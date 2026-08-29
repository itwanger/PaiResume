/* eslint-disable react-refresh/only-export-components */
import {
  Document,
  Font,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import type { ResumeModule } from '../api/resume'
import {
  hasPaperContent,
  hasResearchContent,
  normalizeAwardContent,
  normalizeBasicInfoContent,
  normalizeEducationContent,
  normalizeInternshipContent,
  normalizeJobIntentionContent,
  normalizePaperContent,
  normalizeProjectContent,
  normalizeResearchContent,
  normalizeSkillContent,
} from './moduleContent'
import { parseInlineMarkdownSegments } from './inlineMarkdown'
import { normalizePhotoSource } from './resumePhoto'
import { getModuleDisplayLabel, sortResumeModulesForDisplay } from './resumeDisplay'
import { normalizeInlineText } from './resumeText'
import { formatAwardDisplayText } from './yearInput'

function resolveFontSource(fileName: string) {
  if (typeof window === 'undefined') {
    return decodeURIComponent(new URL(`../../public/fonts/${fileName}`, import.meta.url).pathname)
  }
  return `/fonts/${fileName}`
}

Font.registerHyphenationCallback((word) => [word])
Font.register({
  family: 'ResumePdfSans',
  fonts: [
    { src: resolveFontSource('noto-sans-sc-regular.otf'), fontWeight: 400 },
    { src: resolveFontSource('noto-sans-sc-bold.otf'), fontWeight: 700 },
  ],
})

export interface ResumePdfOptions {
  pageMode?: 'standard' | 'continuous'
  documentTitle?: string
  fileNameSuffix?: string
  templateId?: ResumePdfTemplateId
  density?: ResumePdfDensity
  accentPreset?: ResumePdfAccentPreset
  headingStyle?: ResumePdfHeadingStyle
}

export type ResumePdfPageMode = NonNullable<ResumePdfOptions['pageMode']>
export type ResumePdfTemplateId =
  | 'default'
  | 'compact'
  | 'accent'
  | 'campus-blue'
  | 'technical-black'
  | 'vibe-resume'
  | 'minimal'
  | 'executive'
  | 'warm'
  | 'slate'
  | 'focus'
export type ResumePdfDensity = 'normal' | 'compact'
export type ResumePdfAccentPreset = 'auto' | 'blue' | 'slate' | 'warm' | 'emerald'
export type ResumePdfHeadingStyle = 'auto' | 'underline' | 'filled' | 'bar'

export interface ResumePdfPreviewConfig {
  pageMode: ResumePdfPageMode
  templateId: ResumePdfTemplateId
  density: ResumePdfDensity
  accentPreset: ResumePdfAccentPreset
  headingStyle: ResumePdfHeadingStyle
}

export interface ResumePdfTemplateOption {
  id: ResumePdfTemplateId
  icon: string
  name: string
  description: string
  previewTitle: string
  previewSummary: string
  previewHighlights: string[]
}

export interface ResumePdfPreviewMeta {
  pageCount: number
  pageWidth: number
  pageHeights: number[]
}

export const RESUME_PDF_TEMPLATES: ResumePdfTemplateOption[] = [
  {
    id: 'default',
    icon: '◫',
    name: '系统默认',
    description: '稳健、清晰，适合大多数投递场景。',
    previewTitle: '系统默认',
    previewSummary: '适合常规投递场景，整体观感稳定，不会抢内容本身的注意力。',
    previewHighlights: ['信息平衡', '留白适中', '阅读稳定'],
  },
  {
    id: 'compact',
    icon: '▤',
    name: '紧凑模式',
    description: '压缩留白，适合内容较多的一页展示。',
    previewTitle: '紧凑模式',
    previewSummary: '适合内容偏多的简历，优先把第一页压实，减少大片留白。',
    previewHighlights: ['边距更小', '段距更短', '首页优先填充'],
  },
  {
    id: 'accent',
    icon: '✦',
    name: '蓝调重点',
    description: '强化标题和重点信息，视觉层次更明显。',
    previewTitle: '蓝调重点',
    previewSummary: '适合想强化模块层级和重点信息的简历，视觉记忆点会更强。',
    previewHighlights: ['蓝色标题', '重点前置', '层次更强'],
  },
  {
    id: 'campus-blue',
    icon: '▥',
    name: '校园技术蓝',
    description: '浅蓝分区栏、左置照片和分栏联系信息，适合校招技术简历。',
    previewTitle: '校园技术蓝',
    previewSummary: '参考优质校招简历的紧凑排版，让教育背景、项目经历和技术成果更易扫描。',
    previewHighlights: ['浅蓝分区栏', '照片左置', '联系分栏'],
  },
  {
    id: 'technical-black',
    icon: '▰',
    name: '黑白技术',
    description: '居中抬头、右置照片和多列经历标题，适合高密度技术简历。',
    previewTitle: '黑白技术',
    previewSummary: '参考高质量后端校招简历，用克制的黑白层级承载教育、实习、项目与科研成果。',
    previewHighlights: ['居中抬头', '多列经历', '高密度正文'],
  },
  {
    id: 'vibe-resume',
    icon: '▧',
    name: 'Vibe 高密技术',
    description: '蓝色分区线、浅色经历条和高密度技术要点，适合项目较多的技术简历。',
    previewTitle: 'Vibe 高密技术',
    previewSummary: '参考 Vibe Resume 的高密度技术版式，让公司、项目、技术动作与结果证据连续呈现。',
    previewHighlights: ['蓝色分区线', '浅色经历条', '技术要点密集'],
  },
  {
    id: 'minimal',
    icon: '—',
    name: '极简留白',
    description: '更克制的装饰和更平的层级，适合偏作品集式表达。',
    previewTitle: '极简留白',
    previewSummary: '适合内容本身已经很强的简历，减少修饰，让版面更安静。',
    previewHighlights: ['更少装饰', '层级更平', '版面更静'],
  },
  {
    id: 'executive',
    icon: '▮',
    name: '深色抬头',
    description: '头部更稳，标题更强，适合结果导向型项目内容。',
    previewTitle: '深色抬头',
    previewSummary: '适合项目和实习成果很扎实的简历，第一眼更有压住版面的感觉。',
    previewHighlights: ['抬头更重', '标题更稳', '成果导向'],
  },
  {
    id: 'warm',
    icon: '◔',
    name: '暖灰质感',
    description: '减少冷蓝色，整体更柔和，适合内容偏叙述型简历。',
    previewTitle: '暖灰质感',
    previewSummary: '适合内容偏完整叙述的简历，视觉更柔和，不那么工具化。',
    previewHighlights: ['暖灰配色', '语气更柔', '阅读顺滑'],
  },
  {
    id: 'slate',
    icon: '▦',
    name: '冷灰技术',
    description: '偏技术文档气质，压低装饰，突出结构与密度。',
    previewTitle: '冷灰技术',
    previewSummary: '适合后端、基础架构类简历，观感更像高质量技术文档。',
    previewHighlights: ['冷灰色系', '文档感强', '结构优先'],
  },
  {
    id: 'focus',
    icon: '◎',
    name: '重点聚焦',
    description: '加大关键信息对比，适合想突出经历亮点的场景。',
    previewTitle: '重点聚焦',
    previewSummary: '适合想把核心项目和关键能力快速抛给招聘方的简历。',
    previewHighlights: ['重点对比', '亮点更显', '扫描更快'],
  },
]

export const DEFAULT_RESUME_PDF_PREVIEW_CONFIG: ResumePdfPreviewConfig = {
  pageMode: 'standard',
  templateId: 'default',
  density: 'normal',
  accentPreset: 'auto',
  headingStyle: 'auto',
}

const RESUME_PDF_TEMPLATE_IDS = new Set<ResumePdfTemplateId>(RESUME_PDF_TEMPLATES.map((template) => template.id))
const RESUME_PDF_DENSITIES = new Set<ResumePdfDensity>(['normal', 'compact'])
const RESUME_PDF_ACCENT_PRESETS = new Set<ResumePdfAccentPreset>(['auto', 'blue', 'slate', 'warm', 'emerald'])
const RESUME_PDF_HEADING_STYLES = new Set<ResumePdfHeadingStyle>(['auto', 'underline', 'filled', 'bar'])

export function resolveResumePdfTemplateId(value: string | null | undefined): ResumePdfTemplateId {
  if (value && RESUME_PDF_TEMPLATE_IDS.has(value as ResumePdfTemplateId)) {
    return value as ResumePdfTemplateId
  }
  return 'default'
}

export function resolveResumePdfDensity(value: string | null | undefined): ResumePdfDensity {
  if (value && RESUME_PDF_DENSITIES.has(value as ResumePdfDensity)) {
    return value as ResumePdfDensity
  }
  return 'normal'
}

export function resolveResumePdfAccentPreset(value: string | null | undefined): ResumePdfAccentPreset {
  if (value && RESUME_PDF_ACCENT_PRESETS.has(value as ResumePdfAccentPreset)) {
    return value as ResumePdfAccentPreset
  }
  return 'auto'
}

export function resolveResumePdfHeadingStyle(value: string | null | undefined): ResumePdfHeadingStyle {
  if (value && RESUME_PDF_HEADING_STYLES.has(value as ResumePdfHeadingStyle)) {
    return value as ResumePdfHeadingStyle
  }
  return 'auto'
}

type ResolvedResumePdfTemplateId = Exclude<ResumePdfTemplateId, 'compact'>

interface ResolvedResumePdfThemeConfig {
  templateId: ResolvedResumePdfTemplateId
  density: ResumePdfDensity
  accentPreset: ResumePdfAccentPreset
  headingStyle: ResumePdfHeadingStyle
}

interface ResumePdfTheme {
  pagePadding: number
  baseFontSize: number
  titleSize: number
  subtitleSize: number
  lineHeight: number
  headerBottom: number
  headerRowGap: number
  headerRowBottom: number
  contactGap: number
  sectionGap: number
  itemGap: number
  sectionTitleSize: number
  sectionTitleBottom: number
  sectionTitlePaddingBottom: number
  sectionTitleColor: string
  sectionTitleBorderColor: string
  labelColor: string
  bodyColor: string
  mutedColor: string
  linkColor: string
  chipTextColor: string
  chipBackgroundColor: string
  paragraphTop: number
  listItemTop: number
  orderedIndent: number
  inlineMetaRowGap: number
  inlineMetaColumnGap: number
  inlineMetaItemRight: number
  inlineMetaItemBottom: number
  chipGap: number
  chipTop: number
  chipFontSize: number
  chipHorizontalPadding: number
  chipVerticalPadding: number
}

const COMPACT_DENSITY_BASELINE: Pick<
  ResumePdfTheme,
  | 'pagePadding'
  | 'baseFontSize'
  | 'titleSize'
  | 'subtitleSize'
  | 'lineHeight'
  | 'headerBottom'
  | 'headerRowGap'
  | 'headerRowBottom'
  | 'contactGap'
  | 'sectionGap'
  | 'itemGap'
  | 'sectionTitleSize'
  | 'sectionTitleBottom'
  | 'sectionTitlePaddingBottom'
  | 'paragraphTop'
  | 'listItemTop'
  | 'orderedIndent'
  | 'inlineMetaRowGap'
  | 'inlineMetaColumnGap'
  | 'inlineMetaItemRight'
  | 'inlineMetaItemBottom'
  | 'chipGap'
  | 'chipTop'
  | 'chipFontSize'
  | 'chipHorizontalPadding'
  | 'chipVerticalPadding'
> = {
  pagePadding: 18,
  baseFontSize: 9.8,
  titleSize: 12,
  subtitleSize: 11.1,
  lineHeight: 1.28,
  headerBottom: 8,
  headerRowGap: 10,
  headerRowBottom: 3,
  contactGap: 6,
  sectionGap: 7,
  itemGap: 4,
  sectionTitleSize: 11.8,
  sectionTitleBottom: 4,
  sectionTitlePaddingBottom: 2,
  paragraphTop: 2,
  listItemTop: 1,
  orderedIndent: 10,
  inlineMetaRowGap: 2,
  inlineMetaColumnGap: 8,
  inlineMetaItemRight: 8,
  inlineMetaItemBottom: 2,
  chipGap: 4,
  chipTop: 2,
  chipFontSize: 8,
  chipHorizontalPadding: 4,
  chipVerticalPadding: 1.5,
}

function getResolvedResumePdfThemeConfig(options?: Pick<ResumePdfOptions, 'templateId' | 'density' | 'accentPreset' | 'headingStyle'>): ResolvedResumePdfThemeConfig {
  const rawTemplateId = options?.templateId ?? DEFAULT_RESUME_PDF_PREVIEW_CONFIG.templateId
  return {
    templateId: rawTemplateId === 'compact' ? 'default' : rawTemplateId,
    density: options?.density ?? (rawTemplateId === 'compact' ? 'compact' : DEFAULT_RESUME_PDF_PREVIEW_CONFIG.density),
    accentPreset: options?.accentPreset ?? DEFAULT_RESUME_PDF_PREVIEW_CONFIG.accentPreset,
    headingStyle: options?.headingStyle ?? DEFAULT_RESUME_PDF_PREVIEW_CONFIG.headingStyle,
  }
}

function getBaseResumePdfTheme(templateId: ResolvedResumePdfTemplateId): ResumePdfTheme {
  switch (templateId) {
    case 'vibe-resume':
      return {
        pagePadding: 22,
        baseFontSize: 9.4,
        titleSize: 18,
        subtitleSize: 10.2,
        lineHeight: 1.31,
        headerBottom: 7,
        headerRowGap: 7,
        headerRowBottom: 3,
        contactGap: 6,
        sectionGap: 6,
        itemGap: 4,
        sectionTitleSize: 13.2,
        sectionTitleBottom: 4,
        sectionTitlePaddingBottom: 2,
        sectionTitleColor: '#1768e5',
        sectionTitleBorderColor: '#2f7df0',
        labelColor: '#173a86',
        bodyColor: '#171717',
        mutedColor: '#5f6672',
        linkColor: '#1768e5',
        chipTextColor: '#173a86',
        chipBackgroundColor: '#eef6ff',
        paragraphTop: 2,
        listItemTop: 1,
        orderedIndent: 9,
        inlineMetaRowGap: 2,
        inlineMetaColumnGap: 7,
        inlineMetaItemRight: 7,
        inlineMetaItemBottom: 1,
        chipGap: 3,
        chipTop: 1,
        chipFontSize: 7.8,
        chipHorizontalPadding: 4,
        chipVerticalPadding: 1.2,
      }
    case 'technical-black':
      return {
        pagePadding: 20,
        baseFontSize: 9.7,
        titleSize: 20,
        subtitleSize: 10.5,
        lineHeight: 1.34,
        headerBottom: 7,
        headerRowGap: 8,
        headerRowBottom: 3,
        contactGap: 7,
        sectionGap: 6,
        itemGap: 4,
        sectionTitleSize: 12.4,
        sectionTitleBottom: 4,
        sectionTitlePaddingBottom: 2,
        sectionTitleColor: '#111111',
        sectionTitleBorderColor: '#111111',
        labelColor: '#262626',
        bodyColor: '#333333',
        mutedColor: '#4b4b4b',
        linkColor: '#1268d6',
        chipTextColor: '#1268d6',
        chipBackgroundColor: '#e8f2ff',
        paragraphTop: 2,
        listItemTop: 1,
        orderedIndent: 9,
        inlineMetaRowGap: 2,
        inlineMetaColumnGap: 7,
        inlineMetaItemRight: 7,
        inlineMetaItemBottom: 1,
        chipGap: 3,
        chipTop: 1,
        chipFontSize: 7.8,
        chipHorizontalPadding: 4,
        chipVerticalPadding: 1.2,
      }
    case 'campus-blue':
      return {
        pagePadding: 18,
        baseFontSize: 10.2,
        titleSize: 21,
        subtitleSize: 10.8,
        lineHeight: 1.32,
        headerBottom: 8,
        headerRowGap: 10,
        headerRowBottom: 3,
        contactGap: 6,
        sectionGap: 7,
        itemGap: 4,
        sectionTitleSize: 12.5,
        sectionTitleBottom: 5,
        sectionTitlePaddingBottom: 0,
        sectionTitleColor: '#164f9c',
        sectionTitleBorderColor: '#bed0eb',
        labelColor: '#1f2937',
        bodyColor: '#20262e',
        mutedColor: '#475569',
        linkColor: '#1b58ad',
        chipTextColor: '#164f9c',
        chipBackgroundColor: '#e3ebf8',
        paragraphTop: 2,
        listItemTop: 1,
        orderedIndent: 10,
        inlineMetaRowGap: 2,
        inlineMetaColumnGap: 8,
        inlineMetaItemRight: 8,
        inlineMetaItemBottom: 2,
        chipGap: 4,
        chipTop: 2,
        chipFontSize: 8,
        chipHorizontalPadding: 4,
        chipVerticalPadding: 1.4,
      }
    case 'minimal':
      return {
        pagePadding: 30,
        baseFontSize: 10.9,
        titleSize: 12.7,
        subtitleSize: 11.9,
        lineHeight: 1.48,
        headerBottom: 16,
        headerRowGap: 14,
        headerRowBottom: 6,
        contactGap: 10,
        sectionGap: 14,
        itemGap: 8,
        sectionTitleSize: 12.2,
        sectionTitleBottom: 5,
        sectionTitlePaddingBottom: 3,
        sectionTitleColor: '#111827',
        sectionTitleBorderColor: '#f1f5f9',
        labelColor: '#6b7280',
        bodyColor: '#111827',
        mutedColor: '#6b7280',
        linkColor: '#2563eb',
        chipTextColor: '#475569',
        chipBackgroundColor: '#f8fafc',
        paragraphTop: 4,
        listItemTop: 2,
        orderedIndent: 13,
        inlineMetaRowGap: 4,
        inlineMetaColumnGap: 12,
        inlineMetaItemRight: 12,
        inlineMetaItemBottom: 4,
        chipGap: 5,
        chipTop: 3,
        chipFontSize: 8.4,
        chipHorizontalPadding: 5,
        chipVerticalPadding: 1.8,
      }
    case 'executive':
      return {
        pagePadding: 26,
        baseFontSize: 10.9,
        titleSize: 14.2,
        subtitleSize: 12.4,
        lineHeight: 1.45,
        headerBottom: 14,
        headerRowGap: 16,
        headerRowBottom: 6,
        contactGap: 9,
        sectionGap: 11,
        itemGap: 7,
        sectionTitleSize: 12.8,
        sectionTitleBottom: 6,
        sectionTitlePaddingBottom: 4,
        sectionTitleColor: '#0f172a',
        sectionTitleBorderColor: '#cbd5e1',
        labelColor: '#334155',
        bodyColor: '#111827',
        mutedColor: '#475569',
        linkColor: '#1d4ed8',
        chipTextColor: '#0f172a',
        chipBackgroundColor: '#e2e8f0',
        paragraphTop: 4,
        listItemTop: 2,
        orderedIndent: 14,
        inlineMetaRowGap: 4,
        inlineMetaColumnGap: 12,
        inlineMetaItemRight: 12,
        inlineMetaItemBottom: 4,
        chipGap: 6,
        chipTop: 4,
        chipFontSize: 8.8,
        chipHorizontalPadding: 6,
        chipVerticalPadding: 2,
      }
    case 'warm':
      return {
        pagePadding: 28,
        baseFontSize: 11,
        titleSize: 13.2,
        subtitleSize: 12.2,
        lineHeight: 1.5,
        headerBottom: 14,
        headerRowGap: 16,
        headerRowBottom: 6,
        contactGap: 10,
        sectionGap: 12,
        itemGap: 8,
        sectionTitleSize: 12.7,
        sectionTitleBottom: 6,
        sectionTitlePaddingBottom: 4,
        sectionTitleColor: '#92400e',
        sectionTitleBorderColor: '#f3e8d8',
        labelColor: '#78716c',
        bodyColor: '#292524',
        mutedColor: '#57534e',
        linkColor: '#b45309',
        chipTextColor: '#9a3412',
        chipBackgroundColor: '#ffedd5',
        paragraphTop: 4,
        listItemTop: 2,
        orderedIndent: 14,
        inlineMetaRowGap: 4,
        inlineMetaColumnGap: 12,
        inlineMetaItemRight: 12,
        inlineMetaItemBottom: 4,
        chipGap: 6,
        chipTop: 4,
        chipFontSize: 9,
        chipHorizontalPadding: 6,
        chipVerticalPadding: 2,
      }
    case 'slate':
      return {
        pagePadding: 24,
        baseFontSize: 10.5,
        titleSize: 12.6,
        subtitleSize: 11.8,
        lineHeight: 1.36,
        headerBottom: 10,
        headerRowGap: 12,
        headerRowBottom: 4,
        contactGap: 7,
        sectionGap: 9,
        itemGap: 5,
        sectionTitleSize: 12,
        sectionTitleBottom: 4,
        sectionTitlePaddingBottom: 2,
        sectionTitleColor: '#334155',
        sectionTitleBorderColor: '#cbd5e1',
        labelColor: '#475569',
        bodyColor: '#0f172a',
        mutedColor: '#64748b',
        linkColor: '#2563eb',
        chipTextColor: '#475569',
        chipBackgroundColor: '#e2e8f0',
        paragraphTop: 3,
        listItemTop: 1,
        orderedIndent: 11,
        inlineMetaRowGap: 2,
        inlineMetaColumnGap: 8,
        inlineMetaItemRight: 8,
        inlineMetaItemBottom: 2,
        chipGap: 4,
        chipTop: 2,
        chipFontSize: 8.2,
        chipHorizontalPadding: 5,
        chipVerticalPadding: 1.6,
      }
    case 'focus':
      return {
        pagePadding: 26,
        baseFontSize: 11,
        titleSize: 13.6,
        subtitleSize: 12.4,
        lineHeight: 1.44,
        headerBottom: 14,
        headerRowGap: 16,
        headerRowBottom: 5,
        contactGap: 9,
        sectionGap: 11,
        itemGap: 7,
        sectionTitleSize: 12.9,
        sectionTitleBottom: 6,
        sectionTitlePaddingBottom: 4,
        sectionTitleColor: '#1e3a8a',
        sectionTitleBorderColor: '#dbeafe',
        labelColor: '#334155',
        bodyColor: '#0f172a',
        mutedColor: '#475569',
        linkColor: '#1d4ed8',
        chipTextColor: '#1d4ed8',
        chipBackgroundColor: '#dbeafe',
        paragraphTop: 4,
        listItemTop: 2,
        orderedIndent: 14,
        inlineMetaRowGap: 4,
        inlineMetaColumnGap: 12,
        inlineMetaItemRight: 12,
        inlineMetaItemBottom: 4,
        chipGap: 6,
        chipTop: 4,
        chipFontSize: 8.9,
        chipHorizontalPadding: 6,
        chipVerticalPadding: 2,
      }
    case 'accent':
      return {
        pagePadding: 28,
        baseFontSize: 11.1,
        titleSize: 13.8,
        subtitleSize: 12.6,
        lineHeight: 1.5,
        headerBottom: 14,
        headerRowGap: 16,
        headerRowBottom: 6,
        contactGap: 10,
        sectionGap: 12,
        itemGap: 8,
        sectionTitleSize: 13,
        sectionTitleBottom: 6,
        sectionTitlePaddingBottom: 4,
        sectionTitleColor: '#1d4ed8',
        sectionTitleBorderColor: '#bfdbfe',
        labelColor: '#334155',
        bodyColor: '#0f172a',
        mutedColor: '#475569',
        linkColor: '#1d4ed8',
        chipTextColor: '#1e40af',
        chipBackgroundColor: '#dbeafe',
        paragraphTop: 4,
        listItemTop: 2,
        orderedIndent: 14,
        inlineMetaRowGap: 4,
        inlineMetaColumnGap: 12,
        inlineMetaItemRight: 12,
        inlineMetaItemBottom: 4,
        chipGap: 6,
        chipTop: 4,
        chipFontSize: 9,
        chipHorizontalPadding: 6,
        chipVerticalPadding: 2,
      }
    case 'default':
    default:
      return {
        pagePadding: 28,
        baseFontSize: 11.2,
        titleSize: 13,
        subtitleSize: 12.5,
        lineHeight: 1.5,
        headerBottom: 14,
        headerRowGap: 16,
        headerRowBottom: 6,
        contactGap: 10,
        sectionGap: 12,
        itemGap: 8,
        sectionTitleSize: 13,
        sectionTitleBottom: 6,
        sectionTitlePaddingBottom: 4,
        sectionTitleColor: '#0f172a',
        sectionTitleBorderColor: '#e5e7eb',
        labelColor: '#475569',
        bodyColor: '#0f172a',
        mutedColor: '#4b5563',
        linkColor: '#2563eb',
        chipTextColor: '#2563eb',
        chipBackgroundColor: '#eff6ff',
        paragraphTop: 4,
        listItemTop: 2,
        orderedIndent: 14,
        inlineMetaRowGap: 4,
        inlineMetaColumnGap: 12,
        inlineMetaItemRight: 12,
        inlineMetaItemBottom: 4,
        chipGap: 6,
        chipTop: 4,
        chipFontSize: 9,
        chipHorizontalPadding: 6,
        chipVerticalPadding: 2,
      }
  }
}

function applyDensityToResumePdfTheme(theme: ResumePdfTheme, density: ResumePdfDensity): ResumePdfTheme {
  if (density !== 'compact') {
    return theme
  }

  return {
    ...theme,
    pagePadding: COMPACT_DENSITY_BASELINE.pagePadding,
    baseFontSize: COMPACT_DENSITY_BASELINE.baseFontSize,
    titleSize: COMPACT_DENSITY_BASELINE.titleSize,
    subtitleSize: COMPACT_DENSITY_BASELINE.subtitleSize,
    lineHeight: COMPACT_DENSITY_BASELINE.lineHeight,
    headerBottom: COMPACT_DENSITY_BASELINE.headerBottom,
    headerRowGap: COMPACT_DENSITY_BASELINE.headerRowGap,
    headerRowBottom: COMPACT_DENSITY_BASELINE.headerRowBottom,
    contactGap: COMPACT_DENSITY_BASELINE.contactGap,
    sectionGap: COMPACT_DENSITY_BASELINE.sectionGap,
    itemGap: COMPACT_DENSITY_BASELINE.itemGap,
    sectionTitleSize: COMPACT_DENSITY_BASELINE.sectionTitleSize,
    sectionTitleBottom: COMPACT_DENSITY_BASELINE.sectionTitleBottom,
    sectionTitlePaddingBottom: COMPACT_DENSITY_BASELINE.sectionTitlePaddingBottom,
    paragraphTop: COMPACT_DENSITY_BASELINE.paragraphTop,
    listItemTop: COMPACT_DENSITY_BASELINE.listItemTop,
    orderedIndent: COMPACT_DENSITY_BASELINE.orderedIndent,
    inlineMetaRowGap: COMPACT_DENSITY_BASELINE.inlineMetaRowGap,
    inlineMetaColumnGap: COMPACT_DENSITY_BASELINE.inlineMetaColumnGap,
    inlineMetaItemRight: COMPACT_DENSITY_BASELINE.inlineMetaItemRight,
    inlineMetaItemBottom: COMPACT_DENSITY_BASELINE.inlineMetaItemBottom,
    chipGap: COMPACT_DENSITY_BASELINE.chipGap,
    chipTop: COMPACT_DENSITY_BASELINE.chipTop,
    chipFontSize: COMPACT_DENSITY_BASELINE.chipFontSize,
    chipHorizontalPadding: COMPACT_DENSITY_BASELINE.chipHorizontalPadding,
    chipVerticalPadding: COMPACT_DENSITY_BASELINE.chipVerticalPadding,
  }
}

function applyAccentPresetToResumePdfTheme(theme: ResumePdfTheme, accentPreset: ResumePdfAccentPreset): ResumePdfTheme {
  if (accentPreset === 'auto') {
    return theme
  }

  const accentPalette = {
    blue: {
      accent: '#1d4ed8',
      accentStrong: '#1e3a8a',
      accentSoft: '#dbeafe',
      accentBorder: '#bfdbfe',
    },
    slate: {
      accent: '#475569',
      accentStrong: '#334155',
      accentSoft: '#e2e8f0',
      accentBorder: '#cbd5e1',
    },
    warm: {
      accent: '#b45309',
      accentStrong: '#92400e',
      accentSoft: '#ffedd5',
      accentBorder: '#fed7aa',
    },
    emerald: {
      accent: '#059669',
      accentStrong: '#065f46',
      accentSoft: '#d1fae5',
      accentBorder: '#a7f3d0',
    },
  }[accentPreset]

  return {
    ...theme,
    sectionTitleColor: accentPalette.accentStrong,
    sectionTitleBorderColor: accentPalette.accentBorder,
    linkColor: accentPalette.accent,
    chipTextColor: accentPalette.accentStrong,
    chipBackgroundColor: accentPalette.accentSoft,
  }
}

function getResumePdfTheme(config: ResolvedResumePdfThemeConfig): ResumePdfTheme {
  const baseTheme = getBaseResumePdfTheme(config.templateId)
  return applyAccentPresetToResumePdfTheme(applyDensityToResumePdfTheme(baseTheme, config.density), config.accentPreset)
}

function createResumePdfStyles(theme: ResumePdfTheme) {
  return StyleSheet.create({
    page: {
      padding: theme.pagePadding,
      fontSize: theme.baseFontSize,
      color: theme.bodyColor,
      lineHeight: theme.lineHeight,
      fontFamily: 'ResumePdfSans',
    },
    header: {
      marginBottom: theme.headerBottom,
    },
    headerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.headerRowGap,
      marginBottom: theme.headerRowBottom,
    },
    title: {
      fontSize: theme.titleSize,
      fontWeight: 700,
    },
    subtitle: {
      fontSize: theme.subtitleSize,
      color: theme.bodyColor,
    },
    contactRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.contactGap,
      color: theme.mutedColor,
    },
    topSectionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
    },
    topSectionMain: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
    },
    topSectionPhotoColumn: {
      flexShrink: 0,
      alignItems: 'flex-end',
    },
    photoFrame: {
      overflow: 'hidden',
      backgroundColor: '#f8fafc',
    },
    photoImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    section: {
      marginBottom: theme.sectionGap,
    },
    sectionTitle: {
      fontSize: theme.sectionTitleSize,
      fontWeight: 700,
      marginBottom: theme.sectionTitleBottom,
      paddingBottom: theme.sectionTitlePaddingBottom,
      color: theme.sectionTitleColor,
      borderBottomWidth: 1,
      borderBottomColor: theme.sectionTitleBorderColor,
    },
    item: {
      marginBottom: theme.itemGap,
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    strong: {
      fontWeight: 700,
    },
    label: {
      color: theme.labelColor,
      fontWeight: 700,
    },
    muted: {
      color: theme.mutedColor,
    },
    wrappedTextRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: theme.paragraphTop > 0 ? Math.min(theme.paragraphTop, 2) : 0,
    },
    orderedItem: {
      marginTop: theme.listItemTop,
      marginLeft: theme.orderedIndent,
    },
    inlineMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: theme.inlineMetaRowGap,
      columnGap: theme.inlineMetaColumnGap,
    },
    inlineMetaItem: {
      marginRight: theme.inlineMetaItemRight,
      marginBottom: theme.inlineMetaItemBottom,
    },
    awardGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    awardGridItem: {
      width: '50%',
      flexDirection: 'row',
      paddingRight: 8,
      marginTop: theme.listItemTop,
    },
    awardBullet: {
      width: 8,
    },
    awardGridText: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.chipGap,
      marginTop: theme.chipTop,
    },
    chip: {
      fontSize: theme.chipFontSize,
      color: theme.chipTextColor,
      backgroundColor: theme.chipBackgroundColor,
      paddingHorizontal: theme.chipHorizontalPadding,
      paddingVertical: theme.chipVerticalPadding,
      borderRadius: 999,
    },
    paragraph: {
      marginTop: theme.paragraphTop,
      whiteSpace: 'pre-wrap',
    },
    listItem: {
      marginTop: theme.listItemTop,
    },
    link: {
      color: theme.linkColor,
      textDecoration: 'none',
    },
  })
}

