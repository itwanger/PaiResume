package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.CouponQuoteDTO;
import com.itwanger.pairesume.dto.MembershipQuoteRequestDTO;
import com.itwanger.pairesume.dto.RedeemVipInviteDTO;
import com.itwanger.pairesume.dto.VipInviteRedemptionDTO;
import com.itwanger.pairesume.service.MembershipService;
import com.itwanger.pairesume.service.VipInviteService;
import com.itwanger.pairesume.util.SecurityUtils;
import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

@Tag(name = "会员接口")
@RestController
@RequestMapping("/membership")
@RequiredArgsConstructor
public class MembershipController {
    private final MembershipService membershipService;
    private final VipInviteService vipInviteService;

    @Operation(summary = "会员价格报价")
    @PostMapping("/quote")
    public Result<CouponQuoteDTO> quote(@RequestBody(required = false) MembershipQuoteRequestDTO dto) {
        return Result.success(membershipService.quote(
                SecurityUtils.getCurrentUserId(), dto == null ? null : dto.getCouponCode()));
    }

    @Operation(summary = "兑换 VIP 邀请码")
    @PostMapping("/redeem-invite")
    public Result<VipInviteRedemptionDTO> redeemInvite(
            @Valid @RequestBody RedeemVipInviteDTO dto,
            HttpServletRequest request
    ) {
        return Result.success(vipInviteService.redeem(
                SecurityUtils.getCurrentUserId(),
                dto.getCode(),
                request.getRemoteAddr()
        ));
    }
}
