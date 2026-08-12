import type { ImportedResumeData } from './markdown'
import { MODULE_LABELS } from '../../types'

export interface ResumeImportPreview {
  title: string
  moduleLabels: string[]
  moduleOutline: Array<{
    label: string
    summary: string
  }>
  name: string
  phone: string
  email: string
}

function getStringValue(content: Record<string, unknown>, key: string): string {
  const value = content[key]
  return typeof value === 'string' ? value.trim() : ''
}

function joinValues(content: Record<string, unknown>, keys: string[]): string {
  return keys
    .map((key) => getStringValue(content, key))
    .filter(Boolean)
    .join(' · ')
}

function getSkillSummary(content: Record<string, unknown>): string {
  const categories = content.categories
  if (!Array.isArray(categories)) {
    return ''
  }

  return categories
    .flatMap((category) => {
      if (!category || typeof category !== 'object') return []
      const itemList = (category as { items?: unknown }).items
      return Array.isArray(itemList)
        ? itemList.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
        : []
    })
    .slice(0, 5)
    .join('、')
}

function getModuleSummary(
  moduleType: ImportedResumeData['modules'][number]['moduleType'],
  content: Record<string, unknown>,
): string {
  switch (moduleType) {
    case 'basic_info':
      return joinValues(content, ['name', 'jobIntention', 'phone', 'email'])
    case 'education':
      return joinValues(content, ['school', 'major', 'degree', 'startDate', 'endDate'])
    case 'internship':
    case 'work_experience':
      return joinValues(content, ['company', 'position', 'startDate', 'endDate'])
    case 'project':
      return joinValues(content, ['projectName', 'role', 'startDate', 'endDate'])
    case 'skill':
      return getSkillSummary(content)
    case 'paper':
      return joinValues(content, ['journalName', 'journalType', 'publishTime'])
    case 'research':
      return joinValues(content, ['projectName', 'projectCycle'])
    case 'award':
      return joinValues(content, ['awardName', 'awardTime'])
    case 'job_intention':
      return joinValues(content, ['targetPosition', 'targetCity'])
  }

  return ''
}

export function buildResumeImportPreview(payload: ImportedResumeData): ResumeImportPreview {
  const basicInfo = payload.modules.find((module) => module.moduleType === 'basic_info')?.content ?? {}

  return {
    title: payload.title.trim() || '导入的简历',
    moduleLabels: payload.modules.map((module) => MODULE_LABELS[module.moduleType]),
    moduleOutline: payload.modules.map((module) => ({
      label: MODULE_LABELS[module.moduleType],
      summary: getModuleSummary(module.moduleType, module.content),
    })),
    name: getStringValue(basicInfo, 'name'),
    phone: getStringValue(basicInfo, 'phone'),
    email: getStringValue(basicInfo, 'email'),
  }
}
