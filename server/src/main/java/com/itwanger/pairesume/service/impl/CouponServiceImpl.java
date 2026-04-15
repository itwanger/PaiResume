package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.CouponAdminDTO;
import com.itwanger.pairesume.dto.CouponQuoteDTO;
import com.itwanger.pairesume.entity.CouponCode;
import com.itwanger.pairesume.entity.FeedbackSubmission;
import com.itwanger.pairesume.mapper.CouponCodeMapper;
import com.itwanger.pairesume.service.CouponService;
import com.itwanger.pairesume.service.MailService;
import com.itwanger.pairesume.service.PlatformConfigService;
import com.itwanger.pairesume.util.DateTimeUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CouponServiceImpl implements CouponService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String COUPON_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final CouponCodeMapper couponCodeMapper;
    private final PlatformConfigService platformConfigService;
    private final MailService mailService;

    @Override
    public CouponQuoteDTO quote(String couponCode) {
        int listPrice = platformConfigService.getConfigEntity().getMembershipPriceCents();
        CouponQuoteDTO dto = new CouponQuoteDTO();
        dto.setListPrice(listPrice);
        dto.setDiscountAmount(0);
        dto.setPayableAmount(listPrice);
        dto.setCouponStatus("NOT_APPLIED");
        dto.setPaymentEnabled(false);

        if (!StringUtils.hasText(couponCode)) {
            return dto;
        }

        CouponCode coupon = getCouponByCode(couponCode);
        validateCouponStatusForQuote(coupon);

        int discountAmount = Math.min(listPrice, coupon.getAmountCents());
        dto.setDiscountAmount(discountAmount);
        dto.setPayableAmount(Math.max(0, listPrice - discountAmount));
        dto.setCouponStatus("VALID");
        return dto;
    }

    @Override
    @Transactional
    public CouponCode issueForFeedback(FeedbackSubmission submission) {
        CouponCode existing = getByFeedbackSubmissionId(submission.getId());
        if (existing != null) {
            if (!"ISSUED".equals(existing.getCouponStatus())) {
                existing.setCouponStatus("ISSUED");
                existing.setEmailSentAt(null);
                couponCodeMapper.updateById(existing);
            }
            return existing;
        }

        CouponCode couponCode = new CouponCode();
        couponCode.setCode(generateUniqueCode());
        couponCode.setSourceType("QUESTIONNAIRE");
        couponCode.setSourceId(submission.getId());
        couponCode.setRecipientEmail(submission.getContactEmail());
        couponCode.setAmountCents(platformConfigService.getConfigEntity().getQuestionnaireCouponAmountCents());
        couponCode.setCouponStatus("ISSUED");
        couponCodeMapper.insert(couponCode);
        resendCoupon(couponCode);
        return couponCode;
    }

    @Override
    public CouponCode getByFeedbackSubmissionId(Long submissionId) {
        return couponCodeMapper.selectOne(
                new LambdaQueryWrapper<CouponCode>()
                        .eq(CouponCode::getSourceType, "QUESTIONNAIRE")
                        .eq(CouponCode::getSourceId, submissionId)
                        .last("LIMIT 1")
        );
    }

    @Override
    public void resendCoupon(CouponCode couponCode) {
        mailService.sendCouponCode(couponCode.getRecipientEmail(), couponCode.getCode(), couponCode.getAmountCents());
        couponCode.setEmailSentAt(LocalDateTime.now());
        couponCodeMapper.updateById(couponCode);
    }

    @Override
    public void invalidateFeedbackCoupon(Long submissionId) {
        CouponCode couponCode = getByFeedbackSubmissionId(submissionId);
        if (couponCode == null) {
            return;
        }
        couponCode.setCouponStatus("INVALID");
        couponCodeMapper.updateById(couponCode);
    }

    @Override
    public List<CouponAdminDTO> listCoupons() {
        return couponCodeMapper.selectList(
                new LambdaQueryWrapper<CouponCode>()
                        .orderByDesc(CouponCode::getCreatedAt)
                        .orderByDesc(CouponCode::getId)
        ).stream().map(this::toAdminDto).toList();
    }

    private CouponCode getCouponByCode(String couponCode) {
        CouponCode coupon = couponCodeMapper.selectOne(
                new LambdaQueryWrapper<CouponCode>()
                        .eq(CouponCode::getCode, normalizeCouponCode(couponCode))
                        .last("LIMIT 1")
        );
        if (coupon == null) {
            throw new BusinessException(ResultCode.COUPON_NOT_FOUND);
        }
        return coupon;
    }

    private void validateCouponStatusForQuote(CouponCode couponCode) {
        if ("USED".equals(couponCode.getCouponStatus())) {
            throw new BusinessException(ResultCode.COUPON_ALREADY_USED);
        }
        if (!"ISSUED".equals(couponCode.getCouponStatus())) {
            throw new BusinessException(ResultCode.COUPON_INVALID);
        }
        if (couponCode.getExpiresAt() != null && couponCode.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BusinessException(ResultCode.COUPON_INVALID);
        }
    }

    private CouponAdminDTO toAdminDto(CouponCode coupon) {
        CouponAdminDTO dto = new CouponAdminDTO();
        dto.setId(coupon.getId());
        dto.setCode(coupon.getCode());
        dto.setRecipientEmail(coupon.getRecipientEmail());
        dto.setAmountCents(coupon.getAmountCents());
        dto.setStatus(coupon.getCouponStatus());
        dto.setEmailSentAt(DateTimeUtils.format(coupon.getEmailSentAt()));
        dto.setUsedAt(DateTimeUtils.format(coupon.getUsedAt()));
        dto.setExpiresAt(DateTimeUtils.format(coupon.getExpiresAt()));
        return dto;
    }

    private String generateUniqueCode() {
        for (int index = 0; index < 10; index += 1) {
            String code = buildCode();
            Long count = couponCodeMapper.selectCount(
                    new LambdaQueryWrapper<CouponCode>().eq(CouponCode::getCode, code)
            );
            if (count == null || count == 0) {
                return code;
            }
        }
        throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "生成优惠码失败");
    }

    private String buildCode() {
        StringBuilder builder = new StringBuilder("PAI");
        for (int index = 0; index < 8; index += 1) {
            builder.append(COUPON_CHARACTERS.charAt(RANDOM.nextInt(COUPON_CHARACTERS.length())));
        }
        return builder.toString();
    }

    private String normalizeCouponCode(String couponCode) {
        return couponCode.trim().toUpperCase();
    }
}
