package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.entity.CreatorEarning;
import com.itwanger.pairesume.entity.CreatorWallet;
import com.itwanger.pairesume.entity.ResumeViewEntitlement;
import com.itwanger.pairesume.entity.ResumeViewOrder;
import com.itwanger.pairesume.mapper.CreatorEarningMapper;
import com.itwanger.pairesume.mapper.CreatorWalletMapper;
import com.itwanger.pairesume.mapper.ResumeViewEntitlementMapper;
import com.itwanger.pairesume.mapper.ResumeViewOrderMapper;
import com.itwanger.pairesume.payment.CreatorEarningStatus;
import com.itwanger.pairesume.payment.MarketplaceOrderStatus;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Single accounting boundary for a confirmed full refund. Provider-detected
 * refunds and administrator-confirmed external refunds must both pass through
 * this service so access revocation, order state and creator accounting cannot
 * drift apart.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MarketplaceRefundReversalService {
    private final ResumeViewOrderMapper orderMapper;
    private final ResumeViewEntitlementMapper entitlementMapper;
    private final CreatorEarningMapper earningMapper;
    private final CreatorWalletMapper walletMapper;

    @Transactional
    public ResumeViewOrder applyProviderFullRefund(String orderNo, LocalDateTime refundedAt) {
        return reverse(orderNo, refundedAt == null ? LocalDateTime.now() : refundedAt,
                null, null, null, "PROVIDER_CONFIRMED_FULL_REFUND", false);
    }

    @Transactional
    public ResumeViewOrder confirmManualFullRefund(String orderNo, Long adminUserId,
                                                   String refundReference, String note) {
        if (!StringUtils.hasText(refundReference) || refundReference.trim().length() > 128
                || !StringUtils.hasText(note) || note.trim().length() > 255) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    "退款流水和备注不能为空且不能超长");
        }
        return reverse(orderNo, LocalDateTime.now(), adminUserId,
                refundReference.trim(), note.trim(), "MANUAL_CONFIRMED_FULL_REFUND", true);
    }

    /**
     * A generic transaction state of REFUND does not prove that a full refund
     * succeeded. Put payout behind the order-level review gate without
     * revoking access or mutating the creator ledger before verification.
     */
    @Transactional
    public ResumeViewOrder markProviderRefundNeedsVerification(
            String orderNo, ProviderPaymentResult providerResult, LocalDateTime checkedAt) {
        ResumeViewOrder order = orderMapper.selectByOrderNoForUpdate(orderNo);
        if (order == null) {
            throw new BusinessException(ResultCode.MARKET_ORDER_NOT_FOUND);
        }
        if (MarketplaceOrderStatus.REFUNDED.name().equals(order.getOrderStatus())
                || MarketplaceOrderStatus.REFUND_REQUIRED.name().equals(order.getOrderStatus())) {
            return order;
        }

        // Serialize against creator payout requests without mutating the
        // earning. The order status itself is the durable refund-review gate.
        earningMapper.selectByOrderIdForUpdate(order.getId());
        LocalDateTime now = checkedAt == null ? LocalDateTime.now() : checkedAt;
        order.setOrderStatus(MarketplaceOrderStatus.REFUND_REQUIRED.name());
        order.setPaymentReviewReason("PROVIDER_REFUND_REQUIRES_FULL_AMOUNT_VERIFICATION");
        if (StringUtils.hasText(providerResult.transactionId())) {
            order.setProviderTransactionId(providerResult.transactionId());
        }
        if (providerResult.paidAt() != null) {
            order.setPaidAt(providerResult.paidAt());
        }
        order.setProviderReconciledAt(now);
        order.setLastCheckedAt(now);
        order.setActiveOrderKey(null);
        orderMapper.updateById(order);
        return order;
    }

    private ResumeViewOrder reverse(String orderNo, LocalDateTime refundedAt, Long adminUserId,
                                    String refundReference, String refundNote,
                                    String reversalReason, boolean manual) {
        ResumeViewOrder order = orderMapper.selectByOrderNoForUpdate(orderNo);
        if (order == null) {
            throw new BusinessException(ResultCode.MARKET_ORDER_NOT_FOUND);
        }
        if (MarketplaceOrderStatus.REFUNDED.name().equals(order.getOrderStatus())) {
            if (!manual || (Objects.equals(order.getRefundReference(), refundReference)
                    && Objects.equals(order.getRefundNote(), refundNote))) {
                return order;
            }
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    "退款记录已使用其他流水确认");
        }
        if (manual && !isManuallyRefundable(order)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    "该订单不是可确认全额退款的已支付订单");
        }
        if (manual) {
            ResumeViewOrder referenceOwner = orderMapper.selectByProviderRefundReference(
                    order.getProvider(), refundReference);
            if (referenceOwner != null && !Objects.equals(referenceOwner.getId(), order.getId())) {
                throw new BusinessException(ResultCode.PAYMENT_REFUND_REFERENCE_CONFLICT);
            }
        }

        ResumeViewEntitlement entitlement = entitlementMapper.selectBySourceOrderIdForUpdate(order.getId());
        if (entitlement != null && "ACTIVE".equals(entitlement.getEntitlementStatus())) {
            entitlement.setEntitlementStatus("REVOKED");
            entitlement.setRevokedAt(refundedAt);
            entitlement.setRevokeReason(reversalReason);
            entitlementMapper.updateById(entitlement);
        }

        CreatorEarning earning = earningMapper.selectByOrderIdForUpdate(order.getId());
        if (earning != null && !CreatorEarningStatus.REVERSED.name().equals(earning.getEarningStatus())) {
            reverseCreatorEarning(earning, reversalReason, refundedAt);
        } else if (MarketplaceOrderStatus.PAID.name().equals(order.getOrderStatus()) && earning == null) {
            // Do not block a real provider refund because a historical ledger
            // row is missing. The order and entitlement still have to converge;
            // operators can inspect this invariant violation in logs.
            log.error("Paid marketplace refund has no creator earning orderNo={}, orderId={}",
                    order.getOrderNo(), order.getId());
        }

        order.setOrderStatus(MarketplaceOrderStatus.REFUNDED.name());
        order.setRefundedAt(refundedAt);
        order.setActiveOrderKey(null);
        if (!manual) {
            order.setLastCheckedAt(refundedAt);
            order.setProviderReconciledAt(refundedAt);
        }
        if (order.getClosedAt() == null) {
            order.setClosedAt(refundedAt);
        }
        if (manual) {
            order.setRefundReference(refundReference);
            order.setRefundNote(refundNote);
            order.setRefundResolvedBy(adminUserId);
            order.setRefundResolvedAt(refundedAt);
        }
        try {
            orderMapper.updateById(order);
        } catch (DuplicateKeyException exception) {
            throw new BusinessException(ResultCode.PAYMENT_REFUND_REFERENCE_CONFLICT);
        }
        return order;
    }

    private void reverseCreatorEarning(CreatorEarning earning, String reason, LocalDateTime refundedAt) {
        String previousStatus = earning.getEarningStatus();
        CreatorEarningStatus status;
        try {
            status = CreatorEarningStatus.valueOf(previousStatus);
        } catch (RuntimeException exception) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "作者收益状态异常，无法退款冲销");
        }

        int netAmount = nonNegative(earning.getNetAmountCents());
        int walletCredit = earning.getWalletCreditCents() == null
                ? netAmount : nonNegative(earning.getWalletCreditCents());
        int debtOffset = earning.getDebtOffsetCents() == null
                ? Math.max(0, netAmount - walletCredit) : nonNegative(earning.getDebtOffsetCents());
        if ((long) walletCredit + debtOffset != netAmount) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "作者收益分配账本不平");
        }

        walletMapper.ensureWallet(earning.getSellerUserId());
        CreatorWallet wallet = walletMapper.selectByUserIdForUpdate(earning.getSellerUserId());
        if (wallet == null) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "作者收益账户不存在");
        }

        long recoveredFromBalance = switch (status) {
            case HOLDING -> deductHeld(wallet, walletCredit);
            case AVAILABLE -> deductAvailable(wallet, walletCredit);
            case PENDING_SETTLEMENT -> deductPending(wallet, walletCredit);
            case SETTLED -> 0L;
            case REVERSED -> walletCredit;
        };
        long unrecovered = walletCredit - recoveredFromBalance;
        wallet.setDebtBalanceCents(nonNegative(wallet.getDebtBalanceCents()) + debtOffset + unrecovered);
        wallet.setLifetimeRefundedCents(nonNegative(wallet.getLifetimeRefundedCents()) + netAmount);
        wallet.setVersion(wallet.getVersion() == null ? 1 : wallet.getVersion() + 1);
        walletMapper.updateById(wallet);

        earning.setEarningStatus(CreatorEarningStatus.REVERSED.name());
        earning.setReversedFromStatus(previousStatus);
        earning.setReversedAt(refundedAt);
        earning.setReversalReason(reason);
        earningMapper.updateById(earning);
    }

    private long deductHeld(CreatorWallet wallet, long amount) {
        long recovered = Math.min(nonNegative(wallet.getHeldBalanceCents()), amount);
        wallet.setHeldBalanceCents(nonNegative(wallet.getHeldBalanceCents()) - recovered);
        return recovered;
    }

    private long deductAvailable(CreatorWallet wallet, long amount) {
        long recovered = Math.min(nonNegative(wallet.getAvailableBalanceCents()), amount);
        wallet.setAvailableBalanceCents(nonNegative(wallet.getAvailableBalanceCents()) - recovered);
        return recovered;
    }

    private long deductPending(CreatorWallet wallet, long amount) {
        long recovered = Math.min(nonNegative(wallet.getPendingBalanceCents()), amount);
        wallet.setPendingBalanceCents(nonNegative(wallet.getPendingBalanceCents()) - recovered);
        return recovered;
    }

    private boolean isManuallyRefundable(ResumeViewOrder order) {
        return MarketplaceOrderStatus.PAID.name().equals(order.getOrderStatus())
                || MarketplaceOrderStatus.REFUND_REQUIRED.name().equals(order.getOrderStatus())
                || MarketplaceOrderStatus.DUPLICATE_PAID.name().equals(order.getOrderStatus());
    }

    private long nonNegative(Long value) {
        return value == null ? 0L : Math.max(0L, value);
    }

    private int nonNegative(Integer value) {
        return value == null ? 0 : Math.max(0, value);
    }
}
