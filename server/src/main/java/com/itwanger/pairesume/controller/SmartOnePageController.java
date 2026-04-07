package com.itwanger.pairesume.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.SmartOnePagePreviewRequestDTO;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.service.AiService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "智能一页接口")
@RestController
@RequestMapping("/resumes/{resumeId}/smart-onepage")
public class SmartOnePageController {

    private final AiService aiService;
    private final ResumeMapper resumeMapper;
    private final ResumeModuleMapper moduleMapper;

    public SmartOnePageController(AiService aiService, ResumeMapper resumeMapper, ResumeModuleMapper moduleMapper) {
        this.aiService = aiService;
        this.resumeMapper = resumeMapper;
        this.moduleMapper = moduleMapper;
    }

    @Operation(summary = "生成智能一页预览")
    @PostMapping("/preview")
    public Result<?> preview(@PathVariable Long resumeId, @RequestBody SmartOnePagePreviewRequestDTO request) {
        var userId = getCurrentUserId();
        var resume = resumeMapper.selectById(resumeId);
        if (resume == null || !resume.getUserId().equals(userId) || resume.getStatus() == 0) {
            throw new BusinessException(ResultCode.RESUME_NOT_FOUND);
        }

        if (request == null || request.getMode() == null || request.getMode().isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "缺少智能一页生成参数");
        }

        var modules = moduleMapper.selectList(
                new LambdaQueryWrapper<com.itwanger.pairesume.entity.ResumeModule>()
                        .eq(com.itwanger.pairesume.entity.ResumeModule::getResumeId, resumeId)
                        .orderByAsc(com.itwanger.pairesume.entity.ResumeModule::getSortOrder)
                        .orderByAsc(com.itwanger.pairesume.entity.ResumeModule::getId)
        );

        if (modules.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请先完善简历内容后再生成智能一页");
        }

        return Result.success(aiService.previewSmartOnePage(resume.getTitle(), modules, request));
    }

    private Long getCurrentUserId() {
        return (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
