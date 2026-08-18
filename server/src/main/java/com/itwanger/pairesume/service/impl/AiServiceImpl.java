package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.AiFieldOptimizeRequestDTO;
import com.itwanger.pairesume.dto.FieldOptimizePromptConfigDTO;
import com.itwanger.pairesume.dto.ResumeAnalysisIssueDTO;
import com.itwanger.pairesume.dto.ResumeAnalysisResultDTO;
import com.itwanger.pairesume.dto.SmartOnePageModuleDecisionDTO;
import com.itwanger.pairesume.dto.SmartOnePagePreviewMetaDTO;
import com.itwanger.pairesume.dto.SmartOnePagePreviewRequestDTO;
import com.itwanger.pairesume.dto.SmartOnePagePreviewResponseDTO;
import com.itwanger.pairesume.dto.ShowcaseMetadataDTO;
import com.itwanger.pairesume.dto.LibraryAiDraftRequestDTO;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.service.AiService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.reactive.function.client.WebClient;
import org.yaml.snakeyaml.Yaml;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.StringJoiner;
import java.util.function.Consumer;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
public class AiServiceImpl implements AiService {
    private static final double A4_HEIGHT = 841.89d;
    private static final Pattern ENGLISH_KEYWORD_PATTERN = Pattern.compile("[A-Za-z][A-Za-z0-9.+#/_-]{1,}");
    private static final Pattern HAN_TO_ENGLISH_PATTERN = Pattern.compile("([\\p{IsHan}])([A-Za-z][A-Za-z0-9.+#/_-]*)");
    private static final Pattern ENGLISH_TO_HAN_PATTERN = Pattern.compile("([A-Za-z][A-Za-z0-9.+#/_-]*)([\\p{IsHan}])");
    private static final Pattern PLACEHOLDER_CANDIDATE_PATTERN = Pattern.compile("^(版本|方向|候选)\\s*[0-9一二三四五六七八九十]+\\s*[:：]?$");
    private static final Pattern SHOWCASE_SCORE_LABEL_PATTERN = Pattern.compile(
            "(?:\\d{1,3}\\s*(?:分|%|％)|高分|满分|优质|优秀|精品)"
    );
    private static final Pattern SHOWCASE_CONTACT_PATTERN = Pattern.compile(
            "(?i)(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}|(?<!\\d)1[3-9]\\d{9}(?!\\d))"
    );
    private static final Pattern SHOWCASE_ORGANIZATION_TAG_PATTERN = Pattern.compile(
            ".*(?:大学|学院|中学|有限公司|公司)$"
    );
    private static final Set<String> ALLOWED_ISSUE_TYPES = Set.of("missing", "weak", "format", "content");
    private static final Set<String> IGNORED_ANALYSIS_FIELDS = Set.of("basic_info.summary", "professional_summary", "skill", "专业技能");
    private static final Set<String> OPTIMIZABLE_MODULE_TYPES = Set.of("internship", "work_experience", "project", "research", "skill");
    private static final Map<String, String> MODULE_LABELS = Map.of(
            "basic_info", "基本信息",
            "education", "教育背景",
            "internship", "实习经历",
            "work_experience", "工作经历",
            "project", "项目经历",
            "skill", "专业技能",
            "paper", "论文期刊",
            "research", "科研经历",
            "award", "荣誉奖项",
            "job_intention", "求职意向"
    );

    private final WebClient webClient;
    private final HttpClient httpClient;
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

    @Value("${app.prompts.field-optimize.config-file:config/field-optimize-prompts.yml}")
    private String fieldOptimizePromptConfigFile;

    private static final String SYSTEM_PROMPT = """
            你是一位顶级的技术招聘官和简历优化专家，尤其擅长指导计算机领域的应届生和实习生。你的任务是优化下方提供的简历模块 JSON 内容，使其在求职（开发、测试、运维等岗位）时更具竞争力。

            **核心优化原则:**
            *   **使用STAR法则**: 确保描述清晰地反映出项目/工作/实习的背景（Situation）、你的任务（Task）、你采取的具体行动（Action）以及最终达成的可量化成果（Result）。
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
    private static final String DEFAULT_FIELD_OPTIMIZE_SYSTEM_PROMPT = "你是一位严格、克制、结果导向的中文技术简历优化专家。";
    private static final String DEFAULT_FIELD_OPTIMIZE_CONFIG_PATH = "config/field-optimize-prompts.yml";
    private static final String INTERNSHIP_PROJECT_DESCRIPTION_PROMPT = """
            你是一位技术简历专家，请只优化“项目简介”这一段原文，不要参考或扩写其他字段。

            优化要求：
            1. 突出“这是一个什么系统/平台、用到了哪些关键的技术栈、解决什么问题、核心价值是什么”。
            2. 可以适当增加一些数据、业务规模。
            3. 输出 3 个版本，分别偏保守、偏标准、偏有张力，但都必须适合直接放进简历。

            原始项目简介：
            {{original}}

            输出要求：
            - 只返回 JSON
            - JSON 结构必须是 {"candidates":["完整版本A","完整版本B","完整版本C"]}
            - candidates 中的每一项都必须是完整可用的简历文案，严禁返回“版本1”“版本2”这类占位词
            """;
    private static final String INTERNSHIP_RESPONSIBILITY_PROMPT = """
            你是一位技术简历专家，请只优化“工作经历 / 实习经历”中的一条核心职责。

            优化要求：
            1. 用了什么技术栈，解决了什么问题，实现了什么业务或能力。
            2. 如果原文中存在量化数据或效果，必须保留；如果没有，可适当增加，但不过分，合情合理，如果牵强，可以不要量化数据。
            3. 输出 3 个版本，分别偏保守、偏标准、偏有张力，但都必须适合直接放进简历。
            4. 保持语言专业、克制、结果导向。
            5. 严禁编造事实。

            提炼和润色方向：
            - 版本1（偏保守）：尽量贴近原文，只做结构优化和表达提纯。
            - 版本2（偏标准）：更完整地写清技术栈、问题、能力，适合作为默认投递版本。
            - 版本3（偏有张力）：在不编造事实的前提下，更强调技术价值、架构价值或业务支撑价值。

            当前上下文：
            - 公司：{{company}}
            - 岗位：{{position}}
            - 项目名：{{projectName}}
            - 技术栈：{{techStack}}
            - 项目简介：{{projectDescription}}

            原始职责：
            {{original}}

            输出要求：
            - 只返回 JSON
            - JSON 结构必须是 {"candidates":["完整版本A","完整版本B","完整版本C"]}
            - 如果你开启了思考并会在思考区展示分析过程，那么你必须在思考的最后额外输出一行固定格式：
              最终结果：{"candidates":["完整版本A","完整版本B","完整版本C"]}
            - 不要讨论输出格式，不要讨论 Markdown、代码块、系统提示词是否冲突
            - candidates 中的每一项都必须是完整可用的简历文案，严禁返回“版本1”“版本2”这类占位词
            """;
    private static final String SKILL_ITEM_PROMPT = """
            你是一位技术简历专家，请只优化“一条专业技能”。

            优化要求：
            1. 保留原文中的技术事实、熟练程度和能力边界，不新增原文没有出现的技术栈或项目成果。
            2. 优先写清“掌握或熟悉什么技术、理解什么机制、能够解决什么问题”，避免只有关键词堆砌。
            3. 输出 3 个版本，分别偏保守、偏标准、偏精炼，每个版本都是一条可直接放进简历的完整技能描述。
            4. 语言专业、克制、信息密度高，不写自我评价和空泛形容词。

            原始技能：
            {{original}}

            输出要求：
            - 只返回 JSON
            - JSON 结构必须是 {"candidates":["完整版本A","完整版本B","完整版本C"]}
            - candidates 中的每一项都必须是完整可用的简历文案，严禁返回“版本1”“版本2”这类占位词
            """;
    private static final String PROJECT_DESCRIPTION_PROMPT = """
            你是一位技术简历专家，请只优化“项目描述”这一段原文，不要参考或扩写其他字段。

            优化要求：
            1. 突出“这是一个什么系统/平台、用到了哪些关键的技术栈、解决什么问题、核心价值是什么”。
            2. 可以适当增加一些数据、业务规模。
            3. 输出 3 个版本，分别偏保守、偏标准、偏有张力，但都必须适合直接放进简历。

            原始项目描述：
            {{original}}

            输出要求：
            - 只返回 JSON
            - JSON 结构必须是 {"candidates":["完整版本A","完整版本B","完整版本C"]}
            - candidates 中的每一项都必须是完整可用的简历文案，严禁返回“版本1”“版本2”这类占位词
            """;
    private static final String PROJECT_DESCRIPTION_RETRY_PROMPT = """
            基于下面这段项目简介，直接输出 3 个可放进简历的候选版本。

            要求：
            1. 只围绕原文改写，不补充任何额外背景。
            2. 每个版本 1-2 句话，至少 20 个字。
            3. 不要写“版本1”“方向1”这类占位词。
            4. 只返回 JSON，格式必须是 {"candidates":["完整版本A","完整版本B","完整版本C"]}。

            原始项目简介：
            %s
            """;
    private static final String PROJECT_RESPONSIBILITY_PROMPT = """
            你是一位技术简历专家，请只优化“项目经历”中的一条核心职责。

            优化要求：
            1. 用了什么技术栈，解决了什么问题，实现了什么业务或能力。
            2. 如果原文中存在量化数据或效果，必须保留；如果没有，可适当增加，但不过分，合情合理，如果牵强，可以不要量化数据。
            3. 输出 3 个版本，分别偏保守、偏标准、偏有张力，但都必须适合直接放进简历。
            4. 保持语言专业、克制、结果导向。
            5. 严禁编造事实。

            提炼和润色方向：
            - 版本1（偏保守）：尽量贴近原文，只做结构优化和表达提纯。
            - 版本2（偏标准）：更完整地写清技术栈、问题、能力，适合作为默认投递版本。
            - 版本3（偏有张力）：在不编造事实的前提下，更强调技术价值、架构价值或业务支撑价值。

            当前上下文：
            - 项目名：{{projectName}}
            - 角色：{{role}}
            - 技术栈：{{techStack}}
            - 项目描述：{{description}}

            原始职责：
            {{original}}

