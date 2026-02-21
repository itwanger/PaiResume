// 教育背景
export interface Education {
  id: string
  school: string
  degree: string
  major: string
  startDate: string
  endDate: string
  description?: string
}

// 工作/项目经历
export interface Experience {
  id: string
  company: string
  position: string
  startDate: string
  endDate: string
  description: string
  achievements?: string[]
}

// 基本信息
export interface BasicInfo {
  name: string
  email: string
  phone: string
  github?: string
  website?: string
  location?: string
  summary?: string
}

// 简历数据结构
export interface Resume {
  basicInfo: BasicInfo
  educations: Education[]
  skills: string[]
  experiences: Experience[]
}

// 简历分析结果
export interface AnalysisResult {
  score: number
  issues: AnalysisIssue[]
  suggestions: string[]
}

// 分析问题
export interface AnalysisIssue {
  type: 'missing' | 'weak' | 'format' | 'content'
  field: string
  message: string
  suggestion: string
}

// PDF 解析结果
export interface ParsedResume {
  basicInfo?: Partial<BasicInfo>
  educations?: Partial<Education>[]
  skills?: string[]
  experiences?: Partial<Experience>[]
}

// 表单步骤
export type FormStep = 'basic' | 'education' | 'skills' | 'experience' | 'preview' | 'analysis'