const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89

function sortModules(modules: ResumeModule[]) {
  return sortResumeModulesForDisplay(modules)
}

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function estimateContinuousPageHeight(modules: ResumeModule[]) {
  const sortedModules = sortModules(modules)
  let textVolume = 0
  let bulletCount = 0
  let moduleCount = 0
  let hasPhoto = false

  for (const module of sortedModules) {
    moduleCount += 1

    if (module.moduleType === 'basic_info') {
      const content = normalizeBasicInfoContent(module.content)
      hasPhoto = Boolean(normalizePhotoSource(content.photo))
      textVolume += textLengthForPage([content.name, content.jobIntention, content.email, content.phone, content.wechat, content.github, content.blog])
      continue
    }

    if (module.moduleType === 'education') {
      const content = normalizeEducationContent(module.content)
      textVolume += textLengthForPage([content.school, content.department, content.major, content.degree])
      continue
    }

    if (module.moduleType === 'internship' || module.moduleType === 'work_experience') {
      const content = normalizeInternshipContent(module.content)
      textVolume += textLengthForPage([
        content.company,
        content.position,
        ...content.projects.flatMap((project) => [project.projectName, project.role, project.projectDescription, project.techStack, ...project.responsibilities]),
      ])
      bulletCount += content.projects.reduce((count, project) => count + project.responsibilities.length, 0)
      continue
    }

    if (module.moduleType === 'project') {
      const content = normalizeProjectContent(module.content)
      textVolume += textLengthForPage([content.projectName, content.role, content.description, content.techStack, ...content.achievements])
      bulletCount += content.achievements.length
      continue
    }

    if (module.moduleType === 'skill') {
      const content = normalizeSkillContent(module.content)
      textVolume += textLengthForPage(
        content.categories.flatMap((category) => [
          category.name,
          ...category.items.filter((item) => item.trim().length > 0),
        ])
      )
      continue
    }

    if (module.moduleType === 'research') {
      const content = normalizeResearchContent(module.content)
      textVolume += textLengthForPage([content.projectName, content.projectCycle, content.background, content.workContent, content.achievements])
      continue
    }

    if (module.moduleType === 'paper') {
      const content = normalizePaperContent(module.content)
      textVolume += textLengthForPage([content.journalName, content.journalType, content.publishTime, content.content])
      continue
    }

    if (module.moduleType === 'award') {
      const content = normalizeAwardContent(module.content)
      textVolume += textLengthForPage([content.awardName, content.awardTime])
    }
  }

  const estimated = 220 + moduleCount * 46 + bulletCount * 18 + textVolume * 0.34 + (hasPhoto ? 96 : 0)
  return Math.max(A4_HEIGHT * 1.15, Math.min(A4_HEIGHT * 4.2, estimated))
}

