package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.MarketListingCardDTO;
import com.itwanger.pairesume.dto.MarketListingContentDTO;
import com.itwanger.pairesume.dto.MarketplacePageDTO;
import com.itwanger.pairesume.dto.MarketplaceReportDTO;
import com.itwanger.pairesume.dto.MarketplaceReportRequestDTO;
import com.itwanger.pairesume.service.MarketplaceGovernanceService;
import com.itwanger.pairesume.service.ResumeMarketplaceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "公开简历市场接口")
@RestController
@RequestMapping("/public/marketplace/listings")
@RequiredArgsConstructor
public class MarketplacePublicController {
    private final ResumeMarketplaceService resumeMarketplaceService;
    private final MarketplaceGovernanceService marketplaceGovernanceService;

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

    @Operation(summary = "记录公开简历浏览")
    @PostMapping("/{slug}/views")
    public Result<Void> recordView(@PathVariable String slug, HttpServletRequest request) {
        resumeMarketplaceService.recordView(slug, request.getRemoteAddr());
        return Result.success();
    }

    @Operation(summary = "举报用户公开简历或提交侵权投诉")
    @PostMapping("/{slug}/reports")
    public Result<MarketplaceReportDTO> report(
            @PathVariable String slug,
            @Valid @RequestBody MarketplaceReportRequestDTO dto,
            HttpServletRequest request
    ) {
        return Result.success(marketplaceGovernanceService.submitReport(
                slug, dto, request.getRemoteAddr()));
    }

    @Operation(summary = "查看免费公开简历")
    @GetMapping("/{slug}/content")
    public Result<MarketListingContentDTO> freeContent(@PathVariable String slug) {
        return Result.success(resumeMarketplaceService.getFreeContent(slug));
    }
}
