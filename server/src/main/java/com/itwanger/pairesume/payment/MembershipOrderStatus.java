package com.itwanger.pairesume.payment;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;

public enum MembershipOrderStatus {
    CREATED,
    PREPAYING,
    PREPAY_UNKNOWN,
    PENDING,
    EXPIRED,
    CANCELED,
    PAID,
    REFUND_REQUIRED;

    public static MembershipOrderStatus from(String value) {
        try {
            return MembershipOrderStatus.valueOf(value);
        } catch (RuntimeException exception) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "会员支付订单状态异常");
        }
    }

    public boolean isProviderQueryable() {
        return this == PREPAY_UNKNOWN || this == PENDING || this == EXPIRED || this == CANCELED;
    }

    public boolean isTerminal() {
        return this == CANCELED || this == PAID || this == REFUND_REQUIRED;
    }
}
