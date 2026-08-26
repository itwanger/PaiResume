package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.*;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.entity.UserAuthIdentity;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.mapper.UserAuthIdentityMapper;
import com.itwanger.pairesume.security.JwtTokenProvider;
import com.itwanger.pairesume.security.LegalConsentPolicy;
import com.itwanger.pairesume.service.AuthService;
import com.itwanger.pairesume.service.MailService;
import com.itwanger.pairesume.service.LoginRateLimitService;
import com.itwanger.pairesume.service.VerificationCodeService;
import com.itwanger.pairesume.service.VipInviteService;
import com.itwanger.pairesume.util.DateTimeUtils;
import com.itwanger.pairesume.wechat.WechatReauthProofStore;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class AuthServiceImpl implements AuthService {

    private static final String EMAIL_PASSWORD_PROVIDER = "EMAIL_PASSWORD";
    private static final String WECHAT_SERVICE_PROVIDER = "WECHAT_SERVICE";

    private static final DefaultRedisScript<Long> CONSUME_REFRESH_TOKEN_SCRIPT =
            new DefaultRedisScript<>("""
                    local stored = redis.call('GET', KEYS[1])
                    if stored and stored == ARGV[1] and redis.call('EXISTS', KEYS[4]) == 0 then
                      redis.call('DEL', KEYS[1])
                      redis.call('SREM', KEYS[2], KEYS[1])
                      return 1
                    end
                    local members = redis.call('SMEMBERS', KEYS[2])
                    for _, key in ipairs(members) do
                      redis.call('DEL', key)
                    end
                    redis.call('DEL', KEYS[2])
                    redis.call('SREM', KEYS[3], KEYS[2])
                    redis.call('SET', KEYS[4], '1', 'EX', ARGV[2])
                    return 0
                    """, Long.class);

    private static final DefaultRedisScript<Long> STORE_REFRESH_TOKEN_SCRIPT =
            new DefaultRedisScript<>("""
                    if redis.call('EXISTS', KEYS[4]) == 1 then
                      return 0
                    end
                    redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
                    redis.call('SADD', KEYS[2], KEYS[1])
                    redis.call('EXPIRE', KEYS[2], ARGV[2])
                    redis.call('SADD', KEYS[3], KEYS[2])
                    redis.call('EXPIRE', KEYS[3], ARGV[2])
                    return 1
                    """, Long.class);

    private static final DefaultRedisScript<Long> REVOKE_REFRESH_FAMILY_SCRIPT =
            new DefaultRedisScript<>("""
                    local members = redis.call('SMEMBERS', KEYS[1])
                    for _, key in ipairs(members) do
                      redis.call('DEL', key)
                    end
                    redis.call('DEL', KEYS[1])
                    redis.call('SREM', KEYS[2], KEYS[1])
                    redis.call('SET', KEYS[3], '1', 'EX', ARGV[1])
                    return #members
                    """, Long.class);

    private final UserMapper userMapper;
    private final UserAuthIdentityMapper userAuthIdentityMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final StringRedisTemplate redisTemplate;
    private final MailService mailService;
    private final VerificationCodeService verificationCodeService;
    private final LoginRateLimitService loginRateLimitService;
    private final VipInviteService vipInviteService;
    private final JdbcTemplate jdbcTemplate;
    private final WechatReauthProofStore wechatReauthProofStore;
    @Autowired(required = false)
    private ResumePhotoService resumePhotoService;

    @Value("${jwt.access-token-expiration}")
    private long accessTokenExpiration;

    @Value("${jwt.refresh-token-expiration}")
    private long refreshTokenExpiration;

    @Value("${app.marketplace.enabled:false}")
    private boolean marketplaceEnabled;

    @Autowired
    public AuthServiceImpl(UserMapper userMapper, UserAuthIdentityMapper userAuthIdentityMapper,
                           PasswordEncoder passwordEncoder, JwtTokenProvider jwtTokenProvider,
                           StringRedisTemplate redisTemplate, MailService mailService,
                           VerificationCodeService verificationCodeService,
                           LoginRateLimitService loginRateLimitService,
                           VipInviteService vipInviteService,
                           JdbcTemplate jdbcTemplate,
                           WechatReauthProofStore wechatReauthProofStore) {
        this.userMapper = userMapper;
        this.userAuthIdentityMapper = userAuthIdentityMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.redisTemplate = redisTemplate;
        this.mailService = mailService;
        this.verificationCodeService = verificationCodeService;
        this.loginRateLimitService = loginRateLimitService;
        this.vipInviteService = vipInviteService;
        this.jdbcTemplate = jdbcTemplate;
        this.wechatReauthProofStore = wechatReauthProofStore;
    }

    AuthServiceImpl(UserMapper userMapper, UserAuthIdentityMapper userAuthIdentityMapper,
                    PasswordEncoder passwordEncoder, JwtTokenProvider jwtTokenProvider,
                    StringRedisTemplate redisTemplate, MailService mailService,
                    VerificationCodeService verificationCodeService,
                    LoginRateLimitService loginRateLimitService,
                    VipInviteService vipInviteService, JdbcTemplate jdbcTemplate) {
        this(userMapper, userAuthIdentityMapper, passwordEncoder, jwtTokenProvider,
                redisTemplate, mailService, verificationCodeService,
                loginRateLimitService, vipInviteService, jdbcTemplate, null);
    }

    AuthServiceImpl(UserMapper userMapper, UserAuthIdentityMapper userAuthIdentityMapper,
                    PasswordEncoder passwordEncoder, JwtTokenProvider jwtTokenProvider,
                    StringRedisTemplate redisTemplate, MailService mailService,
                    VerificationCodeService verificationCodeService,
                    LoginRateLimitService loginRateLimitService,
                    VipInviteService vipInviteService) {
        this(userMapper, userAuthIdentityMapper, passwordEncoder, jwtTokenProvider,
                redisTemplate, mailService, verificationCodeService,
                loginRateLimitService, vipInviteService, null, null);
    }

    @Override
    @Transactional
    public TokenDTO register(RegisterDTO dto, String clientIp) {
        if (dto == null || !dto.isTermsAccepted() || !dto.isPrivacyAccepted()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请阅读并同意服务条款与隐私政策");
        }
        String normalizedEmail = normalizeEmail(dto.getEmail());

        var verificationResult = verificationCodeService.consumeRegistrationCode(
                normalizedEmail,
                dto.getVerificationCode()
        );
        if (verificationResult == VerificationCodeService.ConsumeResult.ATTEMPTS_EXCEEDED) {
            throw new BusinessException(ResultCode.VERIFY_CODE_ATTEMPTS_EXCEEDED);
        }
        if (verificationResult != VerificationCodeService.ConsumeResult.VERIFIED) {
            throw new BusinessException(ResultCode.VERIFY_CODE_ERROR);
        }

        var exists = userMapper.selectCount(
                new LambdaQueryWrapper<User>().eq(User::getEmail, normalizedEmail)
        );
        if (exists > 0) {
            throw new BusinessException(ResultCode.EMAIL_EXISTS);
        }

        var user = new User();
        try {
            user.setEmail(normalizedEmail);
            user.setPassword(passwordEncoder.encode(dto.getPassword()));
            user.setNickname("");
            user.setAvatar("");
            user.setRole(0);
            user.setStatus(1);
            user.setMembershipStatus("FREE");
            LocalDateTime acceptedAt = LocalDateTime.now();
            user.setTermsAcceptedAt(acceptedAt);
            user.setPrivacyAcceptedAt(acceptedAt);
            user.setTermsVersion(LegalConsentPolicy.CURRENT_VERSION);
            user.setPrivacyVersion(LegalConsentPolicy.CURRENT_VERSION);
            user.setAiProcessingDisclosureVersion(LegalConsentPolicy.CURRENT_VERSION);
            userMapper.insert(user);

            var identity = new UserAuthIdentity();
            identity.setUserId(user.getId());
            identity.setProvider("EMAIL_PASSWORD");
            identity.setPrincipal(normalizedEmail);
            identity.setCredentialHash(user.getPassword());
            identity.setVerifiedAt(LocalDateTime.now());
            identity.setStatus(1);
            userAuthIdentityMapper.insert(identity);
        } catch (DuplicateKeyException exception) {
            throw new BusinessException(ResultCode.EMAIL_EXISTS);
        }

        if (StringUtils.hasText(dto.getInviteCode())) {
            vipInviteService.redeem(user.getId(), dto.getInviteCode(), clientIp);
            user = userMapper.selectById(user.getId());
            if (user == null) {
                throw new BusinessException(ResultCode.USER_NOT_FOUND);
            }
        }

        return generateTokenPair(user);
    }

    @Override
    public TokenDTO login(LoginDTO dto, String clientIp) {
        String normalizedEmail = normalizeEmail(dto.getEmail());
        loginRateLimitService.acquireAttempt(normalizedEmail, clientIp);
        var identity = userAuthIdentityMapper.selectOne(
            new LambdaQueryWrapper<UserAuthIdentity>()
                .eq(UserAuthIdentity::getProvider, "EMAIL_PASSWORD")
                .eq(UserAuthIdentity::getPrincipal, normalizedEmail)
                .eq(UserAuthIdentity::getStatus, 1)
                .last("LIMIT 1")
        );

        if (identity == null || identity.getCredentialHash() == null
                || !passwordEncoder.matches(dto.getPassword(), identity.getCredentialHash())) {
            throw new BusinessException(ResultCode.LOGIN_FAILED);
        }

        var user = userMapper.selectById(identity.getUserId());
        if (user == null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        if (user.getStatus() == 0) {
            throw new BusinessException(ResultCode.ACCOUNT_LOCKED);
        }

        identity.setLastLoginAt(LocalDateTime.now());
        userAuthIdentityMapper.updateById(identity);
        loginRateLimitService.recordSuccess(normalizedEmail);
        return generateTokenPair(user);
    }

    @Override
    public TokenDTO refreshToken(String refreshToken) {
        if (!jwtTokenProvider.validateRefreshToken(refreshToken)) {
            throw new BusinessException(ResultCode.REFRESH_TOKEN_INVALID);
        }

        var userId = jwtTokenProvider.getUserIdFromToken(refreshToken);
        var jti = jwtTokenProvider.getJtiFromToken(refreshToken);
        var sessionId = jwtTokenProvider.getSessionIdFromToken(refreshToken);

        Long consumed = redisTemplate.execute(
                CONSUME_REFRESH_TOKEN_SCRIPT,
                List.of(
                        refreshTokenKey(userId, jti),
                        refreshFamilyKey(userId, sessionId),
                        refreshUserIndexKey(userId),
                        refreshRevokedFamilyKey(userId, sessionId)
                ),
                tokenDigest(refreshToken),
                String.valueOf(refreshTokenTtlSeconds())
        );
        if (consumed == null || consumed != 1L) {
            throw new BusinessException(ResultCode.REFRESH_TOKEN_EXPIRED);
        }

        // 获取用户信息生成新 token
        var user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        if (user.getStatus() == null || user.getStatus() == 0 || user.getAccountDeletedAt() != null) {
            revokeRefreshFamily(userId, sessionId);
            throw new BusinessException(ResultCode.ACCOUNT_LOCKED);
        }

        return generateTokenPair(user, sessionId);
    }

    @Override
    public UserInfoDTO getCurrentUserInfo(Long userId) {
        var user = userMapper.selectById(userId);
        if (user == null || user.getStatus() == null || user.getStatus() == 0
                || user.getAccountDeletedAt() != null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        return buildUserInfo(user);
    }

    @Override
    @Transactional
    public UserInfoDTO updateProfile(Long userId, AccountProfileUpdateDTO dto) {
        User user = userMapper.selectByIdForUpdate(userId);
        if (user == null || user.getStatus() == null || user.getStatus() == 0
                || user.getAccountDeletedAt() != null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }

        String nickname = dto.getNickname() == null ? "" : dto.getNickname().strip();
        if (nickname.isBlank() || nickname.length() > 64
                || nickname.codePoints().anyMatch(Character::isISOControl)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请输入正确的昵称");
        }

        user.setNickname(nickname);
        if (dto.getAvatarPhotoId() != null) {
            if (resumePhotoService == null) {
                throw new BusinessException(ResultCode.RESUME_PHOTO_UPLOAD_INVALID);
            }
            resumePhotoService.access(userId, dto.getAvatarPhotoId());
            user.setAvatar(resumePhotoService.storedReference(dto.getAvatarPhotoId()));
        } else if (dto.isRemoveAvatar()) {
            user.setAvatar("");
        }
        userMapper.updateById(user);
        return buildUserInfo(user);
    }

    @Override
    public void logout(Long userId, String accessToken) {
        var jti = jwtTokenProvider.getJtiFromToken(accessToken);
        var expiration = jwtTokenProvider.getExpirationFromToken(accessToken);

        // 将 access token 加入黑名单
        var remainingSeconds = (expiration.getTime() - System.currentTimeMillis()) / 1000;
        if (remainingSeconds > 0) {
            redisTemplate.opsForValue().set("blacklist:" + jti, "1", remainingSeconds, TimeUnit.SECONDS);
        }

        revokeRefreshFamily(userId, jwtTokenProvider.getSessionIdFromToken(accessToken));
    }

    @Override
    public void sendVerificationCode(String email, String clientIp) {
        String normalizedEmail = normalizeEmail(email);
        String code = verificationCodeService.issueRegistrationCode(normalizedEmail, clientIp);
        try {
            mailService.sendVerificationCode(normalizedEmail, code);
        } catch (RuntimeException exception) {
            verificationCodeService.rollbackRegistrationCode(normalizedEmail);
            throw exception;
        }
        log.info("Registration verification email accepted for delivery to {}", maskEmail(normalizedEmail));
    }

    @Override
    public void requestPasswordReset(String email, String clientIp) {
        String normalizedEmail = normalizeEmail(email);
        var identity = findActiveEmailIdentity(normalizedEmail);
        if (identity == null) {
            log.info("Password reset requested for an unregistered email fingerprint");
            return;
        }

        String code = verificationCodeService.issuePasswordResetCode(normalizedEmail, clientIp);
        try {
            mailService.sendPasswordResetCode(normalizedEmail, code);
            log.info("Password reset email accepted for delivery to {}", maskEmail(normalizedEmail));
        } catch (RuntimeException exception) {
            verificationCodeService.rollbackPasswordResetCode(normalizedEmail);
            log.warn("Password reset email delivery failed for {}", maskEmail(normalizedEmail));
        }
    }

    @Override
    @Transactional
    public void resetPassword(PasswordResetConfirmDTO dto) {
        String normalizedEmail = normalizeEmail(dto.getEmail());
        var verificationResult = verificationCodeService.consumePasswordResetCode(
                normalizedEmail,
                dto.getVerificationCode()
        );
        if (verificationResult != VerificationCodeService.ConsumeResult.VERIFIED) {
            throw new BusinessException(ResultCode.PASSWORD_RESET_CODE_ERROR);
        }

        var identity = findActiveEmailIdentity(normalizedEmail);
        if (identity == null) {
            throw new BusinessException(ResultCode.PASSWORD_RESET_CODE_ERROR);
        }
        var user = userMapper.selectByIdForUpdate(identity.getUserId());
        if (user == null || user.getStatus() == null || user.getStatus() == 0
                || user.getAccountDeletedAt() != null) {
            throw new BusinessException(ResultCode.PASSWORD_RESET_CODE_ERROR);
        }

        String encodedPassword = passwordEncoder.encode(dto.getNewPassword());
        identity.setCredentialHash(encodedPassword);
        userAuthIdentityMapper.updateById(identity);
        user.setPassword(encodedPassword);
        userMapper.updateById(user);
        invalidateAllSessions(user.getId());
        markCredentialsChanged(user.getId());
        log.info("Password reset completed for userId={}", user.getId());
    }

    @Override
    public void requestEmailBinding(Long userId, EmailBindingCodeDTO dto, String clientIp) {
        User user = requireActiveUser(userId);
        if (StringUtils.hasText(user.getEmail()) || findActiveEmailIdentityByUserId(userId) != null) {
            throw new BusinessException(ResultCode.EMAIL_ALREADY_BOUND);
        }

        String normalizedEmail = normalizeEmail(dto.getEmail());
        if (findActiveEmailIdentity(normalizedEmail) != null
                || userMapper.selectCount(new LambdaQueryWrapper<User>().eq(User::getEmail, normalizedEmail)) > 0) {
            throw new BusinessException(ResultCode.EMAIL_IDENTITY_CONFLICT);
        }

        String code = verificationCodeService.issueEmailBindingCode(normalizedEmail, clientIp);
        try {
            mailService.sendEmailBindingCode(normalizedEmail, code);
        } catch (RuntimeException exception) {
            verificationCodeService.rollbackEmailBindingCode(normalizedEmail);
            throw exception;
        }
        log.info("Email binding verification accepted for delivery to userId={}, email={}",
                userId, maskEmail(normalizedEmail));
    }

    @Override
    @Transactional
    public UserInfoDTO bindEmail(Long userId, EmailBindingConfirmDTO dto) {
        User user = userMapper.selectByIdForUpdate(userId);
        if (user == null || user.getStatus() == null || user.getStatus() == 0
                || user.getAccountDeletedAt() != null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        if (StringUtils.hasText(user.getEmail()) || findActiveEmailIdentityByUserId(userId) != null) {
            throw new BusinessException(ResultCode.EMAIL_ALREADY_BOUND);
        }

        String normalizedEmail = normalizeEmail(dto.getEmail());
        if (findActiveEmailIdentity(normalizedEmail) != null
                || userMapper.selectCount(new LambdaQueryWrapper<User>().eq(User::getEmail, normalizedEmail)) > 0) {
            throw new BusinessException(ResultCode.EMAIL_IDENTITY_CONFLICT);
        }

        VerificationCodeService.ConsumeResult verificationResult =
                verificationCodeService.consumeEmailBindingCode(normalizedEmail, dto.getVerificationCode());
        if (verificationResult == VerificationCodeService.ConsumeResult.ATTEMPTS_EXCEEDED) {
            throw new BusinessException(ResultCode.VERIFY_CODE_ATTEMPTS_EXCEEDED);
        }
        if (verificationResult != VerificationCodeService.ConsumeResult.VERIFIED) {
            throw new BusinessException(ResultCode.VERIFY_CODE_ERROR);
        }

        String encodedPassword = passwordEncoder.encode(dto.getPassword());
        try {
            user.setEmail(normalizedEmail);
            user.setPassword(encodedPassword);
            userMapper.updateById(user);

            UserAuthIdentity identity = new UserAuthIdentity();
            identity.setUserId(userId);
            identity.setProvider(EMAIL_PASSWORD_PROVIDER);
            identity.setPrincipal(normalizedEmail);
            identity.setCredentialHash(encodedPassword);
            identity.setVerifiedAt(LocalDateTime.now());
            identity.setStatus(1);
            userAuthIdentityMapper.insert(identity);
        } catch (DuplicateKeyException exception) {
            throw new BusinessException(ResultCode.EMAIL_IDENTITY_CONFLICT);
        }

        log.info("Email login enabled for userId={}, email={}", userId, maskEmail(normalizedEmail));
        return buildUserInfo(user);
    }

    @Override
    @Transactional
    public UserInfoDTO acceptLegalConsent(Long userId, LegalConsentDTO dto) {
        if (dto == null || !dto.isTermsAccepted() || !dto.isPrivacyAccepted()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请阅读并同意服务条款与隐私政策");
        }
        var user = userMapper.selectByIdForUpdate(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        if (user.getAccountDeletedAt() != null || user.getStatus() == null || user.getStatus() == 0) {
            throw new BusinessException(ResultCode.ACCOUNT_ALREADY_DELETED);
        }
        applyCurrentLegalConsent(user, LocalDateTime.now());
        userMapper.updateById(user);
        return buildUserInfo(user);
    }

    @Override
    @Transactional
    public void deleteAccount(Long userId, AccountDeletionDTO dto) {
        if (dto == null || !"注销账号".equals(dto.getConfirmation())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请输入“注销账号”确认操作");
        }
        var user = userMapper.selectByIdForUpdate(userId);
        if (user == null || user.getAccountDeletedAt() != null || user.getStatus() == null || user.getStatus() == 0) {
            throw new BusinessException(ResultCode.ACCOUNT_ALREADY_DELETED);
        }

        var identity = findActiveEmailIdentityByUserId(userId);
        if (identity != null && (identity.getCredentialHash() == null
                || !StringUtils.hasText(dto.getPassword())
                || !passwordEncoder.matches(dto.getPassword(), identity.getCredentialHash()))) {
            throw new BusinessException(ResultCode.ACCOUNT_DELETION_PASSWORD_INVALID);
        }
        if (jdbcTemplate == null) {
            throw new IllegalStateException("JdbcTemplate is required for account deletion");
        }
        ensureAccountDeletionAllowed(userId);
        if (identity == null) {
            if (wechatReauthProofStore == null) {
                throw new BusinessException(ResultCode.WECHAT_REAUTH_REQUIRED);
            }
            wechatReauthProofStore.consume(userId, dto.getWechatReauthProof());
        }
        String normalizedEmail = StringUtils.hasText(user.getEmail())
                ? normalizeEmail(user.getEmail()) : "";

        // Close every payment attempt tied to this account before removing the
        // seller's public offer. A late provider payment is then routed to the
        // existing refund-review path instead of creating a new sale.
        jdbcTemplate.update("""
                UPDATE resume_view_order
                SET sale_closed_at = COALESCE(sale_closed_at, CURRENT_TIMESTAMP),
                    sale_close_reason = COALESCE(sale_close_reason, 'ACCOUNT_DELETION'),
                    updated_at = CURRENT_TIMESTAMP
                WHERE active_order_key IS NOT NULL
                  AND (seller_user_id = ? OR buyer_user_id = ?)
                """, userId, userId);
        jdbcTemplate.update("""
                INSERT INTO marketplace_governance_audit (
                    listing_id, actor_user_id, actor_type, action, target_type,
                    target_id, from_status, to_status, reason
                )
                SELECT id, ?, 'SYSTEM', 'ACCOUNT_DELETION', 'LISTING',
                       id, publication_status, 'UNPUBLISHED', '作者账号已注销'
                FROM resume_market_listing
                WHERE seller_user_id = ?
                """, userId, userId);
        jdbcTemplate.update("""
                UPDATE resume_market_listing
                SET publication_status = 'UNPUBLISHED',
                    summary = '',
                    tags = JSON_ARRAY(),
                    access_type = 'FREE',
                    price_cents = 0,
                    pending_revision_id = NULL,
                    review_status = CASE
                        WHEN review_status = 'PENDING' THEN 'REJECTED'
                        ELSE review_status
                    END,
                    review_submitted_at = NULL,
                    publish_after_review = 0,
                    public_consent_at = NULL,
                    moderation_reason = CASE
                        WHEN moderation_status = 'SUSPENDED' THEN moderation_reason
                        ELSE '作者账号已注销，停止新销售'
                    END,
                    moderated_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE seller_user_id = ?
                """, userId);
        // Purchased revisions are contractual delivery records and remain
        // addressable through the buyer's entitlement. Revisions that were
        // never sold and are not referenced by an entitlement are removed.
        jdbcTemplate.update("""
                DELETE revision
                FROM resume_market_listing_revision revision
                INNER JOIN resume_market_listing listing
                    ON listing.id = revision.listing_id
                LEFT JOIN resume_view_order sold_order
                    ON sold_order.listing_revision_id = revision.id
                   AND sold_order.order_status IN (
                       'PAID', 'DUPLICATE_PAID', 'REFUND_REQUIRED', 'REFUNDED'
                   )
                LEFT JOIN resume_view_entitlement entitlement
                    ON entitlement.listing_revision_id = revision.id
                WHERE listing.seller_user_id = ?
                  AND sold_order.id IS NULL
                  AND entitlement.id IS NULL
                """, userId);
        jdbcTemplate.update("""
                UPDATE resume_market_listing listing
                SET current_revision_id = (
                        SELECT MAX(revision.id)
                        FROM resume_market_listing_revision revision
                        WHERE revision.listing_id = listing.id
                    ),
                    updated_at = CURRENT_TIMESTAMP
                WHERE listing.seller_user_id = ?
                """, userId);
        jdbcTemplate.update("""
                DELETE rm FROM resume_module rm
                INNER JOIN resume r ON r.id = rm.resume_id
                WHERE r.user_id = ?
                """, userId);
        jdbcTemplate.update("DELETE FROM resume_material_usage WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM user_resume_material WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM user_resume_profile WHERE user_id = ?", userId);
        if (resumePhotoService != null) {
            resumePhotoService.deleteAllForUser(userId);
        }
        jdbcTemplate.update("DELETE FROM ai_optimize_record WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM resume_analysis_record WHERE user_id = ?", userId);
        jdbcTemplate.update("""
                UPDATE resume_review_follow_challenge
                SET challenge_status = CASE WHEN challenge_status = 'ACTIVE' THEN 'EXPIRED' ELSE challenge_status END,
                    active_user_key = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                """, userId);
        // 终态请求只保留计费/审计必需元数据。若邮件已投递，SMTP 接受的
        // 附件副本不可召回，用户提交人工精修申请即触发该处理。
        jdbcTemplate.update("""
                UPDATE resume_review_request
                SET contact_email = CONCAT('deleted-review-', id, '@invalid.local'),
                    snapshot_json = '{}',
                    content_hash = SHA2('{}', 256),
                    pdf_object_key = NULL,
                    pdf_object_etag = NULL,
                    pdf_original_file_name = NULL,
                    pdf_size_bytes = NULL,
                    pdf_sha256 = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                  AND request_status IN ('COMPLETED', 'RETURNED', 'REFUNDED')
                """, userId);
        // 上传票据不是计费凭证；删除账号时直接删除与用户的对象定位关系。
        // OSS 中的随机键对象由 staging/final 生命周期规则按披露期限清理。
        jdbcTemplate.update("DELETE FROM resume_review_upload WHERE user_id = ?", userId);
        if (StringUtils.hasText(normalizedEmail)) {
            jdbcTemplate.update("""
                    UPDATE feedback_submission
                    SET contact_email = CONCAT('deleted+feedback-', id, '@users.invalid'),
                        display_name = '',
                        school_or_company = '',
                        target_role = '',
                        testimonial_text = '',
                        desired_features = NULL,
                        bug_feedback = NULL,
                        consent_to_publish = 0,
                        publish_status = 'UNPUBLISHED',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE LOWER(contact_email) = ?
                    """, normalizedEmail);
            jdbcTemplate.update("""
                    UPDATE coupon_code
                    SET recipient_email = CONCAT('deleted+coupon-', id, '@users.invalid'),
                        status = CASE WHEN status = 'ISSUED' THEN 'INVALID' ELSE status END,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE LOWER(recipient_email) = ?
                    """, normalizedEmail);
            jdbcTemplate.update("""
                    UPDATE marketplace_listing_report
                    SET contact = NULL,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE LOWER(TRIM(contact)) = ?
                    """, normalizedEmail);
        }
        jdbcTemplate.update("""
                UPDATE resume
                SET status = 0, title = '已删除简历', updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                """, userId);
        jdbcTemplate.update("""
                UPDATE user_auth_identity
                SET credential_hash = NULL,
                    status = 0,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                """, userId);
        String deletedEmail = identity == null ? null : "deleted+" + userId + "@users.invalid";
        String disabledPassword = identity == null
                ? null : passwordEncoder.encode(UUID.randomUUID().toString());
        jdbcTemplate.update("""
                UPDATE `user`
                SET email = ?,
                    password = ?,
                    nickname = '已注销用户',
                    avatar = '',
                    status = 0,
                    membership_status = 'FREE',
                    membership_granted_at = NULL,
                    membership_source = NULL,
                    membership_origin_type = NULL,
                    membership_origin_id = NULL,
                    membership_expires_at = NULL,
                    account_deleted_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, deletedEmail, disabledPassword, userId);

        invalidateAllSessions(userId);
        var valueOperations = redisTemplate.opsForValue();
        if (valueOperations != null) {
            valueOperations.set(accountDisabledKey(userId), "1");
        }
        log.info("Account deletion completed for userId={}", userId);
    }

    @Override
    @Transactional
    public TokenDTO loginOrRegisterPaicongming(
            String appId,
            String openId,
            LocalDateTime subscribedAt
    ) {
        return loginOrRegisterPaicongming(appId, openId, subscribedAt, false, false);
    }

    @Override
    @Transactional
    public TokenDTO loginOrRegisterPaicongming(
            String appId,
            String openId,
            LocalDateTime subscribedAt,
            boolean termsAccepted,
            boolean privacyAccepted
    ) {
        if (termsAccepted != privacyAccepted) {
            throw new BusinessException(
                    ResultCode.BAD_REQUEST.getCode(),
                    "请完整阅读并同意服务条款与隐私政策"
            );
        }
        String principal = wechatPrincipal(appId, openId);
        var identity = findWechatIdentity(principal);
        User user;
        if (identity == null) {
            user = new User();
            user.setEmail(null);
            user.setPassword(null);
            user.setNickname("微信用户");
            user.setAvatar("");
            user.setRole(0);
            user.setStatus(1);
            user.setMembershipStatus("FREE");
            if (termsAccepted) {
                applyCurrentLegalConsent(user, LocalDateTime.now());
            }
            userMapper.insert(user);

            identity = new UserAuthIdentity();
            identity.setUserId(user.getId());
            identity.setProvider(WECHAT_SERVICE_PROVIDER);
            identity.setPrincipal(principal);
            identity.setVerifiedAt(subscribedAt);
            identity.setStatus(1);
            identity.setSubscribed(true);
            identity.setSubscribedAt(subscribedAt);
            identity.setSubscriptionUpdatedAt(subscribedAt);
            try {
                userAuthIdentityMapper.insert(identity);
            } catch (DuplicateKeyException exception) {
                // Roll back the just-created sentinel account. The caller may safely retry the
                // unconsumed exchange and will then resolve the winning identity.
                throw new BusinessException(ResultCode.WECHAT_IDENTITY_CONFLICT);
            }
        } else {
            if (identity.getStatus() == null || identity.getStatus() == 0) {
                throw new BusinessException(ResultCode.ACCOUNT_LOCKED);
            }
            user = requireActiveUser(identity.getUserId());
            identity.setSubscribed(true);
            identity.setSubscribedAt(subscribedAt);
            identity.setUnsubscribedAt(null);
            identity.setSubscriptionUpdatedAt(subscribedAt);
            if (termsAccepted) {
                applyCurrentLegalConsent(user, LocalDateTime.now());
                userMapper.updateById(user);
            }
        }
        identity.setLastLoginAt(LocalDateTime.now());
        userAuthIdentityMapper.updateById(identity);
        return generateTokenPair(user);
    }

    private void applyCurrentLegalConsent(User user, LocalDateTime acceptedAt) {
        user.setTermsAcceptedAt(acceptedAt);
        user.setPrivacyAcceptedAt(acceptedAt);
        user.setTermsVersion(LegalConsentPolicy.CURRENT_VERSION);
        user.setPrivacyVersion(LegalConsentPolicy.CURRENT_VERSION);
        user.setAiProcessingDisclosureVersion(LegalConsentPolicy.CURRENT_VERSION);
    }

    @Override
    @Transactional
    public UserInfoDTO bindPaicongming(
            Long userId,
            String appId,
            String openId,
            LocalDateTime subscribedAt
    ) {
        User user = userMapper.selectByIdForUpdate(userId);
        if (user == null || user.getStatus() == null || user.getStatus() == 0
                || user.getAccountDeletedAt() != null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        String principal = wechatPrincipal(appId, openId);
        var identity = findWechatIdentity(principal);
        var currentWechatIdentity = findWechatIdentityByUserId(userId);
        if (currentWechatIdentity != null
                && !principal.equals(currentWechatIdentity.getPrincipal())) {
            throw new BusinessException(ResultCode.WECHAT_IDENTITY_CONFLICT);
        }
        if (identity != null && !userId.equals(identity.getUserId())) {
            throw new BusinessException(ResultCode.WECHAT_IDENTITY_CONFLICT);
        }
        if (identity != null && (identity.getStatus() == null || identity.getStatus() == 0)) {
            throw new BusinessException(ResultCode.ACCOUNT_LOCKED);
        }
        if (identity == null) {
            identity = new UserAuthIdentity();
            identity.setUserId(userId);
            identity.setProvider(WECHAT_SERVICE_PROVIDER);
            identity.setPrincipal(principal);
            identity.setVerifiedAt(subscribedAt);
            identity.setStatus(1);
            try {
                userAuthIdentityMapper.insert(identity);
            } catch (DuplicateKeyException exception) {
                throw new BusinessException(ResultCode.WECHAT_IDENTITY_CONFLICT);
            }
        }
        identity.setSubscribed(true);
        identity.setSubscribedAt(subscribedAt);
        identity.setUnsubscribedAt(null);
        identity.setSubscriptionUpdatedAt(subscribedAt);
        userAuthIdentityMapper.updateById(identity);
        return buildUserInfo(user);
    }

    @Override
    public void recordPaicongmingSubscription(
            String appId,
            String openId,
            boolean subscribed,
            LocalDateTime eventAt
    ) {
        userAuthIdentityMapper.updateSubscriptionIfNewer(
                wechatPrincipal(appId, openId), subscribed, eventAt
        );
    }

    @Override
    public void verifyPaicongmingReauth(Long userId, String appId, String openId) {
        UserAuthIdentity identity = findWechatIdentity(wechatPrincipal(appId, openId));
        if (identity == null || identity.getStatus() == null || identity.getStatus() == 0
                || !userId.equals(identity.getUserId())
                || !Boolean.TRUE.equals(identity.getSubscribed())) {
            throw new BusinessException(ResultCode.WECHAT_REAUTH_REQUIRED);
        }
        requireActiveUser(userId);
    }

    private void ensureAccountDeletionAllowed(Long userId) {
        Boolean membershipOrderBlocked = jdbcTemplate.queryForObject("""
                SELECT EXISTS(
                    SELECT 1
                    FROM membership_payment_order
                    WHERE user_id = ?
                      AND (
                          order_status IN (
                              'CREATED', 'PREPAYING', 'PREPAY_UNKNOWN',
                              'PENDING', 'EXPIRED', 'REFUND_REQUIRED'
                          )
                          OR review_status IN ('PENDING', 'REFUND_PROCESSING')
                      )
                )
                """, Boolean.class, userId);
        if (Boolean.TRUE.equals(membershipOrderBlocked)) {
            throw new BusinessException(
                    ResultCode.ACCOUNT_DELETION_BLOCKED.getCode(),
                    "请先处理未完成的会员订单或待退款记录后再注销"
            );
        }

        Boolean marketplaceOrderBlocked = jdbcTemplate.queryForObject("""
                SELECT EXISTS(
                    SELECT 1
                    FROM resume_view_order
                    WHERE (buyer_user_id = ? OR seller_user_id = ?)
                      AND order_status IN (
                          'CREATED', 'PREPAYING', 'PREPAY_UNKNOWN', 'PENDING',
                          'EXPIRED', 'DUPLICATE_PAID', 'REFUND_REQUIRED'
                      )
                )
                """, Boolean.class, userId, userId);
        if (Boolean.TRUE.equals(marketplaceOrderBlocked)) {
            throw new BusinessException(
                    ResultCode.ACCOUNT_DELETION_BLOCKED.getCode(),
                    "请先处理未完成的简历市场订单或待退款记录后再注销"
            );
        }

        Boolean resumeReviewBlocked = jdbcTemplate.queryForObject("""
                SELECT EXISTS(
                    SELECT 1
                    FROM resume_review_request
                    WHERE user_id = ?
                      AND request_status IN (
                          'AWAITING_PAYMENT', 'EMAIL_PENDING', 'EMAILED',
                          'ACCEPTED', 'REFUND_REQUIRED'
                      )
                )
                """, Boolean.class, userId);
        if (Boolean.TRUE.equals(resumeReviewBlocked)) {
            throw new BusinessException(
                    ResultCode.ACCOUNT_DELETION_BLOCKED.getCode(),
                    "请先处理正在投递、精修或退款中的人工简历服务后再注销"
            );
        }

        Boolean creatorBalanceBlocked = jdbcTemplate.queryForObject("""
                SELECT (
                    EXISTS(
                        SELECT 1
                        FROM creator_wallet
                        WHERE user_id = ?
                          AND (
                              held_balance_cents <> 0
                              OR pending_balance_cents <> 0
                              OR available_balance_cents <> 0
                              OR debt_balance_cents <> 0
                          )
                    )
                    OR EXISTS(
                        SELECT 1
                        FROM creator_earning
                        WHERE seller_user_id = ?
                          AND earning_status IN ('HOLDING', 'AVAILABLE', 'PENDING_SETTLEMENT')
                    )
                )
                """, Boolean.class, userId, userId);
        if (Boolean.TRUE.equals(creatorBalanceBlocked)) {
            throw new BusinessException(
                    ResultCode.ACCOUNT_DELETION_BLOCKED.getCode(),
                    "请先结清作者收益余额后再注销"
            );
        }
    }

    private TokenDTO generateTokenPair(User user) {
        return generateTokenPair(user, UUID.randomUUID().toString());
    }

    private TokenDTO generateTokenPair(User user, String sessionId) {
        var role = user.getRole() == 1 ? "ADMIN" : "USER";
        var userInfo = buildUserInfo(user);
        var accessToken = jwtTokenProvider.generateAccessToken(
                user.getId(), userInfo.getEmail(), role, sessionId
        );
        var refreshToken = jwtTokenProvider.generateRefreshToken(user.getId(), sessionId);

        var refreshJti = jwtTokenProvider.getJtiFromToken(refreshToken);
        Long stored = redisTemplate.execute(
                STORE_REFRESH_TOKEN_SCRIPT,
                List.of(
                        refreshTokenKey(user.getId(), refreshJti),
                        refreshFamilyKey(user.getId(), sessionId),
                        refreshUserIndexKey(user.getId()),
                        refreshRevokedFamilyKey(user.getId(), sessionId)
                ),
                tokenDigest(refreshToken),
                String.valueOf(refreshTokenTtlSeconds())
        );
        if (stored == null || stored != 1L) {
            throw new BusinessException(ResultCode.REFRESH_TOKEN_INVALID);
        }

        return new TokenDTO(accessToken, refreshToken, accessTokenExpiration / 1000, userInfo);
    }

    private UserInfoDTO buildUserInfo(User user) {
        var role = user.getRole() != null && user.getRole() == 1 ? "ADMIN" : "USER";
        boolean emailLoginEnabled = StringUtils.hasText(user.getEmail());
        var wechatIdentity = findWechatIdentityByUserId(user.getId());
        String avatarUrl = user.getAvatar();
        Long avatarPhotoId = null;
        if (resumePhotoService != null) {
            avatarPhotoId = resumePhotoService.storedPhotoId(user.getAvatar());
            if (avatarPhotoId != null) {
                try {
                    avatarUrl = resumePhotoService.access(user.getId(), avatarPhotoId).accessUrl();
                } catch (RuntimeException exception) {
                    log.warn("Unable to resolve account avatar for userId={}", user.getId());
                    avatarUrl = "";
                }
            }
        }
        UserInfoDTO userInfo = new UserInfoDTO(
                user.getId(),
                emailLoginEnabled ? user.getEmail() : null,
                user.getNickname(),
                avatarUrl,
                role,
                resolveMembershipStatus(user),
                DateTimeUtils.format(user.getMembershipGrantedAt()),
                DateTimeUtils.format(user.getMembershipExpiresAt()),
                "ADMIN".equals(role),
                LegalConsentPolicy.isRequired(user),
                marketplaceEnabled,
                emailLoginEnabled,
                wechatIdentity != null,
                wechatIdentity != null && Boolean.TRUE.equals(wechatIdentity.getSubscribed())
        );
        userInfo.setAvatarPhotoId(avatarPhotoId);
        return userInfo;
    }

    private String resolveMembershipStatus(User user) {
        if (!"ACTIVE".equals(user.getMembershipStatus())) {
            return "FREE";
        }
        return user.getMembershipExpiresAt() == null
                || user.getMembershipExpiresAt().isAfter(LocalDateTime.now())
                ? "ACTIVE"
                : "FREE";
    }

    private UserAuthIdentity findActiveEmailIdentity(String normalizedEmail) {
        return userAuthIdentityMapper.selectOne(
                new LambdaQueryWrapper<UserAuthIdentity>()
                        .eq(UserAuthIdentity::getProvider, EMAIL_PASSWORD_PROVIDER)
                        .eq(UserAuthIdentity::getPrincipal, normalizedEmail)
                        .eq(UserAuthIdentity::getStatus, 1)
                        .last("LIMIT 1")
        );
    }

    private UserAuthIdentity findActiveEmailIdentityByUserId(Long userId) {
        return userAuthIdentityMapper.selectOne(
                new LambdaQueryWrapper<UserAuthIdentity>()
                        .eq(UserAuthIdentity::getUserId, userId)
                        .eq(UserAuthIdentity::getProvider, EMAIL_PASSWORD_PROVIDER)
                        .eq(UserAuthIdentity::getStatus, 1)
                        .last("LIMIT 1")
        );
    }

    private UserAuthIdentity findWechatIdentity(String principal) {
        return userAuthIdentityMapper.selectOne(
                new LambdaQueryWrapper<UserAuthIdentity>()
                        .eq(UserAuthIdentity::getProvider, WECHAT_SERVICE_PROVIDER)
                        .eq(UserAuthIdentity::getPrincipal, principal)
                        .last("LIMIT 1")
        );
    }

    private UserAuthIdentity findWechatIdentityByUserId(Long userId) {
        return userAuthIdentityMapper.selectOne(
                new LambdaQueryWrapper<UserAuthIdentity>()
                        .eq(UserAuthIdentity::getUserId, userId)
                        .eq(UserAuthIdentity::getProvider, WECHAT_SERVICE_PROVIDER)
                        .eq(UserAuthIdentity::getStatus, 1)
                        .last("LIMIT 1")
        );
    }

    private User requireActiveUser(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null || user.getStatus() == null || user.getStatus() == 0
                || user.getAccountDeletedAt() != null) {
            throw new BusinessException(ResultCode.ACCOUNT_LOCKED);
        }
        return user;
    }

    private String wechatPrincipal(String appId, String openId) {
        if (!StringUtils.hasText(appId) || !StringUtils.hasText(openId)
                || appId.contains(":") || openId.contains(":")) {
            throw new BusinessException(ResultCode.WECHAT_BRIDGE_EVENT_INVALID);
        }
        return appId.trim() + ":" + openId.trim();
    }

    private void invalidateAllSessions(Long userId) {
        String userIndexKey = refreshUserIndexKey(userId);
        var setOperations = redisTemplate.opsForSet();
        Set<String> familyKeys = setOperations == null ? null : setOperations.members(userIndexKey);
        if (familyKeys != null) {
            for (String familyKey : familyKeys) {
                Set<String> tokenKeys = setOperations.members(familyKey);
                if (tokenKeys != null && !tokenKeys.isEmpty()) {
                    redisTemplate.delete(tokenKeys);
                }
                redisTemplate.delete(familyKey);
            }
        }
        redisTemplate.delete(userIndexKey);
    }

    private void markCredentialsChanged(Long userId) {
        var valueOperations = redisTemplate.opsForValue();
        if (valueOperations != null) {
            valueOperations.set(
                    credentialsChangedKey(userId),
                    String.valueOf(System.currentTimeMillis()),
                    Duration.ofMillis(Math.max(1L, accessTokenExpiration + 60_000L))
            );
        }
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private String maskEmail(String email) {
        int atIndex = email.indexOf('@');
        if (atIndex <= 1) {
            return "***";
        }
        return email.charAt(0) + "***" + email.substring(atIndex);
    }

    private void revokeRefreshFamily(Long userId, String sessionId) {
        redisTemplate.execute(
                REVOKE_REFRESH_FAMILY_SCRIPT,
                List.of(
                        refreshFamilyKey(userId, sessionId),
                        refreshUserIndexKey(userId),
                        refreshRevokedFamilyKey(userId, sessionId)
                ),
                String.valueOf(refreshTokenTtlSeconds())
        );
    }

    private long refreshTokenTtlSeconds() {
        return Math.max(1L, (refreshTokenExpiration + 999L) / 1000L);
    }

    private String tokenDigest(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private String refreshTokenKey(Long userId, String jti) {
        return "refresh:token:" + userId + ":" + jti;
    }

    private String refreshFamilyKey(Long userId, String sessionId) {
        return "refresh:family:" + userId + ":" + sessionId;
    }

    private String refreshUserIndexKey(Long userId) {
        return "refresh:user:" + userId;
    }

    private String refreshRevokedFamilyKey(Long userId, String sessionId) {
        return "refresh:revoked:" + userId + ":" + sessionId;
    }

    private String credentialsChangedKey(Long userId) {
        return "auth:credentials-changed:" + userId;
    }

    private String accountDisabledKey(Long userId) {
        return "auth:account-disabled:" + userId;
    }
}
