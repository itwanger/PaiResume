package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.ResumeAnalysisResultDTO;
import com.itwanger.pairesume.dto.AiFieldOptimizeRequestDTO;
import com.itwanger.pairesume.dto.SmartOnePagePreviewRequestDTO;
import com.itwanger.pairesume.dto.SmartOnePagePreviewResponseDTO;
import com.itwanger.pairesume.entity.ResumeModule;

import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

public interface AiService {
    /**
     * 对简历模块内容进行 AI 优化，返回优化前后的对比
     * 不直接保存到数据库，需用户确认后再调用更新接口
     */
    Map<String, Object> optimizeModule(String moduleType, Map<String, Object> content);

    /**
     * 对模块中的单个字段进行 AI 优化，返回优化前后的文本
     */
    Map<String, Object> optimizeModuleField(String moduleType, Map<String, Object> content, AiFieldOptimizeRequestDTO request);

    /**
     * 对模块中的单个字段进行流式 AI 优化，实时推送推理和最终结果
     */
    Map<String, Object> streamOptimizeModuleField(
            String moduleType,
            Map<String, Object> content,
            AiFieldOptimizeRequestDTO request,
            Consumer<Map<String, Object>> eventConsumer
    );

    /**
     * 分析整份简历内容，返回结构化的 AI 评估结果
     */
    ResumeAnalysisResultDTO analyzeResume(String resumeTitle, List<ResumeModule> modules, String promptOverride);

    /**
     * 生成智能一页预览结果，返回压缩前后候选内容与连续长页元信息
     */
    SmartOnePagePreviewResponseDTO previewSmartOnePage(
            String resumeTitle,
            List<ResumeModule> modules,
            SmartOnePagePreviewRequestDTO request
    );
}
