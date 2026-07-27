package com.itwanger.pairesume.payment;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import org.springframework.util.StringUtils;

import java.util.Locale;

public enum MembershipPlanCode {
    MONTHLY,
    QUARTERLY,
    ANNUAL,
    LIFETIME;

    public static MembershipPlanCode fromRequest(String value) {
        String normalized = StringUtils.hasText(value)
                ? value.trim().toUpperCase(Locale.ROOT)
                : ANNUAL.name();
        try {
            return valueOf(normalized);
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(ResultCode.MEMBERSHIP_PLAN_NOT_FOUND);
        }
    }
}
