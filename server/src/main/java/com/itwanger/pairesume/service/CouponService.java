package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.CouponAdminDTO;
import com.itwanger.pairesume.dto.CouponQuoteDTO;
import com.itwanger.pairesume.entity.CouponCode;
import com.itwanger.pairesume.entity.FeedbackSubmission;

import java.util.List;

public interface CouponService {
    CouponQuoteDTO quote(String couponCode);

    CouponQuoteDTO quote(String couponCode, int listPriceCents);

    CouponQuoteDTO quoteForUser(String couponCode, String recipientEmail);

    CouponQuoteDTO quoteForUser(String couponCode, String recipientEmail, int listPriceCents);

    CouponCode issueForFeedback(FeedbackSubmission submission);

    CouponCode getByFeedbackSubmissionId(Long submissionId);

    void resendCoupon(CouponCode couponCode);

    void invalidateFeedbackCoupon(Long submissionId);

    List<CouponAdminDTO> listCoupons();
}
