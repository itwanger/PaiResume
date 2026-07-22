package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.CreateMarketplaceOrderDTO;
import com.itwanger.pairesume.dto.MarketplaceOrderDTO;
import com.itwanger.pairesume.service.MarketplaceOrderService;
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

@Tag(name = "简历市场支付订单")
@RestController
@RequestMapping("/marketplace")
@RequiredArgsConstructor
public class MarketplaceOrderController {
    private final MarketplaceOrderService marketplaceOrderService;

    @Operation(summary = "创建或复用简历查看订单")
    @PostMapping("/listings/{slug}/orders")
    public Result<MarketplaceOrderDTO> create(
            @PathVariable String slug,
            @Valid @RequestBody CreateMarketplaceOrderDTO dto,
            HttpServletRequest request
    ) {
        return Result.success(marketplaceOrderService.createOrder(
                slug,
                SecurityUtils.getCurrentUserId(),
                SecurityUtils.isAdmin(),
                dto.getIdempotencyKey(),
                request.getRemoteAddr()
        ));
    }

    @Operation(summary = "获取支付订单状态")
    @GetMapping("/orders/{orderNo}")
    public Result<MarketplaceOrderDTO> get(@PathVariable String orderNo) {
        return Result.success(marketplaceOrderService.getOrder(
                orderNo,
                SecurityUtils.getCurrentUserId(),
                SecurityUtils.isAdmin()
        ));
    }

    @Operation(summary = "向支付平台主动查单并刷新状态")
    @PostMapping("/orders/{orderNo}/refresh")
    public Result<MarketplaceOrderDTO> refresh(@PathVariable String orderNo) {
        return Result.success(marketplaceOrderService.refreshOrder(
                orderNo,
                SecurityUtils.getCurrentUserId(),
                SecurityUtils.isAdmin()
        ));
    }
}
