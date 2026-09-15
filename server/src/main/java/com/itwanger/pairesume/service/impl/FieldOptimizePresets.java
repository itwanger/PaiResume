package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;

public final class FieldOptimizePresets {
    private FieldOptimizePresets() {}
    public static String normalize(String id) {
        if (id == null || id.isBlank()) return "standard";
        if (!id.equals("standard") && !id.equals("asu")) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "优化方式无效");
        }
        return id;
    }

}
