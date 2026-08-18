package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.ResumeAnalysisPromptConfigDTO;
import com.itwanger.pairesume.dto.UpdateResumeAnalysisPromptDTO;
import com.itwanger.pairesume.service.ResumeAnalysisPromptConfigService;
import com.itwanger.pairesume.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "管理后台简历分析提示词")
@RestController
@RequestMapping("/admin/resume-analysis-prompts")
@RequiredArgsConstructor
public class AdminResumeAnalysisPromptController {
    private final ResumeAnalysisPromptConfigService service;

    @Operation(summary = "获取全部求职场景分析提示词")
    @GetMapping
    public Result<List<ResumeAnalysisPromptConfigDTO>> list() {
        return Result.success(service.listAdminConfigs());
    }

    @Operation(summary = "更新指定求职场景分析提示词")
    @PutMapping("/{scenarioCode}")
    public Result<ResumeAnalysisPromptConfigDTO> update(
            @PathVariable String scenarioCode,
            @Valid @RequestBody UpdateResumeAnalysisPromptDTO request
    ) {
        return Result.success(service.update(
                scenarioCode,
                request.getPrompt(),
                SecurityUtils.getCurrentUserId()
        ));
    }
}
