package com.itwanger.pairesume.wechat;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WechatReauthProofStoreTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;

    @Test
    void proofIsHighEntropyStoredByDigestAndConsumedOnce() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        var store = new WechatReauthProofStore(redisTemplate, new WechatBridgeSigner());

        String proof = store.issue(7L);

        assertTrue(proof.matches("[A-Za-z0-9_-]{43}"));
        verify(valueOperations).set(
                org.mockito.ArgumentMatchers.startsWith("auth:wechat:reauth-proof:"),
                eq("7"),
                eq(java.time.Duration.ofSeconds(WechatReauthProofStore.PROOF_TTL_SECONDS))
        );
        org.mockito.Mockito.doReturn(1L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));
        store.consume(7L, proof);
    }

    @Test
    void missingOrAlreadyConsumedProofCannotDeleteAccount() {
        var store = new WechatReauthProofStore(redisTemplate, new WechatBridgeSigner());
        org.mockito.Mockito.doReturn(0L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> store.consume(7L, "A".repeat(43))
        );

        assertEquals(ResultCode.WECHAT_REAUTH_REQUIRED.getCode(), exception.getCode());
        assertThrows(BusinessException.class, () -> store.consume(7L, "short"));
    }
}