            输出要求：
            - 只返回 JSON
            - JSON 结构必须是 {"candidates":["完整版本A","完整版本B","完整版本C"]}
            - 如果你开启了思考并会在思考区展示分析过程，那么你必须在思考的最后额外输出一行固定格式：
              最终结果：{"candidates":["完整版本A","完整版本B","完整版本C"]}
            - 不要讨论输出格式，不要讨论 Markdown、代码块、系统提示词是否冲突
            - candidates 中的每一项都必须是完整可用的简历文案，严禁返回“版本1”“版本2”这类占位词
            """;

    public AiServiceImpl(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.webClient = WebClient.builder().build();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
    }

    private record FieldOptimizePlan(
            String moduleType,
            String fieldType,
            String originalText,
            String prompt,
            boolean candidateOutput
    ) {
    }

    private record StreamChatResult(String content, String reasoning, String finishReason) {
    }

    private static final class StreamLogState {
        private int reasoningLoggedLength;
        private int contentLoggedLength;
        private boolean reasoningStarted;
        private boolean contentStarted;
    }

    @Override
    public Map<String, Object> optimizeModule(String moduleType, Map<String, Object> content) {
        validateConfiguration();
        validateContentLength(content);

        var contentJson = toJsonString(content);
        var prompt = String.format(SYSTEM_PROMPT, contentJson);

        try {
            var response = invokeChatCompletion(model, prompt, "请优化这份简历内容", 0.7, 4000, false, false);

            if (response == null) {
                throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
            }

            var optimizedContent = parseAiResponse(response, content);
            return Map.of("original", content, "optimized", optimizedContent);
        } catch (BusinessException e) {
            throw e;
        } catch (WebClientResponseException e) {
            log.error("AI optimization upstream failed: status={}, errorType={}",
                    e.getStatusCode(), e.getClass().getSimpleName());
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY.getCode(), buildUpstreamErrorMessage(e));
        } catch (Exception e) {
            log.error("AI optimization failed: errorType={}", e.getClass().getSimpleName());
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
        }
    }

    @Override
    public FieldOptimizePromptConfigDTO getFieldOptimizePromptConfig() {
        return loadFieldOptimizePromptConfig();
    }

    @Override
    public Map<String, Object> optimizeModuleField(String moduleType, Map<String, Object> content, AiFieldOptimizeRequestDTO request) {
        validateConfiguration();
        var plan = prepareFieldOptimizePlan(moduleType, content, request);

        log.info("[AI Optimize][Service] preparing field optimize: moduleType={}, fieldType={}, index={}, originalLength={}",
                plan.moduleType(),
                plan.fieldType(),
                request.getIndex(),
                plan.originalText().length());

        try {
            var candidateOutput = plan.candidateOutput();
            var targetModel = model;
            var systemPrompt = resolveFieldSystemPrompt(request);
            var response = invokeChatCompletion(
                    targetModel,
                    systemPrompt,
                    plan.prompt(),
                    0.35,
                    candidateOutput ? 1600 : 1000,
                    candidateOutput,
                    false
            );

            if (response == null) {
                throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
            }

            log.info("[AI Optimize][Service] upstream response received: moduleType={}, fieldType={}, responseLength={}",
                    plan.moduleType(), plan.fieldType(), response.length());

            if (candidateOutput) {
                var candidates = normalizeResumeCandidates(parseTextCandidatesResponse(response));
                log.info("[AI Optimize][Service] parsed field optimize candidates: moduleType={}, fieldType={}, count={}",
                        plan.moduleType(), plan.fieldType(), candidates.size());
                if ("project_description".equals(plan.fieldType()) && !areTextCandidatesUsable(candidates)) {
                    log.warn("[AI Optimize][Service] unusable project description candidates detected, retrying: moduleType={}, count={}",
                            plan.moduleType(), candidates.size());
                    var retryResponse = invokeChatCompletion(
                            model,
                            systemPrompt,
                            PROJECT_DESCRIPTION_RETRY_PROMPT.formatted(plan.originalText()),
                            0.35,
                            1000,
                            true,
                            false
                    );

                    if (retryResponse == null) {
                        throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
                    }

                    log.info("[AI Optimize][Service] upstream retry response received: moduleType={}, fieldType={}, responseLength={}",
                            plan.moduleType(), plan.fieldType(), retryResponse.length());
                    candidates = normalizeResumeCandidates(parseTextCandidatesResponse(retryResponse));
                    log.info("[AI Optimize][Service] parsed retry candidates: moduleType={}, count={}",
                            plan.moduleType(), candidates.size());
                }

                if (!areTextCandidatesUsable(candidates)) {
                    throw new BusinessException(ResultCode.AI_RESPONSE_INVALID.getCode(), "AI 返回了占位候选结果，请重试");
                }

                return Map.of(
                        "original", plan.originalText(),
                        "optimized", candidates.get(0),
                        "candidates", candidates
                );
            }

            var optimizedText = normalizeResumeMixedTextSpacing(cleanTextResponse(response));
            if (optimizedText.isBlank()) {
                throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
            }

            log.info("[AI Optimize][Service] parsed field optimize result: moduleType={}, fieldType={}, optimizedLength={}",
                    plan.moduleType(), plan.fieldType(), optimizedText.length());

            return Map.of(
                    "original", plan.originalText(),
                    "optimized", optimizedText
            );
        } catch (BusinessException e) {
            throw e;
        } catch (WebClientResponseException e) {
            log.error("AI field optimization upstream failed: status={}, errorType={}",
                    e.getStatusCode(), e.getClass().getSimpleName());
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY.getCode(), buildUpstreamErrorMessage(e));
        } catch (Exception e) {
            log.error("AI field optimization failed: errorType={}", e.getClass().getSimpleName());
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
        }
    }

    @Override
    public Map<String, Object> streamOptimizeModuleField(
            String moduleType,
            Map<String, Object> content,
            AiFieldOptimizeRequestDTO request,
            Consumer<Map<String, Object>> eventConsumer
    ) {
        validateConfiguration();
        var plan = prepareFieldOptimizePlan(moduleType, content, request);
        emitStreamEvent(eventConsumer, "meta", Map.of(
                "moduleType", plan.moduleType(),
                "fieldType", plan.fieldType(),
                "original", plan.originalText()
        ));
        emitStreamEvent(eventConsumer, "status", Map.of("message", "AI 已连接，正在生成结果。"));

        try {
            var targetModel = model;
            var systemPrompt = resolveFieldSystemPrompt(request);
            var streamResult = streamChatCompletion(
                    targetModel,
                    systemPrompt,
                    plan.prompt(),
                    0.35,
                    plan.candidateOutput() ? 2400 : 1400,
                    plan.candidateOutput(),
                    false,
                    eventConsumer
            );

            if (plan.candidateOutput()) {
                var candidates = normalizeResumeCandidates(extractCandidatesFromStreamResult(streamResult));
                if (candidates.isEmpty() && "length".equals(streamResult.finishReason())) {
                    emitStreamEvent(eventConsumer, "status", Map.of("message", "首次输出被截断，正在补全最终候选，这一步可能需要几秒。"));
                    candidates = normalizeResumeCandidates(finalizeCandidateOutput(targetModel, systemPrompt, plan.prompt(), streamResult.content()));
                    if (candidates.isEmpty()) {
                        emitStreamEvent(eventConsumer, "status", Map.of("message", "首次补全未拿到可用结果，正在重试一次。"));
                        candidates = normalizeResumeCandidates(finalizeCandidateOutput(targetModel, systemPrompt, plan.prompt(), streamResult.content()));
                    }
                }
                log.info("[AI Optimize][Service] stream field optimize candidates ready: moduleType={}, fieldType={}, count={}",
                        plan.moduleType(), plan.fieldType(), candidates.size());
                if (!areTextCandidatesUsable(candidates)) {
                    throw new BusinessException(ResultCode.AI_RESPONSE_INVALID.getCode(), "AI 返回了不可采纳的候选结果，请重试");
                }
                return Map.of(
                        "original", plan.originalText(),
                        "optimized", candidates.get(0),
                        "candidates", candidates
                );
            }

            var optimizedText = normalizeResumeMixedTextSpacing(cleanTextContent(streamResult.content()));
            if (optimizedText.isBlank()) {
                optimizedText = normalizeResumeMixedTextSpacing(extractOptimizedTextFromReasoning(streamResult.reasoning()));
            }
            if (optimizedText.isBlank()) {
                throw new BusinessException(ResultCode.AI_RESPONSE_INVALID.getCode(), "AI 思考已结束，但未返回最终结果，请重试");
            }
            log.info("[AI Optimize][Service] stream field optimize result ready: moduleType={}, fieldType={}, optimizedLength={}",
                    plan.moduleType(), plan.fieldType(), optimizedText.length());

            return Map.of(
                    "original", plan.originalText(),
                    "optimized", optimizedText
            );
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("AI field streaming optimization failed: errorType={}", e.getClass().getSimpleName());
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
        }
    }

    private FieldOptimizePlan prepareFieldOptimizePlan(String moduleType, Map<String, Object> content, AiFieldOptimizeRequestDTO request) {
        if (request == null || request.getFieldType() == null || request.getFieldType().isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "缺少字段级优化参数");
        }

        return switch (moduleType) {
            case "internship", "work_experience" -> buildExperienceFieldOptimizePlan(moduleType, content, request);
            case "project" -> buildProjectFieldOptimizePlan(content, request);
            case "skill" -> buildSkillFieldOptimizePlan(content, request);
            default -> throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "当前模块暂不支持字段级 AI 优化");
        };
    }

    private FieldOptimizePlan buildExperienceFieldOptimizePlan(String moduleType, Map<String, Object> content, AiFieldOptimizeRequestDTO request) {
        var company = getStringValue(content.get("company"));
        var position = getStringValue(content.get("position"));
        var hasNestedProjects = content.get("projects") instanceof List<?> projects && !projects.isEmpty();

        return switch (request.getFieldType()) {
            case "project_description" -> {
                var projectIndex = hasNestedProjects && request.getIndex() != null ? request.getIndex() : 0;
                var project = hasNestedProjects ? getMapListItem(content.get("projects"), projectIndex) : null;
                if (hasNestedProjects && project == null) {
                    throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "项目索引无效");
                }
                var projectDescription = getStringValue(project == null
                        ? content.get("projectDescription")
                        : project.get("projectDescription"));
                if (projectDescription.isBlank()) {
                    throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "项目简介为空，暂时无法优化");
                }
                yield new FieldOptimizePlan(
                        moduleType,
                        "project_description",
                        projectDescription,
                        resolveFieldPrompt(
                                request,
                                renderPromptTemplate(
                                        loadFieldOptimizePromptConfig().getDescriptionPrompt(),
                                        Map.of("original", projectDescription)
                                )
                        ),
                        true
                );
            }
            case "responsibility" -> {
                var encodedIndex = request.getIndex();
                if (encodedIndex == null || encodedIndex < 0) {
                    throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "核心职责索引无效");
                }
                var projectIndex = hasNestedProjects ? encodedIndex / 1000 : 0;
                var responsibilityIndex = hasNestedProjects ? encodedIndex % 1000 : encodedIndex;
                var project = hasNestedProjects ? getMapListItem(content.get("projects"), projectIndex) : null;
                if (hasNestedProjects && project == null) {
                    throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "项目索引无效");
                }
                var projectName = getStringValue(project == null ? content.get("projectName") : project.get("projectName"));
                var techStack = getStringValue(project == null ? content.get("techStack") : project.get("techStack"));
                var projectDescription = getStringValue(project == null ? content.get("projectDescription") : project.get("projectDescription"));
                var responsibilities = getStringListValue(project == null ? content.get("responsibilities") : project.get("responsibilities"));
                if (responsibilityIndex >= responsibilities.size()) {
                    throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "核心职责索引无效");
                }
                var originalText = responsibilities.get(responsibilityIndex);
                if (originalText == null || originalText.isBlank()) {
                    throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "当前这条核心职责为空，暂时无法优化");
                }
                yield new FieldOptimizePlan(
                        moduleType,
                        "responsibility",
                        originalText,
                        resolveFieldPrompt(
                                request,
                                renderPromptTemplate(
                                        loadFieldOptimizePromptConfig().getResponsibilityPrompt(),
                                        Map.of(
                                                "company", company,
                                                "position", position,
                                                "projectName", projectName,
                                                "techStack", techStack,
                                                "projectDescription", projectDescription,
                                                "original", originalText
                                        )
                                )
                        ),
                        true
                );
            }
            default -> throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "不支持的字段级优化类型");
        };
    }

    private FieldOptimizePlan buildProjectFieldOptimizePlan(Map<String, Object> content, AiFieldOptimizeRequestDTO request) {
        var projectName = getStringValue(content.get("projectName"));
        var role = getStringValue(content.get("role"));
        var techStack = getStringValue(content.get("techStack"));
        var description = getStringValue(content.get("description"));
        var achievements = getStringListValue(content.get("achievements"));

        return switch (request.getFieldType()) {
            case "project_description" -> {
                if (description.isBlank()) {
                    throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "项目描述为空，暂时无法优化");
                }
                yield new FieldOptimizePlan(
                        "project",
                        "project_description",
                        description,
                        resolveFieldPrompt(
                                request,
                                renderPromptTemplate(
                                        loadFieldOptimizePromptConfig().getDescriptionPrompt(),
                                        Map.of("original", description)
                                )
                        ),
                        true
                );
            }
            case "responsibility" -> {
                var index = request.getIndex();
                if (index == null || index < 0 || index >= achievements.size()) {
                    throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "核心职责索引无效");
                }
                var originalText = achievements.get(index);
                if (originalText == null || originalText.isBlank()) {
                    throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "当前这条核心职责为空，暂时无法优化");
                }
                yield new FieldOptimizePlan(
                        "project",
                        "responsibility",
                        originalText,
                        resolveFieldPrompt(
                                request,
                                renderPromptTemplate(
                                        loadFieldOptimizePromptConfig().getResponsibilityPrompt(),
                                        Map.of(
                                                "projectName", projectName,
                                                "role", role,
                                                "techStack", techStack,
                                                "description", description,
                                                "original", originalText
                                        )
                                )
                        ),
                        true
                );
            }
            default -> throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "不支持的字段级优化类型");
        };
    }

    private FieldOptimizePlan buildSkillFieldOptimizePlan(Map<String, Object> content, AiFieldOptimizeRequestDTO request) {
        if (!"skill".equals(request.getFieldType())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "不支持的字段级优化类型");
        }
        var index = request.getIndex();
        if (index == null || index < 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "专业技能索引无效");
        }

        var items = new ArrayList<String>();
        if (content.get("categories") instanceof List<?> categories) {
            for (var categoryValue : categories) {
                if (categoryValue instanceof Map<?, ?> category) {
                    items.addAll(getStringListValue(category.get("items")));
                }
            }
        }
        if (index >= items.size()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "专业技能索引无效");
        }

        var originalText = items.get(index);
        if (originalText == null || originalText.isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "当前这条专业技能为空，暂时无法优化");
        }
        return new FieldOptimizePlan(
                "skill",
                "skill",
                originalText,
                resolveFieldPrompt(
                        request,
                        renderPromptTemplate(
                                loadFieldOptimizePromptConfig().getSkillPrompt(),
                                Map.of("original", originalText)
                        )
                ),
                true
        );
    }

    private String resolveFieldPrompt(AiFieldOptimizeRequestDTO request, String defaultPrompt) {
        if (request != null && request.getPrompt() != null && !request.getPrompt().isBlank()) {
            return request.getPrompt().trim();
        }
        return defaultPrompt;
    }

    private String resolveFieldSystemPrompt(AiFieldOptimizeRequestDTO request) {
        if (request != null && request.getSystemPrompt() != null && !request.getSystemPrompt().isBlank()) {
            return request.getSystemPrompt().trim();
        }
        return loadFieldOptimizePromptConfig().getSystemPrompt();
    }

    private String resolveConfiguredFieldPrompt(String configuredPrompt, String fallbackPrompt) {
        if (configuredPrompt == null || configuredPrompt.isBlank()) {
            return fallbackPrompt;
        }
        return configuredPrompt.trim().replace("\\n", "\n");
    }

    private FieldOptimizePromptConfigDTO loadFieldOptimizePromptConfig() {
        var fallback = buildFallbackFieldOptimizePromptConfig();
        var configPath = resolveFieldOptimizePromptConfigPath();
        if (configPath == null) {
            return fallback;
        }

        try {
            var yamlText = Files.readString(configPath, StandardCharsets.UTF_8);
            if (yamlText.isBlank()) {
                return fallback;
            }
            var yaml = new Yaml();
            var parsed = yaml.load(yamlText);
            if (!(parsed instanceof Map<?, ?> rawMap)) {
                return fallback;
            }

            var config = new FieldOptimizePromptConfigDTO();
            config.setSystemPrompt(resolveConfiguredFieldPrompt(readYamlString(rawMap, "systemPrompt"), DEFAULT_FIELD_OPTIMIZE_SYSTEM_PROMPT));
            config.setDescriptionPrompt(resolveConfiguredFieldPrompt(
                    firstNonBlank(
                            readYamlString(rawMap, "descriptionPrompt"),
                            readYamlString(rawMap, "internshipDescriptionPrompt"),
                            readYamlString(rawMap, "projectDescriptionPrompt")
                    ),
                    INTERNSHIP_PROJECT_DESCRIPTION_PROMPT
            ));
            config.setResponsibilityPrompt(resolveConfiguredFieldPrompt(
                    firstNonBlank(
                            readYamlString(rawMap, "responsibilityPrompt"),
                            readYamlString(rawMap, "internshipResponsibilityPrompt"),
                            readYamlString(rawMap, "projectResponsibilityPrompt")
                    ),
                    INTERNSHIP_RESPONSIBILITY_PROMPT
            ));
            config.setSkillPrompt(resolveConfiguredFieldPrompt(
                    readYamlString(rawMap, "skillPrompt"),
                    SKILL_ITEM_PROMPT
            ));
            return config;
        } catch (Exception e) {
            log.warn("Failed to load field optimize prompt config from {}: errorType={}",
                    configPath, e.getClass().getSimpleName());
            return fallback;
        }
    }

    private FieldOptimizePromptConfigDTO buildFallbackFieldOptimizePromptConfig() {
        var config = new FieldOptimizePromptConfigDTO();
        config.setSystemPrompt(DEFAULT_FIELD_OPTIMIZE_SYSTEM_PROMPT);
        config.setDescriptionPrompt(INTERNSHIP_PROJECT_DESCRIPTION_PROMPT);
        config.setResponsibilityPrompt(INTERNSHIP_RESPONSIBILITY_PROMPT);
        config.setSkillPrompt(SKILL_ITEM_PROMPT);
        return config;
    }

    private Path resolveFieldOptimizePromptConfigPath() {
        var candidates = List.of(
                Path.of(fieldOptimizePromptConfigFile),
                Path.of(DEFAULT_FIELD_OPTIMIZE_CONFIG_PATH),
                Path.of("../" + DEFAULT_FIELD_OPTIMIZE_CONFIG_PATH)
        );
        for (var candidate : candidates) {
            try {
                var normalized = candidate.toAbsolutePath().normalize();
                if (Files.exists(normalized) && Files.isRegularFile(normalized)) {
                    return normalized;
                }
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private String readYamlString(Map<?, ?> rawMap, String key) {
        var value = rawMap.get(key);
        return value == null ? "" : String.valueOf(value);
    }

    private String firstNonBlank(String... values) {
        for (var value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private String renderPromptTemplate(String template, Map<String, String> variables) {
        var rendered = template;
        for (var entry : variables.entrySet()) {
            rendered = rendered.replace("{{" + entry.getKey() + "}}", Objects.toString(entry.getValue(), ""));
        }
        return rendered;
    }

    @Override
    public ResumeAnalysisResultDTO analyzeResume(String resumeTitle, List<ResumeModule> modules, String analysisInstructions) {
        validateConfiguration();

        var prompt = buildResumeAnalysisPrompt(resumeTitle, modules, analysisInstructions);

        try {
            var response = invokeChatCompletion(
                    analysisModel,
                    "你是一位严格、专业、懂技术招聘的资深简历顾问。你需要基于候选人当前简历内容给出真实、克制、可执行的分析结果，并且必须严格输出 JSON。",
                    prompt,
                    0.3,
                    1600,
                    true,
                    false
            );

            if (response == null) {
                throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
            }

            return parseAnalysisResponse(response);
        } catch (BusinessException e) {
            throw e;
        } catch (WebClientResponseException e) {
            log.error("AI resume analysis upstream failed: status={}, errorType={}",
                    e.getStatusCode(), e.getClass().getSimpleName());
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY.getCode(), buildUpstreamErrorMessage(e));
        } catch (Exception e) {
            log.error("AI resume analysis failed: errorType={}", e.getClass().getSimpleName());
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
        }
    }

    @Override
    public ShowcaseMetadataDTO generateShowcaseMetadata(String resumeTitle, List<ResumeModule> modules) {
        validateConfiguration();

        var prompt = buildShowcaseMetadataPrompt(resumeTitle, modules);
        try {
            var response = invokeChatCompletion(
                    analysisModel,
                    "你负责生成公开简历卡片的结构化元数据。只能依据输入内容概括，不能补充、猜测或编造事实。必须严格输出 JSON。",
                    prompt,
                    0.2,
                    800,
                    true,
                    true
            );

            if (response == null) {
                throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
            }
            var metadata = parseShowcaseMetadataResponse(response);
            validateShowcaseMetadataAgainstPrivateInfo(metadata, modules);
            return metadata;
        } catch (BusinessException e) {
            throw e;
        } catch (WebClientResponseException e) {
            log.error("AI showcase metadata upstream failed: status={}, errorType={}",
                    e.getStatusCode(), e.getClass().getSimpleName());
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY.getCode(), buildUpstreamErrorMessage(e));
        } catch (Exception e) {
            log.error("AI showcase metadata generation failed: errorType={}", e.getClass().getSimpleName());
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
        }
    }

    @Override
    public Map<String, Object> generateLibraryDraft(LibraryAiDraftRequestDTO request) {
        validateConfiguration();
        var kind = request.getKind() == null ? "" : request.getKind().strip().toUpperCase(Locale.ROOT);
        if (!Set.of("MATERIAL", "TEMPLATE").contains(kind)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "AI 草稿类型只能是 MATERIAL 或 TEMPLATE");
        }

        var input = new LinkedHashMap<String, Object>();
        input.put("kind", kind);
        input.put("moduleType", request.getModuleType());
        input.put("targetRole", request.getTargetRole());
        input.put("careerStage", request.getCareerStage());
        input.put("techStack", request.getTechStack() == null ? List.of() : request.getTechStack());
        input.put("verifiedFacts", request.getFacts() == null ? Map.of() : request.getFacts());

        var outputSchema = "TEMPLATE".equals(kind)
                ? "{\"title\":\"内容模板标题\",\"summary\":\"适用说明\",\"targetRole\":\"岗位\",\"careerStage\":\"阶段\",\"tags\":[],\"modules\":[{\"moduleType\":\"project\",\"content\":{}}]}"
                : "{\"title\":\"素材标题\",\"moduleType\":\"" + request.getModuleType() + "\",\"tags\":[],\"content\":{}}";
        var prompt = """
                请根据下面的结构化条件生成一份简历官方参考草稿。

