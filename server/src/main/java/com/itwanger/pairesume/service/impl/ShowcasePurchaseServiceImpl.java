package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.ShowcasePurchaseOrderDTO;
import com.itwanger.pairesume.entity.ResumeShowcase;
import com.itwanger.pairesume.entity.ShowcasePurchaseOrder;
import com.itwanger.pairesume.mapper.ResumeShowcaseMapper;
import com.itwanger.pairesume.mapper.ShowcasePurchaseOrderMapper;
import com.itwanger.pairesume.payment.MarketplacePaymentGateway;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.payment.PaymentPrepayRequest;
import com.itwanger.pairesume.payment.PaymentPrepayResult;
import com.itwanger.pairesume.payment.PaymentOrderNoGenerator;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import com.itwanger.pairesume.payment.ProviderPaymentResultValidator;
import com.itwanger.pairesume.payment.QrCodeDataUrlGenerator;
import com.itwanger.pairesume.service.ShowcasePurchaseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.Objects;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class ShowcasePurchaseServiceImpl implements ShowcasePurchaseService {
    private static final Pattern TOKEN_PATTERN = Pattern.compile("[A-Za-z0-9_-]{32,128}");
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private static final String PAYMENT_DESCRIPTION = "PaiResume 单份优质简历解锁";

    private final ResumeShowcaseMapper showcaseMapper;
    private final ShowcasePurchaseOrderMapper orderMapper;
    private final MarketplacePaymentGateway paymentGateway;
    private final MarketplacePaymentProperties paymentProperties;
    private final QrCodeDataUrlGenerator qrCodeGenerator;

    @Override
    @Transactional
    public ShowcasePurchaseOrderDTO createOrder(String slug, String purchaseToken,
                                                String idempotencyKey, String clientIp) {
        String tokenHash = hashToken(purchaseToken);
        ResumeShowcase showcase = requirePaidShowcase(slug);

        ShowcasePurchaseOrder idempotent = orderMapper.selectByIdempotencyKey(tokenHash, idempotencyKey);
        if (idempotent != null) {
            if (!Objects.equals(idempotent.getShowcaseId(), showcase.getId())) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "幂等键已用于其他订单");
            }
            return toDto(idempotent);
        }

        ShowcasePurchaseOrder paid = latestPaid(showcase.getId(), tokenHash);
        if (paid != null) {
            return toDto(paid);
        }

        String activeKey = showcase.getId() + ":" + tokenHash;
        ShowcasePurchaseOrder active = orderMapper.selectByActiveOrderKey(activeKey);
        if (active != null) {
            return toDto(active);
        }
        if (!isPaymentEnabled()) {
            throw new BusinessException(ResultCode.PAYMENT_NOT_ENABLED);
        }

        ShowcasePurchaseOrder order = new ShowcasePurchaseOrder();
        order.setOrderNo(PaymentOrderNoGenerator.generate("PO"));
        order.setShowcaseId(showcase.getId());
        order.setPurchaseTokenHash(tokenHash);
        order.setIdempotencyKey(idempotencyKey);
        order.setActiveOrderKey(activeKey);
        order.setAmountCents(showcase.getPriceCents());
        order.setCurrency("CNY");
        order.setProvider(paymentGateway.provider());
        order.setPayChannel("mock".equals(paymentGateway.provider()) ? "MOCK_NATIVE" : "WECHAT_NATIVE");
        order.setOrderStatus("CREATED");
        order.setExpiresAt(LocalDateTime.now().plusMinutes(paymentProperties.getOrderExpireMinutes()));
        try {
            orderMapper.insert(order);
        } catch (DuplicateKeyException exception) {
            ShowcasePurchaseOrder concurrent = orderMapper.selectByActiveOrderKey(activeKey);
            if (concurrent != null) return toDto(concurrent);
            throw exception;
        }

        order.setOrderStatus("PREPAYING");
        orderMapper.updateById(order);
        try {
            PaymentPrepayResult prepay = paymentGateway.createNativeOrder(new PaymentPrepayRequest(
                    order.getOrderNo(),
                    PAYMENT_DESCRIPTION,
                    order.getAmountCents(),
                    StringUtils.hasText(clientIp) ? clientIp : "127.0.0.1",
                    order.getExpiresAt()
            ));
            if (prepay == null
                    || !Objects.equals(paymentGateway.provider(), prepay.provider())
                    || !StringUtils.hasText(prepay.codeUrl())) {
                throw new IllegalStateException("Payment provider returned an invalid Native prepay response");
            }
            qrCodeGenerator.generate(prepay.codeUrl());
            order.setProviderPrepayId(prepay.providerPrepayId());
            order.setCodeUrl(prepay.codeUrl());
            order.setExpiresAt(prepay.expiresAt() == null ? order.getExpiresAt() : prepay.expiresAt());
            order.setOrderStatus("PENDING");
            orderMapper.updateById(order);
            return toDto(order);
        } catch (Exception exception) {
            order.setOrderStatus("PREPAY_UNKNOWN");
            orderMapper.updateById(order);
            log.warn("Showcase Native prepay failed orderNo={}, errorType={}",
                    order.getOrderNo(), exception.getClass().getSimpleName());
            if (exception instanceof BusinessException businessException) throw businessException;
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "创建支付订单失败，请稍后重试");
        }
    }

    @Override
    public ShowcasePurchaseOrderDTO getOrder(String orderNo, String purchaseToken) {
        return toDto(requireAuthorizedOrder(orderNo, hashToken(purchaseToken)));
    }

    @Override
    public ShowcasePurchaseOrderDTO getLatestOrder(String slug, String purchaseToken) {
        String tokenHash = hashToken(purchaseToken);
        ResumeShowcase showcase = requirePaidShowcase(slug);

        ShowcasePurchaseOrder order = latestPaid(showcase.getId(), tokenHash);
        if (order == null) {
            order = orderMapper.selectByActiveOrderKey(showcase.getId() + ":" + tokenHash);
        }
        if (order == null) {
            order = orderMapper.selectOne(new LambdaQueryWrapper<ShowcasePurchaseOrder>()
                    .eq(ShowcasePurchaseOrder::getShowcaseId, showcase.getId())
                    .eq(ShowcasePurchaseOrder::getPurchaseTokenHash, tokenHash)
                    .orderByDesc(ShowcasePurchaseOrder::getId)
                    .last("LIMIT 1"));
        }
        return order == null ? null : toDto(order);
    }

    @Override
    @Transactional
    public ShowcasePurchaseOrderDTO refreshOrder(String orderNo, String purchaseToken) {
        String tokenHash = hashToken(purchaseToken);
        ShowcasePurchaseOrder order = requireAuthorizedOrder(orderNo, tokenHash);
        if ("PAID".equals(order.getOrderStatus()) || "REFUNDED".equals(order.getOrderStatus())) {
            return toDto(order);
        }

        ProviderPaymentResult first = paymentGateway.queryOrder(orderNo);
        order = requireAuthorizedOrderForUpdate(orderNo, tokenHash);
        if (shouldPreserveLockedTerminal(order, first)) {
            return toDto(order);
        }
        applyProviderResult(order, first);
        boolean unusablePrepay = "PREPAY_UNKNOWN".equals(order.getOrderStatus());
        if (first.state() != PaymentProviderState.PENDING
                || (!unusablePrepay && !isExpired(order))) {
            return toDto(order);
        }

        RuntimeException closeFailure = null;
        try {
            paymentGateway.closeOrder(orderNo);
        } catch (RuntimeException exception) {
            closeFailure = exception;
            log.warn("Showcase provider close needs recheck orderNo={}, errorType={}",
                    orderNo, exception.getClass().getSimpleName());
        }

        ProviderPaymentResult afterClose = paymentGateway.queryOrder(orderNo);
        applyProviderResult(order, afterClose);
        if (afterClose.state() == PaymentProviderState.PENDING) {
            if (closeFailure != null) {
                throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(),
                        "支付订单状态确认中，请稍后重试");
            }
            finishExpiredOrder(order);
        }
        return toDto(order);
    }

    @Override
    public boolean isUnlocked(Long showcaseId, String purchaseToken) {
        if (!StringUtils.hasText(purchaseToken) || !TOKEN_PATTERN.matcher(purchaseToken).matches()) {
            return false;
        }
        return latestPaid(showcaseId, hashToken(purchaseToken)) != null;
    }

    @Override
    public boolean isPaymentEnabled() {
        return !"disabled".equals(paymentGateway.provider());
    }

    @Override
    @Transactional
    public void handleVerifiedProviderNotification(ProviderPaymentResult result) {
        if (result == null || !StringUtils.hasText(result.orderNo())) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }
        ShowcasePurchaseOrder order = orderMapper.selectByOrderNoForUpdate(result.orderNo());
        if (order == null) throw new BusinessException(ResultCode.SHOWCASE_ORDER_NOT_FOUND);
        applyProviderResult(order, result);
    }

    private void applyProviderResult(ShowcasePurchaseOrder order, ProviderPaymentResult result) {
        verifyProviderResult(order, result);
        order.setLastCheckedAt(LocalDateTime.now());
        if (result.state() == PaymentProviderState.PAID) {
            order.setOrderStatus("PAID");
            order.setProviderTransactionId(result.transactionId());
            order.setPaidAt(result.paidAt());
            order.setActiveOrderKey(null);
        } else if (result.state() == PaymentProviderState.CLOSED) {
            order.setOrderStatus("CLOSED");
            order.setClosedAt(LocalDateTime.now());
            order.setActiveOrderKey(null);
        } else if (result.state() == PaymentProviderState.FAILED) {
            order.setOrderStatus("FAILED");
            order.setActiveOrderKey(null);
        } else if (result.state() == PaymentProviderState.REFUNDED) {
            order.setOrderStatus("REFUNDED");
            order.setProviderTransactionId(result.transactionId());
            order.setRefundedAt(LocalDateTime.now());
            order.setActiveOrderKey(null);
        }
        orderMapper.updateById(order);
    }

    private boolean isExpired(ShowcasePurchaseOrder order) {
        return order.getExpiresAt() != null
                && !order.getExpiresAt().isAfter(LocalDateTime.now());
    }

    private boolean shouldPreserveLockedTerminal(
            ShowcasePurchaseOrder order,
            ProviderPaymentResult providerResult
    ) {
        String status = order.getOrderStatus();
        if ("PAID".equals(status) || "REFUNDED".equals(status)) {
            return true;
        }
        if (providerResult != null && providerResult.state() == PaymentProviderState.PAID) {
            return false;
        }
        return "CLOSED".equals(status)
                || "FAILED".equals(status)
                || ("EXPIRED".equals(status) && order.getActiveOrderKey() == null);
    }

    private void finishExpiredOrder(ShowcasePurchaseOrder order) {
        order.setOrderStatus("EXPIRED");
        order.setClosedAt(LocalDateTime.now());
        order.setActiveOrderKey(null);
        orderMapper.updateById(order);
    }

    private void verifyProviderResult(ShowcasePurchaseOrder order, ProviderPaymentResult result) {
        ProviderPaymentResultValidator.verifyIdentityAndAmount(
                order.getOrderNo(), order.getProvider(), order.getAmountCents(), paymentGateway, result);
        if (result.state() == PaymentProviderState.PAID
                && (!StringUtils.hasText(result.transactionId()) || result.paidAt() == null)) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }
    }

    private ResumeShowcase requirePaidShowcase(String slug) {
        ResumeShowcase showcase = showcaseMapper.selectOne(
                new LambdaQueryWrapper<ResumeShowcase>()
                        .eq(ResumeShowcase::getSlug, slug)
                        .eq(ResumeShowcase::getPublishStatus, "PUBLISHED")
                        .last("LIMIT 1")
        );
        if (showcase == null) throw new BusinessException(ResultCode.SHOWCASE_NOT_FOUND);
        if (!"PAID".equalsIgnoreCase(showcase.getAccessType())
                || showcase.getPriceCents() == null
                || showcase.getPriceCents() <= 0) {
            throw new BusinessException(ResultCode.MARKET_PRICE_INVALID);
        }
        return showcase;
    }

    private ShowcasePurchaseOrder requireAuthorizedOrder(String orderNo, String tokenHash) {
        ShowcasePurchaseOrder order = orderMapper.selectByOrderNo(orderNo);
        if (order == null) throw new BusinessException(ResultCode.SHOWCASE_ORDER_NOT_FOUND);
        if (!Objects.equals(order.getPurchaseTokenHash(), tokenHash)) {
            throw new BusinessException(ResultCode.SHOWCASE_PURCHASE_TOKEN_INVALID);
        }
        return order;
    }

    private ShowcasePurchaseOrder requireAuthorizedOrderForUpdate(String orderNo, String tokenHash) {
        ShowcasePurchaseOrder order = orderMapper.selectByOrderNoForUpdate(orderNo);
        if (order == null) throw new BusinessException(ResultCode.SHOWCASE_ORDER_NOT_FOUND);
        if (!Objects.equals(order.getPurchaseTokenHash(), tokenHash)) {
            throw new BusinessException(ResultCode.SHOWCASE_PURCHASE_TOKEN_INVALID);
        }
        return order;
    }

    private ShowcasePurchaseOrder latestPaid(Long showcaseId, String tokenHash) {
        return orderMapper.selectOne(new LambdaQueryWrapper<ShowcasePurchaseOrder>()
                .eq(ShowcasePurchaseOrder::getShowcaseId, showcaseId)
                .eq(ShowcasePurchaseOrder::getPurchaseTokenHash, tokenHash)
                .eq(ShowcasePurchaseOrder::getOrderStatus, "PAID")
                .orderByDesc(ShowcasePurchaseOrder::getPaidAt)
                .last("LIMIT 1"));
    }

    private String hashToken(String purchaseToken) {
        if (!StringUtils.hasText(purchaseToken)
                || !TOKEN_PATTERN.matcher(purchaseToken).matches()) {
            throw new BusinessException(ResultCode.SHOWCASE_PURCHASE_TOKEN_INVALID);
        }
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(purchaseToken.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    private ShowcasePurchaseOrderDTO toDto(ShowcasePurchaseOrder order) {
        ResumeShowcase showcase = showcaseMapper.selectById(order.getShowcaseId());
        ShowcasePurchaseOrderDTO dto = new ShowcasePurchaseOrderDTO();
        dto.setOrderNo(order.getOrderNo());
        dto.setListingSlug(showcase == null ? null : showcase.getSlug());
        dto.setListingId(order.getShowcaseId());
        dto.setListingRevisionId(0L);
        dto.setAmountCents(order.getAmountCents());
        dto.setCurrency(order.getCurrency());
        dto.setProvider(order.getProvider());
        dto.setPayChannel(order.getPayChannel());
        dto.setOrderStatus(order.getOrderStatus());
        boolean displayable = "PENDING".equals(order.getOrderStatus())
                && order.getExpiresAt() != null
                && order.getExpiresAt().isAfter(LocalDateTime.now())
                && StringUtils.hasText(order.getCodeUrl());
        dto.setCodeUrl(displayable ? order.getCodeUrl() : null);
        dto.setQrCodeDataUrl(displayable ? qrCodeGenerator.generate(order.getCodeUrl()) : null);
        dto.setExpiresAt(format(order.getExpiresAt()));
        dto.setPaidAt(format(order.getPaidAt()));
        dto.setRefundedAt(format(order.getRefundedAt()));
        dto.setUnlocked("PAID".equals(order.getOrderStatus()));
        return dto;
    }

    private String format(LocalDateTime value) {
        return value == null ? null : TIME_FORMAT.format(value);
    }
}
