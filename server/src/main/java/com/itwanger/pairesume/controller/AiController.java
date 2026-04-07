package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.service.AiService;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.AiFieldOptimizeRequestDTO;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;

@Tag(name = "AI 优化接口")
@Slf4j
@RestController
@RequestMapping("/resumes/{resumeId}/modules/{moduleId}")
public class AiController {

    private final AiService aiService;
    private final ResumeMapper resumeMapper;
    private final ResumeModuleMapper moduleMapper;
    private final ObjectMapper objectMapper;

    public AiController(AiService aiService, ResumeMapper resumeMapper, ResumeModuleMapper moduleMapper, ObjectMapper objectMapper) {
        this.aiService = aiService;
        this.resumeMapper = resumeMapper;
        this.moduleMapper = moduleMapper;
        this.objectMapper = objectMapper;
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

    @Operation(summary = "AI 优化模块内单个字段")
    @PostMapping("/ai-optimize-field")
    public Result<Map<String, Object>> aiOptimizeField(
            @PathVariable Long resumeId,
            @PathVariable Long moduleId,
            @RequestBody AiFieldOptimizeRequestDTO request
    ) {
        var userId = getCurrentUserId();
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
                    event -> sendSseEvent(response, String.valueOf(event.getOrDefault("type", "message")), event)
            );

            sendSseEvent(response, "result", result);
            sendSseEvent(response, "done", Map.of("status", "completed"));
        } catch (BusinessException e) {
            log.warn("[AI Optimize][Controller] field optimize stream failed: resumeId={}, moduleId={}, code={}, message={}",
                    resumeId, moduleId, e.getCode(), e.getMessage());
            sendSseEvent(response, "error", Map.of(
                    "code", e.getCode(),
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("[AI Optimize][Controller] field optimize stream crashed: resumeId={}, moduleId={}", resumeId, moduleId, e);
            sendSseEvent(response, "error", Map.of(
                    "code", ResultCode.INTERNAL_ERROR.getCode(),
                    "message", "流式 AI 优化失败，请稍后重试"
            ));
        }
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
}
