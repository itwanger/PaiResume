package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.CouponQuoteDTO;
import com.itwanger.pairesume.dto.MembershipQuoteRequestDTO;
import com.itwanger.pairesume.service.MembershipService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "会员接口")
@RestController
@RequestMapping("/membership")
@RequiredArgsConstructor
public class MembershipController {
    private final MembershipService membershipService;

    @Operation(summary = "会员价格报价")
    @PostMapping("/quote")
    public Result<CouponQuoteDTO> quote(@RequestBody(required = false) MembershipQuoteRequestDTO dto) {
        return Result.success(membershipService.quote(dto == null ? null : dto.getCouponCode()));
    }
}
