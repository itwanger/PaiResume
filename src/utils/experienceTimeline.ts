import type { ExperienceProjectContent, InternshipContent } from '../types'

function toMonthIndex(value: string): number | null {
  if (value === '至今') return Number.POSITIVE_INFINITY
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return null
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return Number(match[1]) * 12 + month
}

export interface ExperienceTimelineIssues {
  company: string[]
  projects: Record<string, string[]>
}

export function reorderExperienceProjects(
  projects: ExperienceProjectContent[],
  sourceId: string,
  targetId: string,
): ExperienceProjectContent[] {
  if (sourceId === targetId) return projects
  const sourceIndex = projects.findIndex((project) => project.id === sourceId)
  const targetIndex = projects.findIndex((project) => project.id === targetId)
  if (sourceIndex < 0 || targetIndex < 0) return projects
  const reordered = [...projects]
  const [source] = reordered.splice(sourceIndex, 1)
  reordered.splice(targetIndex, 0, source)
  return reordered
}

export function getExperienceTimelineIssues(content: InternshipContent): ExperienceTimelineIssues {
  const company: string[] = []
  const projects: Record<string, string[]> = {}
  const companyStart = toMonthIndex(content.startDate)
  const companyEnd = toMonthIndex(content.endDate)

  if (companyStart !== null && companyEnd !== null && companyStart > companyEnd) {
    company.push('任职结束时间不能早于开始时间')
  }

  content.projects.forEach((project) => {
    const messages: string[] = []
    const projectStart = toMonthIndex(project.startDate)
    const projectEnd = toMonthIndex(project.endDate)

    if (projectStart !== null && projectEnd !== null && projectStart > projectEnd) {
      messages.push('项目结束时间不能早于开始时间')
    }
    if (companyStart !== null && projectStart !== null && projectStart < companyStart) {
      messages.push('项目开始时间不能早于任职开始时间')
    }
    if (companyEnd !== null && Number.isFinite(companyEnd) && projectStart !== null && projectStart > companyEnd) {
      messages.push('项目开始时间不能晚于任职结束时间')
    }
    if (companyEnd !== null && Number.isFinite(companyEnd) && projectEnd === Number.POSITIVE_INFINITY) {
      messages.push('任职已经结束，项目结束时间不能为至今')
    } else if (companyEnd !== null && projectEnd !== null && projectEnd > companyEnd) {
      messages.push('项目结束时间不能晚于任职结束时间')
    }

    if (messages.length > 0) projects[project.id] = messages
  })

  return { company, projects }
}
