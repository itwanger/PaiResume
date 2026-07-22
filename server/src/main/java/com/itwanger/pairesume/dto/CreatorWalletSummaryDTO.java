package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class CreatorWalletSummaryDTO {
    private Long heldBalanceCents;
    private Long availableBalanceCents;
    private Long pendingSettlementCents;
    private Long debtBalanceCents;
    private String debtNotice;
    private Long lifetimeEarnedCents;
    private Long lifetimeRefundedCents;
    private Long lifetimeNetEarnedCents;
    private Long paidOutCents;
    private Long holdingCount;
    private Long availableCount;
    private Long pendingSettlementCount;
    private Long settledCount;
    private Long reversedCount;
}
