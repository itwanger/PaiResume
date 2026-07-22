package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.CreatorMarketListingDTO;
import com.itwanger.pairesume.dto.MarketListingUpsertDTO;
import com.itwanger.pairesume.dto.MarketPrivacyConfirmationDTO;
import com.itwanger.pairesume.service.ResumeMarketplaceService;
import com.itwanger.pairesume.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "简历作者市场接口")
@RestController
@RequestMapping("/creator")
@RequiredArgsConstructor
public class CreatorMarketplaceController {
    private final ResumeMarketplaceService resumeMarketplaceService;

    @Operation(summary = "获取我的公开简历")
    @GetMapping("/listings")
    public Result<List<CreatorMarketListingDTO>> list() {
        return Result.success(resumeMarketplaceService.listCreatorListings(SecurityUtils.getCurrentUserId()));
    }

    @Operation(summary = "获取指定简历的公开设置")
    @GetMapping("/resumes/{resumeId}/listing")
    public Result<CreatorMarketListingDTO> detail(@PathVariable Long resumeId) {
        return Result.success(resumeMarketplaceService.getCreatorListing(
                SecurityUtils.getCurrentUserId(),
                resumeId
        ));
    }

    @Operation(summary = "公开或更新简历市场版本")
    @PutMapping("/resumes/{resumeId}/listing")
    public Result<CreatorMarketListingDTO> publish(
            @PathVariable Long resumeId,
            @Valid @RequestBody MarketListingUpsertDTO dto
    ) {
        return Result.success(resumeMarketplaceService.publish(
                SecurityUtils.getCurrentUserId(),
                resumeId,
                dto
        ));
    }

    @Operation(summary = "下架公开简历")
    @PostMapping("/resumes/{resumeId}/listing/unpublish")
    public Result<CreatorMarketListingDTO> unpublish(@PathVariable Long resumeId) {
        return Result.success(resumeMarketplaceService.unpublish(
                SecurityUtils.getCurrentUserId(),
                resumeId
        ));
    }

    @Operation(summary = "从实时简历生成新的公开版本")
    @PostMapping("/resumes/{resumeId}/listing/refresh-revision")
    public Result<CreatorMarketListingDTO> refreshRevision(
            @PathVariable Long resumeId,
            @RequestBody MarketPrivacyConfirmationDTO dto
    ) {
        return Result.success(resumeMarketplaceService.refreshRevision(
                SecurityUtils.getCurrentUserId(),
                resumeId,
                dto
        ));
    }
}
