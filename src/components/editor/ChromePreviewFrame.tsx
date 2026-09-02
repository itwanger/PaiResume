import { useMemo, useState, type Ref } from 'react'
import {
  RESUME_PDF_TEMPLATES,
  type ResumePdfAccentPreset,
  type ResumePdfHeadingStyle,
  type ResumePdfPageMode,
  type ResumePdfPreviewConfig,
  type ResumePdfTemplateId,
} from '../../utils/resumePdf'
import { Button } from '../ui/Button'
import { SegmentedControl } from '../ui/SegmentedControl'

interface ChromePreviewFrameProps {
  resumeId: number
  config: ResumePdfPreviewConfig
  onConfigChange: (nextConfig: ResumePdfPreviewConfig) => void
  onExportPdf?: (pageMode: ResumePdfPageMode) => void
  onExportMarkdown?: () => void
  onRequestReview?: () => void
  reviewButtonRef?: Ref<HTMLButtonElement>
  exporting?: boolean
  markdownExporting?: boolean
  exportError?: string
}

const visibleTemplates = RESUME_PDF_TEMPLATES.filter((template) => template.id !== 'compact')

const accentPresetOptions: Array<{ value: ResumePdfAccentPreset; label: string; swatchClassName: string }> = [
  { value: 'auto', label: '跟随模板', swatchClassName: 'bg-gradient-to-br from-blue-500 via-slate-500 to-amber-500' },
  { value: 'blue', label: '蓝调', swatchClassName: 'bg-blue-600' },
  { value: 'slate', label: '石墨', swatchClassName: 'bg-slate-700' },
  { value: 'warm', label: '暖棕', swatchClassName: 'bg-amber-700' },
  { value: 'emerald', label: '森绿', swatchClassName: 'bg-emerald-600' },
]

const headingStyleOptions: Array<{ value: ResumePdfHeadingStyle; label: string }> = [
  { value: 'auto', label: '跟随模板' },
  { value: 'underline', label: '横线标题' },
  { value: 'filled', label: '色块标题' },
  { value: 'bar', label: '侧边强调' },
]
function MiniLine({ className }: { className: string }) {
  return <div className={`h-1.5 rounded-full ${className}`} />
}

function PreviewStatusBadge({ isActive }: { isActive: boolean }) {
  if (!isActive) {
    return null
  }

  return (
    <span className="inline-flex h-5 items-center justify-center rounded-full bg-primary-600 px-2 text-[11px] font-medium text-white">
      当前
    </span>
  )
}

