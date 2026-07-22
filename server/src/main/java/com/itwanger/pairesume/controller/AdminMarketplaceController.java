package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.AdminMarketListingDTO;
import com.itwanger.pairesume.dto.AdminMarketModerationDTO;
import com.itwanger.pairesume.dto.MarketplacePageDTO;
import com.itwanger.pairesume.service.ResumeMarketplaceService;
import com.itwanger.pairesume.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "简历市场管理接口")
@RestController
@RequestMapping("/admin/marketplace/listings")
@RequiredArgsConstructor
public class AdminMarketplaceController {
    private final ResumeMarketplaceService resumeMarketplaceService;

    @Operation(summary = "获取用户公开简历管理列表")
    @GetMapping
    public Result<MarketplacePageDTO<AdminMarketListingDTO>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String publicationStatus,
            @RequestParam(required = false) String moderationStatus
    ) {
        return Result.success(resumeMarketplaceService.listAdminListings(
                page,
                size,
                publicationStatus,
                moderationStatus
        ));
    }

    @Operation(summary = "通过或暂停用户公开简历")
    @PatchMapping("/{listingId}/moderation")
    public Result<AdminMarketListingDTO> moderate(
            @PathVariable Long listingId,
            @Valid @RequestBody AdminMarketModerationDTO dto
    ) {
        return Result.success(resumeMarketplaceService.moderate(
                listingId,
                SecurityUtils.getCurrentUserId(),
                dto
        ));
    }
}
