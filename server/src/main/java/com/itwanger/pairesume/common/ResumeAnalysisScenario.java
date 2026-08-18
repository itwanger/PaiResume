package com.itwanger.pairesume.common;

import java.util.Arrays;

public enum ResumeAnalysisScenario {
    WORKING_PROFESSIONAL(
            "工作党",
            """
            请按有工作经验的社会招聘简历标准评估。

            核心评估范围：
            1. 基本信息是否准确、求职方向是否清晰。
            2. 工作经历是否写清公司、职位、任职时间，以及候选人在项目中的职责边界、技术决策和可验证成果。
            3. 专业技能是否与目标岗位和工作项目相互印证。
            4. 教育背景只作为基础信息评估，不因学校层级或缺少 GPA 明显扣分。

            场景边界：
            1. 工作党不要求实习经历，不得因缺少或填写实习经历单独加分或扣分。
            2. 不要求论文期刊、科研经历和独立项目经历；工作项目已经写在工作经历中时，不得要求重复新增项目经历。
            3. 重点检查工作内容是否只有技术堆砌、缺少本人贡献、业务价值或量化结果。
            4. 已具备清晰工作时间线、真实项目成果和岗位匹配能力的简历，应得到与成熟度相符的高分。
            """
    ),
    STUDENT_DAILY_INTERNSHIP(
            "学生党找日常实习",
            """
            请按学生申请日常实习的技术简历标准评估。

            核心评估范围：
            1. 基本信息、教育背景、专业技能、项目经历是主要评分依据。
            2. 项目经历重点看候选人实际承担的工作、使用的技术、解决的问题和可验证成果。
            3. 荣誉奖项、科研经历、论文期刊只在与目标岗位相关且确有内容时作为补充，不要求本科生必须具备。
            4. 不要求正式工作经历，也不得因缺少工作经历扣分。
            5. 对研究生简历，可结合已有科研或论文判断研究能力，但不得因未填写而机械扣分。
            """
    ),
    STUDENT_SUMMER_INTERNSHIP(
            "学生党找暑期实习",
            """
            请按学生申请暑期实习的技术简历标准评估。

            核心评估范围：
            1. 基本信息、教育背景、专业技能、项目经历是主要评分依据。
            2. 更关注项目完整度、技术深度、本人职责、成果数据以及与目标岗位的匹配度。
            3. 已有实习经历时重点评估实际贡献；没有实习经历时，不得仅因这一点直接判定简历不合格。
            4. 荣誉奖项可作为竞争力补充；科研经历和论文期刊仅对研究生或研究型岗位按相关性评估。
            5. 不要求正式工作经历，也不得因缺少工作经历扣分。
            """
    ),
    STUDENT_AUTUMN_RECRUITMENT(
            "学生党冲秋招",
            """
            请按应届生参加秋季招聘的技术简历标准评估。

            核心评估范围：
            1. 基本信息、教育背景、专业技能、实习经历和项目经历共同构成主要评分依据。
            2. 有实习经历时重点看真实职责和成果；没有实习经历时，应结合项目、科研和竞赛等现有内容判断岗位准备度，不能机械扣分。
            3. 项目经历重点检查技术深度、本人贡献、问题难度、结果表达和岗位匹配度。
            4. 荣誉奖项用于补充竞争力；科研经历和论文期刊仅在研究生或研究型岗位下按相关性评估。
            5. 不要求正式工作经历，也不得因缺少工作经历扣分。
            """
    );

    private final String displayName;
    private final String defaultPrompt;

    ResumeAnalysisScenario(String displayName, String defaultPrompt) {
        this.displayName = displayName;
        this.defaultPrompt = defaultPrompt.strip();
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDefaultPrompt() {
        return defaultPrompt;
    }

    public static ResumeAnalysisScenario fromCode(String code) {
        if (code == null || code.isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请选择求职场景");
        }
        return Arrays.stream(values())
                .filter(scenario -> scenario.name().equalsIgnoreCase(code.strip()))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        ResultCode.BAD_REQUEST.getCode(), "求职场景不存在"));
    }
}
