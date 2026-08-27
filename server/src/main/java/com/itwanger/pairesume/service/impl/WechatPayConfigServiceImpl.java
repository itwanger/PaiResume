package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.WechatPayConfigUpdateDTO;
import com.itwanger.pairesume.dto.WechatPayConfigViewDTO;
import com.itwanger.pairesume.entity.WechatPayConfig;
import com.itwanger.pairesume.entity.WechatPayConfigAudit;
import com.itwanger.pairesume.mapper.WechatPayConfigAuditMapper;
import com.itwanger.pairesume.mapper.WechatPayConfigMapper;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.service.WechatPayConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.util.ArrayList;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class WechatPayConfigServiceImpl implements WechatPayConfigService {
    public static final String PAYMENT_NOTIFY_PATH = "/api/public/payments/wechat/notify";
    public static final String REFUND_NOTIFY_PATH = "/api/public/payments/wechat/refund-notify";

    private final WechatPayConfigMapper configMapper;
    private final WechatPayConfigAuditMapper auditMapper;
    private final AiProviderCryptoService cryptoService;
    private final MarketplacePaymentProperties properties;

    @Override
    @Transactional(readOnly = true)
    public WechatPayConfigViewDTO view() {
        return toView(requireRow());
    }

    @Override
    @Transactional
    public WechatPayConfigViewDTO update(Long adminUserId, WechatPayConfigUpdateDTO dto) {
        WechatPayConfig config = requireRow();
        MarketplacePaymentProperties.Wechat env = properties.getWechat();
        var changedFields = new ArrayList<String>();
        boolean credentialsRotated = false;

        String appId = required(dto.getAppId(), "App ID");
        String merchantId = required(dto.getMerchantId(), "商户号");
        String merchantSerial = required(dto.getMerchantSerialNumber(), "商户证书序列号");
        String paymentNotifyUrl = normalizeNotifyUrl(
                dto.getPaymentNotifyUrl(), PAYMENT_NOTIFY_PATH, "支付通知地址");
        String refundNotifyUrl = normalizeNotifyUrl(
                dto.getRefundNotifyUrl(), REFUND_NOTIFY_PATH, "退款通知地址");
        if (paymentNotifyUrl.equals(refundNotifyUrl)) {
            throw badRequest("支付通知地址与退款通知地址不能相同");
        }

        changedFields.addAll(setIfChanged(config, appId, merchantId, merchantSerial,
                paymentNotifyUrl, refundNotifyUrl, dto.isEnabled()));

        if (StringUtils.hasText(dto.getPrivateKey())) {
            requireMasterKey();
            config.setPrivateKeyCipher(cryptoService.encrypt(dto.getPrivateKey().strip()));
            config.setPrivateKeyMask("已加密保存");
            changedFields.add("privateKey");
            credentialsRotated = true;
        }
        if (StringUtils.hasText(dto.getApiV3Key())) {
            requireMasterKey();
            String apiV3Key = normalizeApiV3Key(dto.getApiV3Key());
            config.setApiV3KeyCipher(cryptoService.encrypt(apiV3Key));
            config.setApiV3KeyMask(AiProviderCryptoService.mask(apiV3Key));
            changedFields.add("apiV3Key");
            credentialsRotated = true;
        }

        if (dto.isEnabled()) {
            credentialsRotated |= importEnvironmentCredentialsIfNecessary(config, env, changedFields);
            validateStoredReady(config);
        }

        config.setUpdatedBy(adminUserId);
        configMapper.updateById(config);
        auditMapper.insert(audit(adminUserId, changedFields, credentialsRotated));
        return toView(config);
    }

    @Override
    @Transactional(readOnly = true)
    public ActiveWechatPayConfig resolveActive() {
        WechatPayConfig config = configMapper.selectById(WechatPayConfig.SINGLE_ROW_ID);
        if (config != null && Boolean.TRUE.equals(config.getEnabled())) {
            validateStoredReady(config);
            return new ActiveWechatPayConfig(
                    config.getAppId(),
                    config.getMerchantId(),
                    decrypt(config.getPrivateKeyCipher()),
                    config.getMerchantSerialNumber(),
                    decrypt(config.getApiV3KeyCipher()),
                    config.getPaymentNotifyUrl(),
                    config.getRefundNotifyUrl(),
                    true
            );
        }

        MarketplacePaymentProperties.Wechat env = properties.getWechat();
        ActiveWechatPayConfig active = new ActiveWechatPayConfig(
                normalize(env.getAppId()),
                normalize(env.getMerchantId()),
                normalize(env.getPrivateKey()),
                normalize(env.getMerchantSerialNumber()),
                normalize(env.getApiV3Key()),
                normalize(env.getNotifyUrl()),
                normalize(env.getRefundNotifyUrl()),
                false
        );
        validateActive(active);
        return active;
    }

    private ArrayList<String> setIfChanged(
            WechatPayConfig config,
            String appId,
            String merchantId,
            String merchantSerial,
            String paymentNotifyUrl,
            String refundNotifyUrl,
            boolean enabled
    ) {
        var changed = new ArrayList<String>();
        if (!Objects.equals(config.getAppId(), appId)) {
            config.setAppId(appId);
            changed.add("appId");
        }
        if (!Objects.equals(config.getMerchantId(), merchantId)) {
            config.setMerchantId(merchantId);
            changed.add("merchantId");
        }
        if (!Objects.equals(config.getMerchantSerialNumber(), merchantSerial)) {
            config.setMerchantSerialNumber(merchantSerial);
            changed.add("merchantSerialNumber");
        }
        if (!Objects.equals(config.getPaymentNotifyUrl(), paymentNotifyUrl)) {
            config.setPaymentNotifyUrl(paymentNotifyUrl);
            changed.add("paymentNotifyUrl");
        }
        if (!Objects.equals(config.getRefundNotifyUrl(), refundNotifyUrl)) {
            config.setRefundNotifyUrl(refundNotifyUrl);
            changed.add("refundNotifyUrl");
        }
        if (Boolean.TRUE.equals(config.getEnabled()) != enabled) {
            config.setEnabled(enabled);
            changed.add("enabled");
        }
        return changed;
    }

    private boolean importEnvironmentCredentialsIfNecessary(
            WechatPayConfig config,
            MarketplacePaymentProperties.Wechat env,
            ArrayList<String> changedFields
    ) {
        boolean imported = false;
        if (config.getPrivateKeyCipher() == null && StringUtils.hasText(env.getPrivateKey())) {
            requireMasterKey();
            config.setPrivateKeyCipher(cryptoService.encrypt(env.getPrivateKey().strip()));
            config.setPrivateKeyMask("已加密保存");
            changedFields.add("privateKey");
            imported = true;
        }
        if (config.getApiV3KeyCipher() == null && StringUtils.hasText(env.getApiV3Key())) {
            requireMasterKey();
            String apiV3Key = normalizeApiV3Key(env.getApiV3Key());
            config.setApiV3KeyCipher(cryptoService.encrypt(apiV3Key));
            config.setApiV3KeyMask(AiProviderCryptoService.mask(apiV3Key));
            changedFields.add("apiV3Key");
            imported = true;
        }
        return imported;
    }

    private void validateStoredReady(WechatPayConfig config) {
        requireMasterKey();
        if (config.getPrivateKeyCipher() == null || config.getApiV3KeyCipher() == null) {
            throw badRequest("启用前必须配置商户私钥和 API v3 Key");
        }
        validateActive(new ActiveWechatPayConfig(
                config.getAppId(), config.getMerchantId(), "encrypted",
                config.getMerchantSerialNumber(), decrypt(config.getApiV3KeyCipher()),
                config.getPaymentNotifyUrl(), config.getRefundNotifyUrl(), true));
    }

    private void validateActive(ActiveWechatPayConfig active) {
        required(active.appId(), "App ID");
        required(active.merchantId(), "商户号");
        required(active.privateKey(), "商户私钥");
        required(active.merchantSerialNumber(), "商户证书序列号");
        normalizeApiV3Key(active.apiV3Key());
        String payment = normalizeNotifyUrl(active.paymentNotifyUrl(), PAYMENT_NOTIFY_PATH, "支付通知地址");
        String refund = normalizeNotifyUrl(active.refundNotifyUrl(), REFUND_NOTIFY_PATH, "退款通知地址");
        if (payment.equals(refund)) {
            throw badRequest("支付通知地址与退款通知地址不能相同");
        }
    }

    private WechatPayConfigViewDTO toView(WechatPayConfig config) {
        MarketplacePaymentProperties.Wechat env = properties.getWechat();
        boolean storedCredentials = config.getPrivateKeyCipher() != null
                && config.getApiV3KeyCipher() != null;
        boolean envCredentials = environmentConfigured(env);
        boolean useStoredDisplay = Boolean.TRUE.equals(config.getEnabled())
                || StringUtils.hasText(config.getAppId());

        var view = new WechatPayConfigViewDTO();
        view.setAppId(useStoredDisplay ? config.getAppId() : normalize(env.getAppId()));
        view.setMerchantId(useStoredDisplay ? config.getMerchantId() : normalize(env.getMerchantId()));
        view.setMerchantSerialNumber(useStoredDisplay
                ? config.getMerchantSerialNumber() : normalize(env.getMerchantSerialNumber()));
        view.setPaymentNotifyUrl(firstText(config.getPaymentNotifyUrl(), env.getNotifyUrl()));
        view.setRefundNotifyUrl(firstText(config.getRefundNotifyUrl(), env.getRefundNotifyUrl()));
        view.setPrivateKeyMask(storedCredentials ? config.getPrivateKeyMask()
                : StringUtils.hasText(env.getPrivateKey()) ? "环境变量已配置" : null);
        view.setApiV3KeyMask(storedCredentials ? config.getApiV3KeyMask()
                : StringUtils.hasText(env.getApiV3Key()) ? AiProviderCryptoService.mask(env.getApiV3Key()) : null);
        view.setStoredCredentialsConfigured(storedCredentials);
        view.setEnvironmentFallbackConfigured(envCredentials);
        view.setMasterKeyConfigured(cryptoService.isAvailable());
        view.setEnabled(Boolean.TRUE.equals(config.getEnabled()));
        view.setUpdatedAt(config.getUpdatedAt());
        return view;
    }

    private boolean environmentConfigured(MarketplacePaymentProperties.Wechat env) {
        return StringUtils.hasText(env.getAppId())
                && StringUtils.hasText(env.getMerchantId())
                && StringUtils.hasText(env.getPrivateKey())
                && StringUtils.hasText(env.getMerchantSerialNumber())
                && StringUtils.hasText(env.getApiV3Key())
                && StringUtils.hasText(env.getNotifyUrl())
                && StringUtils.hasText(env.getRefundNotifyUrl());
    }

    private String normalizeNotifyUrl(String value, String expectedPath, String label) {
        String normalized = required(value, label);
        try {
            URI uri = URI.create(normalized);
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || !StringUtils.hasText(uri.getHost())
                    || !expectedPath.equals(uri.getPath())
                    || uri.getUserInfo() != null
                    || uri.getQuery() != null
                    || uri.getFragment() != null) {
                throw new IllegalArgumentException();
            }
            return uri.toString();
        } catch (RuntimeException exception) {
            throw badRequest(label + "必须是派简历对应回调路径的 HTTPS 地址");
        }
    }

    private String normalizeApiV3Key(String value) {
        String normalized = required(value, "API v3 Key");
        if (normalized.length() != 32) {
            throw badRequest("API v3 Key 必须恰好为 32 个字符");
        }
        return normalized;
    }

    private String decrypt(byte[] cipher) {
        if (cipher == null) {
            throw badRequest("微信支付加密凭据尚未配置");
        }
        try {
            return cryptoService.decrypt(cipher);
        } catch (BusinessException exception) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "微信支付加密凭据不可用");
        }
    }

    private void requireMasterKey() {
        if (!cryptoService.isAvailable()) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(),
                    "服务器未配置加密主密钥，暂时无法保存或读取微信支付凭据");
        }
    }

    private WechatPayConfig requireRow() {
        WechatPayConfig config = configMapper.selectById(WechatPayConfig.SINGLE_ROW_ID);
        if (config == null) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "微信支付配置行缺失");
        }
        return config;
    }

    private WechatPayConfigAudit audit(
            Long adminUserId,
            ArrayList<String> changedFields,
            boolean credentialsRotated
    ) {
        var audit = new WechatPayConfigAudit();
        audit.setAdminUserId(adminUserId);
        audit.setAction("UPDATE");
        audit.setChangedFields(String.join(",", changedFields));
        audit.setCredentialsRotated(credentialsRotated);
        audit.setDetail("更新完成，变更字段 " + changedFields.size() + " 个");
        return audit;
    }

    private String required(String value, String label) {
        String normalized = normalize(value);
        if (!StringUtils.hasText(normalized)) {
            throw badRequest(label + "不能为空");
        }
        return normalized;
    }

    private String firstText(String first, String second) {
        return StringUtils.hasText(first) ? first.strip() : normalize(second);
    }

    private String normalize(String value) {
        return value == null ? "" : value.strip();
    }

    private BusinessException badRequest(String message) {
        return new BusinessException(ResultCode.BAD_REQUEST.getCode(), message);
    }
}
