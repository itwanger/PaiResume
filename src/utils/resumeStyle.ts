import {
  DEFAULT_RESUME_PDF_PREVIEW_CONFIG,
  type ResumePdfAccentPreset,
  type ResumePdfDensity,
  type ResumePdfHeadingStyle,
  type ResumePdfPageMode,
  type ResumePdfPreviewConfig,
  type ResumePdfTemplateId,
} from './resumePdf'

export const RESUME_STYLE_STORAGE_KEY_PREFIX = 'pai-resume.pdf-preview-config'

const templateIds = new Set<ResumePdfTemplateId>([
  'default', 'compact', 'accent', 'campus-blue', 'campus-black', 'technical-black', 'vibe-resume', 'minimal', 'executive', 'warm', 'slate', 'focus',
])
const densities = new Set<ResumePdfDensity>(['normal', 'compact'])
const accentPresets = new Set<ResumePdfAccentPreset>(['auto', 'blue', 'slate', 'warm', 'emerald'])
const headingStyles = new Set<ResumePdfHeadingStyle>(['auto', 'underline', 'filled', 'bar'])
const pageModes = new Set<ResumePdfPageMode>(['standard', 'continuous'])

export interface ResumeStyleSource {
  pageMode?: string | null
  templateId?: string | null
  density?: string | null
  accentPreset?: string | null
  headingStyle?: string | null
}

export function normalizeResumeStyle(source?: ResumeStyleSource | null): ResumePdfPreviewConfig {
  const rawTemplateId = source?.templateId && templateIds.has(source.templateId as ResumePdfTemplateId)
    ? source.templateId as ResumePdfTemplateId
    : DEFAULT_RESUME_PDF_PREVIEW_CONFIG.templateId

  return {
    pageMode: source?.pageMode && pageModes.has(source.pageMode as ResumePdfPageMode)
      ? source.pageMode as ResumePdfPageMode
      : DEFAULT_RESUME_PDF_PREVIEW_CONFIG.pageMode,
    templateId: rawTemplateId === 'compact' ? 'default' : rawTemplateId,
    density: source?.density && densities.has(source.density as ResumePdfDensity)
      ? source.density as ResumePdfDensity
      : rawTemplateId === 'compact'
        ? 'compact'
        : DEFAULT_RESUME_PDF_PREVIEW_CONFIG.density,
    accentPreset: source?.accentPreset && accentPresets.has(source.accentPreset as ResumePdfAccentPreset)
      ? source.accentPreset as ResumePdfAccentPreset
      : DEFAULT_RESUME_PDF_PREVIEW_CONFIG.accentPreset,
    headingStyle: source?.headingStyle && headingStyles.has(source.headingStyle as ResumePdfHeadingStyle)
      ? source.headingStyle as ResumePdfHeadingStyle
      : DEFAULT_RESUME_PDF_PREVIEW_CONFIG.headingStyle,
  }
}

export function readStoredResumeStyle(resumeId: number): ResumePdfPreviewConfig | null {
  if (typeof window === 'undefined') return null
  const storedValue = window.localStorage.getItem(`${RESUME_STYLE_STORAGE_KEY_PREFIX}:${resumeId}`)
  if (!storedValue) return null

  try {
    return normalizeResumeStyle(JSON.parse(storedValue) as ResumeStyleSource)
  } catch {
    return null
  }
}

export function writeStoredResumeStyle(resumeId: number, config: ResumePdfPreviewConfig) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(`${RESUME_STYLE_STORAGE_KEY_PREFIX}:${resumeId}`, JSON.stringify(config))
}
