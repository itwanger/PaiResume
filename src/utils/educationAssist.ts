import type {
  OfficialResumeMaterial,
  ResumeHistoryMaterial,
} from '../api/contentLibrary'
import type { EducationContent } from '../types'
import { normalizeEducationContent } from './moduleContent'

const DEGREE_DURATION_YEARS: Record<string, number> = {
  大专: 3,
  本科: 4,
  硕士: 3,
  博士: 4,
}

export interface EducationReferenceOption {
  key: string
  department: string
  major: string
  source: 'mine' | 'official'
  officialMaterialId?: number
}

function normalizeSchoolName(value: string): string {
  return value.replace(/\s+/g, '').toLocaleLowerCase()
}

export function inferEducationStartDate(degree: string, endDate: string): string {
  const durationYears = DEGREE_DURATION_YEARS[degree]
  const match = /^(\d{4})-(\d{2})$/.exec(endDate)
  if (!durationYears || !match) return ''

  const endYear = Number(match[1])
  if (!Number.isInteger(endYear) || endYear <= durationYears) return ''
  return `${endYear - durationYears}-09`
}

export function inferEducationEndDate(degree: string, startDate: string): string {
  const durationYears = DEGREE_DURATION_YEARS[degree]
  const match = /^(\d{4})-(\d{2})$/.exec(startDate)
  if (!durationYears || !match) return ''

  const startYear = Number(match[1])
  if (!Number.isInteger(startYear)) return ''
  return `${startYear + durationYears}-06`
}

export function completeEducationDates(content: EducationContent): EducationContent {
  if (!content.startDate && content.endDate) {
    const startDate = inferEducationStartDate(content.degree, content.endDate)
    return startDate ? { ...content, startDate } : content
  }

  if (!content.endDate && content.startDate) {
    const endDate = inferEducationEndDate(content.degree, content.startDate)
    return endDate ? { ...content, endDate } : content
  }

  return content
}

export function buildEducationReferenceOptions(
  school: string,
  mine: ResumeHistoryMaterial[],
  official: OfficialResumeMaterial[],
): EducationReferenceOption[] {
  const normalizedSchool = normalizeSchoolName(school)
  if (!normalizedSchool) return []

  const options: EducationReferenceOption[] = []
  const seen = new Set<string>()

  const append = (
    material: ResumeHistoryMaterial | OfficialResumeMaterial,
    source: EducationReferenceOption['source'],
  ) => {
    const content: EducationContent = normalizeEducationContent(material.content)
    if (normalizeSchoolName(content.school) !== normalizedSchool) return
    if (!content.department && !content.major) return

    const valueKey = `${normalizeSchoolName(content.department)}:${normalizeSchoolName(content.major)}`
    if (seen.has(valueKey)) return
    seen.add(valueKey)
    options.push({
      key: `${source}-${'key' in material ? material.key : material.id}`,
      department: content.department,
      major: content.major,
      source,
      officialMaterialId: source === 'official' && 'id' in material ? material.id : undefined,
    })
  }

  mine.forEach((material) => append(material, 'mine'))
  official.forEach((material) => append(material, 'official'))
  return options
}
