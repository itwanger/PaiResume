import type { ResumeModule } from '../api/resume'
import type { EducationContent } from '../types'
import { normalizeEducationContent } from './moduleContent'

const DEGREE_LEVEL: Record<string, number> = {
  大专: 1,
  本科: 2,
  硕士: 3,
  博士: 4,
}

interface EducationEntry {
  moduleId: number
  content: EducationContent
  level: number
  start: number | null
  end: number | null
}

export interface EducationTimelineIssue {
  moduleId: number
  messages: string[]
}

function parseMonth(value: string): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isInteger(year) || month < 1 || month > 12) return null
  return year * 12 + month
}

function followsEarlierStage(later: EducationEntry, earlier: EducationEntry): boolean {
  if (later.start !== null && earlier.start !== null && later.start <= earlier.start) return false
  if (later.end !== null && earlier.end !== null && later.end <= earlier.end) return false
  if (later.start !== null && earlier.end !== null && later.start < earlier.end) return false
  return true
}

export function getEducationTimelineIssues(modules: ResumeModule[]): EducationTimelineIssue[] {
  const entries: EducationEntry[] = modules
    .filter((module) => module.moduleType === 'education')
    .map((module) => {
      const content = normalizeEducationContent(module.content)
      return {
        moduleId: module.id,
        content,
        level: DEGREE_LEVEL[content.degree] ?? 0,
        start: parseMonth(content.startDate),
        end: parseMonth(content.endDate),
      }
    })

  const issueMap = new Map<number, Set<string>>()
  const addIssue = (moduleId: number, message: string) => {
    const messages = issueMap.get(moduleId) ?? new Set<string>()
    messages.add(message)
    issueMap.set(moduleId, messages)
  }

  for (const entry of entries) {
    if (entry.start !== null && entry.end !== null && entry.end < entry.start) {
      addIssue(entry.moduleId, '结束时间不能早于开始时间')
    }
  }

  for (const later of entries) {
    if (later.level === 0) continue
    for (const earlier of entries) {
      if (earlier.level === 0 || later.level <= earlier.level) continue
      if (followsEarlierStage(later, earlier)) continue
      addIssue(later.moduleId, `${later.content.degree}阶段应晚于${earlier.content.degree}阶段，请检查起止时间`)
    }
  }

  return [...issueMap.entries()].map(([moduleId, messages]) => ({
    moduleId,
    messages: [...messages],
  }))
}
