package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.AdminMarketplaceActionDTO;
import com.itwanger.pairesume.dto.MarketplaceAppealDTO;
import com.itwanger.pairesume.dto.MarketplaceAppealRequestDTO;
import com.itwanger.pairesume.dto.MarketplaceGovernanceAuditDTO;
import com.itwanger.pairesume.dto.MarketplacePageDTO;
import com.itwanger.pairesume.dto.MarketplaceReportDTO;
import com.itwanger.pairesume.dto.MarketplaceReportRequestDTO;

import java.util.List;

public interface MarketplaceGovernanceService {
    MarketplaceReportDTO submitReport(String listingSlug, MarketplaceReportRequestDTO dto, String clientIp);

    MarketplaceAppealDTO submitAppeal(Long creatorUserId, Long listingId, MarketplaceAppealRequestDTO dto);

    List<MarketplaceAppealDTO> listCreatorAppeals(Long creatorUserId);

    MarketplacePageDTO<MarketplaceReportDTO> listReports(int page, int size, String status);

    MarketplaceReportDTO handleReport(Long reportId, Long adminUserId, AdminMarketplaceActionDTO dto);

    MarketplacePageDTO<MarketplaceAppealDTO> listAppeals(int page, int size, String status);

    MarketplaceAppealDTO handleAppeal(Long appealId, Long adminUserId, AdminMarketplaceActionDTO dto);

    MarketplacePageDTO<MarketplaceGovernanceAuditDTO> listAudits(int page, int size, Long listingId);
}
