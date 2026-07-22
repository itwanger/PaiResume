package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.entity.CreatorEarning;
import com.itwanger.pairesume.entity.CreatorWallet;
import com.itwanger.pairesume.entity.ResumeViewOrder;
import com.itwanger.pairesume.mapper.CreatorEarningMapper;
import com.itwanger.pairesume.mapper.CreatorWalletMapper;
import com.itwanger.pairesume.mapper.ResumeMarketListingMapper;
import com.itwanger.pairesume.mapper.ResumeViewOrderMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.payment.CreatorEarningStatus;
import com.itwanger.pairesume.payment.MarketplaceOrderStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CreatorEarningServiceImplTest {
    @Mock private CreatorEarningMapper earningMapper;
    @Mock private CreatorWalletMapper walletMapper;
    @Mock private ResumeMarketListingMapper listingMapper;
    @Mock private ResumeViewOrderMapper orderMapper;
    @Mock private UserMapper userMapper;

    private CreatorEarningServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new CreatorEarningServiceImpl(
                earningMapper, walletMapper, listingMapper, orderMapper, userMapper);
        ResumeViewOrder paidOrder = new ResumeViewOrder();
        paidOrder.setId(2L);
        paidOrder.setOrderStatus(MarketplaceOrderStatus.PAID.name());
        lenient().when(orderMapper.selectByEarningIdForUpdate(10L)).thenReturn(paidOrder);
    }

    @Test
    void settlementRequestIsIdempotentWhileAlreadyPending() {
        CreatorEarning earning = earning(CreatorEarningStatus.PENDING_SETTLEMENT);
        when(earningMapper.selectByIdForUpdate(10L)).thenReturn(earning);

        service.requestSettlement(10L, 7L);

        verify(walletMapper, never()).updateById((CreatorWallet) any());
        verify(earningMapper, never()).updateById((CreatorEarning) any());
    }

    @Test
    void anotherCreatorCannotRequestSettlement() {
        CreatorEarning earning = earning(CreatorEarningStatus.AVAILABLE);
        when(earningMapper.selectByIdForUpdate(10L)).thenReturn(earning);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.requestSettlement(10L, 8L));

        assertEquals(ResultCode.CREATOR_EARNING_NOT_FOUND.getCode(), exception.getCode());
        verify(walletMapper, never()).selectByUserIdForUpdate(any());
    }

    @Test
    void requestMovesAvailableBalanceToPendingExactlyOnce() {
        CreatorEarning earning = earning(CreatorEarningStatus.AVAILABLE);
        CreatorWallet wallet = wallet(500L, 20L, 0L);
        when(earningMapper.selectByIdForUpdate(10L)).thenReturn(earning);
        when(walletMapper.selectByUserIdForUpdate(7L)).thenReturn(wallet);

        service.requestSettlement(10L, 7L);

        assertEquals(CreatorEarningStatus.PENDING_SETTLEMENT.name(), earning.getEarningStatus());
        assertEquals(400L, wallet.getAvailableBalanceCents());
        assertEquals(120L, wallet.getPendingBalanceCents());
        verify(walletMapper).updateById(wallet);
        verify(earningMapper).updateById(earning);
    }

    @Test
    void administratorCanSettleOnlyPendingEarning() {
        CreatorEarning earning = earning(CreatorEarningStatus.AVAILABLE);
        when(earningMapper.selectByIdForUpdate(10L)).thenReturn(earning);

        assertThrows(BusinessException.class,
                () -> service.markSettled(10L, 99L, "bank-transfer-1"));

        verify(walletMapper, never()).selectByUserIdForUpdate(any());
    }

    @Test
    void repeatedAdminSettlementNeverPaysOutTwice() {
        CreatorEarning earning = earning(CreatorEarningStatus.PENDING_SETTLEMENT);
        CreatorWallet wallet = wallet(0L, 100L, 50L);
        when(earningMapper.selectByIdForUpdate(10L)).thenReturn(earning);
        when(walletMapper.selectByUserIdForUpdate(7L)).thenReturn(wallet);

        service.markSettled(10L, 99L, "bank-transfer-1");
        service.markSettled(10L, 99L, "bank-transfer-1");

        assertEquals(CreatorEarningStatus.SETTLED.name(), earning.getEarningStatus());
        assertEquals(0L, wallet.getPendingBalanceCents());
        assertEquals(150L, wallet.getPaidOutCents());
        verify(walletMapper, times(1)).updateById(wallet);
    }

    @Test
    void insufficientAvailableBalanceFailsBeforeAnyLedgerMutation() {
        CreatorEarning earning = earning(CreatorEarningStatus.AVAILABLE);
        CreatorWallet wallet = wallet(99L, 0L, 0L);
        when(earningMapper.selectByIdForUpdate(10L)).thenReturn(earning);
        when(walletMapper.selectByUserIdForUpdate(7L)).thenReturn(wallet);

        assertThrows(BusinessException.class,
                () -> service.requestSettlement(10L, 7L));

        assertEquals(99L, wallet.getAvailableBalanceCents());
        assertEquals(CreatorEarningStatus.AVAILABLE.name(), earning.getEarningStatus());
        verify(walletMapper, never()).updateById((CreatorWallet) any());
        verify(earningMapper, never()).updateById((CreatorEarning) any());
    }

    @Test
    void holdingIncomeCannotBeRequestedBeforeRefundWindowEnds() {
        CreatorEarning earning = earning(CreatorEarningStatus.HOLDING);
        when(earningMapper.selectByIdForUpdate(10L)).thenReturn(earning);

        assertThrows(BusinessException.class,
                () -> service.requestSettlement(10L, 7L));

        verify(walletMapper, never()).selectByUserIdForUpdate(any());
    }

    @Test
    void summaryExposesHeldRefundAndLatePayoutDebt() {
        CreatorWallet wallet = wallet(300L, 20L, 500L);
        wallet.setHeldBalanceCents(80L);
        wallet.setDebtBalanceCents(40L);
        wallet.setLifetimeEarnedCents(1000L);
        wallet.setLifetimeRefundedCents(250L);
        when(walletMapper.selectById(7L)).thenReturn(wallet);

        var summary = service.getSummary(7L);

        assertEquals(80L, summary.getHeldBalanceCents());
        assertEquals(40L, summary.getDebtBalanceCents());
        assertEquals(250L, summary.getLifetimeRefundedCents());
        assertEquals(750L, summary.getLifetimeNetEarnedCents());
        assertEquals("已结算收益发生退款后会形成待抵扣欠款，后续新收益将优先自动抵扣。",
                summary.getDebtNotice());
    }

    @Test
    void latePayoutRefundDebtBlocksOtherAvailableWithdrawals() {
        CreatorEarning earning = earning(CreatorEarningStatus.AVAILABLE);
        CreatorWallet wallet = wallet(1000L, 0L, 500L);
        wallet.setDebtBalanceCents(100L);
        when(earningMapper.selectByIdForUpdate(10L)).thenReturn(earning);
        when(walletMapper.selectByUserIdForUpdate(7L)).thenReturn(wallet);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.requestSettlement(10L, 7L));

        assertEquals("存在已结算收益退款形成的待抵扣欠款，欠款抵扣完成后才能申请结算",
                exception.getMessage());
        assertEquals(1000L, wallet.getAvailableBalanceCents());
        verify(walletMapper, never()).updateById((CreatorWallet) any());
        verify(earningMapper, never()).updateById((CreatorEarning) any());
    }

    @Test
    void latePayoutRefundDebtAlsoBlocksAlreadyPendingTransfer() {
        CreatorEarning earning = earning(CreatorEarningStatus.PENDING_SETTLEMENT);
        CreatorWallet wallet = wallet(0L, 100L, 0L);
        wallet.setDebtBalanceCents(100L);
        when(earningMapper.selectByIdForUpdate(10L)).thenReturn(earning);
        when(walletMapper.selectByUserIdForUpdate(7L)).thenReturn(wallet);

        assertThrows(BusinessException.class,
                () -> service.markSettled(10L, 99L, "bank-transfer-1"));

        assertEquals(100L, wallet.getPendingBalanceCents());
        verify(walletMapper, never()).updateById((CreatorWallet) any());
    }

    @Test
    void providerRefundReviewBlocksPayoutWithoutDestroyingEarningState() {
        CreatorEarning earning = earning(CreatorEarningStatus.PENDING_SETTLEMENT);
        ResumeViewOrder reviewOrder = new ResumeViewOrder();
        reviewOrder.setId(2L);
        reviewOrder.setOrderStatus(MarketplaceOrderStatus.REFUND_REQUIRED.name());
        when(orderMapper.selectByEarningIdForUpdate(10L)).thenReturn(reviewOrder);
        when(earningMapper.selectByIdForUpdate(10L)).thenReturn(earning);

        assertThrows(BusinessException.class,
                () -> service.markSettled(10L, 99L, "bank-transfer-1"));

        assertEquals(CreatorEarningStatus.PENDING_SETTLEMENT.name(), earning.getEarningStatus());
        verify(walletMapper, never()).selectByUserIdForUpdate(7L);
    }

    private CreatorEarning earning(CreatorEarningStatus status) {
        CreatorEarning earning = new CreatorEarning();
        earning.setId(10L);
        earning.setSellerUserId(7L);
        earning.setListingId(1L);
        earning.setOrderId(2L);
        earning.setNetAmountCents(100);
        earning.setGrossAmountCents(100);
        earning.setPlatformFeeCents(0);
        earning.setEarningStatus(status.name());
        return earning;
    }

    private CreatorWallet wallet(long available, long pending, long paidOut) {
        CreatorWallet wallet = new CreatorWallet();
        wallet.setUserId(7L);
        wallet.setHeldBalanceCents(0L);
        wallet.setAvailableBalanceCents(available);
        wallet.setPendingBalanceCents(pending);
        wallet.setDebtBalanceCents(0L);
        wallet.setLifetimeEarnedCents(500L);
        wallet.setLifetimeRefundedCents(0L);
        wallet.setPaidOutCents(paidOut);
        wallet.setVersion(0);
        return wallet;
    }
}