function splitPreviewSummary(summary: string, parts = 3) {
  const phrases = summary
    .split(/[，。；：]/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (phrases.length > 1) {
    return phrases
  }

  const compact = summary.replace(/[，。；：]/g, '').trim()
  if (!compact) {
    return []
  }

  const chunkSize = Math.max(4, Math.ceil(compact.length / parts))
  return Array.from({ length: parts }, (_, index) => compact.slice(index * chunkSize, (index + 1) * chunkSize)).filter(Boolean)
}

function TemplateTonePreview({
  templateId,
  name,
  summary,
  highlights,
  isActive,
}: {
  templateId: ResumePdfTemplateId
  name: string
  summary: string
  highlights: string[]
  isActive: boolean
}) {
  const frameClassName = 'overflow-hidden rounded-xl bg-white'
  const previewLines = splitPreviewSummary(summary, 3)
  const previewHighlights = [highlights[0] ?? '', highlights[1] ?? '', highlights[2] ?? '']
  const previewTextClassName = 'break-all leading-4'

  switch (templateId) {
    case 'vibe-resume':
      return (
        <div className={`${frameClassName} shadow-[inset_0_0_0_1px_rgba(191,219,254,0.95)]`}>
          <div className="space-y-1.5 px-3 py-3 text-[10px] text-slate-600">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-slate-900">{name}</div>
                <MiniLine className="mt-1.5 w-4/5 bg-slate-200" />
              </div>
              <PreviewStatusBadge isActive={isActive} />
            </div>
            <div className="border-b-2 border-blue-500 pb-0.5 font-bold text-blue-600">实习经历</div>
            <div className="border-l-[3px] border-blue-500 bg-blue-50 px-1.5 py-1 font-semibold text-blue-900">
              公司 · 技术平台
            </div>
            <div className="space-y-1">
              {previewLines[0] ? <div className={previewTextClassName}>{previewLines[0]}</div> : null}
              {previewLines[1] ? <div className={previewTextClassName}>{previewLines[1]}</div> : <MiniLine className="w-full bg-slate-200" />}
              {previewLines[2] ? <div className={previewTextClassName}>{previewLines[2]}</div> : <MiniLine className="w-4/5 bg-slate-200" />}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {previewHighlights.map((highlight, index) => (
                <div key={`${templateId}-highlight-${index}`} className="truncate bg-blue-50 px-1.5 py-1 text-center font-medium text-blue-700">
                  {highlight || ' '}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    case 'campus-black':
      return (
        <div className={`${frameClassName} shadow-[inset_0_0_0_1px_rgba(148,163,184,0.85)]`}>
          <div className="space-y-1.5 px-3 py-3 text-[10px] text-slate-600">
            <div className="relative min-h-11 border-b-2 border-slate-900 pb-2 pr-10">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-bold text-slate-950">{name}</span>
                <span className="truncate font-semibold text-slate-800">求职岗位</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                <MiniLine className="w-full bg-slate-300" />
                <MiniLine className="w-full bg-slate-300" />
                <MiniLine className="w-4/5 bg-slate-300" />
              </div>
              <div className="absolute right-0 top-0 h-10 w-8 bg-slate-200 ring-1 ring-slate-300" />
            </div>
            <div className="border-b-2 border-slate-900 pb-0.5 font-bold text-slate-900">教育背景</div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-1 font-semibold text-slate-800">
              <span>学校</span>
              <span className="text-center">专业 | 学位</span>
              <span className="text-right">时间</span>
            </div>
            <div className="space-y-1 pl-1">
              <MiniLine className="w-full bg-slate-200" />
              <MiniLine className="w-4/5 bg-slate-200" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <PreviewStatusBadge isActive={isActive} />
              <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
                {previewHighlights.map((highlight, index) => (
                  <div key={`${templateId}-highlight-${index}`} className="truncate bg-slate-100 px-1 py-0.5 text-center font-medium text-slate-700">
                    {highlight || ' '}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    case 'technical-black':
      return (
        <div className={`${frameClassName} shadow-[inset_0_0_0_1px_rgba(203,213,225,0.95)]`}>
          <div className="space-y-1.5 px-3 py-3 text-[10px] text-slate-600">
            <div className="relative min-h-11 border-b border-slate-800 pb-2 text-center">
              <div className="text-[13px] font-bold text-slate-800">{name}</div>
              <MiniLine className="mx-auto mt-2 w-2/3 bg-slate-300" />
              <div className="absolute right-0 top-0 h-10 w-8 bg-slate-200 ring-1 ring-slate-300" />
              <div className="absolute left-0 top-0">
                <PreviewStatusBadge isActive={isActive} />
              </div>
            </div>
            <div className="grid grid-cols-[1.2fr_.65fr_1fr] gap-1 font-semibold text-slate-700">
              <span>学校 / 公司</span>
              <span className="text-center">角色</span>
              <span className="text-right">时间</span>
            </div>
            <div className="border-b border-slate-800 pb-0.5 font-bold text-slate-800">项目经历</div>
            <div className="space-y-1">
              {previewLines[0] ? <div className={previewTextClassName}>{previewLines[0]}</div> : null}
              {previewLines[1] ? <div className={previewTextClassName}>{previewLines[1]}</div> : <MiniLine className="w-full bg-slate-200" />}
              {previewLines[2] ? <div className={previewTextClassName}>{previewLines[2]}</div> : <MiniLine className="w-4/5 bg-slate-200" />}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {previewHighlights.map((highlight, index) => (
                <div key={`${templateId}-highlight-${index}`} className="truncate bg-slate-100 px-1.5 py-1 text-center font-medium text-slate-700">
                  {highlight || ' '}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    case 'campus-blue':
      return (
        <div className={`${frameClassName} shadow-[inset_0_0_0_1px_rgba(190,208,235,0.95)]`}>
          <div className="space-y-2 px-3 py-3 text-[10px] text-slate-600">
            <div className="flex items-start gap-2">
              <div className="h-12 w-9 shrink-0 bg-blue-100 ring-1 ring-blue-200" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-slate-800">{name}</span>
                  <PreviewStatusBadge isActive={isActive} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
                  <MiniLine className="w-full bg-slate-200" />
                  <MiniLine className="w-full bg-slate-200" />
                  <MiniLine className="w-4/5 bg-slate-200" />
                  <MiniLine className="w-4/5 bg-slate-200" />
                </div>
              </div>
            </div>
            <div className="border-l-2 border-blue-700 bg-blue-100 px-2 py-1 font-semibold text-blue-800">
              教育经历
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              {previewLines[0] ? <div className={previewTextClassName}>{previewLines[0]}</div> : <MiniLine className="w-4/5 bg-slate-200" />}
              <MiniLine className="mt-1 w-12 bg-slate-200" />
            </div>
            <div className="border-l-2 border-blue-700 bg-blue-100 px-2 py-1 font-semibold text-blue-800">
              项目经历
            </div>
            <div className="space-y-1">
              {previewLines[1] ? <div className={previewTextClassName}>{previewLines[1]}</div> : <MiniLine className="w-full bg-slate-200" />}
              {previewLines[2] ? <div className={previewTextClassName}>{previewLines[2]}</div> : <MiniLine className="w-4/5 bg-slate-200" />}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {previewHighlights.map((highlight, index) => (
                <div
                  key={`${templateId}-highlight-${index}`}
                  className="truncate bg-blue-50 px-1.5 py-1 text-center font-medium text-blue-700"
                >
                  {highlight || ' '}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    case 'accent':
      return (
        <div className={`${frameClassName} bg-blue-50 shadow-[inset_0_0_0_1px_rgba(191,219,254,0.9)]`}>
          <div className="space-y-2 px-3 py-3 text-[11px]">
            <div className="flex items-center justify-between gap-3">
              <div className="relative text-blue-700">
                <span className="font-semibold">{name}</span>
                <span className="absolute -bottom-0.5 left-0 h-1.5 w-10 rounded-full bg-blue-500/80" />
              </div>
              <PreviewStatusBadge isActive={isActive} />
            </div>
            <div className="space-y-1.5">
              <div className="h-2 w-16 rounded-full bg-blue-700" />
              <div className="h-px w-full bg-blue-200" />
              {previewLines[0] ? <div className={`${previewTextClassName} text-blue-500`}>{previewLines[0]}</div> : null}
              {previewLines[1] ? <div className={`${previewTextClassName} text-blue-400`}>{previewLines[1]}</div> : <MiniLine className="w-full bg-blue-200" />}
              {previewLines[2] ? <div className={`${previewTextClassName} text-blue-400`}>{previewLines[2]}</div> : <MiniLine className="w-3/4 bg-blue-200" />}
            </div>
            <div className="flex gap-1.5">
              {previewHighlights.map((highlight, index) => (
                <div
                  key={`${templateId}-highlight-${index}`}
                  className="truncate rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-600"
                >
                  {highlight || ' '}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    case 'minimal':
      return (
        <div className={`${frameClassName} shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]`}>
          <div className="space-y-4 px-4 py-4 text-[11px] text-slate-900">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-slate-900">{name}</div>
                <PreviewStatusBadge isActive={isActive} />
              </div>
              <MiniLine className="w-3/5 bg-slate-100" />
            </div>
            <div className="space-y-2.5">
              {previewLines[0] ? <div className={previewTextClassName}>{previewLines[0]}</div> : null}
              {previewLines[1] ? <div className={previewTextClassName}>{previewLines[1]}</div> : <MiniLine className="w-2/3 bg-slate-100" />}
              {previewLines[2] ? <div className={previewTextClassName}>{previewLines[2]}</div> : null}
            </div>
            <div className="flex gap-1.5">
              {previewHighlights.map((highlight, index) => (
                <div
                  key={`${templateId}-highlight-${index}`}
                  className="truncate rounded-full bg-slate-50 px-2 py-1"
                >
                  {highlight || ' '}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    case 'executive':
      return (
        <div className={`${frameClassName} bg-slate-50 shadow-[inset_0_0_0_1px_rgba(203,213,225,0.9)]`}>
          <div className="space-y-3">
            <div className="space-y-2 bg-slate-800 px-3 py-3 text-[11px] text-white/90">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{name}</span>
                <PreviewStatusBadge isActive={isActive} />
              </div>
              {previewLines[0] ? <div className={`${previewTextClassName} text-white/55`}>{previewLines[0]}</div> : null}
            </div>
            <div className="space-y-2 px-3 pb-3 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <div className="h-2 w-14 rounded-full bg-slate-700" />
                <div className="h-4 w-9 rounded-full bg-slate-900" />
              </div>
              {previewLines[1] ? <div className={`${previewTextClassName} text-slate-500`}>{previewLines[1]}</div> : <MiniLine className="w-full bg-slate-300" />}
              {previewLines[2] ? <div className={`${previewTextClassName} text-slate-500`}>{previewLines[2]}</div> : <MiniLine className="w-3/4 bg-slate-300" />}
              <div className="flex gap-1.5">
                {previewHighlights.map((highlight, index) => (
                  <div
                    key={`${templateId}-highlight-${index}`}
                    className="truncate rounded-full bg-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600"
                  >
                    {highlight || ' '}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    case 'warm':
      return (
        <div className={`${frameClassName} bg-stone-50 shadow-[inset_0_0_0_1px_rgba(243,232,216,0.95)]`}>
          <div className="space-y-2 px-3 py-3 text-[11px] text-stone-500">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-stone-600">{name}</div>
              <PreviewStatusBadge isActive={isActive} />
            </div>
            <div className="space-y-1.5">
              <div className="h-2 w-16 rounded-full bg-amber-700" />
              <div className="h-px w-full bg-[#f3e8d8]" />
              {previewLines[0] ? <div className={previewTextClassName}>{previewLines[0]}</div> : null}
              {previewLines[1] ? <div className={previewTextClassName}>{previewLines[1]}</div> : <MiniLine className="w-4/5 bg-stone-200" />}
              {previewLines[2] ? <div className={previewTextClassName}>{previewLines[2]}</div> : <MiniLine className="w-3/5 bg-stone-200" />}
            </div>
            <div className="flex gap-1.5">
              {previewHighlights.map((highlight, index) => (
                <div
                  key={`${templateId}-highlight-${index}`}
                  className="truncate rounded-full bg-orange-100 px-2 py-1 font-medium text-amber-800"
                >
                  {highlight || ' '}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    case 'slate':
      return (
        <div className={`${frameClassName} bg-slate-100 shadow-[inset_0_0_0_1px_rgba(203,213,225,0.9)]`}>
          <div className="space-y-2 px-3 py-3 text-[11px] text-slate-500">
            <div className="flex items-center justify-between gap-2">
              <div className="rounded bg-slate-300 px-2 py-1 font-semibold text-slate-700">{name}</div>
              <PreviewStatusBadge isActive={isActive} />
            </div>
            <div className="rounded bg-[#f8fafc] px-2 py-2">
              {previewLines[0] ? <div className={previewTextClassName}>{previewLines[0]}</div> : null}
              {previewLines[1] ? <div className={`${previewTextClassName} mt-1.5`}>{previewLines[1]}</div> : <MiniLine className="mt-1.5 w-5/6 bg-slate-300" />}
              {previewLines[2] ? <div className={`${previewTextClassName} mt-1.5`}>{previewLines[2]}</div> : null}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {previewHighlights.map((highlight, index) => (
                <div
                  key={`${templateId}-highlight-${index}`}
                  className="truncate rounded-full bg-slate-200 px-1.5 py-1 text-center text-[11px] font-medium text-slate-600"
                >
                  {highlight || ' '}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    case 'focus':
      return (
        <div className={`${frameClassName} shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]`}>
          <div className="space-y-2 px-3 py-3 text-[11px] text-slate-500">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-blue-900">{name}</div>
              <PreviewStatusBadge isActive={isActive} />
            </div>
            <div className="flex items-stretch gap-2">
              <div className="w-2 shrink-0 rounded-full bg-blue-500" />
              <div className="min-w-0 flex-1 space-y-1.5">
                {previewLines[0] ? <div className={`${previewTextClassName} text-slate-600`}>{previewLines[0]}</div> : null}
                {previewLines[1] ? <div className={`${previewTextClassName} text-slate-600`}>{previewLines[1]}</div> : <MiniLine className="w-4/5 bg-blue-200" />}
                {previewLines[2] ? <div className={`${previewTextClassName} text-slate-600`}>{previewLines[2]}</div> : <MiniLine className="w-3/5 bg-blue-200" />}
              </div>
              <div className="w-[42px] shrink-0 rounded bg-blue-100" />
            </div>
            <div className="flex gap-1.5">
              {previewHighlights.map((highlight, index) => (
                <div
                  key={`${templateId}-highlight-${index}`}
                  className="truncate rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-700"
                >
                  {highlight || ' '}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    case 'default':
    default:
      return (
        <div className={`${frameClassName} shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]`}>
          <div className="space-y-2 px-3 py-3 text-[11px] text-slate-500">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-slate-700">{name}</div>
              <PreviewStatusBadge isActive={isActive} />
            </div>
            <div className="space-y-1.5">
              <div className="h-2 w-16 rounded-full bg-slate-700" />
              <div className="h-px w-full bg-slate-200" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                {previewLines[0] ? <div className={previewTextClassName}>{previewLines[0]}</div> : null}
                {previewLines[1] ? <div className={previewTextClassName}>{previewLines[1]}</div> : <MiniLine className="w-5/6 bg-slate-200" />}
              </div>
              <div className="space-y-1.5">
                {previewLines[2] ? <div className={previewTextClassName}>{previewLines[2]}</div> : <MiniLine className="w-2/3 bg-slate-200" />}
                <MiniLine className="w-2/3 bg-slate-200" />
              </div>
            </div>
            <div className="flex gap-1.5">
              {previewHighlights.map((highlight, index) => (
                <div
                  key={`${templateId}-highlight-${index}`}
                  className="truncate rounded-full bg-blue-50 px-2 py-1 font-medium text-blue-700"
                >
                  {highlight || ' '}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
  }
}

function CompactOptionGrid<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string; swatchClassName?: string }>
  onChange: (nextValue: T) => void
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium text-slate-500">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isActive = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(option.value)}
              className={`flex min-h-10 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                isActive
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {option.swatchClassName ? (
                <span className={`h-3 w-3 shrink-0 rounded-full ${option.swatchClassName}`} aria-hidden="true" />
              ) : null}
              <span>{option.label}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function ChromePreviewFrame({
  resumeId,
  config,
  onConfigChange,
  onExportPdf,
  onExportMarkdown,
  onRequestReview,
  reviewButtonRef,
  exporting = false,
  markdownExporting = false,
  exportError = '',
}: ChromePreviewFrameProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [controlTab, setControlTab] = useState<'templates' | 'styles'>('templates')
  const pageMode = config.pageMode
  const previewPath = useMemo(() => {
    const params = new URLSearchParams({
      pageMode,
      templateId: config.templateId,
      density: config.density,
      accentPreset: config.accentPreset,
      headingStyle: config.headingStyle,
      refresh: String(refreshKey),
    })

    return `/preview/${resumeId}?${params.toString()}`
  }, [config.accentPreset, config.density, config.headingStyle, config.templateId, pageMode, refreshKey, resumeId])
  const updateConfig = (patch: Partial<ResumePdfPreviewConfig>) => {
    onConfigChange({
      ...config,
      ...patch,
    })
  }
  const selectPageMode = (nextPageMode: ResumePdfPageMode) => {
    updateConfig({ pageMode: nextPageMode })
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] overflow-hidden border border-slate-200 bg-white shadow-sm">
      <div className="relative z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              ariaLabel="PDF 页面模式"
              value={pageMode}
              options={[
                { value: 'standard', label: '标准 PDF（可能分页）' },
                { value: 'continuous', label: '智能长一页（内容无损）' },
              ]}
              onChange={selectPageMode}
            />
            <span className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden="true" />
            <SegmentedControl
              label="内容密度"
              ariaLabel="内容密度"
              value={config.density}
              options={[
                { value: 'normal', label: '标准' },
                { value: 'compact', label: '紧凑' },
              ]}
              onChange={(nextDensity) => updateConfig({ density: nextDensity })}
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setRefreshKey((current) => current + 1)}
              title="刷新预览"
              aria-label="刷新预览"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-primary-200 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <a
              href={previewPath}
              target="_blank"
              rel="noreferrer"
              title="在新标签打开预览"
              aria-label="在新标签打开预览"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-primary-200 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            {onExportPdf ? (
              <Button
                type="button"
                onClick={() => onExportPdf(pageMode)}
                loading={exporting}
                disabled={markdownExporting}
                className="shrink-0"
              >
                导出 PDF
              </Button>
            ) : null}
            {onExportMarkdown ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="导出 Markdown"
                onClick={onExportMarkdown}
                loading={markdownExporting}
                disabled={exporting}
                className="shrink-0"
              >
                Markdown
              </Button>
            ) : null}
            {onRequestReview ? (
              <button
                ref={reviewButtonRef}
                type="button"
                onClick={onRequestReview}
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 transition hover:border-primary-300 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                人工精修
              </button>
            ) : null}
          </div>
        </div>
        {exportError ? (
          <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {exportError}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] bg-slate-100 lg:h-[calc(100vh-12rem)] lg:min-h-[500px] lg:grid-cols-[232px_minmax(0,1fr)] lg:overflow-hidden">
        <aside className="min-w-0 border-b border-slate-200 bg-white lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-3">
            <SegmentedControl
              ariaLabel="预览设置"
              value={controlTab}
              options={[
                { value: 'templates', label: '模板' },
                { value: 'styles', label: '样式' },
              ]}
              onChange={setControlTab}
              size="md"
              fullWidth
            />
          </div>

          <div className="p-3">
            {controlTab === 'templates' ? (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 lg:grid lg:grid-cols-2 lg:overflow-visible">
                {visibleTemplates.map((template) => {
                  const isActive = config.templateId === template.id
                  return (
                    <button
                      key={template.id}
                      type="button"
                      aria-pressed={isActive}
                      aria-label={`选择${template.name}模板`}
                      onClick={() => updateConfig({ templateId: template.id })}
                      className={`w-36 shrink-0 rounded-xl border bg-white p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:w-auto ${
                        isActive
                          ? 'border-primary-500 ring-1 ring-primary-500'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="h-[74px] overflow-hidden rounded-lg bg-slate-50" aria-hidden="true">
                        <div className="pointer-events-none w-[182%] origin-top-left scale-[0.55]">
                          <TemplateTonePreview
                            templateId={template.id}
                            name={template.name}
                            summary={template.previewSummary}
                            highlights={template.previewHighlights}
                            isActive={false}
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-medium text-slate-700">{template.name}</span>
                        {isActive ? (
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[10px] text-white" aria-hidden="true">
                            ✓
                          </span>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                <CompactOptionGrid
                  label="主题色"
                  value={config.accentPreset}
                  options={accentPresetOptions}
                  onChange={(nextValue) => updateConfig({ accentPreset: nextValue })}
                />
                <CompactOptionGrid
                  label="标题样式"
                  value={config.headingStyle}
                  options={headingStyleOptions}
                  onChange={(nextValue) => updateConfig({ headingStyle: nextValue })}
                />
              </div>
            )}
          </div>
        </aside>

        <section
          aria-label="PDF 预览区域"
          tabIndex={0}
          className="h-[72dvh] min-h-[420px] min-w-0 overflow-hidden bg-slate-100 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 sm:p-5 lg:h-auto lg:min-h-0"
        >
          <div className="mx-auto h-full w-full max-w-[980px]">
            <div className="h-full overflow-hidden border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
              <iframe
                key={previewPath}
                title="简历模板预览"
                src={previewPath}
                scrolling="no"
                className="block h-full w-full border-0 bg-white"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