                安全要求：
                1. 这只是待管理员审核的参考草稿，不能包含姓名、手机号、邮箱、微信、头像等个人信息。
                2. 只能把 verifiedFacts 中明确提供的内容写成事实；缺失的学校、公司、项目、论文、奖项、职责、成果和数据必须使用中文方括号占位符，不能猜测或编造。
                3. 不得虚构百分比、用户量、性能提升、录取或获奖结果。
                4. content 字段必须沿用 PaiResume 对应 moduleType 的结构；长文本写成可修改的参考表达。
                5. 只输出一个 JSON 对象，不要 Markdown，不要解释。

                输出结构：
                %s

                输入条件：
                %s
                """.formatted(outputSchema, toJsonString(input));

        try {
            var response = invokeChatCompletion(
                    analysisModel,
                    "你是派简历官方内容库的草稿生成器。你必须把真实性和可审核性放在表达效果之前，并严格输出 JSON。",
                    prompt,
                    0.25,
                    2400,
                    true,
                    true
            );
            if (response == null) throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
            return parseLibraryDraftResponse(response, kind);
        } catch (BusinessException e) {
            throw e;
        } catch (WebClientResponseException e) {
            log.error("AI library draft upstream failed: status={}, errorType={}",
                    e.getStatusCode(), e.getClass().getSimpleName());
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY.getCode(), buildUpstreamErrorMessage(e));
        } catch (Exception e) {
            log.error("AI library draft generation failed: errorType={}", e.getClass().getSimpleName());
            throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
        }
    }

    @Override
    public ResumeAnalysisResultDTO streamAnalyzeResume(
            String resumeTitle,
            List<ResumeModule> modules,
            String analysisInstructions,
            Consumer<Map<String, Object>> eventConsumer
    ) {
        validateConfiguration();

        var prompt = buildResumeAnalysisPrompt(resumeTitle, modules, analysisInstructions);
        emitStreamEvent(eventConsumer, "status", Map.of("message", "AI 已连接，正在审阅整份简历。"));

        try {
            var streamResult = streamChatCompletion(
                    analysisModel,
                    "你是一位严格、专业、懂技术招聘的资深简历顾问。你需要基于候选人当前简历内容给出真实、克制、可执行的分析结果，并且必须严格输出 JSON。",
                    prompt,
                    0.3,
                    1600,
                    true,
                    false,
                    eventConsumer
            );

            var response = streamResult.content();
            if (response == null || response.isBlank()) {
                throw new BusinessException(ResultCode.AI_RESPONSE_INVALID.getCode(), "AI 思考已结束，但未返回最终分析结果，请重试");
            }
            return parseAnalysisResponse(response);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("AI resume analysis streaming failed: errorType={}", e.getClass().getSimpleName());
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
        }
    }

    @Override
    public SmartOnePagePreviewResponseDTO previewSmartOnePage(
            String resumeTitle,
            List<ResumeModule> modules,
            SmartOnePagePreviewRequestDTO request
    ) {
        var originalModules = sortResumeModules(modules).stream()
                .map(this::cloneModule)
                .toList();

        validateSmartOnePageRequest(request);
        if ("layout_only".equals(request.getMode())) {
            return buildLayoutOnlyPreview(originalModules);
        }

        validateConfiguration();

        var skillPreset = resolveSkillPreset(request);
        var templatePreset = resolveTemplatePreset(request);
        var promptInstruction = resolvePromptInstruction(request, skillPreset);
        var optimizedModules = new ArrayList<ResumeModule>();
        var effectiveModules = new ArrayList<ResumeModule>();
        var decisions = new ArrayList<SmartOnePageModuleDecisionDTO>();
        var resumeContext = buildSmartOnePageContext(resumeTitle, originalModules);

        for (var module : originalModules) {
            if (!shouldOptimizeModule(module)) {
                var reason = nonOptimizedReasonForModule(module.getModuleType());
                optimizedModules.add(cloneModule(module));
                effectiveModules.add(cloneModule(module));
                decisions.add(buildDecision(module.getId(), "keep_original", reason));
                continue;
            }

            if (!isMeaningfulValue(module.getContent())) {
                optimizedModules.add(cloneModule(module));
                effectiveModules.add(cloneModule(module));
                decisions.add(buildDecision(module.getId(), "keep_original", "当前模块内容较少，直接保留原文。"));
                continue;
            }

            try {
                var optimizedContent = optimizeModuleForSmartOnePage(
                        resumeTitle,
                        module,
                        resumeContext,
                        promptInstruction,
                        templatePreset.getMarkdownBody(),
                        skillPreset
                );
                var optimizedModule = cloneModuleWithContent(module, optimizedContent);
                optimizedModules.add(optimizedModule);

                if (shouldAdoptSmartOptimization(module.getContent(), optimizedContent)) {
                    effectiveModules.add(cloneModule(optimizedModule));
                    decisions.add(buildDecision(module.getId(), "suggest_optimized", "AI 判断这一段还能明显压缩，已生成候选内容供你选择。"));
                } else {
                    effectiveModules.add(cloneModule(module));
                    decisions.add(buildDecision(module.getId(), "keep_original", "原文已经比较成熟或压缩收益有限，默认保持原样。"));
                }
            } catch (BusinessException e) {
                if (e.getCode() == ResultCode.AI_RESPONSE_INVALID.getCode()) {
                    optimizedModules.add(cloneModule(module));
                    effectiveModules.add(cloneModule(module));
                    decisions.add(buildDecision(module.getId(), "keep_original", "AI 返回结果不可采纳，已自动保留原文。"));
                    continue;
                }
                throw e;
            } catch (Exception e) {
                log.warn("Smart one-page optimization fallback: moduleId={}, errorType={}",
                        module.getId(), e.getClass().getSimpleName());
                optimizedModules.add(cloneModule(module));
                effectiveModules.add(cloneModule(module));
                decisions.add(buildDecision(module.getId(), "keep_original", "当前模块优化失败，已自动保留原文。"));
            }
        }

        var result = new SmartOnePagePreviewResponseDTO();
        result.setOriginalModules(originalModules.stream().map(this::cloneModule).toList());
        result.setOptimizedModules(optimizedModules.stream().map(this::cloneModule).toList());
        result.setEffectiveModules(effectiveModules.stream().map(this::cloneModule).toList());
        result.setModuleDecisions(decisions);
        result.setPreviewMeta(buildPreviewMeta(originalModules, effectiveModules));
        result.setSummary(buildSmartOnePageSummary(decisions));
        return result;
    }

    private void validateSmartOnePageRequest(SmartOnePagePreviewRequestDTO request) {
        if (request == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "缺少智能一页请求参数");
        }
        if (!"layout_only".equals(request.getMode()) && !"optimize_and_layout".equals(request.getMode())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "不支持的智能一页模式");
        }
        if (request.getTemplateId() == null || request.getTemplateId().isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请选择参考模板");
        }
        if (!"only_if_better".equals(request.getAdoptionPolicy())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "当前仅支持 only_if_better 采纳策略");
        }
        if (!"continuous_pdf".equals(request.getOutputFormat())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "当前仅支持连续长页 PDF 输出");
        }
        if ("optimize_and_layout".equals(request.getMode())) {
            if (!"skill".equals(request.getPromptMode()) && !"custom".equals(request.getPromptMode())) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请选择优化策略");
            }
            if ("skill".equals(request.getPromptMode()) && (request.getSkillId() == null || request.getSkillId().isBlank())) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请选择内置 Skill");
            }
            if ("custom".equals(request.getPromptMode()) && (request.getCustomPrompt() == null || request.getCustomPrompt().isBlank())) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请输入自定义提示词");
            }
        }
    }

    private SmartOnePagePresetRegistry.SkillPreset resolveSkillPreset(SmartOnePagePreviewRequestDTO request) {
        if (!"skill".equals(request.getPromptMode())) {
            return null;
        }

        var preset = SmartOnePagePresetRegistry.getSkill(request.getSkillId());
        if (preset == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "选择的 Skill 不存在");
        }
        return preset;
    }

    private SmartOnePagePresetRegistry.TemplatePreset resolveTemplatePreset(SmartOnePagePreviewRequestDTO request) {
        var preset = SmartOnePagePresetRegistry.getTemplate(request.getTemplateId());
        if (preset == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "选择的参考模板不存在");
        }
        return preset;
    }

    private String resolvePromptInstruction(
            SmartOnePagePreviewRequestDTO request,
            SmartOnePagePresetRegistry.SkillPreset skillPreset
    ) {
        if ("skill".equals(request.getPromptMode()) && skillPreset != null) {
            return skillPreset.getSystemPrompt();
        }
        return request.getCustomPrompt() == null ? "" : request.getCustomPrompt().trim();
    }

    private SmartOnePagePreviewResponseDTO buildLayoutOnlyPreview(List<ResumeModule> originalModules) {
        var result = new SmartOnePagePreviewResponseDTO();
        var decisions = originalModules.stream()
                .map(module -> buildDecision(module.getId(), "keep_original", "当前模式仅生成连续长页 PDF，不对内容做 AI 压缩。"))
                .toList();

        result.setOriginalModules(originalModules.stream().map(this::cloneModule).toList());
        result.setOptimizedModules(originalModules.stream().map(this::cloneModule).toList());
        result.setEffectiveModules(originalModules.stream().map(this::cloneModule).toList());
        result.setModuleDecisions(decisions);
        result.setPreviewMeta(buildPreviewMeta(originalModules, originalModules));
        result.setSummary("已保持当前 PDF 模板和模块内容不变，仅把导出改为单张连续长页。");
        return result;
    }

    private List<ResumeModule> sortResumeModules(List<ResumeModule> modules) {
        return modules.stream()
                .sorted(Comparator.comparing((ResumeModule module) -> module.getSortOrder() == null ? Integer.MAX_VALUE : module.getSortOrder())
                        .thenComparing(ResumeModule::getId))
                .toList();
    }

    private ResumeModule cloneModule(ResumeModule source) {
        return cloneModuleWithContent(source, deepCopyMap(source.getContent()));
    }

    private ResumeModule cloneModuleWithContent(ResumeModule source, Map<String, Object> content) {
        var clone = new ResumeModule();
        clone.setId(source.getId());
        clone.setResumeId(source.getResumeId());
        clone.setModuleType(source.getModuleType());
        clone.setContent(content);
        clone.setSortOrder(source.getSortOrder());
        clone.setCreatedAt(source.getCreatedAt());
        clone.setUpdatedAt(source.getUpdatedAt());
        return clone;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> deepCopyMap(Map<String, Object> source) {
        if (source == null) {
            return new LinkedHashMap<>();
        }

        return objectMapper.convertValue(source, LinkedHashMap.class);
    }

    private boolean shouldOptimizeModule(ResumeModule module) {
        return OPTIMIZABLE_MODULE_TYPES.contains(module.getModuleType());
    }

    private String nonOptimizedReasonForModule(String moduleType) {
        return switch (moduleType) {
            case "basic_info" -> "基本信息以事实为主，默认保持原文。";
            case "education" -> "教育背景通常较稳定，默认保留原文。";
            case "paper" -> "论文内容以事实陈述为主，默认保留原文。";
            case "award" -> "奖项信息以事实为主，默认保留原文。";
            case "job_intention" -> "求职意向信息较短，默认保留原文。";
            default -> "当前模块默认保持原文。";
        };
    }

    private Map<String, Object> optimizeModuleForSmartOnePage(
            String resumeTitle,
            ResumeModule module,
            String resumeContext,
            String promptInstruction,
            String templateMarkdown,
            SmartOnePagePresetRegistry.SkillPreset skillPreset
    ) {
        validateContentLength(module.getContent());

        var response = invokeChatCompletion(
                model,
                """
                你是一位中文技术简历优化专家。
                你的任务是把单个简历模块压缩为更适合一页/两页投递的表达。
                必须遵守：
                1. 严禁编造事实。
                2. 输出必须且只能是与输入结构完全一致的 JSON。
                3. 如果原文已经足够成熟，也可以只做极少修改。
                """,
                buildSmartOnePageModulePrompt(resumeTitle, module, resumeContext, promptInstruction, templateMarkdown, skillPreset),
                0.35,
                3200,
                false,
                false
        );

        if (response == null) {
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY);
        }

        return parseAiResponse(response, module.getContent());
    }

    private String buildSmartOnePageModulePrompt(
            String resumeTitle,
            ResumeModule module,
            String resumeContext,
            String promptInstruction,
            String templateMarkdown,
            SmartOnePagePresetRegistry.SkillPreset skillPreset
    ) {
        var moduleRule = defaultModuleRule(module.getModuleType());
        var presetRules = skillPreset == null ? "" : String.join("\n", skillPreset.getModuleRules());

        return """
                请基于整份简历上下文，对其中一个模块进行“智能一页”压缩预处理。

