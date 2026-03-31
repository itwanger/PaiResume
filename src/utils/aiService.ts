import { Resume, AnalysisResult } from '../types'

// 检测是否使用阿里云百炼 API
const isAliyun = import.meta.env.VITE_AI_BASE_URL?.includes('dashscope') ||
                 import.meta.env.VITE_AI_BASE_URL?.includes('aliyuncs')

// API 配置 - 从环境变量读取
const API_CONFIG = {
  apiKey: import.meta.env.VITE_AI_API_KEY || '',
  baseURL: import.meta.env.VITE_AI_BASE_URL || 'https://api.anthropic.com/v1',
  model: import.meta.env.VITE_AI_MODEL || 'qwen3.5-plus',
  isAliyun
}

/**
 * 使用 LLM 分析简历
 * 支持阿里云百炼（通义千问）和 Anthropic Claude API
 */
export async function analyzeWithLLM(resume: Resume): Promise<AnalysisResult> {
  const prompt = buildResumeAnalysisPrompt(resume)

  try {
    if (API_CONFIG.isAliyun) {
      return await analyzeWithAliyun(prompt)
    } else {
      return await analyzeWithAnthropic(prompt)
    }
  } catch (error) {
    console.error('LLM 分析失败:', error)
    throw error
  }
}

/**
 * 使用阿里云百炼 API 分析
 * 通过 Vite 代理绕过 CORS 限制
 */
async function analyzeWithAliyun(prompt: string): Promise<AnalysisResult> {
  const apiKey = API_CONFIG.apiKey
  const model = API_CONFIG.model
  const systemPrompt = '你是一位专业的简历顾问。请分析简历并提供专业建议。必须严格按照 JSON 格式输出。'

  console.log('[Aliyun API] 使用模型:', model)
  console.log('[Aliyun API] API Key 前缀:', apiKey.substring(0, 6) + '...')

  // qwen3.5 系列优先使用 Responses API，其余模型默认使用 DashScope 原生文本生成接口
  const useResponsesApi = /^qwen3\.5/i.test(model)
  const endpoint = useResponsesApi
    ? '/api/v2/apps/protocols/compatible-mode/v1/responses'
    : '/api/v1/services/aigc/text-generation/generation'

  const requestBody = useResponsesApi
    ? {
        model,
        // Responses API 支持直接字符串输入
        input: `${systemPrompt}\n\n${prompt}`
      }
    : {
        model,
        input: {
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        parameters: {
          max_tokens: 2048,
          temperature: 0.3,
          result_format: 'message'
        }
      }

  console.log('[Aliyun API] 请求体:', JSON.stringify(requestBody, null, 2).substring(0, 300) + '...')

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    console.log('[Aliyun API] 响应状态:', response.status, response.statusText)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({} as Record<string, unknown>))
      console.error('[Aliyun API] 错误详情:', errorData)

      let errorMsg = `API 请求失败 (${response.status})`

      if (response.status === 403) {
        errorMsg += ' - API Key 无效或权限不足，请检查：\n' +
          '1. API Key 是否正确复制（包含完整的 sk- 前缀）\n' +
          '2. 账户是否有足够的余额\n' +
          '3. 是否已开通通义千问服务'
      } else if (response.status === 401) {
        errorMsg += ' - 认证失败，请检查 API Key'
      } else if (response.status === 429) {
        errorMsg += ' - 请求频率超限'
      }

      if (errorData.message) {
        errorMsg += `\n服务端信息：${errorData.message}`
      }
      if (errorData.code) {
        errorMsg += `\n错误码：${errorData.code}`
      }

      throw new Error(errorMsg)
    }

    const data = await response.json()
    console.log('[Aliyun API] 响应数据:', JSON.stringify(data).substring(0, 500) + '...')

    // DashScope 文本生成接口返回格式
    const generationContent = data.output?.choices?.[0]?.message?.content || data.output?.text || ''

    // Responses API 返回格式优先读取 output_text
    const responsesContent = data.output_text ||
      data.output?.map((item: { content?: Array<{ text?: string }> }) =>
        item?.content?.map((part: { text?: string }) => part?.text || '').join('')
      ).join('\n') ||
      ''

    const content = useResponsesApi ? responsesContent : generationContent

    if (!content) {
      throw new Error('API 返回内容为空')
    }

    return parseLLMResponse(content)
  } catch (fetchError) {
    console.error('[Aliyun API] 请求异常:', fetchError)
    if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
      throw new Error('网络请求失败，请检查 Vite 开发服务（http://localhost:5173）和网络连接')
    }
    throw fetchError
  }
}

/**
 * 使用 Anthropic Claude API 分析
 */
async function analyzeWithAnthropic(prompt: string): Promise<AnalysisResult> {
  const response = await fetch(`${API_CONFIG.baseURL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_CONFIG.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: API_CONFIG.model,
      max_tokens: 2048,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Anthropic API 请求失败：${response.status} - ${errorData.error?.message || '未知错误'}`)
  }

  const data = await response.json()
  const content = data.content[0].text

  return parseLLMResponse(content)
}

/**
 * 构建简历分析提示词
 */
