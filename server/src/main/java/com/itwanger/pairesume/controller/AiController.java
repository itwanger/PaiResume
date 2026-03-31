package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.service.AiService;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "AI 优化接口")
@RestController
@RequestMapping("/resumes/{resumeId}/modules/{moduleId}")
public class AiController {

    private final AiService aiService;
    private final ResumeMapper resumeMapper;
    private final ResumeModuleMapper moduleMapper;

    public AiController(AiService aiService, ResumeMapper resumeMapper, ResumeModuleMapper moduleMapper) {
        this.aiService = aiService;
        this.resumeMapper = resumeMapper;
        this.moduleMapper = moduleMapper;
    }

    @Operation(summary = "AI 优化模块内容")
    @PostMapping("/ai-optimize")
    public Result<Map<String, Object>> aiOptimize(@PathVariable Long resumeId, @PathVariable Long moduleId) {
        var userId = getCurrentUserId();
        validateOwnership(resumeId, userId);

        var module = moduleMapper.selectById(moduleId);
        if (module == null || !module.getResumeId().equals(resumeId)) {
            throw new BusinessException(ResultCode.MODULE_NOT_FOUND);
        }

        var result = aiService.optimizeModule(module.getModuleType(), module.getContent());
        return Result.success(result);
    }

    private void validateOwnership(Long resumeId, Long userId) {
        var resume = resumeMapper.selectById(resumeId);
        if (resume == null || !resume.getUserId().equals(userId) || resume.getStatus() == 0) {
            throw new BusinessException(ResultCode.RESUME_NOT_FOUND);
        }
    }

    private Long getCurrentUserId() {
        return (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
