package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.service.AiService;
import com.itwanger.pairesume.service.AiOptimizeRecordService;
import com.itwanger.pairesume.service.MembershipService;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.AiFieldOptimizeRecordDTO;
import com.itwanger.pairesume.dto.AiFieldOptimizeRequestDTO;
import com.itwanger.pairesume.entity.AiOptimizeRecord;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Tag(name = "AI 优化接口")
@Slf4j
@RestController
@RequestMapping("/resumes/{resumeId}/modules/{moduleId}")
public class AiController {

    private final AiService aiService;
    private final AiOptimizeRecordService aiOptimizeRecordService;
    private final ResumeMapper resumeMapper;
    private final ResumeModuleMapper moduleMapper;
    private final ObjectMapper objectMapper;
    private final MembershipService membershipService;

    public AiController(
            AiService aiService,
            AiOptimizeRecordService aiOptimizeRecordService,
            ResumeMapper resumeMapper,
            ResumeModuleMapper moduleMapper,
            ObjectMapper objectMapper,
            MembershipService membershipService
    ) {
        this.aiService = aiService;
        this.aiOptimizeRecordService = aiOptimizeRecordService;
        this.resumeMapper = resumeMapper;
        this.moduleMapper = moduleMapper;
        this.objectMapper = objectMapper;
        this.membershipService = membershipService;
    }

    @Operation(summary = "AI 优化模块内容")
    @PostMapping("/ai-optimize")
    public Result<Map<String, Object>> aiOptimize(@PathVariable Long resumeId, @PathVariable Long moduleId) {
        var userId = getCurrentUserId();
        membershipService.requireAiAccess(userId);
        validateOwnership(resumeId, userId);

        var module = moduleMapper.selectById(moduleId);
        if (module == null || !module.getResumeId().equals(resumeId)) {
            throw new BusinessException(ResultCode.MODULE_NOT_FOUND);
        }

        var result = aiService.optimizeModule(module.getModuleType(), module.getContent());
        return Result.success(result);
    }

    @Operation(summary = "AI 优化模块内单个字段")
    @PostMapping("/ai-optimize-field")
    public Result<Map<String, Object>> aiOptimizeField(
            @PathVariable Long resumeId,
            @PathVariable Long moduleId,
            @RequestBody AiFieldOptimizeRequestDTO request
    ) {
        var userId = getCurrentUserId();
        membershipService.requireAiAccess(userId);
        log.info("[AI Optimize][Controller] received field optimize request: resumeId={}, moduleId={}, userId={}, fieldType={}, index={}",
                resumeId, moduleId, userId, request == null ? null : request.getFieldType(), request == null ? null : request.getIndex());
        validateOwnership(resumeId, userId);

        var module = moduleMapper.selectById(moduleId);
        if (module == null || !module.getResumeId().equals(resumeId)) {
            throw new BusinessException(ResultCode.MODULE_NOT_FOUND);
        }

        var result = aiService.optimizeModuleField(module.getModuleType(), module.getContent(), request);
        log.info("[AI Optimize][Controller] field optimize response ready: resumeId={}, moduleId={}, moduleType={}, keys={}",
                resumeId, moduleId, module.getModuleType(), result.keySet());
        return Result.success(result);
    }