function buildResumeAnalysisPrompt(resume: Resume): string {
  const resumeText = formatResumeForAnalysis(resume)

  return `请分析以下简历，提供专业、具体的改进建议。

## 简历内容

${resumeText}

## 分析要求

请从以下维度分析这份简历：

1. **完整性检查**：是否缺少关键信息（联系方式、教育背景、技能、经历等）
2. **内容质量**：描述是否具体、是否有量化成果、是否使用 STAR 法则
3. **格式规范**：表达是否专业、是否有拼写语法问题
4. **行业匹配**：技能关键词是否符合目标岗位要求
5. **竞争力评估**：整体竞争力如何，有哪些突出亮点和明显不足

## 输出格式

请**严格只输出 JSON 格式**，不要有任何其他文字，格式如下：

{
  "score": 75,
  "issues": [
    {
      "type": "missing",
      "field": "basicInfo.name",
      "message": "缺少姓名信息",
      "suggestion": "请填写您的姓名"
    }
  ],
  "suggestions": ["建议 1", "建议 2"]
}

评分标准：
- 90-100: 优秀简历，可直接用于投递
- 80-89: 良好简历，小幅修改后更佳
- 70-79: 中等水平，需要一定改进
- 60-69: 及格水平，需要较多改进
- 0-59: 需要大幅重构`
}

/**
 * 格式化简历数据为文本，便于 LLM 分析
 */
function formatResumeForAnalysis(resume: Resume): string {
  const parts: string[] = []

  // 基本信息
  const { basicInfo } = resume
  parts.push(`### 基本信息
姓名：${basicInfo.name || '（未填写）'}
邮箱：${basicInfo.email || '（未填写）'}
手机：${basicInfo.phone || '（未填写）'}
所在地：${basicInfo.location || '（未填写）'}
GitHub: ${basicInfo.github || '（未填写）'}
网站：${basicInfo.website || '（未填写）'}
个人总结：${basicInfo.summary || '（未填写）'}`)

  // 教育背景
  if (resume.educations.length > 0) {
    parts.push(`### 教育背景
${resume.educations.map((edu, i) => `${i + 1}. ${edu.school} - ${edu.major} (${edu.degree}) ${edu.startDate} 至 ${edu.endDate}
   ${edu.description || ''}`).join('\n')}`)
  } else {
    parts.push('### 教育背景\n（未填写）')
  }

  // 专业技能
  if (resume.skills.length > 0) {
    parts.push(`### 专业技能
${resume.skills.join(', ')}`)
  } else {
    parts.push('### 专业技能\n（未填写）')
  }

  // 工作/项目经历
  if (resume.experiences.length > 0) {
    parts.push(`### 工作/项目经历
${resume.experiences.map((exp, i) => `${i + 1}. ${exp.position} @ ${exp.company} (${exp.startDate} 至 ${exp.endDate})
   ${exp.description}
   ${exp.achievements?.length ? '主要成就：' + exp.achievements.join('; ') : ''}`).join('\n')}`)
  } else {
    parts.push('### 工作/项目经历\n（未填写）')
  }

  return parts.join('\n\n')
}

/**
 * 解析 LLM 返回的 JSON 响应
 */
function parseLLMResponse(content: string): AnalysisResult {
  try {
    console.log('LLM 返回内容:', content.substring(0, 500) + '...')

    // 尝试提取 JSON 内容（可能包含在代码块中）
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    let jsonString = content

    if (jsonMatch) {
      jsonString = jsonMatch[1] || content
    } else {
      // 尝试直接查找 JSON 对象
      const jsonStart = content.indexOf('{')
      const jsonEnd = content.lastIndexOf('}')
      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonString = content.substring(jsonStart, jsonEnd + 1)
      }
    }

    // 清理可能的markdown标记
    jsonString = jsonString.replace(/```/g, '').trim()

    const result = JSON.parse(jsonString)

    // 验证返回格式（score 允许为 0）
    const hasValidScore = typeof result.score === 'number' && Number.isFinite(result.score)
    const hasValidIssues = Array.isArray(result.issues)
    const hasValidSuggestions = Array.isArray(result.suggestions)

    if (!hasValidScore || !hasValidIssues || !hasValidSuggestions) {
      throw new Error('返回的 JSON 格式不正确')
    }

    return result
  } catch (error) {
    console.error('解析 LLM 响应失败:', error, '原始内容:', content)

    // 降级处理：返回基础分析结果
    return {
      score: 70,
      issues: [
        {
          type: 'content',
          field: 'api',
          message: 'AI 分析结果解析失败',
          suggestion: '已切换到本地规则分析模式，建议检查 API 配置或重试'
        }
      ],
      suggestions: ['AI 响应格式异常，建议检查配置后重新分析']
    }
  }
}

/**
 * 检查是否配置了 API Key
 */
export function isLLMConfigured(): boolean {
  return !!API_CONFIG.apiKey
}

/**
 * 获取 API 配置状态
 */
export function getAPIConfigStatus(): {
  configured: boolean
  baseURL: string
  model: string
  provider: 'aliyun' | 'anthropic' | 'unknown'
} {
  return {
    configured: !!API_CONFIG.apiKey,
    baseURL: API_CONFIG.baseURL,
    model: API_CONFIG.model,
    provider: API_CONFIG.isAliyun ? 'aliyun' : 'anthropic'
  }
}
