package com.itwanger.pairesume.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.WechatQrAuthProperties;
import com.itwanger.pairesume.dto.TokenDTO;
import com.itwanger.pairesume.dto.UserInfoDTO;
import com.itwanger.pairesume.dto.WechatBridgeEventDTO;
import com.itwanger.pairesume.dto.WechatChallengeCreateDTO;
import com.itwanger.pairesume.dto.LegalConsentDTO;
import com.itwanger.pairesume.dto.WechatChallengeStatusDTO;
import com.itwanger.pairesume.dto.WechatReauthProofDTO;
import com.itwanger.pairesume.service.AuthService;
import com.itwanger.pairesume.service.VipInviteClaimService;
import com.itwanger.pairesume.service.WechatQrAuthService;
import com.itwanger.pairesume.wechat.WechatBridgeSigner;
import com.itwanger.pairesume.wechat.WechatQrGatewayClient;
import com.itwanger.pairesume.wechat.WechatReauthProofStore;
import jakarta.validation.Validator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class WechatQrAuthServiceImpl implements WechatQrAuthService {

    private static final int MAX_BRIDGE_BODY_BYTES = 8 * 1024;
    private static final String PURPOSE_LOGIN = "LOGIN";
    private static final String PURPOSE_BIND = "BIND";
    private static final String PURPOSE_REAUTH = "REAUTH";
    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_CONFIRMED = "CONFIRMED";
    private static final String STATUS_EXCHANGING = "EXCHANGING";
    private static final String STATUS_CONSUMED = "CONSUMED";

    private static final DefaultRedisScript<Long> CONFIRM_CHALLENGE_SCRIPT =
            new DefaultRedisScript<>("""
                    if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
                    if redis.call('HGET', KEYS[1], 'purpose') ~= ARGV[1] then return -2 end
                    local status = redis.call('HGET', KEYS[1], 'status')
                    local principal = redis.call('HGET', KEYS[1], 'principal')
                    if status == 'PENDING' then
                      redis.call('HSET', KEYS[1],
                        'status', 'CONFIRMED',
                        'principal', ARGV[2],
                        'subscribed_at', ARGV[3])
                      return 1
                    end
                    if status == 'CONFIRMED' and principal == ARGV[2] then return 2 end
                    return 0
                    """, Long.class);

    private static final DefaultRedisScript<String> CLAIM_CHALLENGE_SCRIPT =
            new DefaultRedisScript<>("""
                    if redis.call('EXISTS', KEYS[1]) == 0 then return 'ERR:EXPIRED' end
                    if redis.call('HGET', KEYS[1], 'purpose') ~= ARGV[1] then return 'ERR:INVALID' end
                    if redis.call('HGET', KEYS[1], 'poll_hash') ~= ARGV[2] then return 'ERR:INVALID' end
                    if redis.call('HGET', KEYS[1], 'bound_user_id') ~= ARGV[3] then return 'ERR:INVALID' end
                    local status = redis.call('HGET', KEYS[1], 'status')
                    if status == 'PENDING' then return 'ERR:PENDING' end
                    if status == 'CONSUMED' then return 'ERR:CONSUMED' end
                    if status ~= 'CONFIRMED' then return 'ERR:BUSY' end
                    redis.call('HSET', KEYS[1], 'status', 'EXCHANGING', 'claim_id', ARGV[4])
                    return 'OK:' .. redis.call('HGET', KEYS[1], 'principal')
                      .. ':' .. redis.call('HGET', KEYS[1], 'subscribed_at')
                      .. ':' .. (redis.call('HGET', KEYS[1], 'vip_claim_id') or '')
                    """, String.class);

    private static final DefaultRedisScript<Long> FINISH_CHALLENGE_SCRIPT =
            new DefaultRedisScript<>("""
                    if redis.call('HGET', KEYS[1], 'status') == 'EXCHANGING'
                      and redis.call('HGET', KEYS[1], 'claim_id') == ARGV[1] then
                      redis.call('HSET', KEYS[1], 'status', 'CONSUMED')
                      redis.call('HDEL', KEYS[1], 'claim_id', 'principal', 'subscribed_at', 'vip_claim_id')
                      return 1
                    end
                    return 0
                    """, Long.class);

    private static final DefaultRedisScript<Long> RELEASE_CHALLENGE_SCRIPT =
            new DefaultRedisScript<>("""
                    if redis.call('HGET', KEYS[1], 'status') == 'EXCHANGING'
                      and redis.call('HGET', KEYS[1], 'claim_id') == ARGV[1] then
                      redis.call('HSET', KEYS[1], 'status', 'CONFIRMED')
                      redis.call('HDEL', KEYS[1], 'claim_id')
                      return 1
                    end
                    return 0
                    """, Long.class);

    private final WechatQrAuthProperties properties;
    private final WechatQrGatewayClient gatewayClient;
    private final WechatBridgeSigner signer;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final Validator validator;
    private final AuthService authService;
    private final WechatReauthProofStore reauthProofStore;
    private final VipInviteClaimService vipInviteClaimService;
    private final SecureRandom secureRandom = new SecureRandom();

    public WechatQrAuthServiceImpl(
            WechatQrAuthProperties properties,
            WechatQrGatewayClient gatewayClient,
            WechatBridgeSigner signer,
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            Validator validator,
            AuthService authService,
            WechatReauthProofStore reauthProofStore,
            VipInviteClaimService vipInviteClaimService
    ) {
        this.properties = properties;
        this.gatewayClient = gatewayClient;
        this.signer = signer;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.validator = validator;
        this.authService = authService;
        this.reauthProofStore = reauthProofStore;
        this.vipInviteClaimService = vipInviteClaimService;
    }

    @Override
    public WechatChallengeCreateDTO createLoginChallenge(String clientIp) {
        return createLoginChallenge(clientIp, null);
    }

    @Override
    public WechatChallengeCreateDTO createLoginChallenge(String clientIp, String claimToken) {
        acquireChallengeCreate(clientIp == null ? "unknown" : "ip:" + clientIp);
        return createChallenge(PURPOSE_LOGIN, null, claimToken);
    }

    @Override
    public WechatChallengeStatusDTO pollLoginChallenge(String challengeId, String pollToken) {
        return pollChallenge(PURPOSE_LOGIN, null, challengeId, pollToken);
    }

    @Override
    public TokenDTO exchangeLoginChallenge(String challengeId, String pollToken) {
        return exchangeLoginChallenge(challengeId, pollToken, null);
    }

    @Override
    public TokenDTO exchangeLoginChallenge(
            String challengeId,
            String pollToken,
            LegalConsentDTO dto
    ) {
        boolean termsAccepted = dto != null && dto.isTermsAccepted();
        boolean privacyAccepted = dto != null && dto.isPrivacyAccepted();
        if (dto != null && (!termsAccepted || !privacyAccepted)) {
            throw new BusinessException(
                    ResultCode.BAD_REQUEST.getCode(),
                    "请完整阅读并同意服务条款与隐私政策"
            );
        }
        ClaimedIdentity claimed = claim(PURPOSE_LOGIN, null, challengeId, pollToken);
        try {
            String[] principal = splitPrincipal(claimed.principal());
            TokenDTO token = dto == null
                    ? authService.loginOrRegisterPaicongming(
                            principal[0], principal[1], claimed.subscribedAt()
                    )
                    : authService.loginOrRegisterPaicongming(
                            principal[0],
                            principal[1],
                            claimed.subscribedAt(),
                            termsAccepted,
                            privacyAccepted
                    );
            bindVipClaimWithoutBlockingLogin(claimed, challengeId, token);
            finish(challengeId, claimed.claimId());
            return token;
        } catch (RuntimeException exception) {
            release(challengeId, claimed.claimId());
            throw exception;
        }
    }

    @Override
    public WechatChallengeCreateDTO createBindChallenge(Long userId, String clientIp) {
        if (userId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        acquireChallengeCreate("user:" + userId + ":ip:" + (clientIp == null ? "unknown" : clientIp));
        return createChallenge(PURPOSE_BIND, userId, null);
    }

    @Override
    public WechatChallengeStatusDTO pollBindChallenge(
            Long userId,
            String challengeId,
            String pollToken
    ) {
        return pollChallenge(PURPOSE_BIND, requireUserId(userId), challengeId, pollToken);
    }

    @Override
    public UserInfoDTO exchangeBindChallenge(
            Long userId,
            String challengeId,
            String pollToken
    ) {
        Long currentUserId = requireUserId(userId);
        ClaimedIdentity claimed = claim(PURPOSE_BIND, currentUserId, challengeId, pollToken);
        try {
            String[] principal = splitPrincipal(claimed.principal());
            UserInfoDTO result = authService.bindPaicongming(
                    currentUserId, principal[0], principal[1], claimed.subscribedAt()
            );
            finish(challengeId, claimed.claimId());
            return result;
        } catch (RuntimeException exception) {
            release(challengeId, claimed.claimId());
            throw exception;
        }
    }

    @Override
    public WechatChallengeCreateDTO createReauthChallenge(Long userId, String clientIp) {
        Long currentUserId = requireUserId(userId);
        acquireChallengeCreate(
                "reauth:user:" + currentUserId + ":ip:" + (clientIp == null ? "unknown" : clientIp)
        );
        return createChallenge(PURPOSE_REAUTH, currentUserId, null);
    }

    @Override
    public WechatChallengeStatusDTO pollReauthChallenge(
            Long userId,
            String challengeId,
            String pollToken
    ) {
        return pollChallenge(PURPOSE_REAUTH, requireUserId(userId), challengeId, pollToken);
    }

    @Override
    public WechatReauthProofDTO exchangeReauthChallenge(
            Long userId,
            String challengeId,
            String pollToken
    ) {
        Long currentUserId = requireUserId(userId);
        ClaimedIdentity claimed = claim(PURPOSE_REAUTH, currentUserId, challengeId, pollToken);
        try {
            String[] principal = splitPrincipal(claimed.principal());
            authService.verifyPaicongmingReauth(currentUserId, principal[0], principal[1]);
            String proof = reauthProofStore.issue(currentUserId);
            finish(challengeId, claimed.claimId());
            return new WechatReauthProofDTO(proof, WechatReauthProofStore.PROOF_TTL_SECONDS);
        } catch (RuntimeException exception) {
            release(challengeId, claimed.claimId());
            throw exception;
        }
    }

    @Override
    public void handleBridgeEvent(String timestamp, String nonce, String signature, byte[] rawBody) {
        requireEnabled();
        properties.requireReady();
        verifyBridgeSignature(timestamp, nonce, signature, rawBody);
        String replayKey = "auth:wechat:bridge-replay:"
                + signer.sha256(timestamp + ":" + nonce);
        var replayOperations = redisTemplate.opsForValue();
        Duration replayTtl = Duration.ofSeconds(properties.getBridgeReplayTtlSeconds());
        Boolean firstDelivery = replayOperations.setIfAbsent(
                replayKey,
                "PROCESSING",
                replayTtl
        );
        if (firstDelivery == null) {
            throw new IllegalStateException("Unable to persist WeChat bridge replay guard");
        }
        if (!firstDelivery) {
            return;
        }

        try {
            WechatBridgeEventDTO event = parseEvent(rawBody);
            if (!properties.getAccountAppId().equals(event.getAppId())) {
                throw new BusinessException(ResultCode.WECHAT_BRIDGE_EVENT_INVALID);
            }
            LocalDateTime eventAt = LocalDateTime.ofInstant(
                    Instant.ofEpochSecond(Long.parseLong(timestamp)), ZoneId.systemDefault()
            );
            boolean subscribed = !"unsubscribe".equalsIgnoreCase(event.getEventType());
            authService.recordPaicongmingSubscription(
                    event.getAppId(), event.getOpenId(), subscribed, eventAt
            );
            if (subscribed && StringUtils.hasText(event.getScene())) {
                SceneChallenge scene = parseScene(event.getScene());
                if (scene != null) {
                    String principal = event.getAppId() + ":" + event.getOpenId();
                    Long confirmation = redisTemplate.execute(
                            CONFIRM_CHALLENGE_SCRIPT,
                            java.util.List.of(challengeKey(scene.challengeId())),
                            scene.purpose(),
                            principal,
                            String.valueOf(eventAt.atZone(ZoneId.systemDefault())
                                    .toInstant().toEpochMilli())
                    );
                    if (confirmation == null) {
                        throw new IllegalStateException("Unable to confirm WeChat challenge");
                    }
                }
            }
            replayOperations.set(replayKey, "DONE", replayTtl);
        } catch (RuntimeException | Error exception) {
            try {
                redisTemplate.delete(replayKey);
            } catch (RuntimeException cleanupException) {
                log.warn("Unable to release WeChat bridge replay guard: errorType={}",
                        cleanupException.getClass().getSimpleName());
            }
            throw exception;
        }
    }

    private WechatChallengeCreateDTO createChallenge(
            String purpose,
            Long boundUserId,
            String vipClaimToken
    ) {
        requireEnabled();
        properties.requireReady();
        String challengeId = randomToken();
        String pollToken = randomToken();
        String scene = sceneFor(purpose, challengeId);
        String key = challengeKey(challengeId);
        long now = Instant.now().getEpochSecond();
        int ttl = properties.getChallengeTtlSeconds();
        Long vipClaimId = null;
        try {
            if (StringUtils.hasText(vipClaimToken)) {
                if (!PURPOSE_LOGIN.equals(purpose)) {
                    throw new BusinessException(ResultCode.WECHAT_CHALLENGE_INVALID);
                }
                vipClaimId = vipInviteClaimService.attachToChallenge(
                        vipClaimToken, challengeId
                );
            }
            Map<String, String> state = new HashMap<>();
            state.put("purpose", purpose);
            state.put("poll_hash", signer.sha256(pollToken));
            state.put("bound_user_id", boundUserId == null ? "" : String.valueOf(boundUserId));
            state.put("status", STATUS_PENDING);
            state.put("created_at", String.valueOf(now));
            state.put("expires_at", String.valueOf(now + ttl));
            state.put("vip_claim_id", vipClaimId == null ? "" : String.valueOf(vipClaimId));
            redisTemplate.opsForHash().putAll(key, state);
            redisTemplate.expire(key, ttl, TimeUnit.SECONDS);
            String qrImageDataUrl = gatewayClient.createTemporaryQr(scene, ttl);
            return new WechatChallengeCreateDTO(challengeId, pollToken, qrImageDataUrl, ttl);
        } catch (BusinessException exception) {
            redisTemplate.delete(key);
            if (vipClaimId != null) {
                vipInviteClaimService.releaseChallenge(vipClaimId, challengeId);
            }
            throw exception;
        } catch (RuntimeException exception) {
            redisTemplate.delete(key);
            if (vipClaimId != null) {
                vipInviteClaimService.releaseChallenge(vipClaimId, challengeId);
            }
            log.warn("Paicongming QR creation failed: errorType={}",
                    exception.getClass().getSimpleName());
            throw new BusinessException(ResultCode.WECHAT_GATEWAY_UNAVAILABLE);
        }
    }

    private WechatChallengeStatusDTO pollChallenge(
            String purpose,
            Long boundUserId,
            String challengeId,
            String pollToken
    ) {
        requireEnabled();
        validateChallengeCredentials(challengeId, pollToken);
        String key = challengeKey(challengeId);
        Map<Object, Object> state = redisTemplate.opsForHash().entries(key);
        if (state == null || state.isEmpty()) {
            return new WechatChallengeStatusDTO(challengeId, "EXPIRED", 0);
        }
        verifyChallengeOwner(state, purpose, boundUserId, pollToken);
        String status = String.valueOf(state.get("status"));
        String publicStatus = switch (status) {
            case STATUS_PENDING -> STATUS_PENDING;
            case STATUS_CONFIRMED, STATUS_EXCHANGING -> STATUS_CONFIRMED;
            case STATUS_CONSUMED -> STATUS_CONSUMED;
            default -> throw new BusinessException(ResultCode.WECHAT_CHALLENGE_INVALID);
        };
        Long ttl = redisTemplate.getExpire(key, TimeUnit.SECONDS);
        return new WechatChallengeStatusDTO(
                challengeId,
                publicStatus,
                ttl == null || ttl < 0 ? 0 : ttl
        );
    }

    private ClaimedIdentity claim(
            String purpose,
            Long boundUserId,
            String challengeId,
            String pollToken
    ) {
        requireEnabled();
        validateChallengeCredentials(challengeId, pollToken);
        String claimId = UUID.randomUUID().toString();
        String result = redisTemplate.execute(
                CLAIM_CHALLENGE_SCRIPT,
                java.util.List.of(challengeKey(challengeId)),
                purpose,
                signer.sha256(pollToken),
                boundUserId == null ? "" : String.valueOf(boundUserId),
                claimId
        );
        if (result == null || result.startsWith("ERR:")) {
            throw switch (result == null ? "ERR:INVALID" : result) {
                case "ERR:EXPIRED" -> new BusinessException(ResultCode.WECHAT_CHALLENGE_EXPIRED);
                case "ERR:PENDING" -> new BusinessException(ResultCode.WECHAT_CHALLENGE_PENDING);
                case "ERR:CONSUMED", "ERR:BUSY" -> new BusinessException(ResultCode.WECHAT_CHALLENGE_CONSUMED);
                default -> new BusinessException(ResultCode.WECHAT_CHALLENGE_INVALID);
            };
        }
        String[] parts = result.split(":", 5);
        if ((parts.length != 4 && parts.length != 5) || !"OK".equals(parts[0])) {
            release(challengeId, claimId);
            throw new BusinessException(ResultCode.WECHAT_CHALLENGE_INVALID);
        }
        try {
            long subscribedAtMillis = Long.parseLong(parts[3]);
            Long vipClaimId = parts.length == 5 && StringUtils.hasText(parts[4])
                    ? Long.parseLong(parts[4]) : null;
            return new ClaimedIdentity(
                    claimId,
                    parts[1] + ":" + parts[2],
                    LocalDateTime.ofInstant(
                            Instant.ofEpochMilli(subscribedAtMillis), ZoneId.systemDefault()
                    ),
                    vipClaimId
            );
        } catch (NumberFormatException exception) {
            release(challengeId, claimId);
            throw new BusinessException(ResultCode.WECHAT_CHALLENGE_INVALID);
        }
    }

    private void finish(String challengeId, String claimId) {
        Long finished = redisTemplate.execute(
                FINISH_CHALLENGE_SCRIPT,
                java.util.List.of(challengeKey(challengeId)),
                claimId
        );
        if (!Long.valueOf(1L).equals(finished)) {
            throw new BusinessException(ResultCode.WECHAT_CHALLENGE_CONSUMED);
        }
    }

    private void release(String challengeId, String claimId) {
        try {
            redisTemplate.execute(
                    RELEASE_CHALLENGE_SCRIPT,
                    java.util.List.of(challengeKey(challengeId)),
                    claimId
            );
        } catch (RuntimeException exception) {
            log.warn("Unable to release WeChat challenge claim: errorType={}",
                    exception.getClass().getSimpleName());
        }
    }

    private void bindVipClaimWithoutBlockingLogin(
            ClaimedIdentity claimed,
            String challengeId,
            TokenDTO token
    ) {
        if (claimed.vipClaimId() == null || token == null || token.getUserInfo() == null
                || token.getUserInfo().getId() == null) {
            return;
        }
        try {
            vipInviteClaimService.bindUserAfterLogin(
                    claimed.vipClaimId(), challengeId, token.getUserInfo().getId()
            );
        } catch (RuntimeException exception) {
            // The QR challenge represents authentication first. A transient or terminal
            // invite failure must never strand a valid login or create another account.
            log.warn("VIP invite claim binding failed after WeChat login: errorType={}",
                    exception.getClass().getSimpleName());
        }
    }

    private void verifyBridgeSignature(
            String timestamp,
            String nonce,
            String signature,
            byte[] rawBody
    ) {
        if (!StringUtils.hasText(timestamp)
                || !StringUtils.hasText(nonce)
                || !nonce.matches("[A-Za-z0-9_-]{16,128}")
                || rawBody == null || rawBody.length == 0 || rawBody.length > MAX_BRIDGE_BODY_BYTES) {
            throw new BusinessException(ResultCode.WECHAT_BRIDGE_SIGNATURE_INVALID);
        }
        long eventEpoch;
        try {
            eventEpoch = Long.parseLong(timestamp);
        } catch (NumberFormatException exception) {
            throw new BusinessException(ResultCode.WECHAT_BRIDGE_SIGNATURE_INVALID);
        }
        long now = Instant.now().getEpochSecond();
        long skew = properties.getBridgeClockSkewSeconds();
        if (eventEpoch < now - skew || eventEpoch > now + skew) {
            throw new BusinessException(ResultCode.WECHAT_BRIDGE_SIGNATURE_INVALID);
        }
        String expected = signer.sign(properties.getBridgeSecret(), timestamp, nonce, rawBody);
        if (!signer.matches(expected, signature)) {
            throw new BusinessException(ResultCode.WECHAT_BRIDGE_SIGNATURE_INVALID);
        }
    }

    private WechatBridgeEventDTO parseEvent(byte[] rawBody) {
        try {
            WechatBridgeEventDTO event = objectMapper.readValue(rawBody, WechatBridgeEventDTO.class);
            if (!validator.validate(event).isEmpty()) {
                throw new BusinessException(ResultCode.WECHAT_BRIDGE_EVENT_INVALID);
            }
            return event;
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException(ResultCode.WECHAT_BRIDGE_EVENT_INVALID);
        }
    }

    private void verifyChallengeOwner(
            Map<Object, Object> state,
            String purpose,
            Long boundUserId,
            String pollToken
    ) {
        String expectedUserId = boundUserId == null ? "" : String.valueOf(boundUserId);
        if (!purpose.equals(String.valueOf(state.get("purpose")))
                || !expectedUserId.equals(String.valueOf(state.get("bound_user_id")))
                || !signer.sha256(pollToken).equals(String.valueOf(state.get("poll_hash")))) {
            throw new BusinessException(ResultCode.WECHAT_CHALLENGE_INVALID);
        }
    }

    private SceneChallenge parseScene(String rawScene) {
        String scene = rawScene.startsWith("qrscene_") ? rawScene.substring(8) : rawScene;
        String loginPrefix = properties.getScenePrefix() + "L_";
        String bindPrefix = properties.getScenePrefix() + "B_";
        String reauthPrefix = properties.getScenePrefix() + "R_";
        if (scene.startsWith(loginPrefix)) {
            return parseSceneId(PURPOSE_LOGIN, scene.substring(loginPrefix.length()));
        }
        if (scene.startsWith(bindPrefix)) {
            return parseSceneId(PURPOSE_BIND, scene.substring(bindPrefix.length()));
        }
        if (scene.startsWith(reauthPrefix)) {
            return parseSceneId(PURPOSE_REAUTH, scene.substring(reauthPrefix.length()));
        }
        return null;
    }

    private SceneChallenge parseSceneId(String purpose, String challengeId) {
        return challengeId.matches("[A-Za-z0-9_-]{43}")
                ? new SceneChallenge(purpose, challengeId) : null;
    }

    private String sceneFor(String purpose, String challengeId) {
        String marker = switch (purpose) {
            case PURPOSE_LOGIN -> "L_";
            case PURPOSE_BIND -> "B_";
            case PURPOSE_REAUTH -> "R_";
            default -> throw new IllegalArgumentException("Unsupported WeChat challenge purpose");
        };
        String scene = properties.getScenePrefix() + marker + challengeId;
        if (scene.length() > 64) {
            throw new IllegalStateException("Paicongming QR scene exceeds the WeChat limit");
        }
        return scene;
    }

    private String[] splitPrincipal(String principal) {
        String[] parts = principal.split(":", 2);
        if (parts.length != 2 || !StringUtils.hasText(parts[0]) || !StringUtils.hasText(parts[1])) {
            throw new BusinessException(ResultCode.WECHAT_CHALLENGE_INVALID);
        }
        return parts;
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private void validateChallengeCredentials(String challengeId, String pollToken) {
        if (challengeId == null || !challengeId.matches("[A-Za-z0-9_-]{43}")
                || pollToken == null || !pollToken.matches("[A-Za-z0-9_-]{43}")) {
            throw new BusinessException(ResultCode.WECHAT_CHALLENGE_INVALID);
        }
    }

    private Long requireUserId(Long userId) {
        if (userId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        return userId;
    }

    private void requireEnabled() {
        if (!properties.isEnabled()) {
            throw new BusinessException(ResultCode.WECHAT_LOGIN_NOT_ENABLED);
        }
    }

    private void acquireChallengeCreate(String subject) {
        requireEnabled();
        properties.requireReady();
        String key = "auth:wechat:create-rate:" + signer.sha256(subject).substring(0, 32);
        Long count = redisTemplate.opsForValue().increment(key);
        if (Long.valueOf(1L).equals(count)) {
            redisTemplate.expire(key, 60, TimeUnit.SECONDS);
        }
        if (count == null || count > properties.getChallengeCreateMinuteLimit()) {
            throw new BusinessException(ResultCode.WECHAT_CHALLENGE_RATE_LIMITED);
        }
    }

    private String challengeKey(String challengeId) {
        return "auth:wechat:challenge:" + challengeId;
    }

    private record SceneChallenge(String purpose, String challengeId) {
    }

    private record ClaimedIdentity(
            String claimId,
            String principal,
            LocalDateTime subscribedAt,
            Long vipClaimId
    ) {
    }
}
