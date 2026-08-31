import type { ExperienceProjectContent, InternshipContent } from '../types'

export interface CompactInternshipHeader {
  title: string
  startDate: string
  endDate: string
}

function uniqueNonEmptyParts(values: string[]) {
  const seen = new Set<string>()
  return values
    .map((value) => value.trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false
      seen.add(value)
      return true
    })
}

export function resolveCompactInternshipHeader(
  content: InternshipContent,
  project: ExperienceProjectContent,
): CompactInternshipHeader {
  const hasProjectDate = Boolean(project.startDate.trim() || project.endDate.trim())

  return {
    title: uniqueNonEmptyParts([
      content.company,
      project.projectName,
      project.role,
      content.position,
    ]).join(' - '),
    startDate: hasProjectDate ? project.startDate : content.startDate,
    endDate: hasProjectDate ? project.endDate : content.endDate,
  }
}