    @Operation(summary = "流式 AI 优化模块内单个字段")
    @PostMapping(value = "/ai-optimize-field/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public void aiOptimizeFieldStream(
            @PathVariable Long resumeId,
            @PathVariable Long moduleId,
            @RequestBody AiFieldOptimizeRequestDTO request,
            HttpServletResponse response
    ) {
        var userId = getCurrentUserId();
        membershipService.requireAiAccess(userId);
        log.info("[AI Optimize][Controller] received field optimize stream request: resumeId={}, moduleId={}, userId={}, fieldType={}, index={}",
                resumeId, moduleId, userId, request == null ? null : request.getFieldType(), request == null ? null : request.getIndex());
        validateOwnership(resumeId, userId);

        var module = moduleMapper.selectById(moduleId);
        if (module == null || !module.getResumeId().equals(resumeId)) {
            throw new BusinessException(ResultCode.MODULE_NOT_FOUND);
        }

        response.setCharacterEncoding("UTF-8");
        response.setContentType(MediaType.TEXT_EVENT_STREAM_VALUE);
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("X-Accel-Buffering", "no");
        var snapshot = new StreamSnapshot();

        try {
            var connectedPayload = new java.util.LinkedHashMap<String, Object>();
            connectedPayload.put("resumeId", resumeId);
            connectedPayload.put("moduleId", moduleId);
            connectedPayload.put("moduleType", module.getModuleType());
            if (request != null && request.getFieldType() != null) {
                connectedPayload.put("fieldType", request.getFieldType());
            }
            sendSseEvent(response, "connected", connectedPayload);

            var result = aiService.streamOptimizeModuleField(
                    module.getModuleType(),
                    module.getContent(),
                    request,
                    event -> {
                        captureStreamSnapshot(snapshot, event);
                        sendSseEvent(response, String.valueOf(event.getOrDefault("type", "message")), event);
                    }
            );

            aiOptimizeRecordService.save(buildCompletedRecord(
                    userId,
                    resumeId,
                    moduleId,
                    module.getModuleType(),
                    request,
                    snapshot,
                    result
            ));
            sendSseEvent(response, "result", result);
            sendSseEvent(response, "done", Map.of("status", "completed"));
        } catch (BusinessException e) {
            aiOptimizeRecordService.save(buildErrorRecord(
                    userId,
                    resumeId,
                    moduleId,
                    module.getModuleType(),
                    request,
                    snapshot,
                    e.getMessage()
            ));
            log.warn("[AI Optimize][Controller] field optimize stream failed: resumeId={}, moduleId={}, code={}, message={}",
                    resumeId, moduleId, e.getCode(), e.getMessage());
            sendSseEvent(response, "error", Map.of(
                    "code", e.getCode(),
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            aiOptimizeRecordService.save(buildErrorRecord(
                    userId,
                    resumeId,
                    moduleId,
                    module.getModuleType(),
                    request,
                    snapshot,
                    "流式 AI 优化失败，请稍后重试"
            ));
            log.error("[AI Optimize][Controller] field optimize stream crashed: resumeId={}, moduleId={}", resumeId, moduleId, e);
            sendSseEvent(response, "error", Map.of(
                    "code", ResultCode.INTERNAL_ERROR.getCode(),
                    "message", "流式 AI 优化失败，请稍后重试"
            ));
        }
    }

    @Operation(summary = "获取字段级 AI 优化最近一次记录")
    @GetMapping("/ai-optimize-field/latest")
    public Result<AiFieldOptimizeRecordDTO> getLatestAiOptimizeFieldRecord(
            @PathVariable Long resumeId,
            @PathVariable Long moduleId,
            @RequestParam String fieldType,
            @RequestParam(required = false) Integer index
    ) {
        var userId = getCurrentUserId();
        membershipService.requireAiAccess(userId);
        validateOwnership(resumeId, userId);

        var module = moduleMapper.selectById(moduleId);
        if (module == null || !module.getResumeId().equals(resumeId)) {
            throw new BusinessException(ResultCode.MODULE_NOT_FOUND);
        }

        return Result.success(aiOptimizeRecordService.getLatestRecord(userId, resumeId, moduleId, fieldType, index));
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

    private void captureStreamSnapshot(StreamSnapshot snapshot, Map<String, Object> event) {
        if (snapshot == null || event == null) {
            return;
        }

        var eventType = String.valueOf(event.getOrDefault("type", ""));
        if ("meta".equals(eventType)) {
            snapshot.original = asString(event.get("original"));
            return;
        }
        if ("reasoning_delta".equals(eventType)) {
            snapshot.reasoning = asString(event.get("text"));
            return;
        }
        if ("content_delta".equals(eventType)) {
            snapshot.streamedContent = asString(event.get("text"));
        }
    }

    private AiOptimizeRecord buildCompletedRecord(
            Long userId,
            Long resumeId,
            Long moduleId,
            String moduleType,
            AiFieldOptimizeRequestDTO request,
            StreamSnapshot snapshot,
            Map<String, Object> result
    ) {
        var record = buildBaseRecord(userId, resumeId, moduleId, moduleType, request, snapshot);
        record.setRecordStatus("completed");
        record.setOriginalText(firstNonBlank(asString(result.get("original")), record.getOriginalText()));
        record.setStreamedContent(firstNonBlank(record.getStreamedContent(), asString(result.get("optimized"))));
        record.setOptimizedText(asString(result.get("optimized")));
        record.setCandidates(extractCandidates(result.get("candidates")));
        record.setErrorMessage(null);
        return record;
    }

    private AiOptimizeRecord buildErrorRecord(
            Long userId,
            Long resumeId,
            Long moduleId,
            String moduleType,
            AiFieldOptimizeRequestDTO request,
            StreamSnapshot snapshot,
            String errorMessage
    ) {
        var record = buildBaseRecord(userId, resumeId, moduleId, moduleType, request, snapshot);
        record.setRecordStatus("error");
        record.setErrorMessage(errorMessage);
        return record;
    }

    private AiOptimizeRecord buildBaseRecord(
            Long userId,
            Long resumeId,
            Long moduleId,
            String moduleType,
            AiFieldOptimizeRequestDTO request,
            StreamSnapshot snapshot
    ) {
        var record = new AiOptimizeRecord();
        record.setUserId(userId);
        record.setResumeId(resumeId);
        record.setModuleId(moduleId);
        record.setModuleType(moduleType);
        record.setFieldType(request == null ? null : request.getFieldType());
        record.setFieldIndex(request == null ? null : request.getIndex());
        record.setOriginalText(snapshot == null ? null : snapshot.original);
        record.setReasoningMarkdown(snapshot == null ? null : snapshot.reasoning);
        record.setStreamedContent(snapshot == null ? null : snapshot.streamedContent);
        record.setPrompt(request == null ? null : request.getPrompt());
        record.setSystemPrompt(request == null ? null : request.getSystemPrompt());
        return record;
    }

    private String asString(Object value) {
        if (!(value instanceof String stringValue)) {
            return null;
        }
        return stringValue;
    }

    private String firstNonBlank(String preferred, String fallback) {
        if (preferred != null && !preferred.isBlank()) {
            return preferred;
        }
        return fallback;
    }

    private List<String> extractCandidates(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        var candidates = new ArrayList<String>();
        for (var item : list) {
            if (item instanceof String text && !text.isBlank()) {
                candidates.add(text);
            }
        }
        return candidates;
    }

    private void sendSseEvent(HttpServletResponse response, String eventName, Map<String, Object> payload) {
        try {
            if (!"reasoning_delta".equals(eventName) && !"content_delta".equals(eventName)) {
                log.info("[AI Optimize][Controller] sending sse event: event={}, payload={}",
                        eventName, summarizePayload(payload));
            }
            response.getWriter().write("event:" + eventName + "\n");
            response.getWriter().write("data:" + objectMapper.writeValueAsString(payload) + "\n\n");
            response.getWriter().flush();
        } catch (IOException ignored) {
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
                if ("text".equals(key) || "delta".equals(key) || "original".equals(key) || "optimized".equals(key)) {
                    sanitized.put(key, truncateText(String.valueOf(value), 160));
                    return;
                }
                if ("candidates".equals(key) && value instanceof java.util.List<?> list) {
                    sanitized.put(key, list.stream().map(item -> truncateText(String.valueOf(item), 80)).toList());
                    return;
                }
                sanitized.put(key, value);
            });
            return objectMapper.writeValueAsString(sanitized);
        } catch (Exception e) {
            return payload.keySet().toString();
        }
    }

    private String truncateText(String text, int maxLength) {
        if (text == null || text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "...";
    }

    private static class StreamSnapshot {
        private String original;
        private String reasoning;
        private String streamedContent;
    }
}
