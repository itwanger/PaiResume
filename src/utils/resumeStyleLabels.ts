import type {
  ResumePdfAccentPreset,
  ResumePdfDensity,
  ResumePdfPageMode,
  ResumePdfTemplateId,
} from './resumePdf'
import { normalizeResumeStyle, type ResumeStyleSource } from './resumeStyle'

const templateLabels: Record<ResumePdfTemplateId, string> = {
  default: '正常标准',
  compact: '紧凑模式',
  accent: '蓝调重点',
  'campus-blue': '校园技术蓝',
  'technical-black': '黑白技术',
  minimal: '极简留白',
  executive: '深色抬头',
  warm: '暖灰质感',
  slate: '冷灰技术',
  focus: '重点聚焦',
}

const accentLabels: Record<Exclude<ResumePdfAccentPreset, 'auto'>, string> = {
  blue: '蓝调',
  slate: '石墨',
  warm: '暖棕',
  emerald: '森绿',
}

const densityLabels: Record<ResumePdfDensity, string> = {
  normal: '标准模式',
  compact: '紧凑模式',
}

const pageModeLabels: Record<ResumePdfPageMode, string> = {
  standard: '标准分页',
  continuous: '智能一页',
}

export function getResumeStyleFeatureLabels(source: ResumeStyleSource): string[] {
  const style = normalizeResumeStyle(source)
  const templateLabel = style.accentPreset === 'auto'
    ? templateLabels[style.templateId]
    : `${templateLabels[style.templateId]} · ${accentLabels[style.accentPreset]}`

  return [densityLabels[style.density], pageModeLabels[style.pageMode], templateLabel]
}

export function getResumeStyleSummary(source: ResumeStyleSource): string {
  return getResumeStyleFeatureLabels(source).join(' · ')
}
