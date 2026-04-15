package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.ApproveFeedbackSubmissionDTO;
import com.itwanger.pairesume.dto.CouponAdminDTO;
import com.itwanger.pairesume.dto.FeedbackSubmissionAdminDTO;
import com.itwanger.pairesume.dto.FeedbackSubmissionCreateDTO;
import com.itwanger.pairesume.dto.PublishedFeedbackDTO;
import com.itwanger.pairesume.dto.RejectFeedbackSubmissionDTO;
import com.itwanger.pairesume.entity.CouponCode;
import com.itwanger.pairesume.entity.FeedbackSubmission;
import com.itwanger.pairesume.mapper.FeedbackSubmissionMapper;
import com.itwanger.pairesume.service.CouponService;
import com.itwanger.pairesume.service.FeedbackSubmissionService;
import com.itwanger.pairesume.util.DateTimeUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class FeedbackSubmissionServiceImpl implements FeedbackSubmissionService {
    private final FeedbackSubmissionMapper feedbackSubmissionMapper;
    private final CouponService couponService;
    private final StringRedisTemplate redisTemplate;

    @Override
    public void submit(FeedbackSubmissionCreateDTO dto, String sourceIp) {
        enforceRateLimit(dto.getContactEmail(), sourceIp);

        FeedbackSubmission submission = new FeedbackSubmission();
        submission.setContactEmail(dto.getContactEmail().trim().toLowerCase());
        submission.setDisplayName(dto.getDisplayName().trim());
        submission.setSchoolOrCompany(dto.getSchoolOrCompany().trim());
        submission.setTargetRole(dto.getTargetRole().trim());
        submission.setRating(dto.getRating());
        submission.setTestimonialText(dto.getTestimonialText().trim());
        submission.setDesiredFeatures(blankToNull(dto.getDesiredFeatures()));
        submission.setBugFeedback(blankToNull(dto.getBugFeedback()));
        submission.setConsentToPublish(Boolean.TRUE.equals(dto.getConsentToPublish()) ? 1 : 0);
        submission.setReviewStatus("PENDING");
        submission.setPublishStatus("UNPUBLISHED");
        submission.setCouponStatus("PENDING");
        feedbackSubmissionMapper.insert(submission);
    }

    @Override
    public List<FeedbackSubmissionAdminDTO> listAdminSubmissions() {
        return feedbackSubmissionMapper.selectList(
                new LambdaQueryWrapper<FeedbackSubmission>()
                        .orderByAsc(FeedbackSubmission::getReviewStatus)
                        .orderByDesc(FeedbackSubmission::getCreatedAt)
                        .orderByDesc(FeedbackSubmission::getId)
        ).stream().map(this::toAdminDto).toList();
    }

    @Override
    @Transactional
    public FeedbackSubmissionAdminDTO approve(Long submissionId, Long adminUserId, ApproveFeedbackSubmissionDTO dto) {
        FeedbackSubmission submission = getById(submissionId);
        boolean firstApproval = !"APPROVED".equals(submission.getReviewStatus());

        submission.setReviewStatus("APPROVED");
        submission.setReviewNote(blankToNull(dto == null ? null : dto.getReviewNote()));
        submission.setReviewedBy(adminUserId);
        submission.setReviewedAt(LocalDateTime.now());

        CouponCode couponCode = couponService.getByFeedbackSubmissionId(submissionId);
        if (couponCode == null) {
            couponCode = couponService.issueForFeedback(submission);
            submission.setCouponStatus("ISSUED");
        } else {
            submission.setCouponStatus("ISSUED");
            if (firstApproval && couponCode.getEmailSentAt() == null) {
                couponService.resendCoupon(couponCode);
            }
        }
        feedbackSubmissionMapper.updateById(submission);
        return toAdminDto(submission);
    }

    @Override
    @Transactional
    public FeedbackSubmissionAdminDTO reject(Long submissionId, Long adminUserId, RejectFeedbackSubmissionDTO dto) {
        FeedbackSubmission submission = getById(submissionId);
        submission.setReviewStatus("REJECTED");
        submission.setPublishStatus("UNPUBLISHED");
        submission.setCouponStatus("REJECTED");
        submission.setReviewNote(dto.getReviewNote().trim());
        submission.setReviewedBy(adminUserId);
        submission.setReviewedAt(LocalDateTime.now());
        feedbackSubmissionMapper.updateById(submission);
        couponService.invalidateFeedbackCoupon(submissionId);
        return toAdminDto(submission);
    }

    @Override
    public FeedbackSubmissionAdminDTO publish(Long submissionId, Long adminUserId) {
        FeedbackSubmission submission = getById(submissionId);
        if (submission.getConsentToPublish() != 1 || submission.getRating() == null || submission.getRating() < 4
                || !"APPROVED".equals(submission.getReviewStatus())) {
            throw new BusinessException(ResultCode.FEEDBACK_PUBLISH_NOT_ALLOWED);
        }

        submission.setPublishStatus("PUBLISHED");
        submission.setReviewedBy(adminUserId);
        if (submission.getReviewedAt() == null) {
            submission.setReviewedAt(LocalDateTime.now());
        }
        feedbackSubmissionMapper.updateById(submission);
        return toAdminDto(submission);
    }

    @Override
    public FeedbackSubmissionAdminDTO unpublish(Long submissionId, Long adminUserId) {
        FeedbackSubmission submission = getById(submissionId);
        submission.setPublishStatus("UNPUBLISHED");
        submission.setReviewedBy(adminUserId);
        feedbackSubmissionMapper.updateById(submission);
        return toAdminDto(submission);
    }

    @Override
    public FeedbackSubmissionAdminDTO resendCoupon(Long submissionId, Long adminUserId) {
        FeedbackSubmission submission = getById(submissionId);
        CouponCode couponCode = couponService.getByFeedbackSubmissionId(submissionId);
        if (couponCode == null) {
            throw new BusinessException(ResultCode.COUPON_NOT_FOUND);
        }
        couponService.resendCoupon(couponCode);
        submission.setReviewedBy(adminUserId);
        if (submission.getReviewedAt() == null) {
            submission.setReviewedAt(LocalDateTime.now());
        }
        feedbackSubmissionMapper.updateById(submission);
        return toAdminDto(submission);
    }

    @Override
    public List<PublishedFeedbackDTO> listPublishedTestimonials() {
        return feedbackSubmissionMapper.selectList(
                new LambdaQueryWrapper<FeedbackSubmission>()
                        .eq(FeedbackSubmission::getPublishStatus, "PUBLISHED")
                        .eq(FeedbackSubmission::getConsentToPublish, 1)
                        .orderByDesc(FeedbackSubmission::getReviewedAt)
                        .orderByDesc(FeedbackSubmission::getId)
        ).stream().map(this::toPublishedDto).toList();
    }

    private FeedbackSubmission getById(Long submissionId) {
        FeedbackSubmission submission = feedbackSubmissionMapper.selectById(submissionId);
        if (submission == null) {
            throw new BusinessException(ResultCode.FEEDBACK_NOT_FOUND);
        }
        return submission;
    }

    private FeedbackSubmissionAdminDTO toAdminDto(FeedbackSubmission submission) {
        FeedbackSubmissionAdminDTO dto = new FeedbackSubmissionAdminDTO();
        dto.setId(submission.getId());
        dto.setContactEmail(submission.getContactEmail());
        dto.setDisplayName(submission.getDisplayName());
        dto.setSchoolOrCompany(submission.getSchoolOrCompany());
        dto.setTargetRole(submission.getTargetRole());
        dto.setRating(submission.getRating());
        dto.setTestimonialText(submission.getTestimonialText());
        dto.setDesiredFeatures(submission.getDesiredFeatures());
        dto.setBugFeedback(submission.getBugFeedback());
        dto.setConsentToPublish(submission.getConsentToPublish() == 1);
        dto.setReviewStatus(submission.getReviewStatus());
        dto.setPublishStatus(submission.getPublishStatus());
        dto.setCouponStatus(submission.getCouponStatus());
        dto.setReviewNote(submission.getReviewNote());
        dto.setReviewedBy(submission.getReviewedBy());
        dto.setReviewedAt(DateTimeUtils.format(submission.getReviewedAt()));
        dto.setCreatedAt(DateTimeUtils.format(submission.getCreatedAt()));

        CouponCode couponCode = couponService.getByFeedbackSubmissionId(submission.getId());
        if (couponCode != null) {
            CouponAdminDTO couponDto = new CouponAdminDTO();
            couponDto.setId(couponCode.getId());
            couponDto.setCode(couponCode.getCode());
            couponDto.setRecipientEmail(couponCode.getRecipientEmail());
            couponDto.setAmountCents(couponCode.getAmountCents());
            couponDto.setStatus(couponCode.getCouponStatus());
            couponDto.setEmailSentAt(DateTimeUtils.format(couponCode.getEmailSentAt()));
            couponDto.setUsedAt(DateTimeUtils.format(couponCode.getUsedAt()));
            couponDto.setExpiresAt(DateTimeUtils.format(couponCode.getExpiresAt()));
            dto.setCoupon(couponDto);
        }
        return dto;
    }

    private PublishedFeedbackDTO toPublishedDto(FeedbackSubmission submission) {
        PublishedFeedbackDTO dto = new PublishedFeedbackDTO();
        dto.setId(submission.getId());
        dto.setDisplayName(submission.getDisplayName());
        dto.setSchoolOrCompany(submission.getSchoolOrCompany());
        dto.setTargetRole(submission.getTargetRole());
        dto.setRating(submission.getRating());
        dto.setTestimonialText(submission.getTestimonialText());
        dto.setCreatedAt(DateTimeUtils.format(submission.getReviewedAt() != null ? submission.getReviewedAt() : submission.getCreatedAt()));
        return dto;
    }

    private void enforceRateLimit(String email, String sourceIp) {
        String normalizedEmail = email.trim().toLowerCase();
        String emailKey = "feedback:email:" + normalizedEmail;
        Long emailCount = redisTemplate.opsForValue().increment(emailKey);
        if (emailCount != null && emailCount == 1) {
            redisTemplate.expire(emailKey, 24, TimeUnit.HOURS);
        }
        if (emailCount != null && emailCount > 1) {
            throw new BusinessException(ResultCode.FEEDBACK_RATE_LIMITED);
        }

        String normalizedIp = sourceIp == null || sourceIp.isBlank() ? "unknown" : sourceIp;
        String ipKey = "feedback:ip:" + normalizedIp;
        Long ipCount = redisTemplate.opsForValue().increment(ipKey);
        if (ipCount != null && ipCount == 1) {
            redisTemplate.expire(ipKey, 1, TimeUnit.HOURS);
        }
        if (ipCount != null && ipCount > 5) {
            throw new BusinessException(ResultCode.FEEDBACK_RATE_LIMITED);
        }
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
