package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.entity.AiOptimizeRecord;
import com.itwanger.pairesume.mapper.AiOptimizeRecordMapper;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class FieldOptimizeCandidateMetadataTest {
    @Test
    void modelMetadataStaysAlignedAndSurvivesHistoryRead() {
        var content = """
          {"candidates":["简洁内容","Redis限流","已有数据99%"],"candidateTags":[["concise"],["technical","invalid"],["quantified"]]}
          """;
        var candidates = List.of("Redis 限流", "简洁内容", "已有数据99%");
        var expected = List.of(List.of("technical"), List.of("concise"), List.of("quantified"));
        assertEquals(expected, FieldOptimizeCandidateMetadata.tags(content, candidates));
        assertEquals(List.of(List.of()), FieldOptimizeCandidateMetadata.tags("{\"candidates\":[\"量化99%\"]}", List.of("量化99%")));
        assertEquals(List.of(List.of()), FieldOptimizeCandidateMetadata.tags(content, List.of("没有对应文本")));
        var mapper = mock(AiOptimizeRecordMapper.class);
        var record = new AiOptimizeRecord();
        record.setCandidates(candidates);
        record.setStreamedContent(content);
        when(mapper.selectOne(any(com.baomidou.mybatisplus.core.conditions.Wrapper.class))).thenReturn(record);
        var service = new AiOptimizeRecordServiceImpl(mapper);
        assertEquals(expected, service.getLatestRecord(1L, 2L, 3L, "responsibility", 0).getCandidateTags());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"length", "missing-tags", "complete"})
    void completedStreamAndHistoryKeepFinalCandidateTags(String scenario) throws Exception {
        var json = new com.fasterxml.jackson.databind.ObjectMapper();
        var texts = List.of("实现技能包自动加载与引用缓存，支持全量和渐进式两种注入模式。", "基于技能注册表自动加载技能包，通过引用缓存复用内容。", "支持全量和渐进式 2 种注入模式，覆盖不同上下文需求。");
        var labels = List.of(List.of("concise"), List.of("technical"), List.of("quantified"));
        String finalContent = json.writeValueAsString(java.util.Map.of("candidates", texts, "candidateTags", labels));
        String initial = scenario.equals("length") ? "" : scenario.equals("complete") ? finalContent
                : json.writeValueAsString(java.util.Map.of("candidates", texts));
        var calls = new java.util.concurrent.atomic.AtomicInteger();
        var server = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/chat/completions", exchange -> {
            int call = calls.incrementAndGet();
            String body;
            if (call == 1) {
                body = "data: " + json.writeValueAsString(java.util.Map.of("choices", List.of(java.util.Map.of(
                        "delta", java.util.Map.of("content", initial), "finish_reason", scenario.equals("length") ? "length" : "stop"))))
                        + "\n\ndata: [DONE]\n\n";
                exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
            } else {
                body = json.writeValueAsString(java.util.Map.of("choices", List.of(java.util.Map.of(
                        "message", java.util.Map.of("content", finalContent)))));
                exchange.getResponseHeaders().set("Content-Type", "application/json");
            }
            byte[] bytes = body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, bytes.length);
            try (var out = exchange.getResponseBody()) { out.write(bytes); }
        });
        server.start();
        try {
            var provider = mock(com.itwanger.pairesume.service.AiProviderConfigService.class);
            when(provider.resolveActive()).thenReturn(new com.itwanger.pairesume.service.AiProviderConfigService.ActiveAiConfig(
                    "DEEPSEEK", "test", "http://127.0.0.1:" + server.getAddress().getPort(), "test", "test", "test", false));
            var ai = new AiServiceImpl(json, provider);
            org.springframework.test.util.ReflectionTestUtils.setField(ai, "timeout", 10);
            var promptStore = mock(FieldOptimizePromptService.class);
            var config = new com.itwanger.pairesume.dto.FieldOptimizePromptConfigDTO();
            config.setSystemPrompt("Admin 系统提示词");
            config.setResponsibilityPrompt("Admin 职责要求 {{original}}");
            when(promptStore.find("asu")).thenReturn(config);
            org.springframework.test.util.ReflectionTestUtils.setField(ai, "fieldOptimizePromptService", promptStore);
            var request = new com.itwanger.pairesume.dto.AiFieldOptimizeRequestDTO();
            request.setFieldType("responsibility"); request.setIndex(0); request.setPresetId("asu");
            var events = new java.util.ArrayList<java.util.Map<String, Object>>();
            var result = ai.streamOptimizeModuleField("work_experience", java.util.Map.of("responsibilities", List.of("实现技能包加载，支持两种注入模式。")), request, events::add);
            assertEquals(labels, result.get("candidateTags"));
            assertEquals(scenario.equals("complete") ? 1 : 2, calls.get());
            var lastContent = events.stream().filter(event -> "content_delta".equals(event.get("type"))).reduce((a, b) -> b).orElseThrow();
            assertEquals(labels, FieldOptimizeCandidateMetadata.tags((String) lastContent.get("text"), texts));
            var controller = new com.itwanger.pairesume.controller.AiController(ai, null, null, null, json, null);
            var record = (AiOptimizeRecord) org.springframework.test.util.ReflectionTestUtils.invokeMethod(controller,
                    "buildCompletedRecord", 1L, 2L, 3L, "project", request, null, result);
            assertEquals(labels, FieldOptimizeCandidateMetadata.tags(record.getStreamedContent(), texts));
        } finally { server.stop(0); }
    }
}
