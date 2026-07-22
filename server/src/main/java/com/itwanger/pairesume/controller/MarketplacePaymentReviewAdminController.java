package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.MarketplacePaymentReviewDTO;
import com.itwanger.pairesume.dto.ConfirmMarketplaceRefundDTO;
import com.itwanger.pairesume.service.MarketplaceOrderService;
import com.itwanger.pairesume.util.SecurityUtils;
import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "管理员支付复核")
@RestController
@RequestMapping("/admin/marketplace/payment-reviews")
@RequiredArgsConstructor
public class MarketplacePaymentReviewAdminController {
    private final MarketplaceOrderService marketplaceOrderService;

    @Operation(summary = "查询待人工退款或重复支付订单（最多 200 条）")
    @GetMapping
    public Result<List<MarketplacePaymentReviewDTO>> list(
            @RequestParam(required = false) String status
    ) {
        return Result.success(marketplaceOrderService.listPaymentReviews(status));
    }

    @Operation(summary = "查询仍待支付平台关闭确认的失效销售订单（最多 200 条）")
    @GetMapping("/close-work")
    public Result<List<MarketplacePaymentReviewDTO>> closeWork() {
        return Result.success(marketplaceOrderService.listOutstandingCloseWork());
    }

    @Operation(summary = "按订单号查询支付与退款复核信息")
    @GetMapping("/{orderNo}")
    public Result<MarketplacePaymentReviewDTO> detail(@PathVariable String orderNo) {
        return Result.success(marketplaceOrderService.getPaymentReview(orderNo));
    }

    @Operation(summary = "确认已在微信商户平台完成全额退款并反冲权益与作者账本（本接口不发起退款）")
    @PostMapping("/{orderNo}/confirm-refunded")
    public Result<MarketplacePaymentReviewDTO> confirmRefunded(
            @PathVariable String orderNo,
            @Valid @RequestBody ConfirmMarketplaceRefundDTO dto
    ) {
        return Result.success(marketplaceOrderService.confirmManualRefund(
                orderNo,
                SecurityUtils.getCurrentUserId(),
                dto.getRefundReference(),
                dto.getNote()
        ));
    }
}
