package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.CompleteVipInviteClaimDTO;
import com.itwanger.pairesume.dto.CreateVipInviteClaimDTO;
import com.itwanger.pairesume.dto.VipInviteClaimCreatedDTO;
import com.itwanger.pairesume.dto.VipInviteClaimResultDTO;
import com.itwanger.pairesume.service.VipInviteClaimService;
import com.itwanger.pairesume.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "知识星球 VIP 邀请码领取")
@RestController
@RequiredArgsConstructor
public class VipInviteClaimController {

    private final VipInviteClaimService claimService;

    @Operation(summary = "未登录用户验证邀请码并创建短期领取流程")
    @PostMapping("/public/vip-invite-claims")
    public Result<VipInviteClaimCreatedDTO> create(
            @Valid @RequestBody CreateVipInviteClaimDTO dto,
            HttpServletRequest request
    ) {
        return Result.success(claimService.create(dto.getCode(), request.getRemoteAddr()));
    }

    @Operation(summary = "登录并同意条款后完成邀请码领取")
    @PostMapping("/membership/vip-invite-claims/complete")
    public Result<VipInviteClaimResultDTO> complete(
            @Valid @RequestBody CompleteVipInviteClaimDTO dto
    ) {
        return Result.success(claimService.complete(
                SecurityUtils.getCurrentUserId(), dto.getClaimToken()
        ));
    }
}
