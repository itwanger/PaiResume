import * as PDFJS from 'pdfjs-dist'

// 设置 PDF.js worker
PDFJS.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.js'

import type { Education, Experience, ParsedResume } from '../types'

/**
 * 从 PDF 文件中提取文本内容
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await PDFJS.getDocument({ data: arrayBuffer }).promise

  let fullText = ''

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    fullText += pageText + '\n'
  }

  return fullText.trim()
}

/**
 * 解析简历文本，提取结构化信息
 */
export function parseResumeText(text: string): ParsedResume {
  const result: ParsedResume = {
    basicInfo: {},
    educations: [],
    skills: [],
    experiences: []
  }

  // 解析基本信息
  parseBasicInfo(text, result)

  // 解析教育背景
  parseEducations(text, result)

  // 解析技能
  parseSkills(text, result)

  // 解析工作经历
  parseExperiences(text, result)

  return result
}

/**
 * 解析基本信息
 */
function parseBasicInfo(text: string, result: ParsedResume) {
  // 邮箱匹配
  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
  if (emailMatch) {
    result.basicInfo!.email = emailMatch[1]
  }

  // 手机号匹配（支持多种格式）
  const phoneMatch = text.match(/(1[3-9]\d{9}|(?:\+?86[- ]?)?1[3-9]\d{9}|(?:0?1[3-9]\d{9})|[\d]{3,4}[- ]?[\d]{7,8})/)
  if (phoneMatch) {
    result.basicInfo!.phone = phoneMatch[1].replace(/\s/g, '')
  }

  // GitHub 匹配
  const githubMatch = text.match(/(?:github\.com\/|@)([a-zA-Z0-9-_]+)/)
  if (githubMatch) {
    result.basicInfo!.github = `https://github.com/${githubMatch[1]}`
  }

  // 网站匹配
  const websiteMatch = text.match(/(https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&//=]*)/)
  if (websiteMatch && !websiteMatch[0].includes('github')) {
    result.basicInfo!.website = websiteMatch[0]
  }
}

/**
 * 解析教育背景
 */
function parseEducations(text: string, result: ParsedResume) {
  // 匹配教育相关关键词
  const educationKeywords = /([^\n]*(?:本科 | 硕士 | 博士 | 学士 | 研究生 | 大学 | 学院|Bachelor|Master|PhD|University|College)[^\n]*)/gi
  const matches = text.matchAll(educationKeywords)

  for (const match of matches) {
    const line = match[0]
    const education: Partial<Education> = {}

    // 尝试提取学校名称（常见大学模式）
    const schoolPatterns = [
      /(?:[^,\n]*) 大学 (?:[^,\n]*)/g,
      /(?:[^,\n]*) 学院 (?:[^,\n]*)/g,
      /(?:[^,\n]*)University(?:[^,\n]*)/gi,
      /(?:[^,\n]*)College(?:[^,\n]*)/gi
    ]

    for (const pattern of schoolPatterns) {
      const schoolMatch = line.match(pattern)
      if (schoolMatch) {
        education.school = schoolMatch[0].trim()
        break
      }
    }

    // 尝试提取学历
    if (/博士|PhD/.test(line)) {
      education.degree = '博士'
    } else if (/硕士 | 研究生|Master/.test(line)) {
      education.degree = '硕士'
    } else if (/本科 | 学士|Bachelor/.test(line)) {
      education.degree = '本科'
    }

    // 尝试提取时间
    const dateMatch = line.match(/(\d{4})[.-](\d{4}|\b 至今\b|\bPresent\b)/)
    if (dateMatch) {
      education.startDate = `${dateMatch[1]}-01`
      education.endDate = dateMatch[2].trim() === '至今' || dateMatch[2].trim() === 'Present' ? '至今' : `${dateMatch[2]}-12`
    }

    if (education.school || education.degree) {
      result.educations!.push(education)
    }
  }
}

/**
 * 解析技能
 */
function parseSkills(text: string, result: ParsedResume) {
  // 常见技术关键词
  const techKeywords = [
    'Java', 'Python', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'C++', 'C#',
    'React', 'Vue', 'Angular', 'Svelte',
    'Node.js', 'Express', 'NestJS',
    'Spring', 'Spring Boot', 'Spring Cloud',
    'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch',
    'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP',
    'Git', 'Linux', 'CI/CD', 'DevOps',
    '机器学习', '深度学习', 'TensorFlow', 'PyTorch',
    '数据分析', '数据可视化'
  ]

  const foundSkills = new Set<string>()

  for (const keyword of techKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
    if (regex.test(text)) {
      foundSkills.add(keyword)
    }
  }

  result.skills = Array.from(foundSkills)
}

/**
 * 解析工作/项目经历
 */
function parseExperiences(text: string, result: ParsedResume) {
  const experience: Partial<Experience> = {}

  // 尝试提取公司名称
  const companyMatch = text.match(/(?:公司 | 企业 | Corp|Inc|Ltd|Company)[^\n]{0,50}/gi)
  if (companyMatch) {
    experience.company = companyMatch[0].trim()
  }

  // 尝试提取职位
  const positionMatch = text.match(/(?:工程师 | 开发 | 经理 | 总监 | 架构师|Engineer|Developer|Manager|Director|Architect|Lead)[^\n]{0,30}/gi)
  if (positionMatch) {
    experience.position = positionMatch[0].trim()
  }

  // 提取时间段
  const dateMatch = text.match(/(\d{4}[年.-]\d{1,2}[月.-]?)\s*[-至]\s*(\d{4}[年.-]\d{1,2}[月.-]?|\b 至今\b|\bPresent\b)/)
  if (dateMatch) {
    experience.startDate = dateMatch[1].trim()
    experience.endDate = dateMatch[2].trim()
  }

  result.experiences = experience.company || experience.position ? [experience] : []
}
