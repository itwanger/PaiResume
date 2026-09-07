package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.FieldOptimizePromptConfigDTO;

public final class FieldOptimizePresets {
    private FieldOptimizePresets() {}
    public static String normalize(String id) {
        if (id == null || id.isBlank()) return "standard";
        if (!id.equals("standard") && !id.equals("asu")) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "优化方式无效");
        }
        return id;
    }

    public static FieldOptimizePromptConfigDTO defaults(String id, FieldOptimizePromptConfigDTO config) {
        id = normalize(id);
        config.setPresetId(id);
        config.setName(id.equals("asu") ? "阿酥式表达" : "标准优化");
        config.setDescription(id.equals("asu")
                ? "突出个人贡献与成果依据，表达稳妥，经得起面试追问。"
                : "梳理技术、职责与业务成果，精简表达，突出重点。");
        if (id.equals("asu")) {
            config.setSystemPrompt(ASU_SYSTEM_PROMPT);
            config.setDescriptionPrompt(config.getDescriptionPrompt() + ASU_SUFFIX);
            config.setResponsibilityPrompt(config.getResponsibilityPrompt() + ASU_SUFFIX);
            config.setSkillPrompt(config.getSkillPrompt() + ASU_SUFFIX);
        }
        return config;
    }
    // Adapted from the existing evidence-first ASu preset; output contracts remain PaiResume's.
    private static final String ASU_SYSTEM_PROMPT = """
你是一位中文技术招聘表达顾问，负责把用户已经做过的事情整理成招聘方容易理解、能够继续追问、也能由事实支撑的简历表达。

要求：
1. 保持公司、职位、学校、时间、项目、技术栈和数据真实，不得补造输入中没有的事实。
2. 按“技术动作 → 系统能力 → 业务价值 → 结果证据 → 个人边界”组织表达，但不要为了凑结构重复信息。
3. 只有原文能够证明决策、交付和结果时，才使用“主导”“负责人”“Owner”“0→1”等强表述。
4. 没有可靠数字时使用可核验的定性结果，不编造百分比、用户量、延迟、排名或收益。
5. 区分个人贡献与团队成果；无法确认归属时使用稳妥表述，不替用户冒领。
6. 优先保留可面试展开的技术细节、关键取舍和结果证据，删除空泛形容词与关键词堆砌。
            """;
    private static final String ASU_SUFFIX = """


阿酥式表达约束：
- 先识别原文里真实存在的动作、能力、价值、证据和个人边界，再生成候选。
- 每个候选都应能直接放进中文技术简历，并经得起面试追问。
- 若原文缺少结果或范围证据，保持稳妥，不使用更高职级或更大范围的说法。
            """;
}
