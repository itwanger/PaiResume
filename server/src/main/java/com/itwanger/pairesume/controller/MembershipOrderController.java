package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.CreateMembershipOrderDTO;
import com.itwanger.pairesume.dto.MembershipOrderDTO;
import com.itwanger.pairesume.service.MembershipOrderService;
import com.itwanger.pairesume.util.SecurityUtils;
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
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "会员支付订单")
@RestController
@RequestMapping("/membership/orders")
@RequiredArgsConstructor
public class MembershipOrderController {
    private final MembershipOrderService membershipOrderService;

    @Operation(summary = "创建或复用会员支付订单")
    @PostMapping
    public Result<MembershipOrderDTO> create(@Valid @RequestBody CreateMembershipOrderDTO dto,
                                             HttpServletRequest request) {
        return Result.success(membershipOrderService.createOrder(
                SecurityUtils.getCurrentUserId(), dto.getIdempotencyKey(),
                dto.getPlanCode(), dto.getCouponCode(), request.getRemoteAddr()));
    }

    @Operation(summary = "获取当前活跃会员支付订单")
    @GetMapping("/active")
    public Result<MembershipOrderDTO> getActive() {
        return Result.success(membershipOrderService.getActiveOrder(
                SecurityUtils.getCurrentUserId()));
    }

    @Operation(summary = "获取会员支付订单")
    @GetMapping("/{orderNo}")
    public Result<MembershipOrderDTO> get(@PathVariable String orderNo) {
        return Result.success(membershipOrderService.getOrder(
                orderNo, SecurityUtils.getCurrentUserId()));
    }

    @Operation(summary = "主动查询会员支付订单")
    @PostMapping("/{orderNo}/refresh")
    public Result<MembershipOrderDTO> refresh(@PathVariable String orderNo) {
        return Result.success(membershipOrderService.refreshOrder(
                orderNo, SecurityUtils.getCurrentUserId()));
    }
}
