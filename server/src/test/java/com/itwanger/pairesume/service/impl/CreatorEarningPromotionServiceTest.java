package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.entity.CreatorEarning;
import com.itwanger.pairesume.entity.CreatorWallet;
import com.itwanger.pairesume.entity.ResumeViewOrder;
import com.itwanger.pairesume.mapper.CreatorEarningMapper;
import com.itwanger.pairesume.mapper.CreatorWalletMapper;
import com.itwanger.pairesume.mapper.ResumeViewOrderMapper;
import com.itwanger.pairesume.payment.CreatorEarningStatus;
import com.itwanger.pairesume.payment.MarketplaceOrderStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CreatorEarningPromotionServiceTest {
    @Mock private CreatorEarningMapper earningMapper;
    @Mock private CreatorWalletMapper walletMapper;
    @Mock private ResumeViewOrderMapper orderMapper;
    @InjectMocks private CreatorEarningPromotionService service;

    @Test
    void dueHoldingIncomeMovesFromHeldToAvailableExactlyOnce() {
        CreatorEarning earning = earning(80);
        CreatorWallet wallet = wallet(80, 20);
        stubReleasable(earning);
        when(walletMapper.selectByUserIdForUpdate(8L)).thenReturn(wallet);

        assertEquals(true, service.promoteOne(30L));
        assertEquals(false, service.promoteOne(30L));

        assertEquals(CreatorEarningStatus.AVAILABLE.name(), earning.getEarningStatus());
        assertEquals(0L, wallet.getHeldBalanceCents());
        assertEquals(100L, wallet.getAvailableBalanceCents());
        verify(walletMapper).updateById(wallet);
        verify(earningMapper).updateById(earning);
    }

    @Test
    void inconsistentHeldBalanceStaysHoldingInsteadOfCreatingMoney() {
        CreatorEarning earning = earning(80);
        CreatorWallet wallet = wallet(30, 20);
        stubReleasable(earning);
        when(walletMapper.selectByUserIdForUpdate(8L)).thenReturn(wallet);

        assertEquals(false, service.promoteOne(30L));

        assertEquals(CreatorEarningStatus.HOLDING.name(), earning.getEarningStatus());
        assertEquals(30L, wallet.getHeldBalanceCents());
        assertEquals(20L, wallet.getAvailableBalanceCents());
        verify(walletMapper, never()).updateById(wallet);
        verify(earningMapper, never()).updateById(earning);
    }

    @Test
    void fullyDebtOffsetIncomeCanFinishHoldWithoutChangingWalletBalance() {
        CreatorEarning earning = earning(0);
        CreatorWallet wallet = wallet(0, 20);
        stubReleasable(earning);
        when(walletMapper.selectByUserIdForUpdate(8L)).thenReturn(wallet);

        assertEquals(true, service.promoteOne(30L));

        assertEquals(CreatorEarningStatus.AVAILABLE.name(), earning.getEarningStatus());
        assertEquals(20L, wallet.getAvailableBalanceCents());
    }

    @Test
    void holdCannotReleaseUntilProviderWasCheckedAfterHoldDeadline() {
        CreatorEarning earning = earning(80);
        ResumeViewOrder order = paidOrder(earning.getAvailableAt().minusSeconds(1));
        when(earningMapper.selectById(30L)).thenReturn(earning);
        when(earningMapper.selectByIdForUpdate(30L)).thenReturn(earning);
        when(orderMapper.selectByIdForUpdate(10L)).thenReturn(order);

        assertEquals(false, service.promoteOne(30L));

        assertEquals(CreatorEarningStatus.HOLDING.name(), earning.getEarningStatus());
        verify(walletMapper, never()).selectByUserIdForUpdate(8L);
    }

    private CreatorEarning earning(int walletCredit) {
        CreatorEarning earning = new CreatorEarning();
        earning.setId(30L);
        earning.setSellerUserId(8L);
        earning.setOrderId(10L);
        earning.setNetAmountCents(100);
        earning.setWalletCreditCents(walletCredit);
        earning.setEarningStatus(CreatorEarningStatus.HOLDING.name());
        earning.setAvailableAt(LocalDateTime.now().minusSeconds(1));
        return earning;
    }

    private void stubReleasable(CreatorEarning earning) {
        when(earningMapper.selectById(30L)).thenReturn(earning);
        when(earningMapper.selectByIdForUpdate(30L)).thenReturn(earning);
        when(orderMapper.selectByIdForUpdate(10L))
                .thenReturn(paidOrder(earning.getAvailableAt().plusSeconds(1)));
    }

    private ResumeViewOrder paidOrder(LocalDateTime reconciledAt) {
        ResumeViewOrder order = new ResumeViewOrder();
        order.setId(10L);
        order.setOrderStatus(MarketplaceOrderStatus.PAID.name());
        order.setProviderReconciledAt(reconciledAt);
        return order;
    }

    private CreatorWallet wallet(long held, long available) {
        CreatorWallet wallet = new CreatorWallet();
        wallet.setUserId(8L);
        wallet.setHeldBalanceCents(held);
        wallet.setAvailableBalanceCents(available);
        wallet.setVersion(0);
        return wallet;
    }
}
