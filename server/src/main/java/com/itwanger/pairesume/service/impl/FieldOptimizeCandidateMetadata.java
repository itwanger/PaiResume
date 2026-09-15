package com.itwanger.pairesume.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Read only model-returned metadata and align it with normalized/deduplicated candidate text. */
public final class FieldOptimizeCandidateMetadata {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> ALLOWED = Set.of("concise", "technical", "quantified");
    private FieldOptimizeCandidateMetadata() {}

    public static boolean hasCompleteTags(String content, List<String> candidates) {
        if (candidates == null || candidates.size() != 3) return false;
        var labels = tags(content, candidates);
        // Concise and technical directions must be present. Quantification depends on available facts.
        return labels.stream().anyMatch(item -> item.contains("concise"))
                && labels.stream().anyMatch(item -> item.contains("technical"));
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
