package com.itwanger.pairesume.wechat;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.List;

@Component
public class WechatReauthProofStore {

    public static final long PROOF_TTL_SECONDS = 300;

    private static final DefaultRedisScript<Long> CONSUME_SCRIPT =
            new DefaultRedisScript<>("""
                    local stored = redis.call('GET', KEYS[1])
                    if stored and stored == ARGV[1] then
                      redis.call('DEL', KEYS[1])
                      return 1
                    end
                    return 0
                    """, Long.class);

    private final StringRedisTemplate redisTemplate;
    private final WechatBridgeSigner signer;
    private final SecureRandom secureRandom = new SecureRandom();

    public WechatReauthProofStore(
            StringRedisTemplate redisTemplate,
            WechatBridgeSigner signer
    ) {
        this.redisTemplate = redisTemplate;
        this.signer = signer;
    }

    public String issue(Long userId) {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String proof = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        redisTemplate.opsForValue().set(
                proofKey(proof), String.valueOf(userId), Duration.ofSeconds(PROOF_TTL_SECONDS)
        );
        return proof;
    }

    public void consume(Long userId, String proof) {
        if (proof == null || !proof.matches("[A-Za-z0-9_-]{43}")) {
            throw new BusinessException(ResultCode.WECHAT_REAUTH_REQUIRED);
        }
        Long consumed = redisTemplate.execute(
                CONSUME_SCRIPT,
                List.of(proofKey(proof)),
                String.valueOf(userId)
        );
        if (!Long.valueOf(1L).equals(consumed)) {
            throw new BusinessException(ResultCode.WECHAT_REAUTH_REQUIRED);
        }
    }

    private String proofKey(String proof) {
        return "auth:wechat:reauth-proof:" + signer.sha256(proof);
    }
}
