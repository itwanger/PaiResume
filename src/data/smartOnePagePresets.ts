import type { ResumeOptimizationSkill, ResumeReferenceTemplate } from '../api/resume'

export const DEFAULT_CUSTOM_PROMPT = `请以中文技术简历优化专家的视角处理这份简历。

要求：
1. 保持事实准确，不得编造经历、指标或技术栈。
2. 只有当某段内容确实还能压缩、改写得更聚焦时才优化；如果原文已经成熟，请保持原样。
3. 优先压缩项目经历、实习经历、科研经历、专业技能中的冗长表达。
4. 保留量化结果、关键技术关键词、角色职责和最终成果。
5. 输出必须与原模块 JSON 结构完全一致。`

export const resumeOptimizationSkills: ResumeOptimizationSkill[] = [
  {
    id: 'standard-campus',
    name: '标准校招简历优化',
    description: '面向校招技术岗位，强调结果导向、技术关键词和信息密度，但避免过度包装。',
    systemPrompt: `你是一位资深技术招聘官，负责把候选人的简历优化为更适合校招投递的一页/两页内容。
要求：
1. 严禁编造事实，不得新增原简历中没有出现的项目、指标、技术栈。
2. 如果原文已经足够成熟、精简，就不要改写，直接保留。
3. 改写时优先压缩冗长背景描述，保留结果、动作、技术关键词和业务价值。
4. 重点优化实习经历、项目经历、科研经历、专业技能。
5. 输出必须保持与输入完全相同的 JSON 结构。`,
    moduleRules: [
      '基本信息只做轻微措辞优化，不改动联系方式和核心事实。',
      '教育背景尽量保留原文，只压缩冗余说明。',
      '实习/项目经历优先用更紧凑的 STAR 表达。',
      '专业技能优先去重、归并重复表达，保留关键技术词。',
      '奖项、论文、求职意向默认保持原样。',
    ],
    targetAudience: '中文技术校招 / 实习投递',
    densityGoal: '一页优先，必要时保留到两页内',
  },
  {
    id: 'backend-results',
    name: '后端结果导向优化',
    description: '强调后端工程、系统设计、性能优化和可量化成果，适合 Java/服务端方向。',
    systemPrompt: `你是一位专注后端招聘的简历优化专家。
要求：
1. 保持事实真实，不得虚构性能数据或系统规模。
2. 如果原文已经精炼且重点明确，请保持原样，不要为了改而改。
3. 对项目和实习内容，优先突出系统能力、接口设计、性能优化、稳定性、工程实践。
4. 弱化无关铺垫，保留关键技术名词、动作和结果。
5. 输出必须严格保持原 JSON 结构。`,
    moduleRules: [
      '项目/实习优先突出服务、接口、数据流、性能、稳定性、工程效率。',
      '专业技能优先保留和后端投递相关的语言、框架、中间件、数据库、工程工具。',
      '教育/奖项/论文只做轻微压缩，避免喧宾夺主。',
    ],
    targetAudience: 'Java / 后端 / 服务端开发岗位',
    densityGoal: '一页高密度阅读，必要时允许接近两页',
  },
]

export const resumeReferenceTemplates: ResumeReferenceTemplate[] = [
  {
    id: 'campus-onepage',
    name: '标准校招一页模板',
    description: '结构均衡，适合绝大多数中文校招技术简历。',
    intendedUse: '适合初版智能一页压缩，重点保留教育、项目、实习、技能四块。',
    markdownBody: `# 姓名 / 求职意向
- 手机 | 邮箱 | GitHub | 博客

## 教育背景
- 学校 / 专业 / 学历 / 时间
- 如有亮点，仅保留一到两条最重要信息

## 实习经历
### 公司 - 岗位 - 时间
- 项目简介：一句话说明业务背景或系统定位
- 技术栈：只保留核心关键词
- 核心职责：2-3 条，优先动作 + 技术 + 结果

## 项目经历
### 项目名 - 角色 - 时间
- 项目简介：一句话说明目标
- 技术栈：精简到关键技术
- 核心职责：2-3 条，优先结果导向

## 专业技能
- 按能力主线压缩，不堆砌重复关键词

## 其他成果
- 论文 / 奖项 / 科研，仅保留最能证明能力的内容`,
  },
  {
    id: 'engineering-compact',
    name: '工程结果紧凑模板',
    description: '强调技术动作、性能结果和工程化产出，适合后端与工程方向。',
    intendedUse: '适合项目与实习内容较多、希望向一页高密度收敛的简历。',
    markdownBody: `# 姓名 / 目标岗位
- 联系方式 / 核心链接 / 到岗时间

## 核心摘要
- 用一句话概括方向和优势

## 实习 / 项目经历
### 标题 - 时间
- 背景：一句话
- 技术：核心关键词
- 结果：2-3 条高密度 bullet，尽量体现优化、性能、效率、稳定性、工程结果

## 教育背景
- 学校 / 专业 / 学历 / 时间 / 关键标签

## 技能矩阵
- 语言 / 框架 / 中间件 / 数据库 / 工具链

## 证明材料
- 论文、奖项、科研择优保留`,
  },
]

export function getResumeOptimizationSkill(skillId: string) {
  return resumeOptimizationSkills.find((skill) => skill.id === skillId) ?? resumeOptimizationSkills[0]
}

export function getResumeReferenceTemplate(templateId: string) {
  return resumeReferenceTemplates.find((template) => template.id === templateId) ?? resumeReferenceTemplates[0]
}
