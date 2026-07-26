package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.CreatorEarningDTO;
import com.itwanger.pairesume.dto.SettleCreatorEarningDTO;
import com.itwanger.pairesume.service.CreatorEarningService;
import com.itwanger.pairesume.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@Tag(name = "管理员作者收益结算")
@RestController
@RequestMapping("/admin/creator-earnings")
@RequiredArgsConstructor
public class CreatorEarningAdminController {
    private final CreatorEarningService creatorEarningService;

    @Operation(summary = "获取待线下结算的作者收益（最多 200 条）")
    @GetMapping
    public Result<List<CreatorEarningDTO>> list(
            @RequestParam(defaultValue = "PENDING_SETTLEMENT") String status
    ) {
        return Result.success(creatorEarningService.listAdminEarnings(status));
    }

    @Operation(summary = "精确统计指定状态的作者收益")
    @GetMapping("/count")
    public Result<Long> count(
            @RequestParam(defaultValue = "PENDING_SETTLEMENT") String status
    ) {
        return Result.success(creatorEarningService.countAdminEarnings(status));
    }

    @Operation(summary = "确认线下转账并将收益标记为已结算")
    @PostMapping("/{id}/settle")
    public Result<CreatorEarningDTO> settle(
            @PathVariable Long id,
            @Valid @RequestBody SettleCreatorEarningDTO dto
    ) {
        return Result.success(creatorEarningService.markSettled(
                id, SecurityUtils.getCurrentUserId(), dto.getSettlementNote()));
    }
}
