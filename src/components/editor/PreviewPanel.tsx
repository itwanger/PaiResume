import { useEffect, useRef, useState } from 'react'
import * as PDFJS from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import type { ResumeModule } from '../../api/resume'
import type { ModuleType } from '../../types'
import {
  hasPaperContent,
  hasResearchContent,
  normalizeAwardContent,
  normalizeBasicInfoContent,
  normalizeEducationContent,
  normalizeInternshipContent,
  normalizePaperContent,
  normalizeProjectContent,
  normalizeResearchContent,
  normalizeSkillContent,
} from '../../utils/moduleContent'
import { parseInlineMarkdownSegments } from '../../utils/inlineMarkdown'
import { normalizePhotoSource } from '../../utils/resumePhoto'
import { findBasicInfoContent, getModuleDisplayLabel } from '../../utils/resumeDisplay'
import {
  generateResumePdfBlob,
  type ResumePdfAccentPreset,
  type ResumePdfHeadingStyle,
  type ResumePdfPageMode,
  type ResumePdfTemplateId,
  type ResumePdfDensity,
} from '../../utils/resumePdf'

interface PreviewPanelProps {
  modules: ResumeModule[]
  loading: boolean
  forcedMode?: PreviewMode
  hideHeader?: boolean
  pdfConfig?: {
    templateId: ResumePdfTemplateId
    density: ResumePdfDensity
    accentPreset: ResumePdfAccentPreset
    headingStyle: ResumePdfHeadingStyle
  }
}

type PreviewMode = 'live' | 'pdf-standard' | 'pdf-continuous'

interface PdfPreviewState {
  blob: Blob | null
  loading: boolean
  error: string
}

interface RenderedPdfPage {
  pageNumber: number
  width: number
  height: number
  dataUrl: string
}

PDFJS.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const pageMotion: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
    scale: 0.985,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

const moduleListMotion: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.11,
      delayChildren: 0.18,
    },
  },
}

