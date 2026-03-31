package com.itwanger.pairesume.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.ResumeAnalysisRequestDTO;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.service.AiService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "简历分析接口")
@RestController
@RequestMapping("/resumes/{resumeId}")
public class ResumeAnalysisController {

    private final AiService aiService;
    private final ResumeMapper resumeMapper;
    private final ResumeModuleMapper moduleMapper;

    public ResumeAnalysisController(AiService aiService, ResumeMapper resumeMapper, ResumeModuleMapper moduleMapper) {
        this.aiService = aiService;
        this.resumeMapper = resumeMapper;
        this.moduleMapper = moduleMapper;
    }

    @Operation(summary = "AI 分析整份简历")
    @PostMapping("/analysis")
    public Result<?> analyzeResume(@PathVariable Long resumeId, @RequestBody(required = false) ResumeAnalysisRequestDTO request) {
        var userId = getCurrentUserId();
        var resume = resumeMapper.selectById(resumeId);
        if (resume == null || !resume.getUserId().equals(userId) || resume.getStatus() == 0) {
            throw new BusinessException(ResultCode.RESUME_NOT_FOUND);
        }

        List<ResumeModule> modules = moduleMapper.selectList(
                new LambdaQueryWrapper<ResumeModule>()
                        .eq(ResumeModule::getResumeId, resumeId)
                        .orderByAsc(ResumeModule::getSortOrder)
                        .orderByAsc(ResumeModule::getId)
        );

        if (modules.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请先完善简历内容后再进行分析");
        }

        var result = aiService.analyzeResume(resume.getTitle(), modules, request == null ? null : request.getPrompt());
        return Result.success(result);
    }

    private Long getCurrentUserId() {
        return (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
