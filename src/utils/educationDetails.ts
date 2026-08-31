import type { EducationContent } from '../types'

const EDUCATION_DETAIL_FIELDS = [
  { key: 'academicPerformance', label: '学业表现' },
  { key: 'majorCourses', label: '主修课程' },
  { key: 'languageProficiency', label: '英语能力' },
] as const

export interface EducationDetailItem {
  key: typeof EDUCATION_DETAIL_FIELDS[number]['key']
  label: string
  value: string
}

export function getEducationDetailItems(content: EducationContent): EducationDetailItem[] {
  return EDUCATION_DETAIL_FIELDS.flatMap(({ key, label }) => {
    const value = content[key].trim()
    return value ? [{ key, label, value }] : []
  })
}