const moduleCardMotion: Variants = {
  hidden: (index: number) => ({
    opacity: 0,
    x: index % 2 === 0 ? -26 : 26,
    y: 28,
    scale: 0.985,
    filter: 'blur(8px)',
  }),
  visible: (index: number) => ({
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.62,
      delay: index * 0.02,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
  exit: (index: number) => ({
    opacity: 0,
    x: index % 2 === 0 ? -18 : 18,
    y: -10,
    scale: 0.98,
    transition: {
      duration: 0.28,
      ease: [0.4, 0, 1, 1],
    },
  }),
}

function usePdfPreview(
  modules: ResumeModule[],
  pageMode: ResumePdfPageMode,
  enabled: boolean,
  pdfConfig?: PreviewPanelProps['pdfConfig']
): PdfPreviewState {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestIdRef = useRef(0)
  const signatureRef = useRef('')

  useEffect(() => {
    if (modules.length === 0) {
      requestIdRef.current += 1
      signatureRef.current = ''
      setBlob(null)
      setLoading(false)
      setError('')
      return
    }

    if (!enabled) {
      return
    }

    const nextSignature = JSON.stringify({ modules, pageMode, pdfConfig })
    if (nextSignature === signatureRef.current && blob) {
      setLoading(false)
      setError('')
      return
    }

    let cancelled = false
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(Boolean(blob))
    setError('')

    void generateResumePdfBlob(modules, {
      pageMode,
      templateId: pdfConfig?.templateId,
      density: pdfConfig?.density,
      accentPreset: pdfConfig?.accentPreset,
      headingStyle: pdfConfig?.headingStyle,
    })
      .then((blob) => {
        if (cancelled || requestId !== requestIdRef.current) {
          return
        }

        signatureRef.current = nextSignature
        setBlob(blob)
        setLoading(false)
      })
      .catch((reason: unknown) => {
        if (cancelled || requestId !== requestIdRef.current) {
          return
        }

        setLoading(false)
        setError(reason instanceof Error ? reason.message : 'PDF 预览生成失败，请稍后重试')
      })

    return () => {
      cancelled = true
    }
  }, [blob, enabled, modules, pageMode, pdfConfig])

  return { blob, loading, error }
}

export function PreviewPanel({
  modules,
  loading,
  forcedMode,
  hideHeader = false,
  pdfConfig,
}: PreviewPanelProps) {
  const shouldReduceMotion = useReducedMotion() ?? false
  const [previewMode, setPreviewMode] = useState<PreviewMode>(forcedMode ?? 'live')
  const isCompactDensity = pdfConfig?.density === 'compact'
  const sortedModules = [...modules].sort((a, b) => {
    if (a.sortOrder === b.sortOrder) {
      return a.id - b.id
    }

    return a.sortOrder - b.sortOrder
  })
  const hasEducationModule = sortedModules.some((module) => module.moduleType === 'education')
  const educationModules = sortedModules.filter((module) => module.moduleType === 'education')
  const firstEducationModuleId = educationModules[0]?.id ?? null
  const basicInfoContent = findBasicInfoContent(sortedModules)
  const visibleModules = sortedModules.filter((module) => {
    if (module.moduleType === 'job_intention') {
      return false
    }

    if (module.moduleType === 'education') {
      return module.id === firstEducationModuleId
    }

    if (module.moduleType === 'paper') {
      return hasPaperContent(normalizePaperContent(module.content))
    }

    if (module.moduleType === 'research') {
      return hasResearchContent(normalizeResearchContent(module.content))
    }

    return !(module.moduleType === 'award' && hasEducationModule)
  })
  const standardPdfPreview = usePdfPreview(modules, 'standard', previewMode === 'pdf-standard', pdfConfig)
  const activePdfPreview = standardPdfPreview
  const activePdfTitle = 'PDF预览'
  const activePdfDescription = '当前模板和样式参数下的标准 A4 分页预览。'
  const activePdfIframeTitle = 'Resume Standard PDF Preview'

  useEffect(() => {
    if (forcedMode) {
      setPreviewMode(forcedMode)
    }
  }, [forcedMode])

  if (loading && modules.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-gray-300">
        加载中...
      </div>
    )
  }

  if (modules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>暂无模块，请在左侧添加</p>
      </div>
    )
  }

  return (
    <div className={`flex h-full flex-col ${hideHeader ? '' : 'bg-gray-50'}`}>
      <div className="w-full">
        {!hideHeader && (
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {previewMode === 'live' ? '文本预览' : activePdfTitle}
              </h2>
              {previewMode === 'live' ? (
                <p className="mt-1 text-xs text-gray-500">
                  当前展示的是编辑内容的文本预览效果。
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  {activePdfDescription}
                </p>
              )}
            </div>
            <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setPreviewMode('live')}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  previewMode === 'live'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                文本预览
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('pdf-standard')}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  previewMode === 'pdf-standard'
                    ? 'bg-primary-700 text-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                PDF预览
              </button>
            </div>
          </div>
        )}

        {previewMode !== 'live' ? (
          <PdfPreviewCard
            preview={activePdfPreview}
            iframeTitle={activePdfIframeTitle}
          />
        ) : (
          <motion.div
            initial={shouldReduceMotion ? false : 'hidden'}
            animate="visible"
            variants={pageMotion}
            className="relative"
          >
            <motion.div
              className="min-h-[297mm] space-y-4"
              variants={shouldReduceMotion ? undefined : moduleListMotion}
              initial={shouldReduceMotion ? false : 'hidden'}
              animate="visible"
            >
              <AnimatePresence initial={false}>
                {visibleModules.map((module, index) => (
                  <ModulePreviewSection
                    key={module.id}
                    module={module}
                  modules={sortedModules}
                  index={index}
                  basicInfoContent={basicInfoContent}
                  compactEducation={isCompactDensity}
                  shouldReduceMotion={shouldReduceMotion}
                />
                ))}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function PdfPreviewCard({
  preview,
  iframeTitle,
}: {
  preview: PdfPreviewState
  iframeTitle: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [pages, setPages] = useState<RenderedPdfPage[]>([])
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState('')

  useEffect(() => {
    const element = containerRef.current
    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }

      setContainerWidth(Math.floor(entry.contentRect.width))
    })

    observer.observe(element)
    setContainerWidth(Math.floor(element.getBoundingClientRect().width))

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!preview.blob || containerWidth <= 0) {
      setPages([])
      setRenderError('')
      setRendering(false)
      return
    }

    const previewBlob = preview.blob
    let cancelled = false
    setRendering(true)
    setRenderError('')

    void (async () => {
      try {
        const arrayBuffer = await previewBlob.arrayBuffer()

        const pdf = await PDFJS.getDocument({ data: arrayBuffer }).promise
        const renderedPages: RenderedPdfPage[] = []

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber)
          const baseViewport = page.getViewport({ scale: 1 })
          const scale = containerWidth / baseViewport.width
          const viewport = page.getViewport({ scale })
          const outputScale = window.devicePixelRatio || 1

          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) {
            throw new Error('PDF 预览上下文创建失败')
          }

          canvas.width = Math.floor(viewport.width * outputScale)
          canvas.height = Math.floor(viewport.height * outputScale)
          canvas.style.width = `${viewport.width}px`
          canvas.style.height = `${viewport.height}px`

          await page.render({
            canvasContext: context,
            viewport,
            transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
          }).promise

          renderedPages.push({
            pageNumber,
            width: viewport.width,
            height: viewport.height,
            dataUrl: canvas.toDataURL('image/png'),
          })
        }

        if (cancelled) {
          return
        }

        setPages(renderedPages)
        setRendering(false)
      } catch (error) {
        if (cancelled) {
          return
        }

        setPages([])
        setRendering(false)
        setRenderError(error instanceof Error ? error.message : 'PDF 预览渲染失败')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [containerWidth, preview.blob])

  return (
    <section
      ref={containerRef}
      className="overflow-hidden rounded-2xl border border-gray-200 bg-slate-100/90 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.38)]"
    >
      {preview.error || renderError ? (
        <div className="flex h-[70vh] min-h-[520px] items-center justify-center px-6 text-sm text-red-500">
          {preview.error || renderError}
        </div>
      ) : preview.blob ? (
        <div className="relative">
          <div className="space-y-8">
            {pages.map((page) => (
              <div key={page.pageNumber} className="relative">
                <figure className="mx-auto overflow-hidden bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.32)]">
                  <img
                    src={page.dataUrl}
                    alt={`${iframeTitle} 第 ${page.pageNumber} 页`}
                    width={Math.round(page.width)}
                    height={Math.round(page.height)}
                    className="block w-full h-auto"
                  />
                </figure>
                {pages.length > 1 ? (
                  <span className="pointer-events-none absolute right-3 top-3 rounded bg-white/88 px-2 py-1 text-[10px] font-medium tracking-wide text-slate-400 shadow-sm">
                    第 {page.pageNumber} 页
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          {(preview.loading || rendering) ? (
            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-medium text-gray-500 shadow-sm ring-1 ring-gray-200">
              {rendering ? '渲染中...' : '更新中...'}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="flex h-[70vh] min-h-[520px] items-center justify-center text-sm text-gray-400">
          正在准备 PDF 预览...
        </div>
      )}
    </section>
  )
}

function renderLabeledText(label: string, value: string, emphasize = false) {
  return (
    <>
      <span className="text-gray-500">{label}：</span>
      <span className={emphasize ? 'font-semibold text-gray-900' : 'text-gray-700'}>{value}</span>
    </>
  )
}

function formatMonth(value: string) {
  if (!value) return ''
  const [year, month] = value.split('-')
  if (!year || !month) return value
  return `${year}年-${Number(month)}月`
}

function formatMonthRange(start: string, end: string) {
  const startText = formatMonth(start)
  const endText = formatMonth(end)
  if (startText && endText) return `${startText}至${endText}`
  return startText || endText
}

function formatAwardDisplayTime(value: string) {
  if (!value) return ''
  const [year] = value.split('-')
  return year ? `${year}年` : value
}

function normalizeExternalUrl(value: string) {
  if (!value) return ''
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function renderContactItem(label: string, value: string) {
  const isLink = label === 'GitHub' || label === '博客'
  const normalizedUrl = isLink ? normalizeExternalUrl(value) : ''

  return (
    <span key={label}>
      <span className="text-gray-500">{label}：</span>
      {isLink ? (
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary-700 hover:text-primary-800 hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="text-gray-700">{value}</span>
      )}
    </span>
  )
}

function renderInlineMarkdownText(value: string) {
  return parseInlineMarkdownSegments(value).map((segment, index) => (
    segment.bold
      ? <strong key={`${index}-${segment.text}`} className="font-semibold text-gray-800">{segment.text}</strong>
      : <span key={`${index}-${segment.text}`}>{segment.text}</span>
  ))
}

function getModuleSurfaceTone(moduleType: string, index: number) {
  const alternatingSurface = index % 2 === 0
    ? 'border-primary-100/90 bg-white/96'
    : 'border-primary-100/90 bg-[#f8fbff]/96'

  const accent = moduleType === 'basic_info'
    ? 'from-primary-900 via-primary-700 to-primary-300'
    : index % 2 === 0
      ? 'from-primary-800 via-primary-600 to-primary-300'
      : 'from-primary-700 via-primary-500 to-primary-200'

  const badge = moduleType === 'basic_info'
    ? 'border-primary-700/20 bg-primary-700 text-white'
    : 'border-primary-100 bg-primary-50 text-primary-700'

  return {
    container: alternatingSurface,
    accent,
    badge,
  }
}

function ModulePreviewSection({
  module,
  modules,
  index,
  basicInfoContent,
  compactEducation,
  shouldReduceMotion,
}: {
  module: ResumeModule
  modules: ResumeModule[]
  index: number
  basicInfoContent: ReturnType<typeof findBasicInfoContent>
  compactEducation: boolean
  shouldReduceMotion: boolean
}) {
  const label = getModuleDisplayLabel(module.moduleType as ModuleType, basicInfoContent)
  const awardModules = modules.filter((item) => item.moduleType === 'award')
  const surfaceTone = getModuleSurfaceTone(module.moduleType, index)

  const renderContent = () => {
    switch (module.moduleType) {
      case 'basic_info': {
        const content = normalizeBasicInfoContent(module.content)
        const photoSource = normalizePhotoSource(content.photo)
        const contactItems = [
          ['邮箱', content.email as string],
          ['手机号', content.phone as string],
          ['微信', content.wechat as string],
          ['意向城市', content.targetCity as string],
          ['期望薪资', content.salaryRange as string],
          ['到岗时间', content.expectedEntryDate as string],
          ['GitHub', content.github as string],
          ['博客', content.blog as string],
          ['籍贯', content.hometown as string],
          ['工作年限', content.workYears as string],
          ['LeetCode', content.leetcode as string],
        ].filter(([, value]) => value)

        return (
          <div className="mb-6 space-y-3">
            <div className={photoSource ? 'grid grid-cols-[minmax(0,1fr)_108px] gap-5 items-start' : 'space-y-3'}>
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[15px]">
                  <p>{renderLabeledText('姓名', (content.name as string) || '未填写', true)}</p>
                  {content.jobIntention && <p>{renderLabeledText('求职意向', content.jobIntention as string)}</p>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
                  {contactItems.map(([itemLabel, itemValue]) => (
                    renderContactItem(itemLabel as string, itemValue as string)
                  ))}
                </div>
                {content.summary && (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    <span className="text-gray-500">个人总结：</span>
                    {content.summary}
                  </p>
                )}
              </div>
              {photoSource ? (
                <div className="flex justify-end">
                  <div className="aspect-[3/4] w-[108px] overflow-hidden border border-primary-100 bg-slate-50 shadow-[0_10px_25px_-18px_rgba(15,23,42,0.4)]">
                    <img src={photoSource} alt="简历照片" className="h-full w-full object-cover" />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )
      }
      case 'education': {
        const awards = awardModules
          .map((item) => normalizeAwardContent(item.content))
          .filter((item) => item.awardName || item.awardTime)

        return (
          <div className="mb-4 space-y-4">
            {modules
              .filter((item) => item.moduleType === 'education')
              .map((educationModule) => {
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
                  formatMonthRange(content.startDate as string, content.endDate as string),
                ].filter(Boolean)
                const secondRowItems = [
                  content.department ? `院系：${content.department}` : '',
                  content.major ? `专业：${content.major}` : '',
                ].filter(Boolean)

                return (
                  <div
                    key={educationModule.id}
                    className="space-y-1.5 pb-3 last:pb-0"
                  >
                    {compactEducation ? (
                      <div className="flex items-start justify-between gap-4 text-sm text-gray-700">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {(content.school as string) || '未填写'}
                            {departmentMajor ? <span className="ml-2 font-normal text-gray-600">{departmentMajor}</span> : null}
                          </span>
                          {schoolTags.map((tag) => (
                            <span key={tag} className="rounded bg-primary-50 px-1.5 py-0.5 text-xs text-primary-600">
                              {tag}
                            </span>
                          ))}
                        </div>
                        {content.startDate || content.endDate ? (
                          <div className="shrink-0 text-sm text-gray-500">
                            {formatMonthRange(content.startDate as string, content.endDate as string)}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                            <span className="font-semibold text-gray-900">{(content.school as string) || '未填写'}</span>
                            {schoolTags.map((tag) => (
                              <span key={tag} className="rounded bg-primary-50 px-1.5 py-0.5 text-xs text-primary-600">
                                {tag}
                              </span>
                            ))}
                          </div>
                          {firstRowItems.length > 0 && (
                            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm text-gray-600">
                              {firstRowItems.map((item) => (
                                <span key={item}>{item}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {secondRowItems.length > 0 && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                            {secondRowItems.map((item) => (
                              <span key={item}>{item}</span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            {awards.length > 0 && (
              <div className="space-y-1 pt-1">
                {awards.map((award, index) => (
                  <div key={`${award.awardName}-${index}`} className="text-sm text-gray-600">
                    <span className="text-gray-500">奖项：</span>
                    {award.awardName}
                    {award.awardTime ? `（${formatAwardDisplayTime(award.awardTime)}）` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      }
      case 'internship': {
        const content = normalizeInternshipContent(module.content)
        const titleLine = [content.company, content.position, content.projectName].filter(Boolean).join(' - ')
        return (
          <div className="mb-4 space-y-1.5">
            <div className="flex justify-between items-start">
              <div className="font-semibold text-gray-800">{titleLine || '公司 - 职位 - 项目名'}</div>
              <span className="text-sm text-gray-400">
                {formatMonthRange(content.startDate, content.endDate)}
              </span>
            </div>
            {content.projectDescription && (
              <p className="text-sm text-gray-600">
                <span className="text-gray-500">项目简介：</span>
                {content.projectDescription}
              </p>
            )}
            {content.techStack && (
              <p className="text-sm text-gray-500">技术栈：{content.techStack}</p>
            )}
            {content.responsibilities.length > 0 && (
              <div className="text-sm text-gray-600">
                <p className="text-gray-500">核心职责：</p>
                <div className="mt-1 space-y-1 pl-4">
                  {content.responsibilities.map((line, index) => (
                    <div key={`${index}-${line}`} className="flex gap-2">
                      <span className="text-gray-400">•</span>
                      <p className="flex-1 leading-6 whitespace-pre-wrap">{renderInlineMarkdownText(line)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      }
      case 'project': {
        const content = normalizeProjectContent(module.content)
        const titleLine = [content.projectName, content.role].filter(Boolean).join(' - ')
        return (
          <div className="mb-4 space-y-1.5">
            <div className="flex justify-between items-start">
              <div className="font-semibold text-gray-800">{titleLine || '项目 - 角色'}</div>
              <span className="text-sm text-gray-400">
                {formatMonthRange(content.startDate, content.endDate)}
              </span>
            </div>
            {content.description && (
              <p className="text-sm text-gray-600">
                <span className="text-gray-500">项目简介：</span>
                {content.description}
              </p>
            )}
            {content.techStack && (
              <p className="text-sm text-gray-500">技术栈：{content.techStack}</p>
            )}
            {content.achievements.length > 0 && (
              <div className="text-sm text-gray-600">
                <p className="text-gray-500">核心职责：</p>
                <div className="mt-1 space-y-1 pl-4">
                  {content.achievements.map((a, i) => (
                    <div key={`${i}-${a}`} className="flex gap-2">
                      <span className="text-gray-400">•</span>
                      <p className="flex-1 leading-6 whitespace-pre-wrap">{renderInlineMarkdownText(a)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      }
      case 'skill': {
        const content = normalizeSkillContent(module.content)
        return (
          <div className="mb-4">
            {content.categories
              .map((cat) => ({
                ...cat,
                items: cat.items.filter((item) => item.trim().length > 0),
              }))
              .filter((cat) => cat.items.length > 0)
              .map((cat, i) => {
                const hasTitle = Boolean(cat.name.trim())
                const shouldRenderAsList = !hasTitle || cat.items.some((item) => item.length > 20 || /[，。；]/.test(item))

                if (shouldRenderAsList) {
                  return (
                    <div key={i} className="mb-3">
                      {hasTitle && <div className="mb-1 font-semibold text-gray-800">{cat.name}</div>}
                      <div className="space-y-1.5 text-sm text-gray-600">
                        {cat.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="flex gap-2">
                            <span className="text-gray-400">•</span>
                            <span className="leading-6">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={i} className="mb-2">
                    <span className="font-semibold">{cat.name}:</span>{' '}
                    <span className="text-gray-600">{cat.items.join('、')}</span>
                  </div>
                )
              })}
          </div>
        )
      }
      case 'paper': {
        const content = normalizePaperContent(module.content)
        return (
          <div className="mb-3">
            <p>
              <span className="font-semibold">{content.journalName}</span>
              <span className="text-gray-500 ml-2">({content.journalType})</span>
              <span className="text-gray-400 ml-2">{content.publishTime}</span>
            </p>
            {content.content && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{content.content}</p>}
          </div>
        )
      }
      case 'research': {
        const content = normalizeResearchContent(module.content)
        return (
          <div className="mb-4">
            <p className="font-semibold">{content.projectName || '科研项目'}</p>
            {content.projectCycle && <p className="text-sm text-gray-400">周期: {content.projectCycle}</p>}
            {content.background && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">背景: {content.background}</p>}
            {content.workContent && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">工作: {content.workContent}</p>}
            {content.achievements && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">成果: {content.achievements}</p>}
          </div>
        )
      }
      case 'award': {
        const content = normalizeAwardContent(module.content)
        return (
          <div className="mb-2 text-sm text-gray-600">
            {content.awardName || '奖项'}
            {content.awardTime ? `（${formatAwardDisplayTime(content.awardTime)}）` : ''}
          </div>
        )
      }
      case 'job_intention':
        return null
      default:
        return <pre className="text-xs text-gray-400">{JSON.stringify(module.content, null, 2)}</pre>
    }
  }

  return (
    <motion.section
      layout
      custom={index}
      variants={shouldReduceMotion ? undefined : moduleCardMotion}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="visible"
      exit={shouldReduceMotion ? { opacity: 0 } : 'exit'}
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      transition={{
        layout: {
          duration: 0.35,
          ease: [0.22, 1, 0.36, 1],
        },
      }}
      className={`relative overflow-hidden rounded-[24px] border ${surfaceTone.container} shadow-[0_20px_45px_-35px_rgba(29,78,216,0.34)]`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${surfaceTone.accent}`} />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white via-primary-200/80 to-transparent" />
      <div className="relative px-5 py-4 sm:px-6 sm:py-5">
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-primary-100/90 pb-3">
          <div className="flex items-center gap-3">
            <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-[11px] font-semibold tracking-[0.22em] ${surfaceTone.badge}`}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <h2 className="text-base font-semibold text-primary-900">{label}</h2>
          </div>
        </div>
        {renderContent()}
      </div>
    </motion.section>
  )
}
