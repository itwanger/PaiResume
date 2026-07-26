package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.CreatorEarningDTO;
import com.itwanger.pairesume.dto.CreatorWalletSummaryDTO;

import java.util.List;

public interface CreatorEarningService {
    CreatorWalletSummaryDTO getSummary(Long sellerUserId);

    List<CreatorEarningDTO> listEarnings(Long sellerUserId);

    List<CreatorEarningDTO> listAdminEarnings(String status);

    long countAdminEarnings(String status);

    CreatorEarningDTO requestSettlement(Long earningId, Long sellerUserId);

    CreatorEarningDTO markSettled(Long earningId, Long adminUserId, String settlementNote);
}