                ## 简历标题
                %s

                ## 整份简历摘要
                %s

                ## 参考模板（Markdown）
                %s

                ## 本次优化策略
                %s

                ## Skill 规则
                %s

                ## 当前模块类型
                %s

                ## 当前模块专属规则
                %s

                ## 输出要求
                1. 只优化当前这个模块，不要生成整份简历。
                2. 如果原文已经足够精简，不需要为了改而改。
                3. 优先压缩项目简介、技术栈、职责描述中的冗长表达。
                4. 保留关键技术词、量化结果、角色和最终成果。
                5. 不能新增事实，不能改动 JSON 结构。

                ## 当前模块 JSON
                %s
                """.formatted(
                resumeTitle == null || resumeTitle.isBlank() ? "未命名简历" : resumeTitle,
                resumeContext,
                templateMarkdown,
                promptInstruction,
                presetRules,
                MODULE_LABELS.getOrDefault(module.getModuleType(), module.getModuleType()),
                moduleRule,
                toPrettyJsonString(module.getContent())
        );
    }

    private String defaultModuleRule(String moduleType) {
        return switch (moduleType) {
            case "internship", "work_experience" -> "把项目简介压缩到 1 句，技术栈保留核心词，职责优先保留 2-3 条最能体现动作和结果的表达。";
            case "project" -> "把项目背景压到 1 句，职责优先保留最强的 2-3 条，突出结果导向和关键技术。";
            case "research" -> "压缩背景铺垫，保留研究主题、个人工作和最终成果。";
            case "skill" -> "优先去重和归并重复技能表达，避免堆砌关键词。";
            default -> "保持事实准确，只做轻微压缩。";
        };
    }

    private String buildSmartOnePageContext(String resumeTitle, List<ResumeModule> modules) {
        var moduleSummaries = modules.stream()
                .map(this::buildModuleSummary)
                .collect(Collectors.joining("\n\n"));

        return """
                标题：%s

