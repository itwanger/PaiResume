import type { ResumeModule } from '../api/resume'
import { MODULE_LABELS, type BasicInfoContent, type ModuleType } from '../types'
import { normalizeBasicInfoContent } from './moduleContent'

export function findBasicInfoContent(modules: ResumeModule[]): BasicInfoContent | null {
  const basicInfoModule = modules.find((module) => module.moduleType === 'basic_info')
  return basicInfoModule ? normalizeBasicInfoContent(basicInfoModule.content) : null
}

export function hasWorkYears(value: string | null | undefined): boolean {
  const normalizedValue = value?.trim()
  if (!normalizedValue) {
    return false
  }

  return /[\d一二两三四五六七八九十半]/.test(normalizedValue)
}

export function getModuleDisplayLabel(
  moduleType: ModuleType,
  basicInfoContent?: Pick<BasicInfoContent, 'workYears'> | null
): string {
  if (moduleType === 'internship' && hasWorkYears(basicInfoContent?.workYears)) {
    return '工作经历'
  }

  return MODULE_LABELS[moduleType]
}

export function getModuleDisplayLabelFromModules(moduleType: ModuleType, modules: ResumeModule[]): string {
  return getModuleDisplayLabel(moduleType, findBasicInfoContent(modules))
}
