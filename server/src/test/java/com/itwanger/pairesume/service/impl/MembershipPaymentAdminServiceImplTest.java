package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.entity.MembershipPaymentOrder;
import com.itwanger.pairesume.entity.MembershipPaymentOrderAuditLog;
import com.itwanger.pairesume.mapper.MembershipPaymentOrderAuditLogMapper;
import com.itwanger.pairesume.mapper.MembershipPaymentOrderMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.payment.MembershipOrderStatus;
import com.itwanger.pairesume.payment.MembershipPaymentReviewStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MembershipPaymentAdminServiceImplTest {
    @Mock private MembershipPaymentOrderMapper orderMapper;
    @Mock private MembershipPaymentOrderAuditLogMapper auditLogMapper;
    @Mock private UserMapper userMapper;
    @Mock private MembershipOrderServiceImpl membershipOrderService;

    private MembershipPaymentAdminServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new MembershipPaymentAdminServiceImpl(
                orderMapper, auditLogMapper, userMapper, membershipOrderService);
    }

    @Test
    void startRefundPersistsHandlerReasonReferenceAndAuditTime() {
        MembershipPaymentOrder order = reviewOrder(MembershipPaymentReviewStatus.PENDING);
        when(orderMapper.selectByOrderNoForUpdate(order.getOrderNo())).thenReturn(order);
        when(auditLogMapper.selectList(any())).thenReturn(List.of());

        var result = service.startRefund(
                order.getOrderNo(), 99L, "已在商户平台发起退款", "refund-001");

        assertEquals(MembershipPaymentReviewStatus.REFUND_PROCESSING.name(), result.getReviewStatus());
        assertEquals(99L, result.getHandledBy());
        assertEquals("refund-001", result.getRefundReference());
        assertNotNull(result.getReviewStartedAt());
        assertNotNull(result.getReviewUpdatedAt());
        verify(orderMapper).updateById(order);
        verify(auditLogMapper).insert(any(MembershipPaymentOrderAuditLog.class));
    }

    @Test
    void replayingSameTransitionIsIdempotentAndDoesNotAppendAuditAgain() {
        MembershipPaymentOrder order = reviewOrder(MembershipPaymentReviewStatus.REFUND_PROCESSING);
        order.setRefundReference("refund-001");
        when(orderMapper.selectByOrderNoForUpdate(order.getOrderNo())).thenReturn(order);
        when(auditLogMapper.selectList(any())).thenReturn(List.of());

        var result = service.startRefund(
                order.getOrderNo(), 99L, "客户端重试", "refund-001");

        assertEquals(MembershipPaymentReviewStatus.REFUND_PROCESSING.name(), result.getReviewStatus());
        verify(orderMapper, never()).updateById(any(MembershipPaymentOrder.class));
        verify(auditLogMapper, never()).insert(any(MembershipPaymentOrderAuditLog.class));
    }

    @Test
    void confirmRefundRequiresProcessingStateAndReference() {
        MembershipPaymentOrder pending = reviewOrder(MembershipPaymentReviewStatus.PENDING);
        when(orderMapper.selectByOrderNoForUpdate(pending.getOrderNo())).thenReturn(pending);

        BusinessException illegalTransition = assertThrows(BusinessException.class,
                () -> service.confirmRefunded(
                        pending.getOrderNo(), 99L, "已到账", "refund-001"));
        assertEquals(ResultCode.MEMBERSHIP_PAYMENT_REVIEW_STATE_INVALID.getCode(),
                illegalTransition.getCode());

        BusinessException missingReference = assertThrows(BusinessException.class,
                () -> service.confirmRefunded(
                        pending.getOrderNo(), 99L, "已到账", " "));
        assertEquals(ResultCode.BAD_REQUEST.getCode(), missingReference.getCode());
    }

    @Test
    void confirmedRefundIsTerminalAndKeepsAppendOnlyAudit() {
        MembershipPaymentOrder order = reviewOrder(MembershipPaymentReviewStatus.REFUND_PROCESSING);
        order.setRefundReference("refund-001");
        order.setReviewStartedAt(LocalDateTime.now().minusMinutes(2));
        when(orderMapper.selectByOrderNoForUpdate(order.getOrderNo())).thenReturn(order);
        when(auditLogMapper.selectList(any())).thenReturn(List.of());

        var result = service.confirmRefunded(
                order.getOrderNo(), 99L, "商户平台显示退款成功", "refund-001");

        assertEquals(MembershipPaymentReviewStatus.REFUNDED.name(), result.getReviewStatus());
        assertNotNull(result.getReviewResolvedAt());
        verify(auditLogMapper).insert(any(MembershipPaymentOrderAuditLog.class));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.closeReview(order.getOrderNo(), 99L, "重复关闭"));
        assertEquals(ResultCode.MEMBERSHIP_PAYMENT_REVIEW_STATE_INVALID.getCode(), exception.getCode());
    }

    @Test
    void ordinaryPaidOrderCannotEnterManualRefundWorkflow() {
        MembershipPaymentOrder order = reviewOrder(MembershipPaymentReviewStatus.NONE);
        order.setOrderStatus(MembershipOrderStatus.PAID.name());
        when(orderMapper.selectByOrderNoForUpdate(order.getOrderNo())).thenReturn(order);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.startRefund(order.getOrderNo(), 99L, "错误操作", null));

        assertEquals(ResultCode.MEMBERSHIP_PAYMENT_REVIEW_STATE_INVALID.getCode(), exception.getCode());
        verify(orderMapper, never()).updateById(any(MembershipPaymentOrder.class));
    }

    @Test
    void orderThatAlreadyGrantedMembershipMustBeRecomputedBeforeRefundRecording() {
        MembershipPaymentOrder order = reviewOrder(MembershipPaymentReviewStatus.PENDING);
        order.setMembershipStartedAt(LocalDateTime.now().minusDays(2));
        order.setMembershipExpiresAt(LocalDateTime.now().plusDays(28));
        when(orderMapper.selectByOrderNoForUpdate(order.getOrderNo())).thenReturn(order);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.startRefund(
                        order.getOrderNo(), 99L, "准备退款", "refund-granted-order"));

        assertEquals(ResultCode.MEMBERSHIP_PAYMENT_REVIEW_STATE_INVALID.getCode(), exception.getCode());
        assertTrue(exception.getMessage().contains("先按权益来源重算"));
        verify(orderMapper, never()).updateById(any(MembershipPaymentOrder.class));
        verify(auditLogMapper, never()).insert(any(MembershipPaymentOrderAuditLog.class));
    }

    @Test
    void lifetimeOrderWithStartedAtStillRequiresEntitlementRecalculationBeforeRefund() {
        MembershipPaymentOrder order = reviewOrder(MembershipPaymentReviewStatus.PENDING);
        order.setPlanCode("LIFETIME");
        order.setPlanNameSnapshot("终身会员");
        order.setEntitlementType("PERMANENT");
        order.setMembershipDays(null);
        order.setMembershipStartedAt(LocalDateTime.now().minusDays(2));
        order.setMembershipExpiresAt(null);
        when(orderMapper.selectByOrderNoForUpdate(order.getOrderNo())).thenReturn(order);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.startRefund(
                        order.getOrderNo(), 99L, "准备退款", "refund-lifetime"));

        assertEquals(ResultCode.MEMBERSHIP_PAYMENT_REVIEW_STATE_INVALID.getCode(),
                exception.getCode());
        verify(orderMapper, never()).updateById(any(MembershipPaymentOrder.class));
    }

    private MembershipPaymentOrder reviewOrder(MembershipPaymentReviewStatus reviewStatus) {
        MembershipPaymentOrder order = new MembershipPaymentOrder();
        order.setId(5L);
        order.setOrderNo("PM-review-001");
        order.setUserId(7L);
        order.setOrderStatus(MembershipOrderStatus.REFUND_REQUIRED.name());
        order.setReviewStatus(reviewStatus.name());
        order.setPaymentReviewReason("LATE_PAYMENT_AFTER_REPLACEMENT_PAID");
        order.setPayableAmountCents(6600);
        order.setCreatedAt(LocalDateTime.now().minusHours(1));
        order.setUpdatedAt(LocalDateTime.now().minusMinutes(5));
        return order;
    }
}
