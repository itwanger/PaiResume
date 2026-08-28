package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.dto.WechatPayConfigUpdateDTO;
import com.itwanger.pairesume.entity.WechatPayConfig;
import com.itwanger.pairesume.entity.WechatPayConfigAudit;
import com.itwanger.pairesume.mapper.WechatPayConfigAuditMapper;
import com.itwanger.pairesume.mapper.WechatPayConfigMapper;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WechatPayConfigServiceImplTest {
    @Mock
    private WechatPayConfigMapper configMapper;
    @Mock
    private WechatPayConfigAuditMapper auditMapper;

    private AiProviderCryptoService crypto;
    private MarketplacePaymentProperties properties;
    private WechatPayConfigServiceImpl service;

    @BeforeEach
    void setUp() {
        crypto = new AiProviderCryptoService(Base64.getEncoder().encodeToString(new byte[32]));
        properties = new MarketplacePaymentProperties();
        service = new WechatPayConfigServiceImpl(configMapper, auditMapper, crypto, properties);
    }

    @Test
    void disabledAdminRowKeepsPaymentDisabledEvenWhenEnvironmentCredentialsExist() {
        WechatPayConfig row = emptyRow();
        configureEnvironment();
        when(configMapper.selectById(WechatPayConfig.SINGLE_ROW_ID)).thenReturn(row);

        var view = service.view();

        assertFalse(service.isEnabled());
        assertThrows(BusinessException.class, service::resolveActive);
        assertTrue(view.isEnvironmentFallbackConfigured());
        assertFalse(view.isStoredCredentialsConfigured());
    }

    @Test
    void enablingImportsEnvironmentSecretsWithoutReturningPlaintext() {
        WechatPayConfig row = emptyRow();
        configureEnvironment();
        when(configMapper.selectById(WechatPayConfig.SINGLE_ROW_ID)).thenReturn(row);

        var view = service.update(7L, completeUpdate(true));
        var active = service.resolveActive();

        assertTrue(view.isEnabled());
        assertTrue(view.isStoredCredentialsConfigured());
        assertEquals("已加密保存", view.getPrivateKeyMask(), "环境私钥不会出现在视图");
        assertEquals("environment-private-key", active.privateKey());
        assertEquals("0123456789abcdef0123456789abcdef", active.apiV3Key());
        assertTrue(active.adminManaged());
        verify(configMapper).updateById(row);
        verify(auditMapper).insert(any(WechatPayConfigAudit.class));
    }

    @Test
    void paymentAndRefundCallbacksCannotBeSwappedOrMerged() {
        WechatPayConfig row = emptyRow();
        when(configMapper.selectById(WechatPayConfig.SINGLE_ROW_ID)).thenReturn(row);
        WechatPayConfigUpdateDTO dto = completeUpdate(false);
        dto.setRefundNotifyUrl(dto.getPaymentNotifyUrl());

        assertThrows(BusinessException.class, () -> service.update(7L, dto));

        dto.setRefundNotifyUrl("https://resume.paicoding.com/api/public/payments/wechat/notify");
        assertThrows(BusinessException.class, () -> service.update(7L, dto));
    }

    @Test
    void enabledAdminConfigurationCanRotateBothEncryptedCredentials() {
        WechatPayConfig row = emptyRow();
        when(configMapper.selectById(WechatPayConfig.SINGLE_ROW_ID)).thenReturn(row);
        WechatPayConfigUpdateDTO dto = completeUpdate(true);
        dto.setPrivateKey("admin-private-key");
        dto.setApiV3Key("abcdef0123456789abcdef0123456789");

        service.update(9L, dto);
        var active = service.resolveActive();

        assertEquals("admin-private-key", active.privateKey());
        assertEquals("abcdef0123456789abcdef0123456789", active.apiV3Key());
        assertEquals("https://resume.paicoding.com/api/public/payments/wechat/notify",
                active.paymentNotifyUrl());
        assertEquals("https://resume.paicoding.com/api/public/payments/wechat/refund-notify",
                active.refundNotifyUrl());
    }

    private WechatPayConfig emptyRow() {
        WechatPayConfig row = new WechatPayConfig();
        row.setId(WechatPayConfig.SINGLE_ROW_ID);
        row.setAppId("");
        row.setMerchantId("");
        row.setMerchantSerialNumber("");
        row.setPaymentNotifyUrl("https://resume.paicoding.com/api/public/payments/wechat/notify");
        row.setRefundNotifyUrl("https://resume.paicoding.com/api/public/payments/wechat/refund-notify");
        row.setEnabled(false);
        return row;
    }

    private void configureEnvironment() {
        MarketplacePaymentProperties.Wechat env = properties.getWechat();
        env.setAppId("wx-environment-app");
        env.setMerchantId("1900000001");
        env.setPrivateKey("environment-private-key");
        env.setMerchantSerialNumber("ENV-SERIAL");
        env.setApiV3Key("0123456789abcdef0123456789abcdef");
        env.setNotifyUrl("https://resume.paicoding.com/api/public/payments/wechat/notify");
        env.setRefundNotifyUrl("https://resume.paicoding.com/api/public/payments/wechat/refund-notify");
    }

    private WechatPayConfigUpdateDTO completeUpdate(boolean enabled) {
        WechatPayConfigUpdateDTO dto = new WechatPayConfigUpdateDTO();
        dto.setAppId("wx-admin-app");
        dto.setMerchantId("1900000001");
        dto.setMerchantSerialNumber("ADMIN-SERIAL");
        dto.setPaymentNotifyUrl("https://resume.paicoding.com/api/public/payments/wechat/notify");
        dto.setRefundNotifyUrl("https://resume.paicoding.com/api/public/payments/wechat/refund-notify");
        dto.setEnabled(enabled);
        return dto;
    }
}