                %s
                """.formatted(
                resumeTitle == null || resumeTitle.isBlank() ? "未命名简历" : resumeTitle,
                moduleSummaries
        ).trim();
    }

    private boolean shouldAdoptSmartOptimization(Map<String, Object> originalContent, Map<String, Object> optimizedContent) {
        var originalJson = toJsonString(originalContent);
        var optimizedJson = toJsonString(optimizedContent);

        if (Objects.equals(originalJson, optimizedJson)) {
            return false;
        }
        if (optimizedJson.length() >= originalJson.length() * 0.96) {
            return false;
        }
        if (optimizedJson.length() < Math.max(60, originalJson.length() * 0.38)) {
            return false;
        }
        return preservesCriticalInformation(originalContent, optimizedContent);
    }

    @SuppressWarnings("unchecked")
    private boolean preservesCriticalInformation(Object original, Object optimized) {
        if (original instanceof Map<?, ?> originalMap && optimized instanceof Map<?, ?> optimizedMap) {
            for (var key : originalMap.keySet()) {
                if (!optimizedMap.containsKey(key)) {
                    return false;
                }
                if (!preservesCriticalInformation(originalMap.get(key), optimizedMap.get(key))) {
                    return false;
                }
            }
            return true;
        }

        if (original instanceof List<?> originalList && optimized instanceof List<?> optimizedList) {
            var originalMeaningful = originalList.stream().filter(this::isMeaningfulValue).toList();
            var optimizedMeaningful = optimizedList.stream().filter(this::isMeaningfulValue).toList();
            if (originalMeaningful.isEmpty()) {
                return true;
            }

            var minAllowed = originalMeaningful.size() == 1
                    ? 1
                    : Math.max(1, (int) Math.ceil(originalMeaningful.size() * 0.5));
            if (optimizedMeaningful.size() < minAllowed) {
                return false;
            }

            for (int index = 0; index < Math.min(originalMeaningful.size(), optimizedMeaningful.size()); index++) {
                if (!preservesCriticalInformation(originalMeaningful.get(index), optimizedMeaningful.get(index))) {
                    return false;
                }
            }
            return true;
        }

        if (original instanceof String originalString && optimized instanceof String optimizedString) {
            return retainsImportantTokens(originalString, optimizedString);
        }

        return true;
    }

    private boolean retainsImportantTokens(String original, String optimized) {
        var normalizedOriginal = original == null ? "" : original.trim();
        var normalizedOptimized = optimized == null ? "" : optimized.trim();
        if (normalizedOriginal.isBlank()) {
            return true;
        }
        if (normalizedOptimized.isBlank()) {
            return false;
        }

        var keywords = extractEnglishKeywords(normalizedOriginal);
        if (keywords.isEmpty()) {
            return true;
        }

        long matchedCount = keywords.stream()
                .filter(keyword -> normalizedOptimized.toLowerCase(Locale.ROOT).contains(keyword.toLowerCase(Locale.ROOT)))
                .count();
        return matchedCount >= Math.max(1, Math.min(keywords.size(), 4) / 2);
    }

    private Set<String> extractEnglishKeywords(String value) {
        var matcher = ENGLISH_KEYWORD_PATTERN.matcher(value);
        var result = new LinkedHashSet<String>();
        while (matcher.find()) {
            result.add(matcher.group());
        }
        return result;
    }

    private SmartOnePageModuleDecisionDTO buildDecision(Long moduleId, String action, String reason) {
        var dto = new SmartOnePageModuleDecisionDTO();
        dto.setModuleId(moduleId);
        dto.setAction(action);
        dto.setReason(reason);
        return dto;
    }

    private SmartOnePagePreviewMetaDTO buildPreviewMeta(List<ResumeModule> originalModules, List<ResumeModule> effectiveModules) {
        var dto = new SmartOnePagePreviewMetaDTO();
        dto.setEstimatedOriginalPages(estimateResumePages(originalModules));
        dto.setEstimatedContinuousHeight(estimateContinuousHeight(effectiveModules));
        dto.setEstimatedCompressedPages(estimateResumePages(effectiveModules));
        return dto;
    }

    private int estimateResumePages(List<ResumeModule> modules) {
        return Math.max(1, (int) Math.ceil(estimateContinuousHeight(modules) / A4_HEIGHT));
    }

    private int estimateContinuousHeight(List<ResumeModule> modules) {
        var textWeight = modules.stream()
                .map(ResumeModule::getContent)
                .mapToInt(this::estimateTextWeight)
                .sum();
        var moduleWeight = modules.size() * 52;
        var estimated = 240 + moduleWeight + textWeight * 0.42;
        return (int) Math.max(900, Math.min(3200, estimated));
    }

    private int estimateTextWeight(Object value) {
        if (value instanceof String stringValue) {
            return stringValue.trim().length();
        }
        if (value instanceof List<?> listValue) {
            return listValue.stream().mapToInt(this::estimateTextWeight).sum();
        }
        if (value instanceof Map<?, ?> mapValue) {
            return mapValue.values().stream().mapToInt(this::estimateTextWeight).sum();
        }
        return 0;
    }

    private String buildSmartOnePageSummary(List<SmartOnePageModuleDecisionDTO> decisions) {
        long optimizedCount = decisions.stream()
                .filter(decision -> "suggest_optimized".equals(decision.getAction()))
                .count();
        long keptCount = decisions.size() - optimizedCount;

        if (optimizedCount == 0) {
            return "AI 已检查整份简历，当前内容整体已经比较成熟，本次默认全部保留原文。";
        }

        return "AI 已生成智能一页候选方案：建议替换 %d 个模块，保留原文 %d 个模块。你可以继续逐模块覆盖默认决策。"
                .formatted(optimizedCount, keptCount);
    }

    private void validateConfiguration() {
        var missing = new ArrayList<String>();
        if (apiKey == null || apiKey.isBlank()) {
            missing.add("AI_API_KEY");
        }
        if (baseUrl == null || baseUrl.isBlank()) {
            missing.add("AI_BASE_URL");
        }
        if (model == null || model.isBlank()) {
            missing.add("AI_MODEL");
        }
        if (!missing.isEmpty()) {
            throw new BusinessException(
                    ResultCode.AI_NOT_CONFIGURED.getCode(),
                    "AI 服务未配置，缺少参数：" + String.join(", ", missing)
            );
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

    private String getStringValue(Object value) {
        return value instanceof String stringValue ? stringValue.trim() : "";
    }

    private List<String> getStringListValue(Object value) {
        if (!(value instanceof List<?> listValue)) {
            return List.of();
        }

        return listValue.stream()
                .filter(String.class::isInstance)
                .map(String.class::cast)
            .toList();
    }

    private Map<?, ?> getMapListItem(Object value, int index) {
        if (!(value instanceof List<?> listValue) || index < 0 || index >= listValue.size()) {
            return null;
        }
        return listValue.get(index) instanceof Map<?, ?> mapValue ? mapValue : null;
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
            boolean jsonMode,
            boolean disableThinking
    ) {
        var requestBody = buildRequestBody(targetModel, systemPrompt, userPrompt, temperature, maxTokens, jsonMode, disableThinking);
        log.info("[AI Optimize][Upstream] request: url={}, model={}, jsonMode={}, disableThinking={}, temperature={}, maxTokens={}, systemPromptLength={}, userPromptLength={}",
                buildChatCompletionUrl(),
                targetModel,
                jsonMode,
                disableThinking,
                temperature,
                maxTokens,
                systemPrompt == null ? 0 : systemPrompt.length(),
                userPrompt == null ? 0 : userPrompt.length());

        return webClient.post()
                .uri(buildChatCompletionUrl())
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .block(java.time.Duration.ofSeconds(timeout));
    }

    private StreamChatResult streamChatCompletion(
            String targetModel,
            String systemPrompt,
            String userPrompt,
            double temperature,
            int maxTokens,
            boolean jsonMode,
            boolean disableThinking,
            Consumer<Map<String, Object>> eventConsumer
    ) throws Exception {
        var requestBody = buildRequestBody(targetModel, systemPrompt, userPrompt, temperature, maxTokens, jsonMode, disableThinking);
        requestBody.put("stream", true);
        log.info("[AI Optimize][Upstream] stream request: url={}, model={}, jsonMode={}, disableThinking={}, temperature={}, maxTokens={}, systemPromptLength={}, userPromptLength={}",
                buildChatCompletionUrl(),
                targetModel,
                jsonMode,
                disableThinking,
                temperature,
                maxTokens,
                systemPrompt == null ? 0 : systemPrompt.length(),
                userPrompt == null ? 0 : userPrompt.length());

        var requestJson = objectMapper.writeValueAsString(requestBody);
        var request = HttpRequest.newBuilder()
                .uri(URI.create(buildChatCompletionUrl()))
                .timeout(Duration.ofSeconds(Math.max(timeout, 180)))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream")
                .POST(HttpRequest.BodyPublishers.ofString(requestJson, StandardCharsets.UTF_8))
                .build();

        var response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() >= 400) {
            var body = new String(response.body().readAllBytes(), StandardCharsets.UTF_8);
            throw new BusinessException(ResultCode.AI_SERVICE_BUSY.getCode(), buildUpstreamErrorMessage(response.statusCode(), body));
        }

        var reasoningBuilder = new StringBuilder();
        var contentBuilder = new StringBuilder();
        var dataBuilder = new StringBuilder();
        var finishReasonBuilder = new StringBuilder();
        var streamLogState = new StreamLogState();

        try (var reader = new BufferedReader(new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    if (handleUpstreamSseEvent(dataBuilder.toString(), reasoningBuilder, contentBuilder, finishReasonBuilder, eventConsumer, streamLogState)) {
                        break;
                    }
                    dataBuilder.setLength(0);
                    continue;
                }
                if (line.startsWith("data:")) {
                    if (dataBuilder.length() > 0) {
                        dataBuilder.append('\n');
                    }
                    dataBuilder.append(line.substring(5).trim());
                }
            }
        }

        log.info("[AI Optimize][Upstream] stream completed: reasoningLength={}, contentLength={}",
                reasoningBuilder.length(), contentBuilder.length());
        emitStreamEvent(eventConsumer, "status", Map.of("message", "AI 推理结束，正在整理最终结果。"));
        return new StreamChatResult(contentBuilder.toString(), reasoningBuilder.toString(), finishReasonBuilder.toString());
    }

    private String buildChatCompletionUrl() {
        if (baseUrl.endsWith("/chat/completions")) {
            return baseUrl;
        }
        return baseUrl + "/chat/completions";
    }

    private String buildUpstreamErrorMessage(WebClientResponseException e) {
        return buildUpstreamErrorMessage(e.getStatusCode().value(), e.getResponseBodyAsString());
    }

    private String buildUpstreamErrorMessage(int status, String responseBody) {
        var detail = extractUpstreamErrorDetail(responseBody);
        if (status == 401 || status == 403) {
            return detail == null
                    ? "AI 服务认证失败（HTTP " + status + "），请检查服务端 AI 配置"
                    : "AI 服务认证失败（HTTP " + status + "）：" + detail;
        }
        if (status == 429) {
            return detail == null
                    ? "AI 服务请求过于频繁，请稍后再试"
                    : "AI 服务请求过于频繁：" + detail;
        }
        if (status >= 500) {
            return detail == null
                    ? "AI 服务暂时不可用，请稍后重试"
                    : "AI 服务暂时不可用（HTTP " + status + "）：" + detail;
        }
        return detail == null
                ? "AI 优化请求失败（HTTP " + status + "）"
                : "AI 优化请求失败（HTTP " + status + "）：" + detail;
    }

    private String extractUpstreamErrorDetail(WebClientResponseException e) {
        return extractUpstreamErrorDetail(e.getResponseBodyAsString());
    }

    private String extractUpstreamErrorDetail(String body) {
        try {
            if (body == null || body.isBlank()) {
                return null;
            }

            var root = objectMapper.readTree(body);
            var directMessage = root.path("message").asText("");
            var directCode = root.path("code").asText("");
            if (!directMessage.isBlank()) {
                return directCode.isBlank() ? directMessage : directMessage + "（上游 code: " + directCode + "）";
            }

            var errorNode = root.path("error");
            var nestedMessage = errorNode.path("message").asText("");
            var nestedCode = errorNode.path("code").asText("");
            if (!nestedMessage.isBlank()) {
                return nestedCode.isBlank() ? nestedMessage : nestedMessage + "（上游 code: " + nestedCode + "）";
            }

            return truncateText(body, 300);
        } catch (Exception parseError) {
            return truncateText(body, 300);
        }
    }

    private Map<String, Object> buildRequestBody(
            String targetModel,
            String systemPrompt,
            String userPrompt,
            double temperature,
            int maxTokens,
            boolean jsonMode,
            boolean disableThinking
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
        if (disableThinking) {
            payload.put("thinking", Map.of("type", "disabled"));
        }
        return payload;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseAiResponse(String response, Map<String, Object> originalContent) {
        try {
            var root = objectMapper.readTree(response);
            var content = cleanJsonPayload(extractAssistantContent(root, false));

            var optimized = objectMapper.readValue(content, Map.class);
            if (!matchesShape(originalContent, optimized)) {
                throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
            }

            return optimized;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse AI response: errorType={}, responseLength={}",
                    e.getClass().getSimpleName(), response == null ? 0 : response.length());
            throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
        }
    }

    private ResumeAnalysisResultDTO parseAnalysisResponse(String response) {
        try {
            var root = objectMapper.readTree(response);
            var content = resolveAnalysisPayload(root, response);
            var result = objectMapper.readValue(content, ResumeAnalysisResultDTO.class);
            normalizeAnalysisResult(result);
            return result;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse analysis response: errorType={}, responseLength={}",
                    e.getClass().getSimpleName(), response == null ? 0 : response.length());
            throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
        }
    }

    private ShowcaseMetadataDTO parseShowcaseMetadataResponse(String response) {
        try {
            var root = objectMapper.readTree(response);
            var content = resolveAnalysisPayload(root, response);
            var result = objectMapper.readValue(content, ShowcaseMetadataDTO.class);

            var displayLabel = truncateText(result.getDisplayLabel(), 128);
            var summary = truncateText(result.getSummary(), 512);
            var tags = new LinkedHashSet<String>();
            if (result.getTags() != null) {
                result.getTags().stream()
                        .map(tag -> truncateText(tag, 128))
                        .filter(tag -> !tag.isBlank())
                        .forEach(tags::add);
            }

            if (displayLabel.length() < 2 || displayLabel.length() > 12
                    || SHOWCASE_SCORE_LABEL_PATTERN.matcher(displayLabel).find()
                    || summary.length() < 40 || summary.length() > 100
                    || tags.size() < 2 || tags.size() > 4
                    || SHOWCASE_CONTACT_PATTERN.matcher(displayLabel + " " + summary).find()
                    || tags.stream().anyMatch(tag -> tag.length() > 12
                            || SHOWCASE_CONTACT_PATTERN.matcher(tag).find()
                            || SHOWCASE_ORGANIZATION_TAG_PATTERN.matcher(tag).matches())) {
                throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
            }

            result.setDisplayLabel(displayLabel);
            result.setSummary(summary);
            result.setTags(List.copyOf(tags));
            return result;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse showcase metadata response: errorType={}, responseLength={}",
                    e.getClass().getSimpleName(), response == null ? 0 : response.length());
            throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseLibraryDraftResponse(String response, String kind) {
        try {
            var root = objectMapper.readTree(response);
            var content = resolveAnalysisPayload(root, response);
            Map<String, Object> result = objectMapper.readValue(content, LinkedHashMap.class);
            if (result.isEmpty() || !result.containsKey("title")) {
                throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
            }
            if ("TEMPLATE".equals(kind)) {
                if (!(result.get("modules") instanceof List<?> modules) || modules.isEmpty()) {
                    throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
                }
            } else if (!(result.get("content") instanceof Map<?, ?>)) {
                throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
            }
            var serialized = objectMapper.writeValueAsString(result);
            if (serialized.length() > 40_000 || SHOWCASE_CONTACT_PATTERN.matcher(serialized).find()) {
                throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
            }
            return result;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse library draft: errorType={}, responseLength={}",
                    e.getClass().getSimpleName(), response == null ? 0 : response.length());
            throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
        }
    }

    private void validateShowcaseMetadataAgainstPrivateInfo(
            ShowcaseMetadataDTO metadata,
            List<ResumeModule> modules
    ) {
        if (modules == null || modules.isEmpty()) {
            return;
        }

        var publicText = String.join(" ",
                metadata.getDisplayLabel(),
                metadata.getSummary(),
                String.join(" ", metadata.getTags())
        ).toLowerCase(Locale.ROOT);

        for (var module : modules) {
            if (!"basic_info".equals(module.getModuleType()) || module.getContent() == null) {
                continue;
            }
            for (var key : List.of("name", "email", "phone", "wechat")) {
                var rawValue = module.getContent().get(key);
                if (!(rawValue instanceof String value)) {
                    continue;
                }
                var normalized = value.trim().toLowerCase(Locale.ROOT);
                if (normalized.length() >= 2 && publicText.contains(normalized)) {
                    throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
                }
            }
        }
    }

    private String resolveAnalysisPayload(com.fasterxml.jackson.databind.JsonNode root, String rawResponse) {
        var content = cleanJsonPayload(extractAssistantContent(root, false));
        if (!content.isBlank()) {
            return content;
        }

        if (root != null && root.isObject() && (root.has("score") || root.has("issues") || root.has("suggestions"))) {
            return cleanJsonPayload(rawResponse);
        }

        return cleanJsonPayload(rawResponse);
    }

    private String extractAssistantContent(com.fasterxml.jackson.databind.JsonNode root, boolean allowReasoningFallback) {
        var message = root.path("choices").path(0).path("message");
        var content = message.path("content").asText("");
        if (content != null && !content.isBlank()) {
            return content;
        }
        if (allowReasoningFallback) {
            return message.path("reasoning_content").asText("");
        }
        return "";
    }

    private String extractAssistantContent(com.fasterxml.jackson.databind.JsonNode root) {
        return extractAssistantContent(root, false);
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

    private String cleanTextResponse(String response) {
        try {
            var root = objectMapper.readTree(response);
            var content = cleanTextContent(extractAssistantContent(root, false));
            if (!content.isBlank()) {
                return content;
            }
            return extractOptimizedTextFromReasoning(root.path("choices").path(0).path("message").path("reasoning_content").asText(""));
        } catch (Exception e) {
            log.error("Failed to parse AI text response: errorType={}, responseLength={}",
                    e.getClass().getSimpleName(), response == null ? 0 : response.length());
            throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
        }
    }

    private List<String> parseTextCandidatesResponse(String response) {
        try {
            var root = objectMapper.readTree(response);
            var content = extractAssistantContent(root, false).trim();
            if (content.isBlank()) {
                var finishReason = root.path("choices").path(0).path("finish_reason").asText("");
                log.warn("[AI Optimize][Service] assistant content is empty for candidate response: finishReason={}",
                        finishReason);
                throw new BusinessException(ResultCode.AI_RESPONSE_INVALID.getCode(), "AI 未返回可用候选结果，请重试");
            }
            return parseTextCandidatesContent(content);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse AI text candidates response: errorType={}, responseLength={}",
                    e.getClass().getSimpleName(), response == null ? 0 : response.length());
            throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
        }
    }

    private String cleanTextContent(String content) {
        var cleaned = content == null ? "" : content.trim();
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceFirst("^```[a-zA-Z]*\\s*", "");
            cleaned = cleaned.replaceFirst("\\s*```$", "");
        }
        return cleaned.replaceAll("^\"|\"$", "").trim();
    }

    private List<String> normalizeResumeCandidates(List<String> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return List.of();
        }
        return candidates.stream()
                .map(this::normalizeResumeMixedTextSpacing)
                .toList();
    }

    private String normalizeResumeMixedTextSpacing(String text) {
        var normalized = text == null ? "" : text;
        if (normalized.isBlank()) {
            return normalized;
        }

        String previous;
        do {
            previous = normalized;
            normalized = HAN_TO_ENGLISH_PATTERN.matcher(normalized).replaceAll("$1 $2");
            normalized = ENGLISH_TO_HAN_PATTERN.matcher(normalized).replaceAll("$1 $2");
        } while (!normalized.equals(previous));

        return normalized;
    }

    private String extractOptimizedTextFromReasoning(String reasoning) {
        var normalized = reasoning == null ? "" : reasoning.trim();
        if (normalized.isBlank()) {
            return "";
        }

        var markers = List.of("最终结果：", "最终结果:", "最终优化结果是：", "最终优化结果：", "优化后的职责：", "优化后的版本：", "精修定稿：", "定稿：");
        for (var marker : markers) {
            var markerIndex = normalized.lastIndexOf(marker);
            if (markerIndex < 0) {
                continue;
            }

            var tail = normalized.substring(markerIndex + marker.length()).trim();
            if (tail.isBlank()) {
                continue;
            }

            tail = sanitizeReasoningSnippet(tail);
            if (!tail.isBlank()) {
                return tail;
            }
        }

        var attemptPattern = Pattern.compile(
                "(?s)(?:^|\\n)\\s*(?:[-*]\\s*)?(?:尝试|版本|草稿)\\s*[0-9一二三四五六七八九十]+\\s*[:：]\\s*(.+?)(?=(?:\\n\\s*(?:[-*]\\s*)?(?:尝试|版本|草稿)\\s*[0-9一二三四五六七八九十]+\\s*[:：])|(?:\\n\\s*(?:这个版本|让我再检查|让我检查|检查一下|校验|说明|要求|最终|结论|上游已结束输出|AI 推理结束|1\\.|2\\.|3\\.))|$)"
        );
        var attemptMatcher = attemptPattern.matcher(normalized);
        String fallbackAttempt = "";
        while (attemptMatcher.find()) {
            var attemptText = sanitizeReasoningSnippet(attemptMatcher.group(1));
            if (!attemptText.isBlank()) {
                fallbackAttempt = attemptText;
            }
        }
        if (!fallbackAttempt.isBlank()) {
            return fallbackAttempt;
        }

        return "";
    }

    private List<String> extractCandidatesFromStreamResult(StreamChatResult streamResult) {
        return parseCandidatePayloadOrEmpty(streamResult == null ? "" : streamResult.content());
    }

    private List<String> parseCandidatePayloadOrEmpty(String content) {
        try {
            return parseTextCandidatesContent(content);
        } catch (BusinessException ignored) {
            return List.of();
        }
    }

    private String sanitizeReasoningSnippet(String snippet) {
        var value = snippet == null ? "" : snippet.trim();
        if (value.isBlank()) {
            return "";
        }

        value = value.replaceFirst("^[:：\\s]*", "");
        var stopMatcher = Pattern.compile("\\n\\s*(这个版本|让我再检查|让我检查|检查一下|校验|说明|要求|上游已结束输出|AI 推理结束|1\\.|2\\.|3\\.)").matcher(value);
        if (stopMatcher.find()) {
            value = value.substring(0, stopMatcher.start()).trim();
        }

        value = value.replaceFirst("^[-*\\s]+", "").trim();

        var quotedMatcher = Pattern.compile("[“\\\"]([^\\n”\\\"]{12,})[”\\\"]").matcher(value);
        if (quotedMatcher.find()) {
            return cleanTextContent(quotedMatcher.group(1));
        }

        var firstLine = value.lines()
                .map(String::trim)
                .filter(line -> !line.isBlank())
                .filter(line -> !line.startsWith("-") && !line.startsWith("*"))
                .findFirst()
                .orElse(value);

        return cleanTextContent(firstLine);
    }

    private List<String> parseTextCandidatesContent(String content) {
        var cleanedContent = content == null ? "" : content.trim();
        if (cleanedContent.startsWith("```")) {
            cleanedContent = cleanedContent.replaceFirst("^```[a-zA-Z]*\\s*", "");
            cleanedContent = cleanedContent.replaceFirst("\\s*```$", "");
        }

        var cleaned = cleanJsonPayload(cleanedContent);
        if (cleaned.isBlank()) {
            throw new BusinessException(ResultCode.AI_RESPONSE_INVALID.getCode(), "AI 思考已结束，但未返回最终结果，请重试");
        }

        try {
            var payload = objectMapper.readTree(cleaned);
            var candidatesNode = payload.get("candidates");
            if (candidatesNode == null || !candidatesNode.isArray()) {
                throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
            }

            var candidates = new ArrayList<String>();
            candidatesNode.forEach(node -> {
                var value = node.asText("").trim();
                if (!value.isBlank()) {
                    candidates.add(value);
                }
            });

            var uniqueCandidates = candidates.stream()
                    .distinct()
                    .limit(3)
                    .toList();

            if (uniqueCandidates.isEmpty()) {
                throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
            }

            return uniqueCandidates;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse AI text candidates content: errorType={}, contentLength={}",
                    e.getClass().getSimpleName(), content == null ? 0 : content.length());
            throw new BusinessException(ResultCode.AI_RESPONSE_INVALID);
        }
    }

    private boolean handleUpstreamSseEvent(
            String rawData,
            StringBuilder reasoningBuilder,
            StringBuilder contentBuilder,
            StringBuilder finishReasonBuilder,
            Consumer<Map<String, Object>> eventConsumer,
            StreamLogState streamLogState
    ) {
        var eventData = rawData == null ? "" : rawData.trim();
        if (eventData.isBlank()) {
            return false;
        }
        if ("[DONE]".equals(eventData)) {
            log.info("[AI Optimize][Upstream] received stream sentinel: [DONE]");
            return true;
        }

        try {
            var root = objectMapper.readTree(eventData);
            var choice = root.path("choices").path(0);
            var delta = choice.path("delta");
            var reasoningDelta = delta.path("reasoning_content").asText("");
            if (!reasoningDelta.isBlank()) {
                reasoningBuilder.append(reasoningDelta);
                logReasoningProgress(streamLogState, reasoningDelta, reasoningBuilder);
                emitStreamEvent(eventConsumer, "reasoning_delta", Map.of(
                        "delta", reasoningDelta,
                        "text", reasoningBuilder.toString()
                ));
            }

            var contentDelta = delta.path("content").asText("");
            if (!contentDelta.isBlank()) {
                contentBuilder.append(contentDelta);
                logContentProgress(streamLogState, contentDelta, contentBuilder);
                emitStreamEvent(eventConsumer, "content_delta", Map.of(
                        "delta", contentDelta,
                        "text", contentBuilder.toString()
                ));
            }

            var finishReason = choice.path("finish_reason").asText("");
            if (!finishReason.isBlank()) {
                finishReasonBuilder.setLength(0);
                finishReasonBuilder.append(finishReason);
                log.info("[AI Optimize][Upstream] finish reason received: finishReason={}, reasoningLength={}, contentLength={}",
                        finishReason, reasoningBuilder.length(), contentBuilder.length());
                emitStreamEvent(eventConsumer, "status", Map.of(
                        "message", "上游已结束输出，等待最终整理。",
                        "finishReason", finishReason
                ));
            }
        } catch (Exception e) {
            log.warn("[AI Optimize][Service] failed to parse upstream stream chunk: eventLength={}, errorType={}",
                    eventData.length(), e.getClass().getSimpleName());
        }
        return false;
    }

    private List<String> finalizeCandidateOutput(String targetModel, String systemPrompt, String originalPrompt, String partialContent) {
        var finalizePrompt = """
                你上一条回答在输出最终候选 JSON 时被截断了。
                现在不要重复分析，不要解释，不要输出 Markdown 代码块，也不要输出思考过程。
                请基于同样要求，直接返回最终完整 JSON：
                {"candidates":["完整版本A","完整版本B","完整版本C"]}

