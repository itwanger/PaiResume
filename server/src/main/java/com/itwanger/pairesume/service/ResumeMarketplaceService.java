package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.AdminMarketListingDTO;
import com.itwanger.pairesume.dto.AdminMarketModerationDTO;
import com.itwanger.pairesume.dto.CreatorMarketListingDTO;
import com.itwanger.pairesume.dto.MarketListingAccessDTO;
import com.itwanger.pairesume.dto.MarketListingCardDTO;
import com.itwanger.pairesume.dto.MarketListingContentDTO;
import com.itwanger.pairesume.dto.MarketListingUpsertDTO;
import com.itwanger.pairesume.dto.MarketPrivacyConfirmationDTO;
import com.itwanger.pairesume.dto.MarketplacePageDTO;

import java.util.List;

public interface ResumeMarketplaceService {
    MarketplacePageDTO<MarketListingCardDTO> listPublished(
            int page,
            int size,
            String query,
            String accessType
    );

    MarketListingCardDTO getPublicOffer(String slug);

    void recordView(String slug, String clientIp);

    MarketListingContentDTO getFreeContent(String slug);

    MarketListingAccessDTO getAccess(String slug, Long userId, boolean admin);

    MarketListingContentDTO getContent(String slug, Long userId, boolean admin);

    List<CreatorMarketListingDTO> listCreatorListings(Long userId);

    CreatorMarketListingDTO getCreatorListing(Long userId, Long resumeId);

    CreatorMarketListingDTO publish(Long userId, Long resumeId, MarketListingUpsertDTO dto);

    CreatorMarketListingDTO unpublish(Long userId, Long resumeId);

    void unpublishDeletedResume(Long resumeId, Long userId);

    CreatorMarketListingDTO refreshRevision(
            Long userId,
            Long resumeId,
            MarketPrivacyConfirmationDTO dto
    );

    MarketplacePageDTO<AdminMarketListingDTO> listAdminListings(
            int page,
            int size,
            String publicationStatus,
            String moderationStatus,
            String reviewStatus
    );

    AdminMarketListingDTO moderate(
            Long listingId,
            Long adminUserId,
            AdminMarketModerationDTO dto
    );
}
