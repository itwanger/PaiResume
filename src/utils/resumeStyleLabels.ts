import type {
  ResumePdfAccentPreset,
  ResumePdfDensity,
  ResumePdfPageMode,
  ResumePdfTemplateId,
} from './resumePdf'
import { normalizeResumeStyle, type ResumeStyleSource } from './resumeStyle'

export type ResumeFeatureBadgeCategory = 'position' | 'density' | 'pageMode' | 'template' | 'accent' | 'other'
export type ResumeFeatureBadgeTone = 'blue' | 'violet' | 'sky' | 'amber' | 'rose' | 'slate'

export interface ResumeStyleFeatureBadge {
  category: ResumeFeatureBadgeCategory
  label: string
}

const featureBadgeTones: Record<ResumeFeatureBadgeCategory, ResumeFeatureBadgeTone> = {
  position: 'blue',
  density: 'violet',
  pageMode: 'sky',
  template: 'amber',
  accent: 'rose',
  other: 'slate',
}

const featureBadgeClassNames: Record<ResumeFeatureBadgeTone, string> = {
  blue: 'bg-primary-50 text-primary-700 ring-primary-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200/80',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200/80',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200/80',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200/70',
}

const templateLabels: Record<ResumePdfTemplateId, string> = {
  default: '系统默认',
  compact: '紧凑模式',
  accent: '蓝调重点',
  'campus-blue': '校园技术蓝',
  'technical-black': '黑白技术',
  'vibe-resume': 'Vibe 高密技术',
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
  normal: '标准',
  compact: '紧凑',
}

const pageModeLabels: Record<ResumePdfPageMode, string> = {
  standard: '标准 PDF（可能分页）',
  continuous: '智能长一页（内容无损）',
}

export function getResumeFeatureBadgeTone(category: ResumeFeatureBadgeCategory): ResumeFeatureBadgeTone {
  return featureBadgeTones[category]
}

export function getResumeFeatureBadgeClassName(category: ResumeFeatureBadgeCategory): string {
  return featureBadgeClassNames[getResumeFeatureBadgeTone(category)]
}

export function getResumeStyleFeatureBadges(source: ResumeStyleSource): ResumeStyleFeatureBadge[] {
  const style = normalizeResumeStyle(source)
  const badges: ResumeStyleFeatureBadge[] = [
    { category: 'density', label: `内容密度：${densityLabels[style.density]}` },
    { category: 'pageMode', label: pageModeLabels[style.pageMode] },
    { category: 'template', label: `模板：${templateLabels[style.templateId]}` },
  ]

  if (style.accentPreset !== 'auto') {
    badges.push({ category: 'accent', label: `主题色：${accentLabels[style.accentPreset]}` })
  }

  return badges
}

export function getResumeStyleFeatureLabels(source: ResumeStyleSource): string[] {
  return getResumeStyleFeatureBadges(source).map((badge) => badge.label)
}

export function getResumeStyleSummary(source: ResumeStyleSource): string {
  return getResumeStyleFeatureLabels(source).join(' · ')
}