                原始任务如下：
                """ + originalPrompt;

        var partial = partialContent == null ? "" : partialContent.trim();
        if (!partial.isBlank()) {
            finalizePrompt += """

                    
                    上一条已经输出但被截断的内容如下，请优先基于它补全为最终合法 JSON：
                    """ + "\n" + truncateText(partial, 2000);
        }

        var response = invokeChatCompletion(
                targetModel,
                systemPrompt,
                finalizePrompt,
                0.2,
                3200,
                true,
                true
        );

        if (response == null) {
            return List.of();
        }

        return parseTextCandidatesResponse(response);
    }

    private void logReasoningProgress(StreamLogState state, String delta, StringBuilder reasoningBuilder) {
        if (state == null) {
            return;
        }
        if (!state.reasoningStarted) {
            state.reasoningStarted = true;
            state.reasoningLoggedLength = reasoningBuilder.length();
            log.info("[AI Optimize][Upstream] reasoning stream started: totalLength={}", reasoningBuilder.length());
            return;
        }
        if (reasoningBuilder.length() - state.reasoningLoggedLength >= 240) {
            state.reasoningLoggedLength = reasoningBuilder.length();
            log.info("[AI Optimize][Upstream] reasoning stream progress: totalLength={}", reasoningBuilder.length());
        }
    }

    private void logContentProgress(StreamLogState state, String delta, StringBuilder contentBuilder) {
        if (state == null) {
            return;
        }
        if (!state.contentStarted) {
            state.contentStarted = true;
            state.contentLoggedLength = contentBuilder.length();
            log.info("[AI Optimize][Upstream] final content stream started: totalLength={}", contentBuilder.length());
            return;
        }
        if (contentBuilder.length() - state.contentLoggedLength >= 120) {
            state.contentLoggedLength = contentBuilder.length();
            log.info("[AI Optimize][Upstream] final content stream progress: totalLength={}", contentBuilder.length());
        }
    }

    private void emitStreamEvent(Consumer<Map<String, Object>> eventConsumer, String type, Map<String, Object> payload) {
        if (eventConsumer == null) {
            return;
        }
        var event = new LinkedHashMap<String, Object>();
        event.put("type", type);
        payload.forEach((key, value) -> {
            if (value != null) {
                event.put(key, value);
            }
        });
        eventConsumer.accept(event);
    }

    private boolean areTextCandidatesUsable(List<String> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return false;
        }

        return candidates.stream().allMatch(this::isUsableTextCandidate);
    }

    private boolean isUsableTextCandidate(String candidate) {
        if (candidate == null) {
            return false;
        }

        var normalized = candidate.trim();
        if (normalized.isBlank()) {
            return false;
        }

        if (PLACEHOLDER_CANDIDATE_PATTERN.matcher(normalized).matches()) {
            return false;
        }

        return normalized.length() >= 20;
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

    private String buildResumeAnalysisPrompt(String resumeTitle, List<ResumeModule> modules, String analysisInstructions) {
        var moduleSummaries = modules.stream()
                .sorted(Comparator.comparing((ResumeModule module) -> module.getSortOrder() == null ? Integer.MAX_VALUE : module.getSortOrder())
                        .thenComparing(ResumeModule::getId))
                .map(this::buildModuleSummary)
                .toList();
        if (analysisInstructions == null || analysisInstructions.isBlank()) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "简历分析提示词配置缺失");
        }
        var instructions = analysisInstructions.trim();

        return """
                请分析下面这份简历，并给出结构化评估结果。

