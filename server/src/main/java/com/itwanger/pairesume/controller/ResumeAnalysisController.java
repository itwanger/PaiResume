package com.itwanger.pairesume.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.ResumeAnalysisResultDTO;
import com.itwanger.pairesume.dto.ResumeAnalysisRequestDTO;
import com.itwanger.pairesume.entity.ResumeAnalysisRecord;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.service.ResumeAnalysisRecordService;
import com.itwanger.pairesume.service.AiService;
import com.itwanger.pairesume.service.MembershipService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@Tag(name = "简历分析接口")
@Slf4j
@RestController
@RequestMapping("/resumes/{resumeId}")
public class ResumeAnalysisController {

    private final AiService aiService;
    private final ResumeAnalysisRecordService resumeAnalysisRecordService;
    private final ResumeMapper resumeMapper;
    private final ResumeModuleMapper moduleMapper;
    private final ObjectMapper objectMapper;
    private final MembershipService membershipService;

    public ResumeAnalysisController(
            AiService aiService,
            ResumeAnalysisRecordService resumeAnalysisRecordService,
            ResumeMapper resumeMapper,
            ResumeModuleMapper moduleMapper,
            ObjectMapper objectMapper,
            MembershipService membershipService
    ) {
        this.aiService = aiService;
        this.resumeAnalysisRecordService = resumeAnalysisRecordService;
        this.resumeMapper = resumeMapper;
        this.moduleMapper = moduleMapper;
        this.objectMapper = objectMapper;
        this.membershipService = membershipService;
    }

    @Operation(summary = "AI 分析整份简历")
    @PostMapping("/analysis")
    public Result<ResumeAnalysisResultDTO> analyzeResume(@PathVariable Long resumeId, @RequestBody(required = false) ResumeAnalysisRequestDTO request) {
        var userId = getCurrentUserId();
        membershipService.requireAiAccess(userId);
        var resume = validateOwnership(resumeId, userId);

        List<ResumeModule> modules = moduleMapper.selectList(
                new LambdaQueryWrapper<ResumeModule>()
                        .eq(ResumeModule::getResumeId, resumeId)
                        .orderByAsc(ResumeModule::getSortOrder)
                        .orderByAsc(ResumeModule::getId)
        );

        if (modules.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请先完善简历内容后再进行分析");
        }

        var prompt = request == null ? null : request.getPrompt();
        try {
            var result = aiService.analyzeResume(resume.getTitle(), modules, prompt);
            resumeAnalysisRecordService.save(buildCompletedRecord(userId, resumeId, prompt, result));
            return Result.success(result);
        } catch (BusinessException e) {
            resumeAnalysisRecordService.save(buildErrorRecord(userId, resumeId, prompt, e.getMessage()));
            throw e;
        } catch (Exception e) {
            resumeAnalysisRecordService.save(buildErrorRecord(userId, resumeId, prompt, e.getMessage()));
            throw e;
        }
    }

