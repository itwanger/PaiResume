import type { ResumeModule } from '../api/resume'
import { MODULE_LABELS, type BasicInfoContent, type ModuleType } from '../types'
import { normalizeBasicInfoContent } from './moduleContent'

export const DEFAULT_RESUME_MODULE_TYPE_ORDER: ModuleType[] = [
  'basic_info',
  'education',
  'internship',
  'project',
  'work_experience',
  'skill',
  'paper',
  'research',
  'award',
]

export function sortResumeModulesForDisplay(modules: ResumeModule[]): ResumeModule[] {
  return [...modules].sort((a, b) => {
    if (a.moduleType === 'basic_info' && b.moduleType !== 'basic_info') {
      return -1
    }
    if (b.moduleType === 'basic_info' && a.moduleType !== 'basic_info') {
      return 1
    }

    if (a.sortOrder === b.sortOrder) {
      return a.id - b.id
    }

    return a.sortOrder - b.sortOrder
  })
}

export function getOrderedExistingModuleTypes(modules: ResumeModule[]): ModuleType[] {
  const supportedTypes = new Set<ModuleType>(DEFAULT_RESUME_MODULE_TYPE_ORDER)
  const seen = new Set<ModuleType>()

  return sortResumeModulesForDisplay(modules).flatMap((module) => {
    const moduleType = module.moduleType as ModuleType
    if (!supportedTypes.has(moduleType) || seen.has(moduleType)) {
      return []
    }
    seen.add(moduleType)
    return [moduleType]
  })
}

export function reorderResumeModulesByType(
  modules: ResumeModule[],
  orderedModuleTypes: ModuleType[],
): ResumeModule[] {
  const sortedModules = sortResumeModulesForDisplay(modules)
  const groupedModules = new Map<string, ResumeModule[]>()

  for (const module of sortedModules) {
    const group = groupedModules.get(module.moduleType) ?? []
    group.push(module)
    groupedModules.set(module.moduleType, group)
  }

  const consumedTypes = new Set<string>()
  const reordered: ResumeModule[] = []

  const requestedTypes = [
    'basic_info',
    ...orderedModuleTypes.filter((moduleType) => moduleType !== 'basic_info'),
  ]

  for (const moduleType of requestedTypes) {
    if (consumedTypes.has(moduleType)) continue
    consumedTypes.add(moduleType)
    reordered.push(...(groupedModules.get(moduleType) ?? []))
  }

  for (const module of sortedModules) {
    if (consumedTypes.has(module.moduleType)) continue
    consumedTypes.add(module.moduleType)
    reordered.push(...(groupedModules.get(module.moduleType) ?? []))
  }

  return reordered.map((module, sortOrder) => ({ ...module, sortOrder }))
}

export function reorderResumeModulesWithinType(
  modules: ResumeModule[],
  moduleType: ModuleType,
  orderedModuleIds: number[],
): ResumeModule[] {
  const sortedModules = sortResumeModulesForDisplay(modules)
  const modulesOfType = sortedModules.filter((module) => module.moduleType === moduleType)
  const expectedIds = new Set(modulesOfType.map((module) => module.id))
  const requestedIds = new Set(orderedModuleIds)

  if (orderedModuleIds.length !== modulesOfType.length
    || requestedIds.size !== orderedModuleIds.length
    || requestedIds.size !== expectedIds.size
    || orderedModuleIds.some((moduleId) => !expectedIds.has(moduleId))) {
    return sortedModules
  }

  const moduleById = new Map(modulesOfType.map((module) => [module.id, module]))
  let nextIndex = 0
  return sortedModules.map((module) => {
    const nextModule = module.moduleType === moduleType
      ? moduleById.get(orderedModuleIds[nextIndex++]) ?? module
      : module
    return { ...nextModule }
  }).map((module, sortOrder) => ({ ...module, sortOrder }))
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

    // Aggregated sections render all entries of their type inside the first preview block.
    return previewModuleType === 'education'
      || previewModuleType === 'internship'
      || previewModuleType === 'work_experience'
      || previewModuleType === 'project'
      || previewModuleType === 'award'
      ? matchingModules.slice(0, 1)
      : matchingModules
  }

  const firstEducationModuleId = sortedModules.find((module) => module.moduleType === 'education')?.id
  const firstInternshipModuleId = sortedModules.find((module) => module.moduleType === 'internship')?.id
  const firstWorkExperienceModuleId = sortedModules.find((module) => module.moduleType === 'work_experience')?.id
  const firstProjectModuleId = sortedModules.find((module) => module.moduleType === 'project')?.id
  const firstAwardModuleId = sortedModules.find((module) => module.moduleType === 'award')?.id

  return sortedModules.filter((module) => {
    if (module.moduleType === 'job_intention') return false
    if (module.moduleType === 'education') return module.id === firstEducationModuleId
    if (module.moduleType === 'internship') return module.id === firstInternshipModuleId
    if (module.moduleType === 'work_experience') return module.id === firstWorkExperienceModuleId
    if (module.moduleType === 'project') return module.id === firstProjectModuleId
    if (module.moduleType === 'award') return module.id === firstAwardModuleId
    return true
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