function textLengthForPage(values: string[]) {
  return values.reduce((sum, value) => sum + normalizeWhitespace(value).length, 0)
}

function formatMonth(value: string) {
  if (!value) return ''
  const [year, month] = value.split('-')
  if (!year || !month) return value
  return `${year}年${Number(month)}月`
}

function formatMonthRange(start: string, end: string) {
  const startText = formatMonth(start)
  const endText = formatMonth(end)
  if (startText && endText) return `${startText} - ${endText}`
  return startText || endText
}

function formatTechnicalMonth(value: string) {
  if (!value) return ''
  const [year, month] = value.split('-')
  if (!year || !month) return value
  return `${year}.${month}`
}

function formatTechnicalMonthRange(start: string, end: string) {
  const startText = formatTechnicalMonth(start)
  const endText = formatTechnicalMonth(end)
  if (startText && endText) return `${startText}-${endText}`
  return startText || endText
}

function tokenizeMixedText(value: string) {
  const rawTokens = value.match(/[\u3400-\u9fff\uf900-\ufaff，。；：？！、】【（）]|[A-Za-z0-9+#./:_-]+|\s+|./g) || []
  const attachToPrevious = new Set(['，', '。', '；', '：', '？', '！', '、', ',', '.', ';', ':', '?', '!', '）', '】', ')', ']'])
  const attachToNext = new Set(['（', '【', '(', '['])
  const mergedTokens: string[] = []
  let pendingPrefix = ''

  for (const token of rawTokens) {
    if (attachToNext.has(token)) {
      pendingPrefix += token
      continue
    }

    if (attachToPrevious.has(token)) {
      let targetIndex = mergedTokens.length - 1
      while (targetIndex >= 0 && /^\s+$/.test(mergedTokens[targetIndex])) {
        targetIndex -= 1
      }

      if (targetIndex >= 0) {
        mergedTokens[targetIndex] += token
      } else {
        pendingPrefix += token
      }
      continue
    }

    if (/^\s+$/.test(token)) {
      if (pendingPrefix) {
        mergedTokens.push(pendingPrefix)
        pendingPrefix = ''
      }
      mergedTokens.push(token)
      continue
    }

    mergedTokens.push(`${pendingPrefix}${token}`)
    pendingPrefix = ''
  }

  if (pendingPrefix) {
    mergedTokens.push(pendingPrefix)
  }

  return mergedTokens
}

function renderWrappedLabeledText(
  styles: ReturnType<typeof createResumePdfStyles>,
  label: string,
  value: string,
  keyPrefix: string
) {
  return (
    <View style={styles.wrappedTextRow}>
      <Text style={styles.label}>{label}</Text>
      {tokenizeMixedText(value).map((token, index) => (
        <Text key={`${keyPrefix}-${index}`}>{token}</Text>
      ))}
    </View>
  )
}

function renderInlineMarkdownTokens(
  styles: ReturnType<typeof createResumePdfStyles>,
  value: string,
  keyPrefix: string
) {
  return parseInlineMarkdownSegments(value).flatMap((segment, segmentIndex) =>
    tokenizeMixedText(segment.text).map((token, tokenIndex) => (
      <Text
        key={`${keyPrefix}-${segmentIndex}-${tokenIndex}`}
        style={segment.bold ? styles.strong : undefined}
      >
        {token}
      </Text>
    ))
  )
}

function renderOrderedItem(
  styles: ReturnType<typeof createResumePdfStyles>,
  value: string,
  index: number,
  keyPrefix: string
) {
  return (
    <View style={styles.orderedItem}>
      <View style={styles.wrappedTextRow}>
        <Text>{`${index + 1}、`}</Text>
        {renderInlineMarkdownTokens(styles, value, keyPrefix)}
      </View>
    </View>
  )
}

function renderBulletItem(
  styles: ReturnType<typeof createResumePdfStyles>,
  value: string,
  keyPrefix: string
) {
  return (
    <View style={styles.orderedItem}>
      <View style={styles.wrappedTextRow}>
        <Text>• </Text>
        {renderInlineMarkdownTokens(styles, value, keyPrefix)}
      </View>
    </View>
  )
}

function normalizeExternalUrl(value: string) {
  if (!value) return ''
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function sanitizePdfFileNamePart(value: string) {
  return value
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim()
}

function buildFileName(modules: ResumeModule[], resumeId?: number, options?: ResumePdfOptions) {
  const basicInfoModule = modules.find((module) => module.moduleType === 'basic_info')
  const educationModule = modules.find((module) => module.moduleType === 'education')
  const jobIntentionModule = modules.find((module) => module.moduleType === 'job_intention')
  const basicInfo = basicInfoModule ? normalizeBasicInfoContent(basicInfoModule.content) : null
  const education = educationModule ? normalizeEducationContent(educationModule.content) : null
  const jobIntention = jobIntentionModule ? normalizeJobIntentionContent(jobIntentionModule.content) : null

  const segments = [
    basicInfo?.name.trim() || '',
    education?.school.trim() || '',
    basicInfo?.jobIntention.trim() || jobIntention?.targetPosition.trim() || '',
  ]
    .filter(Boolean)
    .map(sanitizePdfFileNamePart)

  const preferredTitle = sanitizePdfFileNamePart(options?.documentTitle ?? '')
  const baseName = preferredTitle || segments.join('-') || (resumeId ? `resume-${resumeId}` : '派简历')
  const suffixPart = sanitizePdfFileNamePart(options?.fileNameSuffix ?? '')
  const suffix = suffixPart ? `-${suffixPart}` : ''
  return `${baseName}${suffix}.pdf`
}

function getResumePdfSectionHeadingVariant(
  templateId: ResolvedResumePdfTemplateId,
  headingStyle: ResumePdfHeadingStyle
): Exclude<ResumePdfHeadingStyle, 'auto'> {
  if (headingStyle !== 'auto') {
    return headingStyle
  }

  switch (templateId) {
    case 'campus-blue':
      return 'filled'
    case 'vibe-resume':
    case 'technical-black':
      return 'underline'
    case 'executive':
    case 'slate':
      return 'filled'
    case 'focus':
      return 'bar'
    case 'default':
    case 'accent':
    case 'minimal':
    case 'warm':
    default:
      return 'underline'
  }
}

function ResumePdfDocument({
  modules,
  documentTitle,
  pageSize = 'A4',
  templateId = 'default',
  density = DEFAULT_RESUME_PDF_PREVIEW_CONFIG.density,
  accentPreset = DEFAULT_RESUME_PDF_PREVIEW_CONFIG.accentPreset,
  headingStyle = DEFAULT_RESUME_PDF_PREVIEW_CONFIG.headingStyle,
  onRender,
}: {
  modules: ResumeModule[]
  documentTitle: string
  pageSize?: 'A4' | [number, number]
  templateId?: ResumePdfTemplateId
  density?: ResumePdfDensity
  accentPreset?: ResumePdfAccentPreset
  headingStyle?: ResumePdfHeadingStyle
  onRender?: (props: unknown) => void
}) {
  const resolvedThemeConfig = getResolvedResumePdfThemeConfig({ templateId, density, accentPreset, headingStyle })
  const theme = getResumePdfTheme(resolvedThemeConfig)
  const styles = createResumePdfStyles(theme)
  const isCompactDensity = resolvedThemeConfig.density === 'compact'
  const isCampusBlue = resolvedThemeConfig.templateId === 'campus-blue'
  const isTechnicalBlack = resolvedThemeConfig.templateId === 'technical-black'
  const isVibeResume = resolvedThemeConfig.templateId === 'vibe-resume'
  const isMinimal = resolvedThemeConfig.templateId === 'minimal'
  const isExecutive = resolvedThemeConfig.templateId === 'executive'
  const isSlate = resolvedThemeConfig.templateId === 'slate'
  const sectionHeadingVariant = getResumePdfSectionHeadingVariant(
    resolvedThemeConfig.templateId,
    resolvedThemeConfig.headingStyle
  )
  const sortedModules = sortModules(modules)
  const basicInfoModule = sortedModules.find((module) => module.moduleType === 'basic_info')
  const basicInfo = basicInfoModule ? normalizeBasicInfoContent(basicInfoModule.content) : null
  const photoSource = normalizePhotoSource(basicInfo?.photo)
  const hasPhoto = Boolean(photoSource)
  const hasPhotoBorder = Boolean(basicInfo?.photoBorder)
  const jobIntentionModule = sortedModules.find((module) => module.moduleType === 'job_intention')
  const jobIntention = jobIntentionModule ? normalizeJobIntentionContent(jobIntentionModule.content) : null
  const displayJobIntention = basicInfo?.jobIntention || jobIntention?.targetPosition || ''
  const internshipSectionTitle = getModuleDisplayLabel('internship')
  const workExperienceSectionTitle = getModuleDisplayLabel('work_experience')
  const educationModules = sortedModules.filter((module) => module.moduleType === 'education')
  const firstContentModuleType = sortedModules.find((module) => module.moduleType !== 'basic_info')?.moduleType
  const useCompactPhotoEducationLayout = isCompactDensity
    && hasPhoto
    && !isCampusBlue
    && !isTechnicalBlack
    && !isVibeResume
    && educationModules.length > 0
    && firstContentModuleType === 'education'
  const internshipModules = sortedModules.filter((module) => module.moduleType === 'internship')
  const workExperienceModules = sortedModules.filter((module) => module.moduleType === 'work_experience')
  const firstInternshipModuleId = internshipModules[0]?.id ?? null
  const firstWorkExperienceModuleId = workExperienceModules[0]?.id ?? null
  const projectModules = sortedModules.filter((module) => module.moduleType === 'project')
  const firstProjectModuleId = projectModules[0]?.id ?? null
  const awardModules = sortedModules
    .filter((module) => module.moduleType === 'award')
    .map((module) => normalizeAwardContent(module.content))
    .filter((award) => award.awardName || award.awardTime)
  const firstAwardModuleId = sortedModules.find((module) => module.moduleType === 'award')?.id ?? null
  const headerContainerStyle = [
    styles.header,
    ...(isExecutive ? [{ backgroundColor: theme.sectionTitleColor, padding: 14, marginBottom: 16 }] : []),
    ...(isMinimal ? [{ marginBottom: 18 }] : []),
  ]
  const headerTitleStyle = [
    styles.title,
    ...(isExecutive ? [{ color: '#f8fafc' }] : []),
  ]
  const headerSubtitleStyle = [
    styles.subtitle,
    ...(isExecutive ? [{ color: '#e2e8f0' }] : []),
  ]
  const headerLabelStyle = [
    styles.label,
    ...(isExecutive ? [{ color: theme.sectionTitleBorderColor }] : []),
  ]
  const headerContactStyle = [
    styles.contactRow,
    ...(isExecutive ? [{ color: '#e2e8f0' }] : []),
  ]
  const headerLinkStyle = [
    styles.link,
    ...(isExecutive ? [{ color: '#ffffff' }] : []),
  ]
  const sectionStyle = [
    styles.section,
    ...(isSlate && resolvedThemeConfig.headingStyle === 'auto' ? [{ backgroundColor: '#f8fafc', padding: 8 }] : []),
  ]
  const sectionBarContentStyle = sectionHeadingVariant === 'bar'
    ? [{ borderLeftWidth: 3, borderLeftColor: theme.linkColor, paddingLeft: 10 }]
    : []
  const sectionTitleStyle = [
    styles.sectionTitle,
    ...(isVibeResume && resolvedThemeConfig.headingStyle === 'auto'
      ? [{ borderBottomWidth: 2, color: theme.sectionTitleColor, paddingBottom: 2, marginBottom: 5 }]
      : []),
    ...(sectionHeadingVariant === 'underline' && isMinimal && resolvedThemeConfig.headingStyle === 'auto'
      ? [{ borderBottomWidth: 0, paddingBottom: 0, marginBottom: 4, color: '#111827' }]
      : []),
    ...(sectionHeadingVariant === 'filled'
      ? [{
          backgroundColor: (resolvedThemeConfig.templateId === 'slate' || isCampusBlue) && resolvedThemeConfig.headingStyle === 'auto'
            ? theme.chipBackgroundColor
            : theme.sectionTitleColor,
          color: (resolvedThemeConfig.templateId === 'slate' || isCampusBlue) && resolvedThemeConfig.headingStyle === 'auto'
            ? theme.sectionTitleColor
            : '#f8fafc',
          paddingHorizontal: isCampusBlue ? 10 : 8,
          paddingVertical: isCampusBlue ? 3 : 4,
          borderBottomWidth: 0,
          borderLeftWidth: isCampusBlue ? 2.5 : 0,
          borderLeftColor: isCampusBlue ? theme.linkColor : theme.sectionTitleColor,
          marginBottom: isCampusBlue ? 5 : 8,
        }]
      : []),
    ...(sectionHeadingVariant === 'bar'
      ? [{ color: theme.linkColor, borderBottomWidth: 0, paddingBottom: 0, marginBottom: 6 }]
      : []),
  ]
  const photoFrameWidth = isCampusBlue ? 70 : (isCompactDensity ? 82 : 96)
  const photoFrameHeight = Math.round(photoFrameWidth * 4 / 3)
  const topSectionWithPhotoStyle = {
    marginBottom: educationModules.length > 0 ? theme.sectionGap : Math.max(theme.headerBottom, 10),
  }
  const splitPhotoFrameStyle = [
    styles.photoFrame,
    {
      width: photoFrameWidth,
      height: photoFrameHeight,
    },
    ...(hasPhotoBorder
      ? [{
          borderWidth: 1,
          borderColor: isExecutive ? '#e2e8f0' : theme.linkColor,
        }]
      : []),
  ]
  const campusBlueContactItems: Array<{ label: string; value: string; href?: string }> = basicInfo
    ? [
        { label: '电话：', value: basicInfo.phone },
        { label: '邮箱：', value: basicInfo.email },
        { label: '工作年限：', value: basicInfo.workYears },
        { label: '微信：', value: basicInfo.wechat },
        { label: '籍贯：', value: basicInfo.hometown },
        { label: '求职意向：', value: displayJobIntention },
        { label: '意向城市：', value: basicInfo.targetCity },
        { label: '政治面貌：', value: basicInfo.politicalStatusMasked ? 'xx' : basicInfo.isPartyMember ? '党员' : '' },
        { label: 'GitHub：', value: basicInfo.github, href: basicInfo.privacyMasked ? undefined : normalizeExternalUrl(basicInfo.github) },
        { label: '博客：', value: basicInfo.blog, href: basicInfo.privacyMasked ? undefined : normalizeExternalUrl(basicInfo.blog) },
        { label: 'LeetCode：', value: basicInfo.leetcode },
      ].filter((item) => Boolean(item.value))
    : []
  const renderSectionBlock = (
    key: string | number,
    title: string,
    children: ReactNode,
    styleOverrides: Array<{ marginBottom?: number }> = []
  ) => (
    <View key={key} style={[...sectionStyle, ...styleOverrides]}>
      {sectionHeadingVariant === 'bar' ? (
        <View style={sectionBarContentStyle}>
          <Text style={sectionTitleStyle}>{title}</Text>
          {children}
        </View>
      ) : (
        <>
          <Text style={sectionTitleStyle}>{title}</Text>
          {children}
        </>
      )}
    </View>
  )

  const renderHeaderBlock = (styleOverrides: Array<{ marginBottom?: number }> = []) => (
    basicInfo ? (
      <View style={[...headerContainerStyle, ...styleOverrides]}>
        <View style={styles.headerRow}>
          <Text style={headerTitleStyle}>
            <Text style={headerLabelStyle}>姓名：</Text>
            {basicInfo.name || '未填写'}
          </Text>
          {displayJobIntention ? (
            <Text style={headerSubtitleStyle}>
              <Text style={headerLabelStyle}>求职意向：</Text>
              {displayJobIntention}
            </Text>
          ) : null}
        </View>
        <View style={headerContactStyle}>
          {basicInfo.email ? <Text><Text style={headerLabelStyle}>邮箱：</Text>{basicInfo.email}</Text> : null}
          {basicInfo.phone ? <Text><Text style={headerLabelStyle}>手机号：</Text>{basicInfo.phone}</Text> : null}
          {basicInfo.wechat ? <Text><Text style={headerLabelStyle}>微信：</Text>{basicInfo.wechat}</Text> : null}
          {basicInfo.targetCity ? <Text><Text style={headerLabelStyle}>意向城市：</Text>{basicInfo.targetCity}</Text> : null}
          {basicInfo.politicalStatusMasked || basicInfo.isPartyMember ? (
            <Text>
              <Text style={headerLabelStyle}>政治面貌：</Text>
              {basicInfo.politicalStatusMasked ? 'xx' : '党员'}
            </Text>
          ) : null}
          {basicInfo.github ? (
            <Text>
              <Text style={headerLabelStyle}>GitHub：</Text>
              {basicInfo.privacyMasked
                ? basicInfo.github
                : <Link src={normalizeExternalUrl(basicInfo.github)} style={headerLinkStyle}>{basicInfo.github}</Link>}
            </Text>
          ) : null}
          {basicInfo.blog ? (
            <Text>
              <Text style={headerLabelStyle}>博客：</Text>
              {basicInfo.privacyMasked
                ? basicInfo.blog
                : <Link src={normalizeExternalUrl(basicInfo.blog)} style={headerLinkStyle}>{basicInfo.blog}</Link>}
            </Text>
          ) : null}
          {basicInfo.hometown ? <Text><Text style={headerLabelStyle}>籍贯：</Text>{basicInfo.hometown}</Text> : null}
          {basicInfo.workYears ? <Text><Text style={headerLabelStyle}>工作年限：</Text>{basicInfo.workYears}</Text> : null}
          {basicInfo.leetcode ? <Text><Text style={headerLabelStyle}>LeetCode：</Text>{basicInfo.leetcode}</Text> : null}
        </View>
      </View>
    ) : null
  )

  const technicalContactItems: Array<{ value: string; href?: string }> = basicInfo
    ? [
        { value: basicInfo.phone },
        { value: basicInfo.email },
        { value: basicInfo.wechat },
        { value: basicInfo.github, href: basicInfo.privacyMasked ? undefined : normalizeExternalUrl(basicInfo.github) },
        { value: basicInfo.blog, href: basicInfo.privacyMasked ? undefined : normalizeExternalUrl(basicInfo.blog) },
        { value: basicInfo.targetCity },
      ].filter((item) => Boolean(item.value))
    : []

  const renderTechnicalBlackHeaderBlock = () => (
    basicInfo ? (
      <View style={[styles.header, { minHeight: hasPhoto ? 66 : 46, position: 'relative', marginBottom: 6 }]}>
        <View style={{ alignItems: 'center', paddingHorizontal: hasPhoto ? 74 : 18 }}>
          <Text style={{ fontSize: theme.titleSize, fontWeight: 700, color: '#2f2f2f' }}>
            {basicInfo.name || '未填写'}
          </Text>
          {technicalContactItems.length > 0 ? (
            <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
              {technicalContactItems.map((item, index) => (
                <Text key={`${item.value}-${index}`} style={styles.muted}>
                  {item.href ? <Link src={item.href} style={styles.link}>{item.value}</Link> : item.value}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
        {hasPhoto ? (
          <View
            style={[
              styles.photoFrame,
              {
                position: 'absolute',
                top: 0,
                right: 0,
                width: 56,
                height: 72,
                ...(hasPhotoBorder ? { borderWidth: 1, borderColor: '#b8b8b8' } : {}),
              },
            ]}
          >
            <Image src={photoSource} style={styles.photoImage} />
          </View>
        ) : null}
      </View>
    ) : null
  )

  const vibeContactItems: Array<{ value: string; href?: string }> = basicInfo
    ? [
        { value: basicInfo.phone },
        { value: basicInfo.email },
        { value: basicInfo.wechat ? `微信：${basicInfo.wechat}` : '' },
        { value: basicInfo.github, href: basicInfo.privacyMasked ? undefined : normalizeExternalUrl(basicInfo.github) },
        { value: basicInfo.blog, href: basicInfo.privacyMasked ? undefined : normalizeExternalUrl(basicInfo.blog) },
      ].filter((item) => Boolean(item.value))
    : []

  const renderVibeResumeHeaderBlock = () => (
    basicInfo ? (
      <View style={[styles.header, { minHeight: hasPhoto ? 66 : 48, position: 'relative', marginBottom: 6 }]}>
        <View style={{ paddingRight: hasPhoto ? 70 : 0 }}>
          <Text style={{ fontSize: theme.titleSize, fontWeight: 700, color: theme.bodyColor }}>
            {basicInfo.name || '未填写'}
          </Text>
          {vibeContactItems.length > 0 ? (
            <View style={{ marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              {vibeContactItems.map((item, index) => (
                <Text key={`${item.value}-${index}`} style={styles.muted}>
                  {item.href ? <Link src={item.href} style={styles.link}>{item.value}</Link> : item.value}
                </Text>
              ))}
            </View>
          ) : null}
          {displayJobIntention ? (
            <Text style={{ marginTop: 3, fontWeight: 700, color: theme.bodyColor }}>
              {displayJobIntention}
              {basicInfo.targetCity ? ` · ${basicInfo.targetCity}` : ''}
              {basicInfo.workYears ? ` · ${basicInfo.workYears}` : ''}
            </Text>
          ) : null}
        </View>
        {hasPhoto ? (
          <View
            style={[
              styles.photoFrame,
              {
                position: 'absolute',
                top: 0,
                right: 0,
                width: 52,
                height: 68,
                ...(hasPhotoBorder ? { borderWidth: 1, borderColor: theme.sectionTitleBorderColor } : {}),
              },
            ]}
          >
            <Image src={photoSource} style={styles.photoImage} />
          </View>
        ) : null}
      </View>
    ) : null
  )

  const renderCampusBlueHeaderBlock = () => (
    basicInfo ? (
      <View style={[styles.header, { marginBottom: theme.headerBottom }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {hasPhoto ? (
            <View style={splitPhotoFrameStyle}>
              <Image src={photoSource} style={styles.photoImage} />
            </View>
          ) : null}
          <View
            style={{
              width: hasPhoto ? 100 : 124,
              flexShrink: 0,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ fontSize: theme.titleSize, fontWeight: 700, color: theme.bodyColor }}>
              {basicInfo.name || '未填写'}
            </Text>
          </View>
          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, flexDirection: 'row', flexWrap: 'wrap' }}>
            {campusBlueContactItems.map((item) => (
              <View key={item.label} style={{ width: '50%', paddingRight: 7, marginBottom: 5 }}>
                <Text>
                  <Text style={styles.label}>{item.label}</Text>
                  {item.href ? (
                    <Link src={item.href} style={styles.link}>{item.value}</Link>
                  ) : item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    ) : null
  )

  const renderEducationBlock = (styleOverrides: Array<{ marginBottom?: number }> = []) => (
    educationModules.length > 0 ? (
      renderSectionBlock('education', '教育背景', (
        <>
        {educationModules.map((educationModule) => {
          const content = normalizeEducationContent(educationModule.content)
          const schoolTags = [
            content.is985 ? '985' : '',
            content.is211 ? '211' : '',
            content.isDoubleFirst ? '双一流' : '',
          ].filter(Boolean)
          const departmentMajor = [
            content.department ? `${content.department}` : '',
            content.major ? `（${content.major}）` : '',
          ].join('')
          const firstRowItems = [
            content.degree || '',
            formatMonthRange(content.startDate, content.endDate),
          ].filter(Boolean)
          const secondRowItems = [
            content.department ? `院系：${content.department}` : '',
            content.major ? `专业：${content.major}` : '',
          ].filter(Boolean)

          return (
            <View
              key={educationModule.id}
              style={[
                styles.item,
                ...(educationModule.id !== educationModules[educationModules.length - 1]?.id
                  ? [{ paddingBottom: 2 }]
                  : []),
              ]}
            >
              {isTechnicalBlack || isVibeResume ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <Text style={[styles.strong, { flexGrow: 1, flexShrink: 1, flexBasis: 0 }]}>
                    {content.school || '未填写'}
                    {schoolTags.length > 0 ? `（${schoolTags.join(' / ')}）` : ''}
                  </Text>
                  <Text style={[isVibeResume ? styles.muted : styles.strong, { width: 72, textAlign: 'center' }]}>{content.degree}</Text>
                  <Text style={[isVibeResume ? styles.muted : styles.strong, { width: 150, textAlign: 'center' }]}>
                    {content.major || content.department}
                  </Text>
                  <Text style={[isVibeResume ? styles.muted : styles.strong, { width: 108, textAlign: 'right' }]}>
                    {formatTechnicalMonthRange(content.startDate, content.endDate)}
                  </Text>
                </View>
              ) : isCampusBlue ? (
                <View style={styles.rowBetween}>
                  <Text style={[styles.strong, { flexGrow: 1, flexBasis: 0 }]}>
                    {content.school || '未填写'}
                    {schoolTags.length > 0 ? `（${schoolTags.join(' / ')}）` : ''}
                  </Text>
                  <Text style={[styles.muted, { width: 180, textAlign: 'center' }]}>
                    {[content.major || content.department, content.degree].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={[styles.muted, { width: 116, textAlign: 'right' }]}>
                    {formatMonthRange(content.startDate, content.endDate)}
                  </Text>
                </View>
              ) : isCompactDensity ? (
                <View style={styles.rowBetween}>
                  <View style={styles.inlineMeta}>
                    <Text style={styles.inlineMetaItem}>
                      <Text style={styles.strong}>{content.school || '未填写'}</Text>
                      {departmentMajor ? <Text style={styles.muted}>{` ${departmentMajor}`}</Text> : null}
                    </Text>
                    {!isMinimal && schoolTags.map((tag) => (
                      <Text key={tag} style={styles.chip}>{tag}</Text>
                    ))}
                  </View>
                  {content.startDate || content.endDate ? (
                    <View style={styles.inlineMeta}>
                      <Text style={[styles.inlineMetaItem, styles.muted]}>
                        {formatMonthRange(content.startDate, content.endDate)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <>
                  <View style={styles.rowBetween}>
                    <View style={styles.inlineMeta}>
                      <Text style={[styles.inlineMetaItem, styles.strong]}>{content.school || '未填写'}</Text>
                      {!isMinimal && schoolTags.map((tag) => (
                        <Text key={tag} style={styles.chip}>{tag}</Text>
                      ))}
                    </View>
                    <View style={styles.inlineMeta}>
                      {firstRowItems.map((item) => (
                        <Text key={item} style={[styles.inlineMetaItem, styles.muted]}>{item}</Text>
                      ))}
                    </View>
                  </View>
                  <View style={styles.inlineMeta}>
                    {secondRowItems.map((item) => (
                      <Text key={item} style={styles.inlineMetaItem}>{item}</Text>
                    ))}
                  </View>
                </>
              )}
            </View>
          )
        })}
        </>
      ), styleOverrides)
    ) : null
  )

  const renderProjectItem = (projectModule: ResumeModule) => {
    const content = normalizeProjectContent(projectModule.content)
    const titleLine = [content.projectName, content.role].filter(Boolean).join(' - ')

    return (
      <View key={projectModule.id} style={styles.item}>
        {isVibeResume ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: theme.chipBackgroundColor, borderLeftWidth: 3, borderLeftColor: theme.linkColor, paddingHorizontal: 7, paddingVertical: 4 }}>
            <Text style={[styles.strong, { flexGrow: 1, flexShrink: 1, flexBasis: 0, color: theme.labelColor }]}>{content.projectName || '项目'}</Text>
            <Text style={[styles.strong, { width: 110, textAlign: 'center', color: theme.labelColor }]}>{content.role}</Text>
            <Text style={[styles.muted, { width: 108, textAlign: 'right' }]}>{formatTechnicalMonthRange(content.startDate, content.endDate)}</Text>
          </View>
        ) : isTechnicalBlack ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Text style={[styles.strong, { flexGrow: 1, flexShrink: 1, flexBasis: 0 }]}>{content.projectName || '项目'}</Text>
            <Text style={[styles.strong, { width: 110, textAlign: 'center' }]}>{content.role}</Text>
            <Text style={[styles.strong, { width: 108, textAlign: 'right' }]}>{formatTechnicalMonthRange(content.startDate, content.endDate)}</Text>
          </View>
        ) : (
          <View style={styles.rowBetween}>
            <Text style={styles.strong}>{titleLine || '项目 - 角色'}</Text>
            <Text style={styles.muted}>{formatMonthRange(content.startDate, content.endDate)}</Text>
          </View>
        )}
        {content.techStack
          ? renderWrappedLabeledText(
              styles,
              '技术栈：',
              normalizeInlineText(content.techStack),
              `project-tech-stack-${projectModule.id}`
            )
          : null}
        {content.description ? (
          <View style={styles.paragraph}>
            {renderWrappedLabeledText(styles, '项目简介：', content.description, `project-summary-${projectModule.id}`)}
          </View>
        ) : null}
        {content.achievements.length > 0 ? (
          <View style={styles.paragraph}>
            <Text><Text style={styles.label}>核心职责：</Text></Text>
            {content.achievements.map((item, index) => (
              <View key={`${index}-${item}`} style={styles.listItem}>
                {isCampusBlue || isTechnicalBlack || isVibeResume
                  ? renderBulletItem(styles, item, `project-${projectModule.id}-${index}`)
                  : renderOrderedItem(styles, item, index, `project-${projectModule.id}-${index}`)}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <Document title={documentTitle} onRender={onRender}>
      <Page size={pageSize} style={styles.page}>
        {isVibeResume ? (
          renderVibeResumeHeaderBlock()
        ) : isTechnicalBlack ? (
          renderTechnicalBlackHeaderBlock()
        ) : isCampusBlue ? (
          renderCampusBlueHeaderBlock()
        ) : useCompactPhotoEducationLayout ? (
          <View style={topSectionWithPhotoStyle}>
            <View style={styles.topSectionRow}>
              <View style={styles.topSectionMain}>
                {renderHeaderBlock([{ marginBottom: Math.max(theme.headerBottom - 2, 4) }])}
                {renderEducationBlock([{ marginBottom: 0 }])}
              </View>
              <View style={[styles.topSectionPhotoColumn, { width: photoFrameWidth }]}>
                <View style={splitPhotoFrameStyle}>
                  <Image src={photoSource} style={styles.photoImage} />
                </View>
              </View>
            </View>
          </View>
        ) : hasPhoto ? (
          <View style={topSectionWithPhotoStyle}>
            <View style={styles.topSectionRow}>
              <View style={styles.topSectionMain}>
                {renderHeaderBlock([{ marginBottom: 0 }])}
              </View>
              <View style={[styles.topSectionPhotoColumn, { width: photoFrameWidth }]}>
                <View style={splitPhotoFrameStyle}>
                  <Image src={photoSource} style={styles.photoImage} />
                </View>
              </View>
            </View>
          </View>
        ) : (
          renderHeaderBlock()
        )}

        {sortedModules.map((module) => {
          switch (module.moduleType) {
            case 'basic_info':
              return null
            case 'education':
              return !useCompactPhotoEducationLayout && module.id === educationModules[0]?.id
                ? renderEducationBlock()
                : null
            case 'internship':
            case 'work_experience': {
              const isWorkExperience = module.moduleType === 'work_experience'
              const experienceModules = isWorkExperience ? workExperienceModules : internshipModules
              const firstModuleId = isWorkExperience ? firstWorkExperienceModuleId : firstInternshipModuleId
              if (module.id !== firstModuleId) return null

              return renderSectionBlock(
                module.id,
                isWorkExperience ? workExperienceSectionTitle : internshipSectionTitle,
                (
                  <View>
                    {experienceModules.map((experienceModule) => {
                      const content = normalizeInternshipContent(experienceModule.content)
                      const companyTitle = [content.company, content.position].filter(Boolean).join(' - ')
                      const visibleProjects = content.projects.filter((project) => {
                        const projectTitle = [project.projectName, project.role].filter(Boolean).join(' - ')
                        return Boolean(projectTitle || project.startDate || project.endDate || project.techStack || project.projectDescription || project.responsibilities.some(Boolean))
                      })
                      return (
                        <View key={experienceModule.id} style={styles.item}>
                          {isVibeResume ? (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: theme.chipBackgroundColor, borderLeftWidth: 3, borderLeftColor: theme.linkColor, paddingHorizontal: 7, paddingVertical: 4 }}>
                              <Text style={[styles.strong, { flexGrow: 1, flexShrink: 1, flexBasis: 0, color: theme.labelColor }]}>{content.company || '公司'}</Text>
                              <Text style={[styles.strong, { width: 122, textAlign: 'center', color: theme.labelColor }]}>{content.position}</Text>
                              <Text style={[styles.muted, { width: 108, textAlign: 'right' }]}>{formatTechnicalMonthRange(content.startDate, content.endDate)}</Text>
                            </View>
                          ) : isTechnicalBlack ? (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                              <Text style={[styles.strong, { flexGrow: 1, flexShrink: 1, flexBasis: 0 }]}>{content.company || '公司'}</Text>
                              <Text style={[styles.strong, { width: 122, textAlign: 'center' }]}>{content.position}</Text>
                              <Text style={[styles.strong, { width: 108, textAlign: 'right' }]}>{formatTechnicalMonthRange(content.startDate, content.endDate)}</Text>
                            </View>
                          ) : (
                            <View style={styles.rowBetween}>
                              <Text style={styles.strong}>{companyTitle || '公司 - 职位'}</Text>
                              <Text style={styles.muted}>{formatMonthRange(content.startDate, content.endDate)}</Text>
                            </View>
                          )}
                          {visibleProjects.map((project, projectIndex) => {
                            const projectTitle = [project.projectName, project.role].filter(Boolean).join(' - ')
                            return (
                              <View
                                key={project.id}
                                style={[
                                  styles.item,
                                  { marginTop: 5 },
                                ]}
                              >
                                {projectTitle || project.startDate || project.endDate ? (
                                  isTechnicalBlack || isVibeResume ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                                      <Text style={[styles.strong, { flexGrow: 1, flexShrink: 1, flexBasis: 0, ...(isVibeResume ? { color: theme.labelColor } : {}) }]}>{project.projectName}</Text>
                                      <Text style={[styles.strong, { width: 110, textAlign: 'center', ...(isVibeResume ? { color: theme.labelColor } : {}) }]}>{project.role}</Text>
                                      <Text style={[isVibeResume ? styles.muted : styles.strong, { width: 108, textAlign: 'right' }]}>{formatTechnicalMonthRange(project.startDate, project.endDate)}</Text>
                                    </View>
                                  ) : (
                                    <View style={styles.rowBetween}>
                                      <Text style={styles.strong}>{projectTitle}</Text>
                                      <Text style={styles.muted}>{formatMonthRange(project.startDate, project.endDate)}</Text>
                                    </View>
                                  )
                                ) : null}
                                {project.projectDescription ? (
                                  <View style={styles.paragraph}>
                                    {renderWrappedLabeledText(styles, '项目简介：', project.projectDescription, `summary-${experienceModule.id}-${projectIndex}`)}
                                  </View>
                                ) : null}
                                {project.techStack
                                  ? renderWrappedLabeledText(
                                      styles,
                                      '技术栈：',
                                      normalizeInlineText(project.techStack),
                                      `experience-tech-stack-${experienceModule.id}-${projectIndex}`
                                    )
                                  : null}
                                {project.responsibilities.some(Boolean) ? (
                                  <View style={styles.paragraph}>
                                    <Text><Text style={styles.label}>核心职责：</Text></Text>
                                    {project.responsibilities.filter(Boolean).map((line, index) => (
                                      <View key={`${index}-${line}`} style={styles.listItem}>
                                        {isCampusBlue || isTechnicalBlack || isVibeResume
                                          ? renderBulletItem(styles, line, `duty-${experienceModule.id}-${projectIndex}-${index}`)
                                          : renderOrderedItem(styles, line, index, `duty-${experienceModule.id}-${projectIndex}-${index}`)}
                                      </View>
                                    ))}
                                  </View>
                                ) : null}
                              </View>
                            )
                          })}
                        </View>
                      )
                    })}
                  </View>
                )
              )
            }
            case 'project': {
              if (module.id !== firstProjectModuleId) {
                return null
              }

              return renderSectionBlock(module.id, '项目经历', projectModules.map(renderProjectItem))
            }
            case 'skill': {
              const content = normalizeSkillContent(module.content)
              const visibleCategories = content.categories
                .map((category) => ({
                  ...category,
                  items: category.items.filter((item) => item.trim().length > 0),
                }))
                .filter((category) => category.items.length > 0)
              return renderSectionBlock(
                module.id,
                '专业技能',
                (
                  <>
                  {isTechnicalBlack || isVibeResume ? visibleCategories.map((category, index) => (
                    <View key={index} style={styles.listItem}>
                      {renderBulletItem(
                        styles,
                        `${category.name ? `**${category.name}：** ` : ''}${category.items.join('；')}`,
                        `${isVibeResume ? 'vibe' : 'technical'}-skill-${index}`
                      )}
                    </View>
                  )) : visibleCategories.map((category, index) => {
                      const hasTitle = Boolean(category.name.trim())
                      const shouldRenderAsList = !hasTitle || category.items.some((item) => item.length > 20 || /[，。；]/.test(item))

                      if (shouldRenderAsList) {
                        return (
                          <View key={index} style={styles.item}>
                            {hasTitle ? <Text style={styles.strong}>{category.name}</Text> : null}
                            {category.items.map((item, itemIndex) => (
                              <View key={itemIndex} style={styles.listItem}>
                                {renderBulletItem(styles, item, `skill-${index}-${itemIndex}`)}
                              </View>
                            ))}
                          </View>
                        )
                      }

                      return (
                        <Text key={index} style={styles.item}>
                          <Text style={styles.strong}>{category.name}：</Text>
                          {category.items.join('、')}
                        </Text>
                      )
                    })}
                  </>
                )
              )
            }
            case 'paper': {
              const content = normalizePaperContent(module.content)
              if (!hasPaperContent(content)) {
                return null
              }
              return renderSectionBlock(
                module.id,
                '论文期刊',
                (
                  <>
                  <Text style={styles.strong}>{content.journalName || '论文'}</Text>
                  <Text>{[content.journalType, content.publishTime].filter(Boolean).join(' / ')}</Text>
                  {content.content ? <Text style={styles.paragraph}>{content.content}</Text> : null}
                  </>
                )
              )
            }
            case 'research': {
              const content = normalizeResearchContent(module.content)
              if (!hasResearchContent(content)) {
                return null
              }
              return renderSectionBlock(
                module.id,
                '科研经历',
                (
                  <>
                  {isTechnicalBlack || isVibeResume ? (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Text style={[styles.strong, { flexGrow: 1, flexShrink: 1, flexBasis: 0 }]}>{content.projectName || '科研项目'}</Text>
                      {content.projectCycle ? <Text style={[styles.strong, { width: 132, textAlign: 'right' }]}>{content.projectCycle}</Text> : null}
                    </View>
                  ) : (
                    <>
                      <Text style={styles.strong}>{content.projectName || '科研项目'}</Text>
                      {content.projectCycle ? <Text>{content.projectCycle}</Text> : null}
                    </>
                  )}
                  {content.background ? <Text style={styles.paragraph}>背景：{content.background}</Text> : null}
                  {content.workContent ? <Text style={styles.paragraph}>工作：{content.workContent}</Text> : null}
                  {content.achievements ? <Text style={styles.paragraph}>成果：{content.achievements}</Text> : null}
                  </>
                )
              )
            }
            case 'award': {
              if (module.id !== firstAwardModuleId) {
                return null
              }
              const awardTexts = awardModules.map((award) => (
                formatAwardDisplayText(award.awardName, award.awardTime)
              ))
              return renderSectionBlock(
                'award',
                '荣誉奖项',
                isCompactDensity && awardTexts.length >= 5 ? (
                  <View style={styles.awardGrid}>
                    {awardTexts.map((text, index) => (
                      <View key={`${text}-${index}`} style={styles.awardGridItem}>
                        <Text style={styles.awardBullet}>•</Text>
                        <Text style={styles.awardGridText}>{text}</Text>
                      </View>
                    ))}
                  </View>
                ) : isCompactDensity ? (
                  <Text>{awardTexts.join('、')}</Text>
                ) : (
                  <>
                    {awardTexts.map((text, index) => (
                      <Text key={`${text}-${index}`} style={styles.paragraph}>{text}</Text>
                    ))}
                  </>
                )
              )
            }
            case 'job_intention':
              return null
            default:
              return null
          }
        })}
      </Page>
    </Document>
  )
}

export async function downloadResumePdf(modules: ResumeModule[], resumeId: number, options?: ResumePdfOptions) {
  const blob = await generateResumePdfBlob(modules, options)
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = buildFileName(modules, resumeId, options)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}

function buildResumePdfPreviewMeta(
  layout: unknown,
  modules: ResumeModule[],
  options?: ResumePdfOptions
): ResumePdfPreviewMeta {
  const fallbackHeight = options?.pageMode === 'continuous'
    ? estimateContinuousPageHeight(modules)
    : A4_HEIGHT
  const rootNode = layout && typeof layout === 'object'
    ? layout as { children?: Array<{ box?: { width?: number; height?: number } }> }
    : null
  const layoutPages = Array.isArray(rootNode?.children) ? rootNode.children : []
  const pageHeights = layoutPages
    .map((page) => {
      const pageHeight = options?.pageMode === 'continuous'
        ? getContinuousPageContentHeight(page, options)
        : page?.box?.height
      return typeof pageHeight === 'number' && Number.isFinite(pageHeight) && pageHeight > 0
        ? pageHeight
        : fallbackHeight
    })
  const firstPageWidth = layoutPages
    .map((page) => page?.box?.width)
    .find((pageWidth) => typeof pageWidth === 'number' && Number.isFinite(pageWidth) && pageWidth > 0)

  if (pageHeights.length === 0) {
    return {
      pageCount: 1,
      pageWidth: A4_WIDTH,
      pageHeights: [fallbackHeight],
    }
  }

  return {
    pageCount: pageHeights.length,
    pageWidth: firstPageWidth ?? A4_WIDTH,
    pageHeights,
  }
}

function getNodeBottomBoundary(node: unknown): number {
  if (!node || typeof node !== 'object') {
    return 0
  }

  const typedNode = node as {
    box?: { top?: number; height?: number }
    children?: unknown[]
  }
  const ownBottom = (typedNode.box?.top ?? 0) + (typedNode.box?.height ?? 0)
  const childBottom = Array.isArray(typedNode.children)
    ? typedNode.children.reduce<number>((maxBottom, child) => Math.max(maxBottom, getNodeBottomBoundary(child)), 0)
    : 0

  return Math.max(ownBottom, childBottom)
}

function getContinuousPageContentHeight(
  page: { box?: { height?: number }; children?: unknown[] } | undefined,
  options?: ResumePdfOptions
) {
  if (!page) {
    return undefined
  }

  const resolvedThemeConfig = getResolvedResumePdfThemeConfig({
    templateId: options?.templateId,
    density: options?.density,
    accentPreset: options?.accentPreset,
    headingStyle: options?.headingStyle,
  })
  const theme = getResumePdfTheme(resolvedThemeConfig)
  const contentBottom = Array.isArray(page.children)
    ? page.children.reduce<number>((maxBottom, child) => Math.max(maxBottom, getNodeBottomBoundary(child)), 0)
    : 0
  const contentHeight = contentBottom + theme.pagePadding + 8

  if (contentHeight <= 0) {
    return page.box?.height
  }

  return Math.min(page.box?.height ?? contentHeight, contentHeight)
}

async function renderResumePdfAsset(
  modules: ResumeModule[],
  pageSize: 'A4' | [number, number],
  options?: ResumePdfOptions
) {
  let previewMeta: ResumePdfPreviewMeta | null = null
  const document = (
    <ResumePdfDocument
      modules={modules}
      documentTitle={buildFileName(modules, undefined, options)}
      pageSize={pageSize}
      templateId={options?.templateId ?? 'default'}
      density={options?.density}
      accentPreset={options?.accentPreset}
      headingStyle={options?.headingStyle}
      onRender={(props) => {
        const layout = props && typeof props === 'object'
          ? (props as { _INTERNAL__LAYOUT__DATA_?: unknown })._INTERNAL__LAYOUT__DATA_
          : undefined
        previewMeta = buildResumePdfPreviewMeta(layout, modules, options)
      }}
    />
  )

  const blob = await pdf(document).toBlob()

  return {
    blob,
    previewMeta: previewMeta ?? buildResumePdfPreviewMeta(undefined, modules, options),
  }
}

export async function generateResumePdfPreviewAsset(modules: ResumeModule[], options?: ResumePdfOptions) {
  if (options?.pageMode === 'continuous') {
    const estimatedHeight = estimateContinuousPageHeight(modules)
    const firstPass = await renderResumePdfAsset(modules, [A4_WIDTH, estimatedHeight], options)
    const actualHeight = firstPass.previewMeta.pageHeights[0]
    const normalizedHeight = actualHeight && Number.isFinite(actualHeight) && actualHeight > 0
      ? Math.ceil(actualHeight)
      : estimatedHeight

    if (Math.abs(normalizedHeight - estimatedHeight) > 6) {
      return renderResumePdfAsset(modules, [A4_WIDTH, normalizedHeight], options)
    }

    return firstPass
  }

  return renderResumePdfAsset(modules, 'A4', options)
}

export async function generateResumePdfBlob(modules: ResumeModule[], options?: ResumePdfOptions) {
  const { blob } = await generateResumePdfPreviewAsset(modules, options)
  return blob
}
