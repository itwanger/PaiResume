package com.itwanger.pairesume.payment;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;

public enum MembershipPaymentReviewStatus {
    NONE,
    PENDING,
    REFUND_PROCESSING,
    REFUNDED,
    REJECTED,
    CLOSED;

    public static MembershipPaymentReviewStatus from(String value) {
        try {
            return MembershipPaymentReviewStatus.valueOf(value);
        } catch (RuntimeException exception) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "会员支付复核状态异常");
        }
    }

    public boolean isTerminal() {
        return this == REFUNDED || this == REJECTED || this == CLOSED;
    }
}
