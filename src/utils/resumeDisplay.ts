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

export function selectResumeModulesForLivePreview(
  modules: ResumeModule[],
  activeModuleType?: ModuleType | null,
): ResumeModule[] {
  const sortedModules = sortResumeModulesForDisplay(modules)

  if (activeModuleType) {
    const previewModuleType = activeModuleType === 'job_intention' ? 'basic_info' : activeModuleType
    const matchingModules = sortedModules.filter((module) => module.moduleType === previewModuleType)

    // Education and project sections already render all entries of their type.
    return previewModuleType === 'education' || previewModuleType === 'project'
      ? matchingModules.slice(0, 1)
      : matchingModules
  }

  const hasEducationModule = sortedModules.some((module) => module.moduleType === 'education')
  const firstEducationModuleId = sortedModules.find((module) => module.moduleType === 'education')?.id
  const firstProjectModuleId = sortedModules.find((module) => module.moduleType === 'project')?.id

  return sortedModules.filter((module) => {
    if (module.moduleType === 'job_intention') return false
    if (module.moduleType === 'education') return module.id === firstEducationModuleId
    if (module.moduleType === 'project') return module.id === firstProjectModuleId
    return !(module.moduleType === 'award' && hasEducationModule)
  })
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
