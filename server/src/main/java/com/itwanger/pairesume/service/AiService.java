package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.ResumeAnalysisResultDTO;
import com.itwanger.pairesume.entity.ResumeModule;

import java.util.List;
import java.util.Map;

public interface AiService {
    /**
     * 对简历模块内容进行 AI 优化，返回优化前后的对比
     * 不直接保存到数据库，需用户确认后再调用更新接口
     */
    Map<String, Object> optimizeModule(String moduleType, Map<String, Object> content);

    /**
     * 分析整份简历内容，返回结构化的 AI 评估结果
     */
    ResumeAnalysisResultDTO analyzeResume(String resumeTitle, List<ResumeModule> modules, String promptOverride);
}
