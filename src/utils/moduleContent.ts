import type {
  AwardContent,
  BasicInfoContent,
  EducationContent,
  InternshipContent,
  JobIntentionContent,
  PaperContent,
  ProjectContent,
  ResearchContent,
  SkillContent,
} from '../types'

type UnknownRecord = Record<string, unknown>

function asRecord(content: Record<string, unknown>): UnknownRecord {
  return content as UnknownRecord
}

export function areModuleContentsEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function toBooleanValue(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

function splitParagraphLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function normalizeMixedText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function parseLegacyInternshipContent(value: string) {
  const lines = splitParagraphLines(value)
  const labeledSummary = lines.find((line) => line.startsWith('项目简介：') || line.startsWith('项目简介:'))
  const projectDescription = normalizeMixedText(labeledSummary
    ? labeledSummary.replace(/^项目简介[:：]\s*/, '')
    : lines[0] || '')

  const responsibilities = lines
    .filter((line) => line !== lines[0])
    .filter((line) => !line.startsWith('项目简介：') && !line.startsWith('项目简介:'))
    .flatMap((line) => {
      if (line === '核心职责：' || line === '核心职责:') {
        return []
      }

      if (line.startsWith('核心职责：') || line.startsWith('核心职责:')) {
        return [normalizeMixedText(line.replace(/^核心职责[:：]\s*/, ''))]
      }

      return [normalizeMixedText(line)]
    })

  return {
    projectDescription,
    responsibilities,
  }
}

export function toSkillCategories(value: unknown): SkillContent['categories'] {
  if (!Array.isArray(value)) {
    return [{ name: '', items: [] }]
  }

  const categories = value
    .filter((item): item is UnknownRecord => !!item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      name: toStringValue(item.name),
      items: toStringArray(item.items),
    }))

  return categories.length > 0 ? categories : [{ name: '', items: [] }]
}

export function normalizeBasicInfoContent(content: Record<string, unknown>): BasicInfoContent {
  const record = asRecord(content)

  return {
    name: toStringValue(record.name),
    email: toStringValue(record.email),
    jobIntention: toStringValue(record.jobIntention),
    targetCity: toStringValue(record.targetCity),
    salaryRange: toStringValue(record.salaryRange),
    expectedEntryDate: toStringValue(record.expectedEntryDate),
    phone: toStringValue(record.phone),
    wechat: toStringValue(record.wechat),
    isPartyMember: toBooleanValue(record.isPartyMember),
    photo: toStringValue(record.photo),
    hometown: toStringValue(record.hometown),
    blog: toStringValue(record.blog),
    github: toStringValue(record.github),
    leetcode: toStringValue(record.leetcode),
    workYears: toStringValue(record.workYears),
    summary: toStringValue(record.summary),
  }
}

export function normalizeEducationContent(content: Record<string, unknown>): EducationContent {
  const record = asRecord(content)

  return {
    school: toStringValue(record.school),
    schoolLogo: toStringValue(record.schoolLogo),
    department: toStringValue(record.department),
    major: toStringValue(record.major),
    degree: toStringValue(record.degree),
    startDate: toStringValue(record.startDate),
    endDate: toStringValue(record.endDate),
    is985: toBooleanValue(record.is985),
    is211: toBooleanValue(record.is211),
    isDoubleFirst: toBooleanValue(record.isDoubleFirst),
  }
}

export function normalizeInternshipContent(content: Record<string, unknown>): InternshipContent {
  const record = asRecord(content)
  const legacyContent = parseLegacyInternshipContent(toStringValue(record.responsibilities))
  const normalizedResponsibilities = toStringArray(record.responsibilities)

  return {
    company: toStringValue(record.company),
    projectName: toStringValue(record.projectName),
    position: toStringValue(record.position),
    startDate: toStringValue(record.startDate),
    endDate: toStringValue(record.endDate),
    techStack: toStringValue(record.techStack),
    projectDescription: toStringValue(record.projectDescription) || legacyContent.projectDescription,
    responsibilities: normalizedResponsibilities.length > 0 ? normalizedResponsibilities : legacyContent.responsibilities,
  }
}

export function normalizeProjectContent(content: Record<string, unknown>): ProjectContent {
  const record = asRecord(content)

  return {
    projectName: toStringValue(record.projectName),
    role: toStringValue(record.role),
    startDate: toStringValue(record.startDate),
    endDate: toStringValue(record.endDate),
    techStack: toStringValue(record.techStack),
    description: toStringValue(record.description),
    achievements: toStringArray(record.achievements),
  }
}

export function normalizeSkillContent(content: Record<string, unknown>): SkillContent {
  const record = asRecord(content)

  return {
    categories: toSkillCategories(record.categories),
  }
}

export function normalizePaperContent(content: Record<string, unknown>): PaperContent {
  const record = asRecord(content)

  return {
    journalType: toStringValue(record.journalType),
    journalName: toStringValue(record.journalName),
    publishTime: toStringValue(record.publishTime),
    content: toStringValue(record.content),
  }
}

export function normalizeResearchContent(content: Record<string, unknown>): ResearchContent {
  const record = asRecord(content)

  return {
    projectName: toStringValue(record.projectName),
    projectCycle: toStringValue(record.projectCycle),
    background: toStringValue(record.background),
    workContent: toStringValue(record.workContent),
    achievements: toStringValue(record.achievements),
  }
}

export function normalizeAwardContent(content: Record<string, unknown>): AwardContent {
  const record = asRecord(content)

  return {
    awardName: toStringValue(record.awardName),
    awardTime: toStringValue(record.awardTime),
  }
}

export function normalizeJobIntentionContent(content: Record<string, unknown>): JobIntentionContent {
  const record = asRecord(content)

  return {
    targetPosition: toStringValue(record.targetPosition),
    targetCity: toStringValue(record.targetCity),
    salaryRange: toStringValue(record.salaryRange),
    expectedEntryDate: toStringValue(record.expectedEntryDate),
  }
}
