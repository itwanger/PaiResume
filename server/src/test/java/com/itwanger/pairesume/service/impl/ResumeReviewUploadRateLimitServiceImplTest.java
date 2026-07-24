package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumeReviewUploadRateLimitProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ResumeReviewUploadRateLimitServiceImplTest {
    @Mock private StringRedisTemplate redisTemplate;

    @Test
    void rejectedAttemptReturnsUploadRateLimitError() {
        doReturn(0L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));
        var service = new ResumeReviewUploadRateLimitServiceImpl(
                redisTemplate, properties());

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.acquireAttempt("complete", 7L, "127.0.0.1"));

        assertEquals(ResultCode.RESUME_REVIEW_UPLOAD_RATE_LIMITED.getCode(),
                exception.getCode());
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void attemptUsesSeparateActionBudgetsWithoutPlainUserOrIp() {
        doReturn(1L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));
        var service = new ResumeReviewUploadRateLimitServiceImpl(
                redisTemplate, properties());

        service.acquireAttempt("authorize", 7L, "203.0.113.8");

        ArgumentCaptor<List> keysCaptor = ArgumentCaptor.forClass(List.class);
        verify(redisTemplate).execute(
                any(RedisScript.class), keysCaptor.capture(), any(Object[].class));
        List<String> keys = keysCaptor.getValue();
        assertEquals(2, keys.size());
        assertTrue(keys.get(0).startsWith(
                "resume-review-upload:attempts:authorize:account:"));
        assertTrue(keys.get(1).startsWith(
                "resume-review-upload:attempts:authorize:ip:"));
        assertFalse(keys.get(0).endsWith(":7"));
        assertFalse(keys.get(1).contains("203.0.113.8"));
    }

    private ResumeReviewUploadRateLimitProperties properties() {
        ResumeReviewUploadRateLimitProperties properties =
                new ResumeReviewUploadRateLimitProperties();
        properties.setWindowSeconds(900);
        properties.setAccountAttemptLimit(20);
        properties.setIpAttemptLimit(200);
        return properties;
    }
}