    @Operation(summary = "流式 AI 分析整份简历")
    @PostMapping(value = "/analysis/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public void analyzeResumeStream(
            @PathVariable Long resumeId,
            @RequestBody(required = false) ResumeAnalysisRequestDTO request,
            HttpServletResponse response
    ) {
        var userId = getCurrentUserId();
        membershipService.requireAiAccess(userId);
        var resume = validateOwnership(resumeId, userId);
        var modules = loadResumeModules(resumeId);
        if (modules.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请先完善简历内容后再进行分析");
        }

        var prompt = request == null ? null : request.getPrompt();
        response.setCharacterEncoding("UTF-8");
        response.setContentType(MediaType.TEXT_EVENT_STREAM_VALUE);
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("X-Accel-Buffering", "no");

        try {
            sendSseEvent(response, "connected", Map.of(
                    "resumeId", resumeId,
                    "message", "简历分析已开始"
            ));
            var result = aiService.streamAnalyzeResume(resume.getTitle(), modules, prompt, event ->
                    sendSseEvent(response, String.valueOf(event.getOrDefault("type", "message")), event)
            );
            resumeAnalysisRecordService.save(buildCompletedRecord(userId, resumeId, prompt, result));
            sendSseEvent(response, "result", Map.of(
                    "score", result.getScore(),
                    "issues", result.getIssues(),
                    "suggestions", result.getSuggestions()
            ));
            sendSseEvent(response, "done", Map.of("status", "completed"));
        } catch (BusinessException e) {
            resumeAnalysisRecordService.save(buildErrorRecord(userId, resumeId, prompt, e.getMessage()));
            sendSseEvent(response, "error", Map.of(
                    "code", e.getCode(),
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            resumeAnalysisRecordService.save(buildErrorRecord(userId, resumeId, prompt, "流式简历分析失败，请稍后重试"));
            log.error("[Resume Analysis][Controller] stream crashed: resumeId={}, errorType={}",
                    resumeId, e.getClass().getSimpleName());
            sendSseEvent(response, "error", Map.of(
                    "code", ResultCode.INTERNAL_ERROR.getCode(),
                    "message", "流式简历分析失败，请稍后重试"
            ));
        }
    }

    @Operation(summary = "获取最近一次成功的简历分析记录")
    @GetMapping("/analysis/latest")
    public Result<ResumeAnalysisResultDTO> getLatestAnalysis(@PathVariable Long resumeId) {
        var userId = getCurrentUserId();
        membershipService.requireAiAccess(userId);
        validateOwnership(resumeId, userId);
        return Result.success(resumeAnalysisRecordService.getLatestCompletedRecord(userId, resumeId));
    }

    private List<ResumeModule> loadResumeModules(Long resumeId) {
        return moduleMapper.selectList(
                new LambdaQueryWrapper<ResumeModule>()
                        .eq(ResumeModule::getResumeId, resumeId)
                        .orderByAsc(ResumeModule::getSortOrder)
                        .orderByAsc(ResumeModule::getId)
        );
    }

    private ResumeAnalysisRecord buildCompletedRecord(
            Long userId,
            Long resumeId,
            String prompt,
            ResumeAnalysisResultDTO result
    ) {
        var record = buildBaseRecord(userId, resumeId, prompt);
        record.setRecordStatus("completed");
        record.setScore(result.getScore());
        record.setIssues(result.getIssues());
        record.setSuggestions(result.getSuggestions());
        return record;
    }

    private ResumeAnalysisRecord buildErrorRecord(Long userId, Long resumeId, String prompt, String errorMessage) {
        var record = buildBaseRecord(userId, resumeId, prompt);
        record.setRecordStatus("error");
        record.setErrorMessage(errorMessage);
        return record;
    }

    private ResumeAnalysisRecord buildBaseRecord(Long userId, Long resumeId, String prompt) {
        var record = new ResumeAnalysisRecord();
        record.setUserId(userId);
        record.setResumeId(resumeId);
        record.setPrompt(prompt);
        return record;
    }

    private Resume validateOwnership(Long resumeId, Long userId) {
        var resume = resumeMapper.selectById(resumeId);
        if (resume == null || !resume.getUserId().equals(userId) || resume.getStatus() == 0) {
            throw new BusinessException(ResultCode.RESUME_NOT_FOUND);
        }
        return resume;
    }

    private void sendSseEvent(HttpServletResponse response, String eventName, Map<String, Object> payload) {
        try {
            if (!"reasoning_delta".equals(eventName) && !"content_delta".equals(eventName)) {
                log.info("[Resume Analysis][Controller] sending sse event: event={}, payload={}", eventName, summarizePayload(payload));
            }
            response.getWriter().write("event:" + eventName + "\n");
            response.getWriter().write("data:" + objectMapper.writeValueAsString(payload) + "\n\n");
            response.getWriter().flush();
        } catch (Exception ignored) {
        }
    }

    private String summarizePayload(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return "{}";
        }
        try {
            var sanitized = new java.util.LinkedHashMap<String, Object>();
            payload.forEach((key, value) -> {
                if (value == null) {
                    return;
                }
                if (value instanceof String text) {
                    sanitized.put(key + "Length", text.length());
                } else if (value instanceof java.util.Collection<?> collection) {
                    sanitized.put(key + "Count", collection.size());
                } else if (value instanceof java.util.Map<?, ?> map) {
                    sanitized.put(key + "Keys", map.keySet());
                } else if (value instanceof Number || value instanceof Boolean) {
                    sanitized.put(key, value);
                } else {
                    sanitized.put(key + "Type", value.getClass().getSimpleName());
                }
            });
            return objectMapper.writeValueAsString(sanitized);
        } catch (Exception e) {
            return payload.keySet().toString();
        }
    }

    private Long getCurrentUserId() {
        return (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
