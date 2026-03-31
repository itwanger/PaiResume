import { Resume, AnalysisResult, AnalysisIssue } from '../types'

/**
 * 分析简历，返回问题和改进建议
 */
export function analyzeResume(resume: Resume): AnalysisResult {
  const issues: AnalysisIssue[] = []
  const suggestions: string[] = []
  let score = 100

  // 分析基本信息
  analyzeBasicInfo(resume.basicInfo, issues, suggestions)

  // 分析教育背景
  analyzeEducations(resume.educations, issues)

  // 分析技能
  analyzeSkills(resume.skills, issues, suggestions)

  // 分析工作经历
  analyzeExperiences(resume.experiences, issues, suggestions)

  // 计算最终得分
  score = Math.max(0, score - issues.length * 10)

  return {
    score,
    issues,
    suggestions: [...new Set(suggestions)]
  }
}

/**
 * 分析基本信息
 */
function analyzeBasicInfo(
  basicInfo: Resume['basicInfo'],
  issues: AnalysisIssue[],
  suggestions: string[]
) {
  // 必填字段检查
  const requiredFields: (keyof Resume['basicInfo'])[] = ['name', 'email', 'phone']

  for (const field of requiredFields) {
    if (!basicInfo[field]) {
      issues.push({
        type: 'missing',
        field: field,
        message: `缺少${getFieldName(field)}信息`,
        suggestion: `请填写您的${getFieldName(field)}，这是简历的基本信息`
      })
    }
  }

  // 邮箱格式检查
  if (basicInfo.email && !isValidEmail(basicInfo.email)) {
    issues.push({
      type: 'format',
      field: 'email',
      message: '邮箱格式不正确',
      suggestion: '请使用标准邮箱格式，例如：yourname@gmail.com'
    })
  }

  // 手机号格式检查
  if (basicInfo.phone && !isValidPhone(basicInfo.phone)) {
    issues.push({
      type: 'format',
      field: 'phone',
      message: '手机号格式不正确',
      suggestion: '请输入 11 位有效的手机号码'
    })
  }

  // 个人总结建议
  if (!basicInfo.summary || basicInfo.summary.length < 50) {
    issues.push({
      type: 'weak',
      field: 'summary',
      message: '个人总结过于简单或缺失',
      suggestion: '建议添加 50-200 字的个人总结，突出您的核心优势和职业目标'
    })
  }

  // 社交链接建议
  if (!basicInfo.github && !basicInfo.website) {
    suggestions.push('建议添加 GitHub 或个人网站链接，展示您的技术作品')
  }
}

/**
 * 分析教育背景
 */
function analyzeEducations(
  educations: Resume['educations'],
  issues: AnalysisIssue[]
) {
  if (educations.length === 0) {
    issues.push({
      type: 'missing',
      field: 'educations',
      message: '缺少教育背景信息',
      suggestion: '请至少添加一条教育经历，包括学校、专业、学历和时间'
    })
    return
  }

  for (const edu of educations) {
    // 检查必填字段
    if (!edu.school) {
      issues.push({
        type: 'missing',
        field: 'education.school',
        message: '教育经历缺少学校名称',
        suggestion: '请填写完整的学校名称'
      })
    }

    if (!edu.degree) {
      issues.push({
        type: 'missing',
        field: 'education.degree',
        message: '教育经历缺少学历信息',
        suggestion: '请选择您的学历（本科/硕士/博士）'
      })
    }

    if (!edu.major) {
      issues.push({
        type: 'missing',
        field: 'education.major',
        message: '教育经历缺少专业信息',
        suggestion: '请填写您的专业名称'
      })
    }

    // 检查时间完整性
    if (!edu.startDate || !edu.endDate) {
      issues.push({
        type: 'missing',
        field: 'education.date',
        message: '教育经历缺少时间信息',
        suggestion: '请填写入学和毕业时间'
      })
    }
  }
}

/**
 * 分析技能列表
 */
function analyzeSkills(
  skills: Resume['skills'],
  issues: AnalysisIssue[],
  suggestions: string[]
) {
  if (skills.length === 0) {
    issues.push({
      type: 'missing',
      field: 'skills',
      message: '缺少专业技能',
      suggestion: '请逐条列出您的专业技能和能力点，帮助招聘方快速判断匹配度'
    })
    return
  }

  if (skills.length < 3) {
    issues.push({
      type: 'weak',
      field: 'skills',
      message: '技能列表过于简单',
      suggestion: '建议列出至少 3-5 项核心技能，让招聘方更好地了解您的能力'
    })
  }

  const longFormSkills = skills.filter((skill) => skill.length >= 20)
  if (longFormSkills.length === 0) {
    suggestions.push('建议优先用完整句子描述技能能力，而不是只堆砌技术关键词')
  }
}

/**
 * 分析工作/项目经历
 */
function analyzeExperiences(
  experiences: Resume['experiences'],
  issues: AnalysisIssue[],
  suggestions: string[]
) {
  if (experiences.length === 0) {
    issues.push({
      type: 'missing',
      field: 'experiences',
      message: '缺少工作/项目经历',
      suggestion: '请添加至少一段工作或项目经历，这是评估您能力的重要依据'
    })
    return
  }

  for (const exp of experiences) {
    // 检查必填字段
    if (!exp.company && !exp.position) {
      issues.push({
        type: 'missing',
        field: 'experience.basic',
        message: '经历缺少公司或职位信息',
        suggestion: '请填写公司名称和职位'
      })
    }

    if (!exp.description || exp.description.length < 50) {
      issues.push({
        type: 'weak',
        field: 'experience.description',
        message: '经历描述过于简单',
        suggestion: '请详细描述您的工作内容，建议至少 50 字'
      })
    }

    // STAR 法则检查
    if (exp.description) {
      const hasAction = /负责 | 主导 | 实现 | 开发 | 设计 | 优化 | 完成|led|developed|implemented|designed/.test(exp.description)
      const hasResult = /提升 | 降低 | 节省|增加 | 减少|improved|reduced|increased/.test(exp.description)
      const hasNumber = /\d+%|\d+ 倍|\d{4,}/.test(exp.description)

      if (!hasAction) {
        issues.push({
          type: 'weak',
          field: 'experience.action',
          message: '经历描述缺少具体行动',
          suggestion: '使用 STAR 法则（情境 - 任务 - 行动 - 结果）描述您的贡献'
        })
      }

      if (!hasResult && !hasNumber) {
        suggestions.push('建议用量化的结果展示您的成就，如"性能提升 50%"、"用户增长 10 万"等')
      }
    }

    // 时间检查
    if (!exp.startDate || !exp.endDate) {
      issues.push({
        type: 'missing',
        field: 'experience.date',
        message: '经历缺少时间信息',
        suggestion: '请填写工作或项目的时间段'
      })
    }
  }
}

/**
 * 获取字段的中文名称
 */
function getFieldName(field: string): string {
  const fieldNames: Record<string, string> = {
    name: '姓名',
    email: '邮箱',
    phone: '手机号',
    github: 'GitHub',
    website: '个人网站',
    summary: '个人总结',
    location: '所在地'
  }
  return fieldNames[field] || field
}

/**
 * 验证邮箱格式
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(email)
}

/**
 * 验证手机号格式（中国大陆）
 */
function isValidPhone(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}
