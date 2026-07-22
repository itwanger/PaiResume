package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.entity.CreatorEarning;
import com.itwanger.pairesume.entity.CreatorWallet;
import com.itwanger.pairesume.entity.ResumeViewOrder;
import com.itwanger.pairesume.mapper.CreatorEarningMapper;
import com.itwanger.pairesume.mapper.CreatorWalletMapper;
import com.itwanger.pairesume.mapper.ResumeViewOrderMapper;
import com.itwanger.pairesume.payment.CreatorEarningStatus;
import com.itwanger.pairesume.payment.MarketplaceOrderStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CreatorEarningPromotionService {
    private final CreatorEarningMapper earningMapper;
    private final CreatorWalletMapper walletMapper;
    private final ResumeViewOrderMapper orderMapper;

    /** Lists at most 100 earnings whose hold deadline has a later verified provider check. */
    @Transactional(readOnly = true)
    public List<Long> listDueCandidateIds() {
        return earningMapper.selectDueHoldingCandidateIds();
    }

    @Transactional
    public boolean promoteOne(Long earningId) {
        CreatorEarning snapshot = earningMapper.selectById(earningId);
        if (snapshot == null) {
            return false;
        }
        // Order first matches refund/review lock ordering. A final provider
        // check is therefore impossible to race past this release decision.
        ResumeViewOrder order = orderMapper.selectByIdForUpdate(snapshot.getOrderId());
        CreatorEarning earning = earningMapper.selectByIdForUpdate(earningId);
        if (order == null || earning == null
                || !CreatorEarningStatus.HOLDING.name().equals(earning.getEarningStatus())
                || earning.getAvailableAt() == null
                || earning.getAvailableAt().isAfter(java.time.LocalDateTime.now())
                || !MarketplaceOrderStatus.PAID.name().equals(order.getOrderStatus())
                || order.getProviderReconciledAt() == null
                || order.getProviderReconciledAt().isBefore(earning.getAvailableAt())) {
            return false;
        }
        walletMapper.ensureWallet(earning.getSellerUserId());
        CreatorWallet wallet = walletMapper.selectByUserIdForUpdate(earning.getSellerUserId());
        if (wallet == null) {
            log.error("Cannot release creator earning because wallet is missing earningId={}", earning.getId());
            return false;
        }
        long amount = earning.getWalletCreditCents() == null
                ? earning.getNetAmountCents() : earning.getWalletCreditCents();
        amount = Math.max(0L, amount);
        long held = nonNegative(wallet.getHeldBalanceCents());
        if (held < amount) {
            log.error("Cannot release creator earning because held balance is short "
                            + "earningId={}, sellerUserId={}, required={}, held={}",
                    earning.getId(), earning.getSellerUserId(), amount, held);
            return false;
        }
        wallet.setHeldBalanceCents(held - amount);
        wallet.setAvailableBalanceCents(nonNegative(wallet.getAvailableBalanceCents()) + amount);
        wallet.setVersion(wallet.getVersion() == null ? 1 : wallet.getVersion() + 1);
        walletMapper.updateById(wallet);

        earning.setEarningStatus(CreatorEarningStatus.AVAILABLE.name());
        earningMapper.updateById(earning);
        return true;
    }

    private long nonNegative(Long value) {
        return value == null ? 0L : Math.max(0L, value);
    }
}
