package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.MarketListingCardDTO;
import com.itwanger.pairesume.dto.MarketListingContentDTO;
import com.itwanger.pairesume.dto.MarketplacePageDTO;
import com.itwanger.pairesume.service.ResumeMarketplaceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "公开简历市场接口")
@RestController
@RequestMapping("/public/marketplace/listings")
@RequiredArgsConstructor
public class MarketplacePublicController {
    private final ResumeMarketplaceService resumeMarketplaceService;

    @Operation(summary = "获取公开简历市场列表")
    @GetMapping
    public Result<MarketplacePageDTO<MarketListingCardDTO>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false, name = "q") String query,
            @RequestParam(required = false) String accessType
    ) {
        return Result.success(resumeMarketplaceService.listPublished(page, size, query, accessType));
    }

    @Operation(summary = "获取公开简历报价与摘要")
    @GetMapping("/{slug}")
    public Result<MarketListingCardDTO> detail(@PathVariable String slug) {
        return Result.success(resumeMarketplaceService.getPublicOffer(slug));
    }

    @Operation(summary = "获取公开简历报价与摘要（兼容路径）")
    @GetMapping("/{slug}/offer")
    public Result<MarketListingCardDTO> offer(@PathVariable String slug) {
        return Result.success(resumeMarketplaceService.getPublicOffer(slug));
    }

    @Operation(summary = "查看免费公开简历")
    @GetMapping("/{slug}/content")
    public Result<MarketListingContentDTO> freeContent(@PathVariable String slug) {
        return Result.success(resumeMarketplaceService.getFreeContent(slug));
    }
}
