package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class VipInviteRateLimitServiceImplTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Test
    void rejectedAtomicAttemptReturnsInviteRateLimitError() {
        doReturn(0L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));
        var service = new VipInviteRateLimitServiceImpl(redisTemplate, 900, 5, 50);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.acquireAttempt("user@example.com", "127.0.0.1")
        );

        assertEquals(ResultCode.VIP_INVITE_RATE_LIMITED.getCode(), exception.getCode());
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void attemptUsesHashedAccountAndIpBudgets() {
        doReturn(1L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));
        var service = new VipInviteRateLimitServiceImpl(redisTemplate, 900, 5, 50);

        service.acquireAttempt(" User@Example.com ", " 127.0.0.1 ");

        ArgumentCaptor<List> keysCaptor = ArgumentCaptor.forClass(List.class);
        verify(redisTemplate).execute(
                any(RedisScript.class),
                keysCaptor.capture(),
                any(Object[].class)
        );
        List<String> keys = keysCaptor.getValue();
        assertEquals(2, keys.size());
        assertTrue(keys.get(0).startsWith("vip-invite:attempts:account:"));
        assertTrue(keys.get(1).startsWith("vip-invite:attempts:ip:"));
        assertFalse(keys.get(0).contains("user@example.com"));
        assertFalse(keys.get(1).contains("127.0.0.1"));
    }
}
