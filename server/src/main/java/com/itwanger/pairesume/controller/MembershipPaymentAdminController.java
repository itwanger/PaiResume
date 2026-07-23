package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.MarketplacePageDTO;
import com.itwanger.pairesume.dto.MembershipPaymentAdminActionDTO;
import com.itwanger.pairesume.dto.MembershipPaymentAdminOrderDTO;
import com.itwanger.pairesume.dto.MembershipPaymentAdminSummaryDTO;
import com.itwanger.pairesume.service.MembershipPaymentAdminService;
import com.itwanger.pairesume.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "会员支付订单管理")
@RestController
@RequestMapping("/admin/membership/payment-orders")
@RequiredArgsConstructor
public class MembershipPaymentAdminController {
    private final MembershipPaymentAdminService adminService;

    @Operation(summary = "分页查询会员支付订单")
    @GetMapping
    public Result<MarketplacePageDTO<MembershipPaymentAdminOrderDTO>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String orderStatus,
            @RequestParam(required = false) String reviewStatus) {
        return Result.success(adminService.listOrders(page, size, orderStatus, reviewStatus));
    }

    @Operation(summary = "查看会员支付订单及人工处置审计记录")
    @GetMapping("/{orderNo}")
    public Result<MembershipPaymentAdminOrderDTO> detail(@PathVariable String orderNo) {
        return Result.success(adminService.getOrder(orderNo));
    }

    @Operation(summary = "查询会员支付异常和对账告警汇总")
    @GetMapping("/summary")
    public Result<MembershipPaymentAdminSummaryDTO> summary() {
        return Result.success(adminService.summary());
    }

    @Operation(summary = "标记为退款处理中（本接口不调用支付平台退款）")
    @PostMapping("/{orderNo}/refund-processing")
    public Result<MembershipPaymentAdminOrderDTO> startRefund(
            @PathVariable String orderNo,
            @Valid @RequestBody MembershipPaymentAdminActionDTO dto) {
        return Result.success(adminService.startRefund(orderNo, SecurityUtils.getCurrentUserId(),
                dto.getReason(), dto.getRefundReference()));
    }

    @Operation(summary = "确认已在支付平台完成退款（本接口不调用支付平台退款）")
    @PostMapping("/{orderNo}/confirm-refunded")
    public Result<MembershipPaymentAdminOrderDTO> confirmRefunded(
            @PathVariable String orderNo,
            @Valid @RequestBody MembershipPaymentAdminActionDTO dto) {
        return Result.success(adminService.confirmRefunded(orderNo, SecurityUtils.getCurrentUserId(),
                dto.getReason(), dto.getRefundReference()));
    }

    @Operation(summary = "驳回退款复核")
    @PostMapping("/{orderNo}/reject")
    public Result<MembershipPaymentAdminOrderDTO> reject(
            @PathVariable String orderNo,
            @Valid @RequestBody MembershipPaymentAdminActionDTO dto) {
        return Result.success(adminService.rejectRefund(orderNo, SecurityUtils.getCurrentUserId(),
                dto.getReason()));
    }

    @Operation(summary = "关闭人工复核")
    @PostMapping("/{orderNo}/close")
    public Result<MembershipPaymentAdminOrderDTO> close(
            @PathVariable String orderNo,
            @Valid @RequestBody MembershipPaymentAdminActionDTO dto) {
        return Result.success(adminService.closeReview(orderNo, SecurityUtils.getCurrentUserId(),
                dto.getReason()));
    }
}
