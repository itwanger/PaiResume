package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.AdminMarketplaceActionDTO;
import com.itwanger.pairesume.dto.MarketplaceAppealDTO;
import com.itwanger.pairesume.dto.MarketplaceGovernanceAuditDTO;
import com.itwanger.pairesume.dto.MarketplacePageDTO;
import com.itwanger.pairesume.dto.MarketplaceReportDTO;
import com.itwanger.pairesume.service.MarketplaceGovernanceService;
import com.itwanger.pairesume.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "简历市场治理接口")
@RestController
@RequestMapping("/admin/marketplace")
@RequiredArgsConstructor
public class AdminMarketplaceGovernanceController {
    private final MarketplaceGovernanceService governanceService;

    @Operation(summary = "分页查看市场举报与侵权投诉")
    @GetMapping("/reports")
    public Result<MarketplacePageDTO<MarketplaceReportDTO>> reports(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status
    ) {
        return Result.success(governanceService.listReports(page, size, status));
    }

    @Operation(summary = "处理市场举报，可结案、驳回或下架条目")
    @PatchMapping("/reports/{reportId}")
    public Result<MarketplaceReportDTO> handleReport(
            @PathVariable Long reportId,
            @Valid @RequestBody AdminMarketplaceActionDTO dto
    ) {
        return Result.success(governanceService.handleReport(
                reportId, SecurityUtils.getCurrentUserId(), dto));
    }

    @Operation(summary = "分页查看创作者申诉")
    @GetMapping("/appeals")
    public Result<MarketplacePageDTO<MarketplaceAppealDTO>> appeals(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status
    ) {
        return Result.success(governanceService.listAppeals(page, size, status));
    }

    @Operation(summary = "通过或驳回创作者申诉")
    @PatchMapping("/appeals/{appealId}")
    public Result<MarketplaceAppealDTO> handleAppeal(
            @PathVariable Long appealId,
            @Valid @RequestBody AdminMarketplaceActionDTO dto
    ) {
        return Result.success(governanceService.handleAppeal(
                appealId, SecurityUtils.getCurrentUserId(), dto));
    }

    @Operation(summary = "分页查看市场治理审计轨迹")
    @GetMapping("/audits")
    public Result<MarketplacePageDTO<MarketplaceGovernanceAuditDTO>> audits(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Long listingId
    ) {
        return Result.success(governanceService.listAudits(page, size, listingId));
    }
}
