package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.MarketListingAccessDTO;
import com.itwanger.pairesume.dto.MarketListingContentDTO;
import com.itwanger.pairesume.service.ResumeMarketplaceService;
import com.itwanger.pairesume.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "简历市场访问接口")
@RestController
@RequestMapping("/marketplace/listings")
@RequiredArgsConstructor
public class MarketplaceController {
    private final ResumeMarketplaceService resumeMarketplaceService;

    @Operation(summary = "获取当前用户的简历访问状态")
    @GetMapping("/{slug}/access")
    public Result<MarketListingAccessDTO> access(@PathVariable String slug) {
        return Result.success(resumeMarketplaceService.getAccess(
                slug,
                SecurityUtils.getCurrentUserId(),
                SecurityUtils.isAdmin()
        ));
    }

    @Operation(summary = "查看已获授权的简历内容")
    @GetMapping("/{slug}/content")
    public Result<MarketListingContentDTO> content(@PathVariable String slug) {
        return Result.success(resumeMarketplaceService.getContent(
                slug,
                SecurityUtils.getCurrentUserId(),
                SecurityUtils.isAdmin()
        ));
    }
}
