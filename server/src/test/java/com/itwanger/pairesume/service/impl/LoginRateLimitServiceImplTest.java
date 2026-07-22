package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LoginRateLimitServiceImplTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Test
    void rejectedAtomicAttemptReturnsRateLimitError() {
        doReturn(0L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));
        var service = new LoginRateLimitServiceImpl(redisTemplate, 900, 10, 100);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.acquireAttempt("user@example.com", "127.0.0.1")
        );

        assertEquals(ResultCode.LOGIN_TOO_MANY_ATTEMPTS.getCode(), exception.getCode());
    }

    @Test
    void successfulLoginClearsOnlyTheEmailFailureBudget() {
        var service = new LoginRateLimitServiceImpl(redisTemplate, 900, 10, 100);

        service.recordSuccess("user@example.com");

        verify(redisTemplate).delete(startsWith("login:attempts:email:"));
    }
}
