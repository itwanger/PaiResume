package com.itwanger.pairesume.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Read only model-returned metadata and align it with normalized/deduplicated candidate text. */
public final class FieldOptimizeCandidateMetadata {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> ALLOWED = Set.of("concise", "technical", "quantified");
    public static final String MARKER = "【候选版本侧重点与标签】";
    public static final String INSTRUCTIONS = """


【候选版本侧重点与标签】
生成三个不同侧重点的候选版本：简洁表达、技术深度、成果与数据量化。
具体优化尺度与量化方式遵循后台配置的字段提示词，不因原文未含数字而取消量化版本或标签。
为每个候选根据实际最终内容返回标签：concise（简洁）、technical（技术深度）、quantified（数据量化），可多选或为空。
标签必须与对应版本内容一致，不按版本序号机械分配。
统一输出协议优先于字段模板中的旧版输出示例：只返回 JSON 对象，candidates 是三个正文字符串，candidateTags 是与其逐项对应的标签数组。
结构示例：{"candidates":["简洁正文","技术正文","量化成果正文"],"candidateTags":[["concise"],["technical"],["technical","quantified"]]}
            """;

    private FieldOptimizeCandidateMetadata() {}

    public static String withInstructions(String prompt) {
        if (prompt != null && prompt.contains(MARKER)) {
            // Remove only the obsolete restriction previously appended by this application.
            return prompt.replace("简洁版保留核心动作并减少冗余；技术版突出原文已有的实现机制和技术取舍；成果版突出已有成果证据。", "")
                    .replace("不得为了量化版补造数字、算法、技术栈或成果。原文没有数字依据时用定性成果，且不得返回 quantified 标签。",
                            "具体优化尺度与量化方式遵循后台配置的字段提示词，不因原文未含数字而取消量化版本或标签。")
                    .replace("有原文数据依据的成果正文", "量化成果正文");
        }
        return (prompt == null ? "" : prompt) + INSTRUCTIONS;
    }

    public static List<List<String>> tags(String content, List<String> candidates) {
        if (candidates == null) return List.of();
        List<List<String>> result = new ArrayList<>();
        for (var ignored : candidates) result.add(List.of());
        if (content == null || content.isBlank()) return result;
        try {
            var payload = JSON.readTree(content.trim().replaceFirst("^```[a-zA-Z]*\\s*", "").replaceFirst("\\s*```$", ""));
            if (payload.has("choices")) {
                return tags(payload.path("choices").path(0).path("message").path("content").asText(), candidates);
            }
            var texts = payload.path("candidates");
            var tags = payload.path("candidateTags");
            if (!texts.isArray() || !tags.isArray() || texts.size() != tags.size()) return result;
            for (int i = 0; i < candidates.size(); i++) {
                for (int j = 0; j < texts.size(); j++) {
                    if (texts.get(j).isTextual() && compact(texts.get(j).asText()).equals(compact(candidates.get(i))) && tags.get(j).isArray()) {
                        List<String> labels = new ArrayList<>();
                        for (var tag : tags.get(j)) {
                            if (tag.isTextual() && ALLOWED.contains(tag.asText()) && !labels.contains(tag.asText())) labels.add(tag.asText());
                        }
                        result.set(i, labels);
                        break;
                    }
                }
            }
        } catch (Exception ignored) {
            // Legacy or truncated records have no trustworthy labels.
        }
        return result;
    }

    private static String compact(String value) { return value.replaceAll("(?U)\\s+", ""); }
}
