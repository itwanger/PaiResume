package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.WechatPayConfigUpdateDTO;
import com.itwanger.pairesume.dto.WechatPayConfigViewDTO;

public interface WechatPayConfigService {
    WechatPayConfigViewDTO view();

    WechatPayConfigViewDTO update(Long adminUserId, WechatPayConfigUpdateDTO dto);

    ActiveWechatPayConfig resolveActive();

    record ActiveWechatPayConfig(
            String appId,
            String merchantId,
            String privateKey,
            String merchantSerialNumber,
            String apiV3Key,
            String paymentNotifyUrl,
            String refundNotifyUrl,
            boolean adminManaged
    ) {
    }
}
