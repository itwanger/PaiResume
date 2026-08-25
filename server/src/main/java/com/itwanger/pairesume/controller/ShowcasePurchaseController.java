package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.CreateShowcasePurchaseOrderDTO;
import com.itwanger.pairesume.dto.ShowcasePurchaseOrderDTO;
import com.itwanger.pairesume.service.ShowcasePurchaseService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/public/showcases")
@RequiredArgsConstructor
public class ShowcasePurchaseController {
    private static final String TOKEN_HEADER = "X-Showcase-Purchase-Token";

    private final ShowcasePurchaseService purchaseService;

    @PostMapping("/{slug}/orders")
    public Result<ShowcasePurchaseOrderDTO> create(
            @PathVariable String slug,
            @RequestHeader(TOKEN_HEADER) String purchaseToken,
            @Valid @RequestBody CreateShowcasePurchaseOrderDTO dto,
            HttpServletRequest request
    ) {
        return Result.success(purchaseService.createOrder(
                slug, purchaseToken, dto.getIdempotencyKey(), request.getRemoteAddr()));
    }

    @GetMapping("/orders/{orderNo}")
    public Result<ShowcasePurchaseOrderDTO> get(
            @PathVariable String orderNo,
            @RequestHeader(TOKEN_HEADER) String purchaseToken
    ) {
        return Result.success(purchaseService.getOrder(orderNo, purchaseToken));
    }

    @PostMapping("/orders/{orderNo}/refresh")
    public Result<ShowcasePurchaseOrderDTO> refresh(
            @PathVariable String orderNo,
            @RequestHeader(TOKEN_HEADER) String purchaseToken
    ) {
        return Result.success(purchaseService.refreshOrder(orderNo, purchaseToken));
    }
}
