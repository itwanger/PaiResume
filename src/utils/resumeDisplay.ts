import type { ResumeModule } from '../api/resume'
import { MODULE_LABELS, type BasicInfoContent, type ModuleType } from '../types'
import { normalizeBasicInfoContent } from './moduleContent'

const MODULE_DISPLAY_ORDER: Partial<Record<ModuleType, number>> = {
  basic_info: 10,
  education: 20,
  internship: 30,
  project: 40,
  work_experience: 50,
  skill: 60,
  paper: 70,
  research: 80,
  award: 90,
  job_intention: 100,
}

function getModuleDisplayOrder(moduleType: string): number {
  return MODULE_DISPLAY_ORDER[moduleType as ModuleType] ?? 1000
}

export function sortResumeModulesForDisplay(modules: ResumeModule[]): ResumeModule[] {
  return [...modules].sort((a, b) => {
    const orderDiff = getModuleDisplayOrder(a.moduleType) - getModuleDisplayOrder(b.moduleType)
    if (orderDiff !== 0) {
      return orderDiff
    }

    if (a.sortOrder === b.sortOrder) {
      return a.id - b.id
    }

    return a.sortOrder - b.sortOrder
  })
}

export function findBasicInfoContent(modules: ResumeModule[]): BasicInfoContent | null {
  const basicInfoModule = modules.find((module) => module.moduleType === 'basic_info')
  return basicInfoModule ? normalizeBasicInfoContent(basicInfoModule.content) : null
}

export function getModuleDisplayLabel(
  moduleType: ModuleType,
  _basicInfoContent?: Pick<BasicInfoContent, 'workYears'> | null
): string {
  void _basicInfoContent
  return MODULE_LABELS[moduleType]
}

export function getModuleDisplayLabelFromModules(moduleType: ModuleType, modules: ResumeModule[]): string {
  return getModuleDisplayLabel(moduleType, findBasicInfoContent(modules))
}
