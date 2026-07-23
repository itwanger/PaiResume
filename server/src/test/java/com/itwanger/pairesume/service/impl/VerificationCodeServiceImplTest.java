package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.service.VerificationCodeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;

import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VerificationCodeServiceImplTest {

    @Mock
    private StringRedisTemplate redisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private VerificationCodeServiceImpl service;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        service = new VerificationCodeServiceImpl(
                redisTemplate,
                "verification-secret-longer-than-thirty-two-characters",
                300,
                60,
                5,
                5,
                20
        );
    }

    @Test
    void issuedCodeIsSixDigitsAndOnlyItsHmacIsStored() {
        when(valueOperations.setIfAbsent(anyString(), eq("1"), any(Duration.class))).thenReturn(true);
        doReturn(1L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));

        String code = service.issueRegistrationCode("user@example.com", "127.0.0.1");

        assertTrue(code.matches("\\d{6}"));
        ArgumentCaptor<String> storedValue = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Duration> ttl = ArgumentCaptor.forClass(Duration.class);
        verify(valueOperations).set(anyString(), storedValue.capture(), ttl.capture());
        assertNotEquals(code, storedValue.getValue());
        assertTrue(storedValue.getValue().matches("[0-9a-f]{64}"));
        assertEquals(Duration.ofSeconds(300), ttl.getValue());
    }

    @Test
    void cooldownIsAcquiredAtomically() {
        when(valueOperations.setIfAbsent(anyString(), eq("1"), any(Duration.class))).thenReturn(false);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.issueRegistrationCode("user@example.com", "127.0.0.1")
        );

        assertEquals(ResultCode.SEND_CODE_TOO_FREQUENT.getCode(), exception.getCode());
        verify(redisTemplate, never()).execute(any(RedisScript.class), anyList(), any(Object[].class));
    }

    @Test
    void consumeResultMapsRedisAtomicOutcomes() {
        doReturn(-2L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));

        assertEquals(
                VerificationCodeService.ConsumeResult.ATTEMPTS_EXCEEDED,
                service.consumeRegistrationCode("user@example.com", "123456")
        );
    }

    @Test
    void passwordResetCodeUsesAnIndependentNamespace() {
        when(valueOperations.setIfAbsent(anyString(), eq("1"), any(Duration.class))).thenReturn(true);
        doReturn(1L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));

        String code = service.issuePasswordResetCode("user@example.com", "127.0.0.1");

        assertTrue(code.matches("\\d{6}"));
        verify(valueOperations).set(
                startsWith("verify:password-reset:code:"),
                argThat(stored -> stored.matches("[0-9a-f]{64}")),
                eq(Duration.ofSeconds(300))
        );
    }

    @Test
    void resumeReviewContactCodeUsesIndependentOneTimeNamespace() {
        when(valueOperations.setIfAbsent(anyString(), eq("1"), any(Duration.class))).thenReturn(true);
        doReturn(1L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));

        String code = service.issueResumeReviewContactCode("contact@example.net", "127.0.0.1");

        assertTrue(code.matches("\\d{6}"));
        verify(valueOperations).set(
                startsWith("verify:resume-review-contact:code:"),
                argThat(stored -> stored.matches("[0-9a-f]{64}")),
                eq(Duration.ofSeconds(300))
        );

        service.consumeResumeReviewContactCode("contact@example.net", code);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> keys = ArgumentCaptor.forClass(List.class);
        verify(redisTemplate, atLeastOnce()).execute(
                any(RedisScript.class), keys.capture(), any(Object[].class));
        assertTrue(keys.getAllValues().stream().flatMap(List::stream)
                .anyMatch(key -> key.startsWith("verify:resume-review-contact:code:")));
    }
}
