package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.ResumeAnalysisIssueDTO;
import com.itwanger.pairesume.dto.ResumeAnalysisResultDTO;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.service.AiService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.StringJoiner;
import java.util.stream.Collectors;

@Slf4j
@Service
public class AiServiceImpl implements AiService {
    private static final Set<String> ALLOWED_ISSUE_TYPES = Set.of("missing", "weak", "format", "content");
    private static final Set<String> IGNORED_ANALYSIS_FIELDS = Set.of("basic_info.summary", "professional_summary", "skill", "专业技能");
    private static final String DEFAULT_ANALYSIS_INSTRUCTIONS = """
            请站在校招技术简历评审视角分析这份简历。
            重点要求：
            1. 重点看项目经历、实习经历、专业技能，这三部分权重最高。
            2. 不要因为获奖较少、没有 AI 竞赛、没有 GPA、GitHub 没有额外包装，就明显拉低分数。
            3. 不要把“专业技能没有分类展示”当成问题，也不要要求把整句技能改成分类标签。
            4. 不要把“缺少个人简介 / 职业总结 / 自我评价”当成问题。
            5. 只有在确实存在明显短板时才指出问题，避免泛泛而谈。
            6. 对已经写得比较成熟的内容，尽量少挑边角问题。
            7. 如果整份简历主体已经可以直接投递，分数应落在 90 分以上。
            输出偏好：
            1. 问题最多 4 条，建议最多 4 条。
            2. 建议必须具体、可执行，避免空话。
            3. 优先指出真正影响投递效果的问题，比如邮箱错误、量化成果不足、表达不够聚焦。
            """;
    private static final Map<String, String> MODULE_LABELS = Map.of(
            "basic_info", "基本信息",
            "education", "教育背景",
            "internship", "实习经历",
            "project", "项目经历",
            "skill", "专业技能",
            "paper", "论文发表",
            "research", "科研经历",
            "award", "获奖情况",
            "job_intention", "求职意向"
    );

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${ai.api-key}")
    private String apiKey;

    @Value("${ai.base-url}")
    private String baseUrl;

    @Value("${ai.model}")
    private String model;

    @Value("${ai.analysis-model:${ai.model}}")
    private String analysisModel;

    @Value("${ai.timeout}")
    private int timeout;

    private static final String SYSTEM_PROMPT = """
            你是一位顶级的技术招聘官和简历优化专家，尤其擅长指导计算机领域的应届生和实习生。你的任务是优化下方提供的简历模块 JSON 内容，使其在求职（开发、测试、运维等岗位）时更具竞争力。

            **核心优化原则:**
            *   **使用STAR法则**: 确保描述清晰地反映出项目/实习的背景（Situation）、你的任务（Task）、你采取的具体行动（Action）以及最终达成的可量化成果（Result）。
            *   **强化技术动词**: 使用如"实现"、"开发"、"重构"、"部署"、"自动化"、"优化"等具体的、有力的技术动词，避免使用"负责"、"参与"等模糊词汇。
            *   **量化成果**: 尽可能将工作成果量化，例如："将接口响应时间从500ms优化至100ms"、"通过自动化脚本将部署时间缩短了10分钟"、"将测试覆盖率从70%%提升至90%%"。
            *   **突出技术栈**: 在描述中自然地融入项目或经历中使用的关键技术、工具或框架。

            **重要规则:**
            1.  你必须保持与输入完全相同的 JSON 结构。不要添加、删除或重命名任何键。输出结果必须是能被直接解析的、格式正确的 JSON。
            2.  你的回答必须且仅包含优化后的纯净 JSON 内容。不要包含任何额外的文字、解释、问候，也不要使用 ```json ... ``` 这种 Markdown 格式。

            待优化的 JSON 内容如下:
            ---
            %s
            ---
            """;

    public AiServiceImpl(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.webClient = WebClient.builder().build();
    }

