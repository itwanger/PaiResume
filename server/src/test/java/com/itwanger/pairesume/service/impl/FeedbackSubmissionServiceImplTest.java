package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.dto.FeedbackSubmissionCreateDTO;
import com.itwanger.pairesume.mapper.FeedbackSubmissionMapper;
import com.itwanger.pairesume.service.CouponService;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FeedbackSubmissionServiceImplTest {
    @Mock private FeedbackSubmissionMapper feedbackSubmissionMapper;
    @Mock private CouponService couponService;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;

    @Test
    void rateLimitKeysDoNotContainRawEmailOrIpAddress() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(anyString())).thenReturn(1L);
        FeedbackSubmissionServiceImpl service = new FeedbackSubmissionServiceImpl(
                feedbackSubmissionMapper, couponService, redisTemplate);

        service.submit(validSubmission(), "203.0.113.8");

        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        verify(valueOperations, times(2)).increment(keyCaptor.capture());
        assertTrue(keyCaptor.getAllValues().stream().allMatch(key -> key.matches(
                "feedback:(email|ip):[0-9a-f]{32}")));
        assertFalse(keyCaptor.getAllValues().stream().anyMatch(key ->
                key.contains("person@example.org") || key.contains("203.0.113.8")));
        verify(redisTemplate, times(2)).expire(anyString(), anyLong(), eq(TimeUnit.HOURS));
    }

    @Test
    void rejectsOversizedPublicFeedbackBeforePersistence() {
        FeedbackSubmissionCreateDTO dto = validSubmission();
        dto.setTestimonialText("x".repeat(2001));

        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var violations = factory.getValidator().validate(dto);
            assertTrue(violations.stream().anyMatch(violation ->
                    "testimonialText".equals(violation.getPropertyPath().toString())));
        }
    }

    private FeedbackSubmissionCreateDTO validSubmission() {
        FeedbackSubmissionCreateDTO dto = new FeedbackSubmissionCreateDTO();
        dto.setContactEmail("person@example.org");
        dto.setDisplayName("求职者");
        dto.setSchoolOrCompany("示例公司");
        dto.setTargetRole("Java 开发");
        dto.setRating(5);
        dto.setTestimonialText("产品体验很好");
        dto.setDesiredFeatures("希望继续优化编辑体验");
        dto.setBugFeedback("");
        dto.setConsentToPublish(true);
        return dto;
    }
}
