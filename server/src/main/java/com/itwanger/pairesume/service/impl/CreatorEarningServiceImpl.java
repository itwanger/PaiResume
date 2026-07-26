package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.CreatorEarningDTO;
import com.itwanger.pairesume.dto.CreatorWalletSummaryDTO;
import com.itwanger.pairesume.entity.CreatorEarning;
import com.itwanger.pairesume.entity.CreatorWallet;
import com.itwanger.pairesume.entity.ResumeMarketListing;
import com.itwanger.pairesume.entity.ResumeViewOrder;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.CreatorEarningMapper;
import com.itwanger.pairesume.mapper.CreatorWalletMapper;
import com.itwanger.pairesume.mapper.ResumeMarketListingMapper;
import com.itwanger.pairesume.mapper.ResumeViewOrderMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.payment.CreatorEarningStatus;
import com.itwanger.pairesume.payment.MarketplaceOrderStatus;
import com.itwanger.pairesume.service.CreatorEarningService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class CreatorEarningServiceImpl implements CreatorEarningService {
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private static final String DEBT_NOTICE = "已结算收益发生退款后会形成待抵扣欠款，后续新收益将优先自动抵扣。";

    private final CreatorEarningMapper earningMapper;
    private final CreatorWalletMapper walletMapper;
    private final ResumeMarketListingMapper listingMapper;
    private final ResumeViewOrderMapper orderMapper;
    private final UserMapper userMapper;

    @Override
    @Transactional(readOnly = true)
    public CreatorWalletSummaryDTO getSummary(Long sellerUserId) {
        CreatorWallet wallet = walletMapper.selectById(sellerUserId);
        CreatorWalletSummaryDTO dto = new CreatorWalletSummaryDTO();
        long held = wallet == null ? 0L : value(wallet.getHeldBalanceCents());
        long available = wallet == null ? 0L : value(wallet.getAvailableBalanceCents());
        long pending = wallet == null ? 0L : value(wallet.getPendingBalanceCents());
        long debt = wallet == null ? 0L : value(wallet.getDebtBalanceCents());
        long lifetimeEarned = wallet == null ? 0L : value(wallet.getLifetimeEarnedCents());
        long lifetimeRefunded = wallet == null ? 0L : value(wallet.getLifetimeRefundedCents());
        dto.setHeldBalanceCents(held);
        dto.setAvailableBalanceCents(available);
        dto.setPendingSettlementCents(pending);
        dto.setDebtBalanceCents(debt);
        dto.setDebtNotice(debt > 0 ? DEBT_NOTICE : null);
        dto.setLifetimeEarnedCents(lifetimeEarned);
        dto.setLifetimeRefundedCents(lifetimeRefunded);
        dto.setLifetimeNetEarnedCents(lifetimeEarned - lifetimeRefunded);
        dto.setPaidOutCents(wallet == null ? 0L : value(wallet.getPaidOutCents()));
        dto.setHoldingCount(count(sellerUserId, CreatorEarningStatus.HOLDING));
        dto.setAvailableCount(count(sellerUserId, CreatorEarningStatus.AVAILABLE));
        dto.setPendingSettlementCount(count(sellerUserId, CreatorEarningStatus.PENDING_SETTLEMENT));
        dto.setSettledCount(count(sellerUserId, CreatorEarningStatus.SETTLED));
        dto.setReversedCount(count(sellerUserId, CreatorEarningStatus.REVERSED));
        return dto;
    }

    @Override
    @Transactional(readOnly = true)
    public List<CreatorEarningDTO> listEarnings(Long sellerUserId) {
        return earningMapper.selectList(new LambdaQueryWrapper<CreatorEarning>()
                        .eq(CreatorEarning::getSellerUserId, sellerUserId)
                        .orderByDesc(CreatorEarning::getCreatedAt)
                        .last("LIMIT 200"))
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CreatorEarningDTO> listAdminEarnings(String status) {
        CreatorEarningStatus requestedStatus = parseStatus(status);
        return earningMapper.selectList(new LambdaQueryWrapper<CreatorEarning>()
                        .eq(CreatorEarning::getEarningStatus, requestedStatus.name())
                        .orderByAsc(CreatorEarning::getCreatedAt)
                        .last("LIMIT 200"))
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public long countAdminEarnings(String status) {
        CreatorEarningStatus requestedStatus = parseStatus(status);
        Long count = earningMapper.selectCount(new LambdaQueryWrapper<CreatorEarning>()
                .eq(CreatorEarning::getEarningStatus, requestedStatus.name()));
        return count == null ? 0 : count;
    }

    @Override
    @Transactional
    public CreatorEarningDTO requestSettlement(Long earningId, Long sellerUserId) {
        CreatorEarning earning = requirePayoutEarningForUpdate(earningId);
        if (!Objects.equals(earning.getSellerUserId(), sellerUserId)) {
            throw new BusinessException(ResultCode.CREATOR_EARNING_NOT_FOUND);
        }
        if (CreatorEarningStatus.PENDING_SETTLEMENT.name().equals(earning.getEarningStatus())) {
            return toDto(earning);
        }
        if (!CreatorEarningStatus.AVAILABLE.name().equals(earning.getEarningStatus())) {
            throw new BusinessException(ResultCode.CREATOR_EARNING_ALREADY_SETTLED);
        }

        CreatorWallet wallet = requireWalletForUpdate(sellerUserId);
        if (value(wallet.getDebtBalanceCents()) > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    "存在已结算收益退款形成的待抵扣欠款，欠款抵扣完成后才能申请结算");
        }
        long amount = payableAmount(earning);
        if (amount <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    "该笔收益已全部用于抵扣历史退款欠款，无可结算金额");
        }
        if (wallet.getAvailableBalanceCents() < amount) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "可结算余额不足，请联系管理员核对账本");
        }
        wallet.setAvailableBalanceCents(wallet.getAvailableBalanceCents() - amount);
        wallet.setPendingBalanceCents(wallet.getPendingBalanceCents() + amount);
        wallet.setVersion(wallet.getVersion() + 1);
        walletMapper.updateById(wallet);

        earning.setEarningStatus(CreatorEarningStatus.PENDING_SETTLEMENT.name());
        earningMapper.updateById(earning);
        return toDto(earning);
    }

    @Override
    @Transactional
    public CreatorEarningDTO markSettled(Long earningId, Long adminUserId, String settlementNote) {
        CreatorEarning earning = requirePayoutEarningForUpdate(earningId);
        if (CreatorEarningStatus.SETTLED.name().equals(earning.getEarningStatus())) {
            return toDto(earning);
        }
        if (!CreatorEarningStatus.PENDING_SETTLEMENT.name().equals(earning.getEarningStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "只有待结算收益可确认线下结算");
        }

        CreatorWallet wallet = requireWalletForUpdate(earning.getSellerUserId());
        if (value(wallet.getDebtBalanceCents()) > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    "作者存在待抵扣退款欠款，暂不能确认打款");
        }
        long amount = payableAmount(earning);
        if (amount <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "该笔收益没有可打款金额");
        }
        if (wallet.getPendingBalanceCents() < amount) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "待结算余额不足，请先核对账本");
        }
        wallet.setPendingBalanceCents(wallet.getPendingBalanceCents() - amount);
        wallet.setPaidOutCents(wallet.getPaidOutCents() + amount);
        wallet.setVersion(wallet.getVersion() + 1);
        walletMapper.updateById(wallet);

        earning.setEarningStatus(CreatorEarningStatus.SETTLED.name());
        earning.setSettledBy(adminUserId);
        earning.setSettledAt(LocalDateTime.now());
        earning.setSettlementNote(settlementNote.trim());
        earningMapper.updateById(earning);
        return toDto(earning);
    }

    private long count(Long sellerUserId, CreatorEarningStatus status) {
        return earningMapper.selectCount(new LambdaQueryWrapper<CreatorEarning>()
                .eq(CreatorEarning::getSellerUserId, sellerUserId)
                .eq(CreatorEarning::getEarningStatus, status.name()));
    }

    private CreatorEarningStatus parseStatus(String status) {
        try {
            return CreatorEarningStatus.valueOf(status.trim().toUpperCase());
        } catch (RuntimeException exception) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "收益状态不合法");
        }
    }

    private CreatorEarning requireForUpdate(Long earningId) {
        CreatorEarning earning = earningMapper.selectByIdForUpdate(earningId);
        if (earning == null) {
            throw new BusinessException(ResultCode.CREATOR_EARNING_NOT_FOUND);
        }
        return earning;
    }

    private CreatorEarning requirePayoutEarningForUpdate(Long earningId) {
        // Keep the same lock order as refund handling: order -> earning -> wallet.
        ResumeViewOrder order = orderMapper.selectByEarningIdForUpdate(earningId);
        CreatorEarning earning = requireForUpdate(earningId);
        if (order == null || !Objects.equals(order.getId(), earning.getOrderId())) {
            throw new BusinessException(ResultCode.CREATOR_EARNING_NOT_FOUND);
        }
        if (!MarketplaceOrderStatus.PAID.name().equals(order.getOrderStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    "来源订单正在退款复核或已退款，当前收益不可结算");
        }
        return earning;
    }

    private CreatorWallet requireWalletForUpdate(Long sellerUserId) {
        CreatorWallet wallet = walletMapper.selectByUserIdForUpdate(sellerUserId);
        if (wallet == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "作者收益账户不存在");
        }
        return wallet;
    }

    private CreatorEarningDTO toDto(CreatorEarning earning) {
        ResumeMarketListing listing = listingMapper.selectById(earning.getListingId());
        ResumeViewOrder order = orderMapper.selectById(earning.getOrderId());
        User seller = userMapper.selectById(earning.getSellerUserId());
        CreatorEarningDTO dto = new CreatorEarningDTO();
        dto.setId(earning.getId());
        dto.setSellerUserId(earning.getSellerUserId());
        dto.setSellerEmail(seller == null ? null : seller.getEmail());
        dto.setListingId(earning.getListingId());
        dto.setListingSlug(listing == null ? null : listing.getSlug());
        dto.setOrderNo(order == null ? null : order.getOrderNo());
        dto.setSourceOrderStatus(order == null ? null : order.getOrderStatus());
        dto.setGrossAmountCents(earning.getGrossAmountCents());
        dto.setPlatformFeeCents(earning.getPlatformFeeCents());
        dto.setNetAmountCents(earning.getNetAmountCents());
        dto.setWalletCreditCents(earning.getWalletCreditCents());
        dto.setDebtOffsetCents(earning.getDebtOffsetCents());
        dto.setEarningStatus(earning.getEarningStatus());
        dto.setAvailableAt(format(earning.getAvailableAt()));
        dto.setReversedAt(format(earning.getReversedAt()));
        dto.setReversedFromStatus(earning.getReversedFromStatus());
        dto.setReversalReason(earning.getReversalReason());
        dto.setSettledAt(format(earning.getSettledAt()));
        dto.setSettlementNote(earning.getSettlementNote());
        dto.setCreatedAt(format(earning.getCreatedAt()));
        return dto;
    }

    private String format(LocalDateTime value) {
        return value == null ? null : TIME_FORMAT.format(value);
    }

    private long payableAmount(CreatorEarning earning) {
        return earning.getWalletCreditCents() == null
                ? Math.max(0, earning.getNetAmountCents())
                : Math.max(0, earning.getWalletCreditCents());
    }

    private long value(Long amount) {
        return amount == null ? 0L : amount;
    }
}
