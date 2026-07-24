package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumeReviewOssProperties;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class ResumeReviewUploadCompletionGuardTest {

    @Test
    void rejectsWorkAboveConfiguredConcurrencyWithoutWaiting() throws Exception {
        ResumeReviewOssProperties properties = new ResumeReviewOssProperties();
        properties.setMaxConcurrentFinalizations(1);
        ResumeReviewUploadCompletionGuard guard =
                new ResumeReviewUploadCompletionGuard(properties);
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        Thread first = new Thread(() -> guard.execute(() -> {
            entered.countDown();
            try {
                release.await(5, TimeUnit.SECONDS);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
            return null;
        }));
        first.start();
        assertTrue(entered.await(2, TimeUnit.SECONDS));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> guard.execute(() -> null));
        assertEquals(ResultCode.RESUME_REVIEW_STORAGE_UNAVAILABLE.getCode(),
                exception.getCode());

        release.countDown();
        first.join(2000);
        assertFalse(first.isAlive());
        assertEquals("ok", guard.execute(() -> "ok"));
    }
}
