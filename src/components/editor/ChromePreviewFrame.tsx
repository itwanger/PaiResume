import { useEffect, useMemo, useRef, useState } from 'react'
import {
  RESUME_PDF_TEMPLATES,
  type ResumePdfAccentPreset,
  type ResumePdfHeadingStyle,
  type ResumePdfPageMode,
  type ResumePdfPreviewConfig,
  type ResumePdfTemplateId,
} from '../../utils/resumePdf'
import { Button } from '../ui/Button'

interface ChromePreviewFrameProps {
  resumeId: number
  config: ResumePdfPreviewConfig
  onConfigChange: (nextConfig: ResumePdfPreviewConfig) => void
  onExportPdf?: (pageMode: ResumePdfPageMode) => void
  exporting?: boolean
  exportError?: string
}

const visibleTemplates = RESUME_PDF_TEMPLATES.filter((template) => template.id !== 'compact')

const accentPresetOptions: Array<{ value: ResumePdfAccentPreset; label: string }> = [
  { value: 'auto', label: '跟随模板' },
  { value: 'blue', label: '蓝调' },
  { value: 'slate', label: '石墨' },
  { value: 'warm', label: '暖棕' },
  { value: 'emerald', label: '森绿' },
]

const headingStyleOptions: Array<{ value: ResumePdfHeadingStyle; label: string }> = [
  { value: 'auto', label: '跟随模板' },
  { value: 'underline', label: '横线标题' },
  { value: 'filled', label: '色块标题' },
  { value: 'bar', label: '侧边强调' },
]
const CHROME_PREVIEW_RESIZE_MESSAGE_TYPE = 'pai-resume:chrome-preview-resize'
const DEFAULT_STANDARD_PREVIEW_HEIGHT = 1160
const DEFAULT_CONTINUOUS_PREVIEW_HEIGHT = 760

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
  templateId: Exclude<ResumePdfTemplateId, 'compact'>
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

function InlinePillGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (nextValue: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label ? <span className="text-xs font-medium text-slate-500">{label}</span> : null}
      <div className="inline-flex items-center rounded-xl bg-slate-100 p-1">
        {options.map((option) => {
          const isActive = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                isActive
                  ? 'bg-primary-50 text-primary-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ChromePreviewFrame({
  resumeId,
  config,
  onConfigChange,
  onExportPdf,
  exporting = false,
  exportError = '',
}: ChromePreviewFrameProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [pageMode, setPageMode] = useState<ResumePdfPageMode>('standard')
  const [previewHeight, setPreviewHeight] = useState<number | null>(null)
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null)
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
  const effectivePreviewHeight = previewHeight ?? (
    pageMode === 'standard' ? DEFAULT_STANDARD_PREVIEW_HEIGHT : DEFAULT_CONTINUOUS_PREVIEW_HEIGHT
  )
  const updateConfig = (patch: Partial<ResumePdfPreviewConfig>) => {
    onConfigChange({
      ...config,
      ...patch,
    })
  }

  useEffect(() => {
    setPreviewHeight(null)
  }, [previewPath])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return
      }

      const payload = event.data as {
        type?: string
        previewPath?: string
        height?: number
      } | null
      if (!payload || payload.type !== CHROME_PREVIEW_RESIZE_MESSAGE_TYPE || payload.previewPath !== previewPath) {
        return
      }

      if (typeof payload.height === 'number' && Number.isFinite(payload.height) && payload.height > 0) {
        setPreviewHeight(Math.ceil(payload.height))
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [previewPath])

  useEffect(() => {
    const iframe = previewIframeRef.current
    if (!iframe) {
      return
    }

    let frameResizeObserver: ResizeObserver | null = null
    let nestedResizeObserver: ResizeObserver | null = null
    let mutationObserver: MutationObserver | null = null

    const updateHeightFromFrame = () => {
      const frameDocument = iframe.contentDocument
      if (!frameDocument) {
        return
      }

      const nextHeight = Math.max(
        frameDocument.body?.scrollHeight ?? 0,
        frameDocument.documentElement?.scrollHeight ?? 0
      )
      if (nextHeight > 0) {
        setPreviewHeight(nextHeight)
      }
    }

    const attachNestedObserver = () => {
      nestedResizeObserver?.disconnect()
      const nestedFrame = iframe.contentDocument?.querySelector('iframe')
      if (!nestedFrame || typeof ResizeObserver === 'undefined') {
        return
      }

      nestedResizeObserver = new ResizeObserver(() => {
        updateHeightFromFrame()
      })
      nestedResizeObserver.observe(nestedFrame)
    }

    const bindFrameObservers = () => {
      const frameDocument = iframe.contentDocument
      if (!frameDocument) {
        return
      }

      updateHeightFromFrame()
      attachNestedObserver()

      if (typeof ResizeObserver !== 'undefined') {
        frameResizeObserver?.disconnect()
        frameResizeObserver = new ResizeObserver(() => {
          updateHeightFromFrame()
          attachNestedObserver()
        })

        if (frameDocument.body) {
          frameResizeObserver.observe(frameDocument.body)
        }
        if (frameDocument.documentElement) {
          frameResizeObserver.observe(frameDocument.documentElement)
        }
      }

      mutationObserver?.disconnect()
      mutationObserver = new MutationObserver(() => {
        updateHeightFromFrame()
        attachNestedObserver()
      })
      mutationObserver.observe(frameDocument, {
        childList: true,
        subtree: true,
        attributes: true,
      })
    }

    const handleLoad = () => {
      bindFrameObservers()
    }

    iframe.addEventListener('load', handleLoad)
    bindFrameObservers()

    return () => {
      iframe.removeEventListener('load', handleLoad)
      frameResizeObserver?.disconnect()
      nestedResizeObserver?.disconnect()
      mutationObserver?.disconnect()
    }
  }, [previewPath])

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="border-b border-slate-200 bg-white px-2 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-4 py-3">
          <div className="flex flex-wrap items-center gap-5">
            <InlinePillGroup
              value={pageMode}
              options={[
                { value: 'standard', label: '标准 PDF' },
                { value: 'continuous', label: '智能一页' },
              ]}
              onChange={setPageMode}
            />
            <InlinePillGroup
              label="密度"
              value={config.density}
              options={[
                { value: 'normal', label: '标准' },
                { value: 'compact', label: '紧凑' },
              ]}
              onChange={(nextDensity) => updateConfig({ density: nextDensity })}
            />
            <InlinePillGroup
              label="主题色"
              value={config.accentPreset}
              options={accentPresetOptions}
              onChange={(nextValue) => updateConfig({ accentPreset: nextValue })}
            />
            <InlinePillGroup
              label="标题样式"
              value={config.headingStyle}
              options={headingStyleOptions}
              onChange={(nextValue) => updateConfig({ headingStyle: nextValue })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onExportPdf && (
              <Button
                type="button"
                onClick={() => onExportPdf(pageMode)}
                loading={exporting}
                className="shrink-0"
              >
                导出 PDF
              </Button>
            )}
            <button
              type="button"
              onClick={() => setRefreshKey((current) => current + 1)}
              title="刷新预览"
              aria-label="刷新预览"
              className="inline-flex items-center justify-center rounded border border-slate-300 bg-white p-2 text-slate-500 transition hover:border-primary-200 hover:text-primary-700"
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
              className="inline-flex items-center justify-center rounded border border-slate-300 bg-white p-2 text-slate-500 transition hover:border-primary-200 hover:text-primary-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
        {exportError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {exportError}
          </div>
        )}
      </div>
      <div
        className="grid grid-cols-[280px_minmax(0,1fr)] bg-white"
        style={{ minHeight: `${effectivePreviewHeight}px` }}
      >
        <aside className="pr-3">
          <div className="flex flex-col py-2">
            {visibleTemplates.map((template) => {
              const isActive = config.templateId === template.id
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => updateConfig({ templateId: template.id })}
                  className="w-full rounded-xl py-2 text-left transition"
                >
                  <div
                    className={`rounded-xl transition ${
                      isActive
                        ? 'ring-2 ring-primary-500'
                        : 'hover:ring-1 hover:ring-slate-200'
                    }`}
                  >
                    <TemplateTonePreview
                      templateId={template.id as Exclude<ResumePdfTemplateId, 'compact'>}
                      name={template.name}
                      summary={template.previewSummary}
                      highlights={template.previewHighlights}
                      isActive={isActive}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </aside>
        <div className="border-l border-slate-200 bg-white">
          <div>
            <iframe
              key={previewPath}
              ref={previewIframeRef}
              title="简历模板预览"
              src={previewPath}
              scrolling="no"
              className="block w-full border-0 bg-white"
              style={{ height: `${effectivePreviewHeight}px` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
