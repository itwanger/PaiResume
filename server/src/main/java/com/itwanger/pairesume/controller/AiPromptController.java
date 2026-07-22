package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.FieldOptimizePromptConfigDTO;
import com.itwanger.pairesume.service.AiService;
import com.itwanger.pairesume.service.MembershipService;
import com.itwanger.pairesume.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "AI 提示词配置接口")
@RestController
@RequestMapping("/resumes/field-optimize-prompts")
public class AiPromptController {

    private final AiService aiService;
    private final MembershipService membershipService;

    public AiPromptController(AiService aiService, MembershipService membershipService) {
        this.aiService = aiService;
        this.membershipService = membershipService;
    }

    @Operation(summary = "获取字段优化默认提示词配置")
    @GetMapping
    public Result<FieldOptimizePromptConfigDTO> getFieldOptimizePromptConfig() {
        membershipService.requireAiAccess(SecurityUtils.getCurrentUserId());
        return Result.success(aiService.getFieldOptimizePromptConfig());
    }
}
