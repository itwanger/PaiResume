package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.CreateResumeReviewUploadDTO;
import com.itwanger.pairesume.dto.ResumeReviewUploadAuthorizationDTO;
import com.itwanger.pairesume.dto.ResumeReviewUploadDTO;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumeReviewProperties;
import com.itwanger.pairesume.service.ResumeReviewService;
import com.itwanger.pairesume.service.ResumeReviewUploadRateLimitService;
import com.itwanger.pairesume.service.impl.ResumeReviewUploadCompletionGuard;
import com.itwanger.pairesume.service.impl.ResumeReviewUploadService;
import com.itwanger.pairesume.util.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/resume-reviews/uploads")
@RequiredArgsConstructor
public class ResumeReviewUploadController {
    private final ResumeReviewUploadService uploadService;
    private final ResumeReviewService reviewService;
    private final ResumeReviewUploadRateLimitService rateLimitService;
    private final ResumeReviewUploadCompletionGuard completionGuard;
    private final ResumeReviewProperties properties;

    @PostMapping
    public Result<ResumeReviewUploadAuthorizationDTO> authorize(
            @Valid @RequestBody CreateResumeReviewUploadDTO dto,
            HttpServletRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        requireFeatureEnabled();
        rateLimitService.acquireAttempt("authorize", userId, request.getRemoteAddr());
        var eligibility = reviewService.eligibility(userId);
        if (!eligibility.isEnabled()) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_DISABLED);
        }
        if (!eligibility.isWelcomeFreeAvailable() && !eligibility.isPaidReviewAvailable()) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_PAID_NOT_ENABLED);
        }
        return Result.success(uploadService.authorize(userId, dto));
    }

    @PostMapping("/{uploadNo}/complete")
    public Result<ResumeReviewUploadDTO> complete(@PathVariable String uploadNo,
                                                  HttpServletRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        requireFeatureEnabled();
        rateLimitService.acquireAttempt("complete", userId, request.getRemoteAddr());
        return Result.success(completionGuard.execute(
                () -> uploadService.complete(userId, uploadNo)));
    }

    private void requireFeatureEnabled() {
        if (!properties.isEnabled()) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_DISABLED);
        }
    }
}
