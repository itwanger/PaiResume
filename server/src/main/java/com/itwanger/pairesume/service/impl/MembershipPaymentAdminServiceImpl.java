package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.MarketplacePageDTO;
import com.itwanger.pairesume.dto.MembershipPaymentAdminOrderDTO;
import com.itwanger.pairesume.dto.MembershipPaymentAdminSummaryDTO;
import com.itwanger.pairesume.dto.MembershipPaymentAuditLogDTO;
import com.itwanger.pairesume.entity.MembershipPaymentOrder;
import com.itwanger.pairesume.entity.MembershipPaymentOrderAuditLog;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.MembershipPaymentOrderAuditLogMapper;
import com.itwanger.pairesume.mapper.MembershipPaymentOrderMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.payment.MembershipOrderStatus;
import com.itwanger.pairesume.payment.MembershipPaymentReviewStatus;
import com.itwanger.pairesume.service.MembershipPaymentAdminService;
import com.itwanger.pairesume.util.DateTimeUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MembershipPaymentAdminServiceImpl implements MembershipPaymentAdminService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> ORDER_STATUSES = Arrays.stream(MembershipOrderStatus.values())
            .map(Enum::name)
            .collect(Collectors.toUnmodifiableSet());
    private static final Set<String> REVIEW_STATUSES = Arrays.stream(MembershipPaymentReviewStatus.values())
            .map(Enum::name)
            .collect(Collectors.toUnmodifiableSet());

    private final MembershipPaymentOrderMapper orderMapper;
    private final MembershipPaymentOrderAuditLogMapper auditLogMapper;
    private final UserMapper userMapper;
    private final MembershipOrderServiceImpl membershipOrderService;

    @Override
    @Transactional(readOnly = true)
    public MarketplacePageDTO<MembershipPaymentAdminOrderDTO> listOrders(
            int page, int size, String orderStatus, String reviewStatus) {
        int safePage = Math.max(1, page);
        int safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, size));
        String normalizedOrderStatus = normalizeFilter(orderStatus, ORDER_STATUSES, "支付订单状态筛选值无效");
        String normalizedReviewStatus = normalizeFilter(reviewStatus, REVIEW_STATUSES, "人工复核状态筛选值无效");
        LambdaQueryWrapper<MembershipPaymentOrder> query = new LambdaQueryWrapper<MembershipPaymentOrder>()
                .eq(StringUtils.hasText(normalizedOrderStatus),
                        MembershipPaymentOrder::getOrderStatus, normalizedOrderStatus)
                .eq(StringUtils.hasText(normalizedReviewStatus),
                        MembershipPaymentOrder::getReviewStatus, normalizedReviewStatus)
                .orderByDesc(MembershipPaymentOrder::getUpdatedAt)
                .orderByDesc(MembershipPaymentOrder::getId);
        Page<MembershipPaymentOrder> result = orderMapper.selectPage(
                new Page<>(safePage, safeSize, true), query);
        int totalPages = result.getTotal() == 0
                ? 0 : (int) Math.ceil((double) result.getTotal() / safeSize);
        return new MarketplacePageDTO<>(
                result.getRecords().stream().map(order -> toDto(order, false)).toList(),
                result.getTotal(), safePage, safeSize, totalPages);
    }

    @Override
    @Transactional(readOnly = true)
    public MembershipPaymentAdminOrderDTO getOrder(String orderNo) {
        return toDto(requireOrder(orderNo), true);
    }

    @Override
    @Transactional
    public MembershipPaymentAdminOrderDTO startRefund(
            String orderNo, Long adminUserId, String reason, String refundReference) {
        return handle(orderNo, adminUserId, "START_REFUND", reason, refundReference,
                MembershipPaymentReviewStatus.REFUND_PROCESSING);
    }

    @Override
    @Transactional
    public MembershipPaymentAdminOrderDTO confirmRefunded(
            String orderNo, Long adminUserId, String reason, String refundReference) {
        if (!StringUtils.hasText(refundReference)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "确认退款必须填写退款流水");
        }
        return handle(orderNo, adminUserId, "CONFIRM_REFUNDED", reason, refundReference,
                MembershipPaymentReviewStatus.REFUNDED);
    }

    @Override
    @Transactional
    public MembershipPaymentAdminOrderDTO rejectRefund(
            String orderNo, Long adminUserId, String reason) {
        return handle(orderNo, adminUserId, "REJECT_REFUND", reason, null,
                MembershipPaymentReviewStatus.REJECTED);
    }

    @Override
    @Transactional
    public MembershipPaymentAdminOrderDTO closeReview(
            String orderNo, Long adminUserId, String reason) {
        return handle(orderNo, adminUserId, "CLOSE_REVIEW", reason, null,
                MembershipPaymentReviewStatus.CLOSED);
    }

    @Override
    @Transactional(readOnly = true)
    public MembershipPaymentAdminSummaryDTO summary() {
        MembershipPaymentAdminSummaryDTO dto = new MembershipPaymentAdminSummaryDTO();
        dto.setTotalOrders(count(null, null));
        dto.setRefundRequiredOrders(count(MembershipOrderStatus.REFUND_REQUIRED.name(), null));
        dto.setPendingReviews(count(null, MembershipPaymentReviewStatus.PENDING.name()));
        dto.setRefundProcessingReviews(count(null, MembershipPaymentReviewStatus.REFUND_PROCESSING.name()));
        dto.setRefundedReviews(count(null, MembershipPaymentReviewStatus.REFUNDED.name()));
        dto.setRejectedReviews(count(null, MembershipPaymentReviewStatus.REJECTED.name()));
        dto.setClosedReviews(count(null, MembershipPaymentReviewStatus.CLOSED.name()));
        dto.setDuplicatePaymentReviews(orderMapper.selectCount(
                new LambdaQueryWrapper<MembershipPaymentOrder>()
                        .eq(MembershipPaymentOrder::getPaymentReviewReason,
                                "LATE_PAYMENT_AFTER_REPLACEMENT_PAID")));
        MembershipOrderServiceImpl.ReconciliationMetrics metrics =
                membershipOrderService.reconciliationMetrics();
        dto.setReconciliationFailuresSinceStart(metrics.failureCount());
        dto.setLastReconciliationFailureAt(DateTimeUtils.format(metrics.lastFailureAt()));
        dto.setObservabilityStartedAt(DateTimeUtils.format(metrics.startedAt()));
        return dto;
    }

    private MembershipPaymentAdminOrderDTO handle(
            String orderNo,
            Long adminUserId,
            String action,
            String reason,
            String refundReference,
            MembershipPaymentReviewStatus target) {
        if (adminUserId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        String normalizedReason = normalizeRequired(reason, "操作原因不能为空");
        String normalizedReference = normalizeOptional(refundReference);
        MembershipPaymentOrder order = orderMapper.selectByOrderNoForUpdate(orderNo);
        if (order == null) {
            throw new BusinessException(ResultCode.MEMBERSHIP_ORDER_NOT_FOUND);
        }
        requireRefundCanBeRecordedWithoutEntitlementReversal(order, target);
        MembershipPaymentReviewStatus current = currentReviewStatus(order);
        if (current == target) {
            verifyIdempotentReference(order, normalizedReference, target);
            return toDto(order, true);
        }
        if (!isAllowed(current, target)) {
            throw new BusinessException(ResultCode.MEMBERSHIP_PAYMENT_REVIEW_STATE_INVALID.getCode(),
                    "不能从 " + current.name() + " 转为 " + target.name());
        }

        LocalDateTime now = LocalDateTime.now();
        String effectiveReference = effectiveRefundReference(order, normalizedReference, target);
        order.setReviewStatus(target.name());
        order.setLastAdminAction(action);
        order.setAdminActionReason(normalizedReason);
        order.setHandledBy(adminUserId);
        order.setReviewUpdatedAt(now);
        if (target == MembershipPaymentReviewStatus.REFUND_PROCESSING
                && order.getReviewStartedAt() == null) {
            order.setReviewStartedAt(now);
        }
        if (target.isTerminal()) {
            order.setReviewResolvedAt(now);
        }
        if (StringUtils.hasText(effectiveReference)) {
            order.setRefundReference(effectiveReference);
        }

        MembershipPaymentOrderAuditLog auditLog = new MembershipPaymentOrderAuditLog();
        auditLog.setOrderId(order.getId());
        auditLog.setOrderNo(order.getOrderNo());
        auditLog.setAdminUserId(adminUserId);
        auditLog.setAction(action);
        auditLog.setFromStatus(current.name());
        auditLog.setToStatus(target.name());
        auditLog.setReason(normalizedReason);
        auditLog.setRefundReference(effectiveReference);
        try {
            orderMapper.updateById(order);
            auditLogMapper.insert(auditLog);
        } catch (DuplicateKeyException exception) {
            throw new BusinessException(ResultCode.MEMBERSHIP_REFUND_REFERENCE_CONFLICT);
        }
        log.info("payment_admin_audit event=MEMBERSHIP_PAYMENT_REVIEW_ACTION orderNo={} "
                        + "adminUserId={} action={} fromStatus={} toStatus={}",
                order.getOrderNo(), adminUserId, action, current.name(), target.name());
        return toDto(order, true);
    }

    private MembershipPaymentReviewStatus currentReviewStatus(MembershipPaymentOrder order) {
        if (!StringUtils.hasText(order.getReviewStatus())
                || MembershipPaymentReviewStatus.NONE.name().equals(order.getReviewStatus())) {
            if (MembershipOrderStatus.REFUND_REQUIRED.name().equals(order.getOrderStatus())) {
                return MembershipPaymentReviewStatus.PENDING;
            }
            throw new BusinessException(ResultCode.MEMBERSHIP_PAYMENT_REVIEW_STATE_INVALID);
        }
        return MembershipPaymentReviewStatus.from(order.getReviewStatus());
    }

    private void requireRefundCanBeRecordedWithoutEntitlementReversal(
            MembershipPaymentOrder order,
            MembershipPaymentReviewStatus target) {
        if (target != MembershipPaymentReviewStatus.REFUND_PROCESSING
                && target != MembershipPaymentReviewStatus.REFUNDED) {
            return;
        }
        if (order.getMembershipStartedAt() != null || order.getMembershipExpiresAt() != null) {
            throw new BusinessException(ResultCode.MEMBERSHIP_PAYMENT_REVIEW_STATE_INVALID.getCode(),
                    "该订单已发放会员权益，请先按权益来源重算并完成人工权益处置，"
                            + "本接口不能直接登记退款完成");
        }
    }

    private boolean isAllowed(MembershipPaymentReviewStatus current,
                              MembershipPaymentReviewStatus target) {
        if (current == MembershipPaymentReviewStatus.PENDING) {
            return target == MembershipPaymentReviewStatus.REFUND_PROCESSING
                    || target == MembershipPaymentReviewStatus.REJECTED
                    || target == MembershipPaymentReviewStatus.CLOSED;
        }
        if (current == MembershipPaymentReviewStatus.REFUND_PROCESSING) {
            return target == MembershipPaymentReviewStatus.REFUNDED
                    || target == MembershipPaymentReviewStatus.REJECTED
                    || target == MembershipPaymentReviewStatus.CLOSED;
        }
        return false;
    }

    private String effectiveRefundReference(
            MembershipPaymentOrder order,
            String requested,
            MembershipPaymentReviewStatus target) {
        String existing = normalizeOptional(order.getRefundReference());
        if (StringUtils.hasText(existing) && StringUtils.hasText(requested)
                && !Objects.equals(existing, requested)) {
            throw new BusinessException(ResultCode.MEMBERSHIP_REFUND_REFERENCE_CONFLICT);
        }
        String effective = StringUtils.hasText(existing) ? existing : requested;
        if (target == MembershipPaymentReviewStatus.REFUNDED && !StringUtils.hasText(effective)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "确认退款必须填写退款流水");
        }
        return effective;
    }

    private void verifyIdempotentReference(
            MembershipPaymentOrder order,
            String requested,
            MembershipPaymentReviewStatus target) {
        if ((target == MembershipPaymentReviewStatus.REFUNDED
                || target == MembershipPaymentReviewStatus.REFUND_PROCESSING)
                && StringUtils.hasText(requested)
                && !Objects.equals(normalizeOptional(order.getRefundReference()), requested)) {
            throw new BusinessException(ResultCode.MEMBERSHIP_REFUND_REFERENCE_CONFLICT);
        }
    }

    private long count(String orderStatus, String reviewStatus) {
        return orderMapper.selectCount(new LambdaQueryWrapper<MembershipPaymentOrder>()
                .eq(StringUtils.hasText(orderStatus), MembershipPaymentOrder::getOrderStatus, orderStatus)
                .eq(StringUtils.hasText(reviewStatus), MembershipPaymentOrder::getReviewStatus, reviewStatus));
    }

    private MembershipPaymentOrder requireOrder(String orderNo) {
        MembershipPaymentOrder order = orderMapper.selectByOrderNo(orderNo);
        if (order == null) {
            throw new BusinessException(ResultCode.MEMBERSHIP_ORDER_NOT_FOUND);
        }
        return order;
    }

    private MembershipPaymentAdminOrderDTO toDto(MembershipPaymentOrder order, boolean includeAudit) {
        MembershipPaymentAdminOrderDTO dto = new MembershipPaymentAdminOrderDTO();
        dto.setId(order.getId());
        dto.setOrderNo(order.getOrderNo());
        dto.setUserId(order.getUserId());
        dto.setUserEmail(emailOf(order.getUserId()));
        dto.setMembershipDays(order.getMembershipDays());
        dto.setListPriceCents(order.getListPriceCents());
        dto.setDiscountAmountCents(order.getDiscountAmountCents());
        dto.setPayableAmountCents(order.getPayableAmountCents());
        dto.setCurrency(order.getCurrency());
        dto.setProvider(order.getProvider());
        dto.setPayChannel(order.getPayChannel());
        dto.setOrderStatus(order.getOrderStatus());
        dto.setProviderTransactionId(order.getProviderTransactionId());
        dto.setPaymentReviewReason(order.getPaymentReviewReason());
        dto.setReviewStatus(order.getReviewStatus());
        dto.setLastAdminAction(order.getLastAdminAction());
        dto.setAdminActionReason(order.getAdminActionReason());
        dto.setHandledBy(order.getHandledBy());
        dto.setHandlerEmail(emailOf(order.getHandledBy()));
        dto.setRefundReference(order.getRefundReference());
        dto.setExpiresAt(DateTimeUtils.format(order.getExpiresAt()));
        dto.setPaidAt(DateTimeUtils.format(order.getPaidAt()));
        dto.setClosedAt(DateTimeUtils.format(order.getClosedAt()));
        dto.setMembershipStartedAt(DateTimeUtils.format(order.getMembershipStartedAt()));
        dto.setMembershipExpiresAt(DateTimeUtils.format(order.getMembershipExpiresAt()));
        dto.setReviewStartedAt(DateTimeUtils.format(order.getReviewStartedAt()));
        dto.setReviewResolvedAt(DateTimeUtils.format(order.getReviewResolvedAt()));
        dto.setReviewUpdatedAt(DateTimeUtils.format(order.getReviewUpdatedAt()));
        dto.setCreatedAt(DateTimeUtils.format(order.getCreatedAt()));
        dto.setUpdatedAt(DateTimeUtils.format(order.getUpdatedAt()));
        dto.setAuditLogs(includeAudit ? listAuditLogs(order.getId()) : List.of());
        return dto;
    }

    private List<MembershipPaymentAuditLogDTO> listAuditLogs(Long orderId) {
        return auditLogMapper.selectList(
                new LambdaQueryWrapper<MembershipPaymentOrderAuditLog>()
                        .eq(MembershipPaymentOrderAuditLog::getOrderId, orderId)
                        .orderByAsc(MembershipPaymentOrderAuditLog::getCreatedAt)
                        .orderByAsc(MembershipPaymentOrderAuditLog::getId))
                .stream().map(this::toAuditDto).toList();
    }

    private MembershipPaymentAuditLogDTO toAuditDto(MembershipPaymentOrderAuditLog log) {
        MembershipPaymentAuditLogDTO dto = new MembershipPaymentAuditLogDTO();
        dto.setId(log.getId());
        dto.setAdminUserId(log.getAdminUserId());
        dto.setAdminEmail(emailOf(log.getAdminUserId()));
        dto.setAction(log.getAction());
        dto.setFromStatus(log.getFromStatus());
        dto.setToStatus(log.getToStatus());
        dto.setReason(log.getReason());
        dto.setRefundReference(log.getRefundReference());
        dto.setCreatedAt(DateTimeUtils.format(log.getCreatedAt()));
        return dto;
    }

    private String emailOf(Long userId) {
        if (userId == null) {
            return null;
        }
        User user = userMapper.selectById(userId);
        return user == null ? null : user.getEmail();
    }

    private String normalizeFilter(String value, Set<String> allowed, String message) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(normalized)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), message);
        }
        return normalized;
    }

    private String normalizeRequired(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), message);
        }
        String normalized = value.trim();
        if (normalized.length() > 255) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "操作原因不能超过 255 个字符");
        }
        return normalized;
    }

    private String normalizeOptional(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.length() > 128) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "退款流水不能超过 128 个字符");
        }
        return normalized;
    }
}