    @Override
    public Map<String, Object> optimizeModule(String moduleType, Map<String, Object> content) {
        validateConfiguration();
        validateContentLength(content);

        var contentJson = toJsonString(content);
        var prompt = String.format(SYSTEM_PROMPT, contentJson);

        try {
            var response = invokeChatCompletion(model, prompt, "请优化这份简历内容", 0.7, 4000, false);

            if (response == null) {
                throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
            }

            var optimizedContent = parseAiResponse(response, content);
            return Map.of("original", content, "optimized", optimizedContent);
        } catch (BusinessException e) {
            throw e;
        } catch (WebClientResponseException e) {
            log.error("AI optimization upstream failed with status {}", e.getStatusCode(), e);
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY.getCode(), buildUpstreamErrorMessage(e));
        } catch (Exception e) {
            log.error("AI optimization failed", e);
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
        }
    }

    @Override
    public ResumeAnalysisResultDTO analyzeResume(String resumeTitle, List<ResumeModule> modules, String promptOverride) {
        validateConfiguration();

        var prompt = buildResumeAnalysisPrompt(resumeTitle, modules, promptOverride);

        try {
            var response = invokeChatCompletion(
                    analysisModel,
                    "你是一位严格、专业、懂技术招聘的资深简历顾问。你需要基于候选人当前简历内容给出真实、克制、可执行的分析结果，并且必须严格输出 JSON。",
                    prompt,
                    0.3,
                    1600,
                    true
            );

            if (response == null) {
                throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
            }

            return parseAnalysisResponse(response);
        } catch (BusinessException e) {
            throw e;
        } catch (WebClientResponseException e) {
            log.error("AI resume analysis upstream failed with status {}", e.getStatusCode(), e);
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY.getCode(), buildUpstreamErrorMessage(e));
        } catch (Exception e) {
            log.error("AI resume analysis failed", e);
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
        }
    }

    private void validateConfiguration() {
        if (apiKey == null || apiKey.isBlank() || baseUrl == null || baseUrl.isBlank() || model == null || model.isBlank()) {
            throw new BusinessException(ResultCode.AI_NOT_CONFIGURED);
        }
    }

    private void validateContentLength(Map<String, Object> content) {
        var json = toJsonString(content);
        if (json.length() > 5000) {
            throw new BusinessException(ResultCode.AI_INPUT_TOO_LONG);
        }
    }

    private String toJsonString(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            throw new RuntimeException("JSON serialization failed", e);
        }
    }

    private String toPrettyJsonString(Object obj) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(obj);
        } catch (Exception e) {
            throw new RuntimeException("JSON serialization failed", e);
        }
    }

    private String invokeChatCompletion(
            String targetModel,
            String systemPrompt,
            String userPrompt,
            double temperature,
            int maxTokens,
            boolean jsonMode
    ) {
        return webClient.post()
                .uri(buildChatCompletionUrl())
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .bodyValue(buildRequestBody(targetModel, systemPrompt, userPrompt, temperature, maxTokens, jsonMode))
                .retrieve()
                .bodyToMono(String.class)
                .block(java.time.Duration.ofSeconds(timeout));
    }

    private String buildChatCompletionUrl() {
        if (baseUrl.endsWith("/chat/completions")) {
            return baseUrl;
        }
        return baseUrl + "/chat/completions";
    }

    private String buildUpstreamErrorMessage(WebClientResponseException e) {
        var status = e.getStatusCode().value();
        if (status == 401 || status == 403) {
            return "AI 服务认证失败，请检查服务端 AI 配置";
        }
        if (status == 429) {
            return "AI 服务请求过于频繁，请稍后再试";
        }
        if (status >= 500) {
            return "AI 服务暂时不可用，请稍后重试";
        }
        return "AI 优化请求失败（HTTP " + status + "）";
    }

    private Map<String, Object> buildRequestBody(
            String targetModel,
            String systemPrompt,
            String userPrompt,
            double temperature,
            int maxTokens,
            boolean jsonMode
    ) {
        var payload = new LinkedHashMap<String, Object>();
        payload.put("model", targetModel);
        payload.put("messages", new Object[]{
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt)
        });
        payload.put("temperature", temperature);
        payload.put("max_tokens", maxTokens);
        if (jsonMode) {
            payload.put("response_format", Map.of("type", "json_object"));
        }
        return payload;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseAiResponse(String response, Map<String, Object> originalContent) {
        try {
            var root = objectMapper.readTree(response);
            var content = cleanJsonPayload(extractAssistantContent(root));

            var optimized = objectMapper.readValue(content, Map.class);
            if (!matchesShape(originalContent, optimized)) {
                throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
            }

            return optimized;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse AI response: {}", e.getMessage());
            throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
        }
    }

    private ResumeAnalysisResultDTO parseAnalysisResponse(String response) {
        try {
            var root = objectMapper.readTree(response);
            var content = cleanJsonPayload(extractAssistantContent(root));
            var result = objectMapper.readValue(content, ResumeAnalysisResultDTO.class);
            normalizeAnalysisResult(result);
            return result;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse analysis response: {} | raw: {}", e.getMessage(), truncateText(response, 1200));
            throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
        }
    }

    private String extractAssistantContent(com.fasterxml.jackson.databind.JsonNode root) {
        var message = root.path("choices").path(0).path("message");
        var content = message.path("content").asText("");
        if (content != null && !content.isBlank()) {
            return content;
        }
        return message.path("reasoning_content").asText("");
    }

    private String cleanJsonPayload(String content) {
        var cleaned = content == null ? "" : content.trim();
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7);
        }
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3);
        }
        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3);
        }
        cleaned = cleaned.trim();

        var jsonStart = cleaned.indexOf('{');
        var jsonEnd = cleaned.lastIndexOf('}');
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
            cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
        }

        return cleaned.trim();
    }

    private void normalizeAnalysisResult(ResumeAnalysisResultDTO result) {
        if (result == null) {
            throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
        }

        result.setScore(Math.max(0, Math.min(100, result.getScore())));
        if (result.getIssues() == null) {
            result.setIssues(List.of());
        }
        if (result.getSuggestions() == null) {
            result.setSuggestions(List.of());
        }

        result.setIssues(result.getIssues().stream()
                .peek(this::normalizeIssue)
                .filter(issue -> !shouldIgnoreAnalysisIssue(issue))
                .limit(4)
                .collect(Collectors.toList()));
        result.setSuggestions(result.getSuggestions().stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(suggestion -> !suggestion.isBlank())
                .filter(suggestion -> !shouldIgnoreAnalysisSuggestion(suggestion))
                .limit(4)
                .collect(Collectors.toList()));
        recalibrateAnalysisScore(result);
    }

    private void normalizeIssue(ResumeAnalysisIssueDTO issue) {
        if (issue == null) {
            throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
        }
        if (issue.getType() == null || !ALLOWED_ISSUE_TYPES.contains(issue.getType())) {
            issue.setType("content");
        }
        if (issue.getField() == null) {
            issue.setField("");
        }
        if (issue.getMessage() == null || issue.getMessage().isBlank()) {
            throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
        }
        if (issue.getSuggestion() == null || issue.getSuggestion().isBlank()) {
            throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
        }
    }

    private boolean shouldIgnoreAnalysisIssue(ResumeAnalysisIssueDTO issue) {
        var field = issue.getField() == null ? "" : issue.getField().trim().toLowerCase();
        var message = issue.getMessage() == null ? "" : issue.getMessage().trim();
        var suggestion = issue.getSuggestion() == null ? "" : issue.getSuggestion().trim();
        var combined = (message + "\n" + suggestion).toLowerCase();

        if (IGNORED_ANALYSIS_FIELDS.contains(field)) {
            return true;
        }

        var targetsSkillClassification = combined.contains("技能描述过于笼统")
                || combined.contains("未分类展示")
                || combined.contains("按类别分类")
                || combined.contains("按技术领域分类")
                || combined.contains("专业技能模块缺乏清晰分类")
                || combined.contains("专业技能部分")
                || combined.contains("技能部分内容较少")
                || combined.contains("扩充专业技能");

        if (targetsSkillClassification) {
            return true;
        }

        if (field.contains("skill") || field.contains("专业技能")) {
            return true;
        }

        if (field.contains("award")
                || field.contains("获奖")
                || combined.contains("获奖情况")
                || combined.contains("奖学金")
                || combined.contains("技术类竞赛")
                || combined.contains("ai相关竞赛")) {
            return true;
        }

        if (field.contains("gpa")
                || combined.contains("gpa")
                || combined.contains("专业排名")
                || combined.contains("学业成绩")) {
            return true;
        }

        if (field.contains("github")
                || combined.contains("github链接")
                || combined.contains("github 链接")
                || combined.contains("github")) {
            return true;
        }

        if ((field.contains("email") || combined.contains("邮箱"))
                && (combined.contains("不够专业")
                || combined.contains("第一印象")
                || combined.contains("学校邮箱")
                || combined.contains("组合邮箱")
                || combined.contains("更专业的邮箱"))) {
            return true;
        }

        return combined.contains("缺少个人简介")
                || combined.contains("职业总结")
                || combined.contains("自我评价")
                || combined.contains("快速了解候选人的核心优势");
    }

    private boolean shouldIgnoreAnalysisSuggestion(String suggestion) {
        var normalized = suggestion.toLowerCase();
        return normalized.contains("个人定位")
                || normalized.contains("个人简介")
                || normalized.contains("职业总结")
                || normalized.contains("自我评价")
                || normalized.contains("按类别分类")
                || normalized.contains("按技术领域分类")
                || normalized.contains("专业技能分类")
                || normalized.contains("技能分类")
                || (normalized.contains("技能") && normalized.contains("分类"))
                || normalized.contains("大模型应用、向量检索、提示工程")
                || normalized.contains("专业技能")
                || normalized.contains("技能部分")
                || normalized.contains("gpa")
                || normalized.contains("专业排名")
                || normalized.contains("学业成绩")
                || normalized.contains("学校邮箱")
                || normalized.contains("更专业的邮箱")
                || normalized.contains("第一印象")
                || normalized.contains("github")
                || normalized.contains("获奖")
                || normalized.contains("竞赛")
                || normalized.contains("奖学金");
    }

    private void recalibrateAnalysisScore(ResumeAnalysisResultDTO result) {
        var issues = result.getIssues();
        var score = result.getScore();

        if (issues.isEmpty()) {
            result.setScore(Math.max(score, 93));
            return;
        }

        var hasCriticalIssue = issues.stream().anyMatch(issue ->
                "missing".equals(issue.getType()) || "content".equals(issue.getType()));
        var onlyMinorIssues = issues.stream().allMatch(issue ->
                "weak".equals(issue.getType()) || "format".equals(issue.getType()));

        if (issues.size() <= 2 && issues.stream().noneMatch(issue -> "missing".equals(issue.getType()))) {
            result.setScore(Math.max(score, 91));
            return;
        }

        if (onlyMinorIssues && issues.size() <= 2) {
            result.setScore(Math.max(score, 92));
            return;
        }

        if (!hasCriticalIssue && issues.size() <= 3) {
            result.setScore(Math.max(score, 90));
        }
    }

    private String buildResumeAnalysisPrompt(String resumeTitle, List<ResumeModule> modules, String promptOverride) {
        var moduleSummaries = modules.stream()
                .sorted(Comparator.comparing((ResumeModule module) -> module.getSortOrder() == null ? Integer.MAX_VALUE : module.getSortOrder())
                        .thenComparing(ResumeModule::getId))
                .map(this::buildModuleSummary)
                .toList();
        var instructions = promptOverride == null || promptOverride.isBlank()
                ? DEFAULT_ANALYSIS_INSTRUCTIONS
                : promptOverride.trim();

        return """
                请分析下面这份简历，并给出结构化评估结果。

                ## 简历标题
                %s

                ## 简历模块
                %s

                ## 用户提示词
                %s

                ## 分析要求
                1. 基于当前真实内容分析，不要臆造候选人未填写的信息。
                2. 重点关注完整性、内容质量、表达专业度、岗位匹配度、竞争力。
                3. 实习经历和项目经历都很重要，不要因为名称不同而区别对待。
                4. 专业技能可能是整句能力描述，不要机械地要求必须是技术名词列表。
                5. 不要把“专业技能没有分类展示”当成问题，也不要建议按类别重写专业技能。
                6. 不要把“缺少个人简介/职业总结/自我评价”当成问题，也不要建议补这一项。
                7. 对校招技术简历，项目经历、实习经历、专业技能是核心权重；不要因为获奖较少、没有 AI 竞赛、没有 GPA、GitHub 链接缺少补充说明而明显拉低总分。
                8. 获奖、GPA、GitHub 包装度只能作为轻微加分项或轻微提示，不应作为主要扣分依据。
                9. 只有在确实存在明显问题时才输出 issues，避免泛泛而谈。
                10. suggestion 必须具体、可执行，避免空话。
                11. issues 最多输出 4 条，suggestions 最多输出 4 条，优先保留最重要的内容。

                ## 输出格式
                你必须严格只输出 JSON，不要输出任何解释、标题或 Markdown 代码块。
                JSON 结构如下：
                {
                  "score": 0,
                  "issues": [
                    {
                      "type": "missing | weak | format | content",
                      "field": "模块名.字段名",
                      "message": "问题描述",
                      "suggestion": "具体修改建议"
                    }
                  ],
                  "suggestions": ["建议1", "建议2"]
                }

                评分说明：
                - 90-100：内容完整、表达成熟、可直接投递
                - 80-89：整体较好，有少量可优化项
                - 70-79：基础可用，但还有明显短板
                - 60-69：信息或表达存在较多问题
                - 0-59：需要明显重构
                """.formatted(
                resumeTitle == null || resumeTitle.isBlank() ? "未命名简历" : resumeTitle,
                String.join("\n\n", moduleSummaries),
                instructions
        );
    }

    private String buildModuleSummary(ResumeModule module) {
        var builder = new StringBuilder();
        builder.append("### ")
                .append(MODULE_LABELS.getOrDefault(module.getModuleType(), module.getModuleType()))
                .append('\n');

        appendStructuredContent(builder, module.getContent(), "");
        return builder.toString().trim();
    }

    @SuppressWarnings("unchecked")
    private void appendStructuredContent(StringBuilder builder, Map<String, Object> content, String indent) {
        if (content == null || content.isEmpty()) {
            builder.append(indent).append("（未填写）\n");
            return;
        }

        for (var entry : content.entrySet()) {
            var value = entry.getValue();
            if (!isMeaningfulValue(value)) {
                continue;
            }

            if (value instanceof Map<?, ?> childMap) {
                builder.append(indent).append(entry.getKey()).append(":\n");
                appendStructuredContent(builder, (Map<String, Object>) childMap, indent + "  ");
                continue;
            }

            if (value instanceof List<?> listValue) {
                builder.append(indent).append(entry.getKey()).append(": ");
                builder.append(joinListValue(listValue)).append('\n');
                continue;
            }

            builder.append(indent)
                    .append(entry.getKey())
                    .append(": ")
                    .append(truncateText(String.valueOf(value), 220))
                    .append('\n');
        }
    }

    private boolean isMeaningfulValue(Object value) {
        if (value == null) {
            return false;
        }
        if (value instanceof String stringValue) {
            return !stringValue.isBlank();
        }
        if (value instanceof List<?> listValue) {
            return listValue.stream().anyMatch(this::isMeaningfulValue);
        }
        if (value instanceof Map<?, ?> mapValue) {
            return mapValue.values().stream().anyMatch(this::isMeaningfulValue);
        }
        if (value instanceof Boolean boolValue) {
            return boolValue;
        }
        return true;
    }

    private String joinListValue(List<?> items) {
        var joiner = new StringJoiner(" | ");
        var count = 0;
        for (var item : items) {
            if (!isMeaningfulValue(item)) {
                continue;
            }
            if (count >= 4) {
                joiner.add("...");
                break;
            }
            joiner.add(truncateText(String.valueOf(item), 160));
            count++;
        }
        return joiner.length() == 0 ? "（未填写）" : joiner.toString();
    }

    private String truncateText(String value, int maxLength) {
        if (value == null) {
            return "";
        }
        var normalized = value.replace('\n', ' ').replace('\r', ' ').replaceAll("\\s+", " ").trim();
        if (normalized.length() <= maxLength) {
            return normalized;
        }
        return normalized.substring(0, Math.max(0, maxLength - 1)) + "…";
    }

    @SuppressWarnings("unchecked")
    private boolean matchesShape(Object original, Object candidate) {
        if (original == null || candidate == null) {
            return original == candidate;
        }

        if (original instanceof Map<?, ?> originalMap && candidate instanceof Map<?, ?> candidateMap) {
            var originalKeys = originalMap.keySet();
            var candidateKeys = candidateMap.keySet();
            if (!Objects.equals(originalKeys, candidateKeys)) {
                return false;
            }

            for (var key : originalKeys) {
                if (!matchesShape(originalMap.get(key), candidateMap.get(key))) {
                    return false;
                }
            }

            return true;
        }

        if (original instanceof List<?> originalList && candidate instanceof List<?> candidateList) {
            if (originalList.isEmpty() || candidateList.isEmpty()) {
                return true;
            }

            var template = originalList.stream().filter(Objects::nonNull).findFirst().orElse(null);
            if (template == null) {
                return true;
            }

            for (var item : candidateList) {
                if (!matchesShape(template, item)) {
                    return false;
                }
            }

            return true;
        }

        if (original instanceof String) {
            return candidate instanceof String;
        }

        if (original instanceof Boolean) {
            return candidate instanceof Boolean;
        }

        if (original instanceof Number) {
            return candidate instanceof Number;
        }

        return original.getClass().equals(candidate.getClass());
    }
}
