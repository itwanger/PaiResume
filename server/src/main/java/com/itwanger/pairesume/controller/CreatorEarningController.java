package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.CreatorEarningDTO;
import com.itwanger.pairesume.dto.CreatorWalletSummaryDTO;
import com.itwanger.pairesume.service.CreatorEarningService;
import com.itwanger.pairesume.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "简历作者收益")
@RestController
@RequestMapping("/creator/earnings")
@RequiredArgsConstructor
public class CreatorEarningController {
    private final CreatorEarningService creatorEarningService;

    @Operation(summary = "获取作者收益汇总")
    @GetMapping("/summary")
    public Result<CreatorWalletSummaryDTO> summary() {
        return Result.success(creatorEarningService.getSummary(SecurityUtils.getCurrentUserId()));
    }

    @Operation(summary = "获取作者收益明细")
    @GetMapping
    public Result<List<CreatorEarningDTO>> list() {
        return Result.success(creatorEarningService.listEarnings(SecurityUtils.getCurrentUserId()));
    }

    @Operation(summary = "申请线下结算一笔收益")
    @PostMapping("/{id}/request-settlement")
    public Result<CreatorEarningDTO> requestSettlement(@PathVariable Long id) {
        return Result.success(creatorEarningService.requestSettlement(
                id, SecurityUtils.getCurrentUserId()));
    }
}