                ## 简历标题
                %s

                ## 简历模块
                %s

                ## 当前求职场景评估规则
                %s

                ## 分析要求
                1. 基于当前真实内容分析，不要臆造候选人未填写的信息。
                2. 严格按当前求职场景决定模块权重和必需项，不得用其他场景的要求扣分。
                3. 重点关注内容质量、表达专业度、岗位匹配度和真实竞争力。
                4. 专业技能可能是整句能力描述，不要机械地要求必须是技术名词列表或分类标签。
                5. 不要把“缺少个人简介/职业总结/自我评价”当成问题，也不要建议补这一项。
                6. 不要因为没有 AI 竞赛、没有 GPA、GitHub 链接缺少额外包装而明显拉低总分。
                7. 只有在确实存在明显问题时才输出 issues，避免泛泛而谈。
                8. suggestion 必须具体、可执行，避免空话。
                9. issues 最多输出 4 条，suggestions 最多输出 4 条，优先保留最重要的内容。

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

    private String buildShowcaseMetadataPrompt(String resumeTitle, List<ResumeModule> modules) {
        var moduleSummaries = sortResumeModules(modules).stream()
                .filter(module -> !"basic_info".equals(module.getModuleType()))
                .map(this::buildModuleSummary)
                .toList();

        return """
                请根据下面这份简历生成面向求职者展示的精选卡片信息。

                ## 简历标题
                %s

                ## 简历内容
                %s

                ## 生成要求
                1. 只能使用简历中真实存在的信息，不得虚构技术栈、公司、学校、经历或结果。
                2. displayLabel 是 2-12 个字的岗位或技术方向，例如“Java 后端”“AI 应用”，禁止输出分数、“高分”“优质”等自夸词。
                3. summary 用 40-100 个字概括这份简历的岗位方向、核心经历与技术特点，不出现姓名、邮箱、电话、微信、照片等个人信息。
                4. tags 输出 2-4 个真实的岗位或技术标签，每个标签不超过 12 个字；不要输出姓名、公司名或学校名。
                5. 严格只返回 JSON，不要输出解释、标题或 Markdown 代码块。

                JSON 结构：
                {
                  "displayLabel": "Java 后端",
                  "summary": "摘要",
                  "tags": ["Java", "Spring Boot", "微服务"]
                }
                """.formatted(
                resumeTitle == null || resumeTitle.isBlank() ? "未命名简历" : resumeTitle,
                moduleSummaries.isEmpty() ? "（暂无可概括内容）" : String.join("\n\n", moduleSummaries)
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
