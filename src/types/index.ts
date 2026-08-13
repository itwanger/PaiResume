// ==================== Module Content Types ====================

export interface BasicInfoContent {
  name: string
  email: string
  jobIntention: string
  targetCity: string
  salaryRange: string
  expectedEntryDate: string
  phone: string
  wechat: string
  isPartyMember: boolean
  photo: string
  photoId: number | null
  photoWidth: number | null
  photoHeight: number | null
  photoBorder: boolean
  hometown: string
  blog: string
  github: string
  leetcode: string
  workYears: string
  summary: string
}

export interface EducationContent {
  school: string
  schoolLogo: string
  department: string
  major: string
  degree: string
  startDate: string
  endDate: string
  is985: boolean
  is211: boolean
  isDoubleFirst: boolean
}

export interface ExperienceProjectContent {
  id: string
  projectName: string
  role: string
  startDate: string
  endDate: string
  techStack: string
  projectDescription: string
  responsibilities: string[]
}

export interface InternshipContent {
  company: string
  position: string
  startDate: string
  endDate: string
  projects: ExperienceProjectContent[]
}

export interface ProjectContent {
  projectName: string
  role: string
  startDate: string
  endDate: string
  techStack: string
  description: string
  achievements: string[]
}

export interface SkillContent {
  categories: Array<{
    name: string
    items: string[]
  }>
}

export interface PaperContent {
  journalType: string
  journalName: string
  publishTime: string
  content: string
}

export interface ResearchContent {
  projectName: string
  projectCycle: string
  background: string
  workContent: string
  achievements: string
}

export interface AwardContent {
  awardName: string
  awardTime: string
}

export interface JobIntentionContent {
  targetPosition: string
  targetCity: string
  salaryRange: string
  expectedEntryDate: string
}

// ==================== Module Type Union ====================

export type ModuleType =
  | 'basic_info'
  | 'education'
  | 'internship'
  | 'work_experience'
  | 'project'
  | 'skill'
  | 'paper'
  | 'research'
  | 'award'
  | 'job_intention'

export const MODULE_LABELS: Record<ModuleType, string> = {
  basic_info: '基本信息',
  education: '教育背景',
  internship: '实习经历',
  work_experience: '工作经历',
  project: '项目经历',
  skill: '专业技能',
  paper: '论文期刊',
  research: '科研经历',
  award: '荣誉奖项',
  job_intention: '求职意向',
}

export const MODULE_ICONS: Record<ModuleType, string> = {
  basic_info: '👤',
  education: '🎓',
  internship: '💼',
  work_experience: '🏢',
  project: '🛠',
  skill: '⚡',
  paper: '📄',
  research: '🔬',
  award: '🏆',
  job_intention: '🎯',
}

// ==================== Content Type Map ====================

export type ModuleContentMap = {
  basic_info: BasicInfoContent
  education: EducationContent
  internship: InternshipContent
  work_experience: InternshipContent
  project: ProjectContent
  skill: SkillContent
  paper: PaperContent
  research: ResearchContent
  award: AwardContent
  job_intention: JobIntentionContent
}

// Singleton module types (only one per resume)
export const SINGLETON_MODULES: ModuleType[] = ['basic_info', 'skill']

// ==================== Legacy Analysis Types ====================

export interface BasicInfo {
  name: string
  email: string
  phone: string
  github: string
  website: string
  location: string
  photo?: string
  photoBorder?: boolean
  summary: string
}

export interface Education {
  id: string
  school: string
  degree: string
  major: string
  startDate: string
  endDate: string
  description?: string
}

export interface Experience {
  id: string
  company: string
  position: string
  startDate: string
  endDate: string
  description: string
  achievements?: string[]
}

export interface Resume {
  basicInfo: BasicInfo
  educations: Education[]
  skills: string[]
  experiences: Experience[]
}

export interface ParsedResume {
  basicInfo?: Partial<BasicInfo>
  educations?: Array<Partial<Education>>
  skills?: string[]
  experiences?: Array<Partial<Experience>>
}

export interface AnalysisIssue {
  type: 'missing' | 'weak' | 'format' | 'content'
  field: string
  message: string
  suggestion: string
}

export interface AnalysisResult {
  score: number
  issues: AnalysisIssue[]
  suggestions: string[]
}
