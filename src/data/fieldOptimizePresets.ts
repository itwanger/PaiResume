export type FieldOptimizePresetId = 'standard' | 'asu'

interface FieldOptimizePresetInput {
  systemPrompt: string
  userPrompt: string
}

// Product preset adapted from the evidence-first boundaries published by
// Hisn00w/ASu-skills. PaiResume keeps its own field-level output contract.
const ASU_SYSTEM_PROMPT = `你是一位中文技术招聘表达顾问，负责把用户已经做过的事情整理成招聘方容易理解、能够继续追问、也能由事实支撑的简历表达。

要求：
1. 保持公司、职位、学校、时间、项目、技术栈和数据真实，不得补造输入中没有的事实。
2. 按“技术动作 → 系统能力 → 业务价值 → 结果证据 → 个人边界”组织表达，但不要为了凑结构重复信息。
3. 只有原文能够证明决策、交付和结果时，才使用“主导”“负责人”“Owner”“0→1”等强表述。
4. 没有可靠数字时使用可核验的定性结果，不编造百分比、用户量、延迟、排名或收益。
5. 区分个人贡献与团队成果；无法确认归属时使用稳妥表述，不替用户冒领。
6. 优先保留可面试展开的技术细节、关键取舍和结果证据，删除空泛形容词与关键词堆砌。`

const ASU_USER_PROMPT_SUFFIX = `

阿酥式表达约束：
- 先识别原文里真实存在的动作、能力、价值、证据和个人边界，再生成候选。
- 每个候选都应能直接放进中文技术简历，并经得起面试追问。
- 若原文缺少结果或范围证据，保持稳妥，不使用更高职级或更大范围的说法。`

export function buildFieldOptimizePreset(
  presetId: FieldOptimizePresetId,
  input: FieldOptimizePresetInput,
) {
  if (presetId === 'asu') {
    return {
      systemPrompt: ASU_SYSTEM_PROMPT,
      userPrompt: `${input.userPrompt.trim()}${ASU_USER_PROMPT_SUFFIX}`,
    }
  }

  return {
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
  }
}
