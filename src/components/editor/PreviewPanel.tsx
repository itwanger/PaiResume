import { useEffect, useRef, useState } from 'react'
import * as PDFJS from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import type { ResumeModule } from '../../api/resume'
import type { ModuleType } from '../../types'
import {
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
import { getEducationDetailItems } from '../../utils/educationDetails'
import { normalizePhotoSource } from '../../utils/resumePhoto'
import { normalizeInlineText } from '../../utils/resumeText'
import { formatAwardDisplayText } from '../../utils/yearInput'
import { resolvePdfPreviewOutputScale } from '../../utils/pdfPreview'
import {
  findBasicInfoContent,
  getModuleDisplayLabel,
  selectResumeModulesForLivePreview,
  sortResumeModulesForDisplay,
} from '../../utils/resumeDisplay'
import {
  generateResumePdfBlob,
  type ResumePdfAccentPreset,
  type ResumePdfHeadingStyle,
  type ResumePdfPageMode,
  type ResumePdfTemplateId,
  type ResumePdfDensity,
} from '../../utils/resumePdf'
import { SegmentedControl } from '../ui/SegmentedControl'

interface PreviewPanelProps {
  modules: ResumeModule[]
  loading: boolean
  forcedMode?: PreviewMode
  hideHeader?: boolean
  activeModuleType?: ModuleType | null
  activeModuleId?: number | null
  pageMode?: ResumePdfPageMode
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
  activeModuleType,
  activeModuleId,
  pageMode = 'standard',
  pdfConfig,
}: PreviewPanelProps) {
  const shouldReduceMotion = useReducedMotion() ?? false
  const [previewMode, setPreviewMode] = useState<PreviewMode>(forcedMode ?? 'live')
  const isCompactDensity = pdfConfig?.density === 'compact'
  const sortedModules = sortResumeModulesForDisplay(modules)
  const livePreviewModules = activeModuleId && activeModuleType
    ? sortedModules.filter((module) => module.moduleType !== activeModuleType || module.id === activeModuleId)
    : sortedModules
  const projectModules = livePreviewModules.filter((module) => module.moduleType === 'project')
  const basicInfoContent = findBasicInfoContent(livePreviewModules)
  const visibleModules = selectResumeModulesForLivePreview(livePreviewModules, activeModuleType)
  const activePdfPreview = usePdfPreview(modules, pageMode, previewMode === 'pdf-standard', pdfConfig)
  const activePdfIframeTitle = pageMode === 'continuous'
    ? 'Resume Smart One Page PDF Preview'
    : 'Resume Standard PDF Preview'

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
          <div className="mb-4 flex justify-end">
            <SegmentedControl
              ariaLabel="预览模式"
              value={previewMode}
              options={[
                { value: 'live', label: '文本预览' },
                { value: 'pdf-standard', label: 'PDF预览' },
              ]}
              onChange={setPreviewMode}
              className="shrink-0"
            />
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
                  modules={livePreviewModules}
                  projectModules={projectModules}
                  index={index}
                  basicInfoContent={basicInfoContent}
                  compactDensity={isCompactDensity}
                  shouldReduceMotion={shouldReduceMotion}
                />
                ))}
              </AnimatePresence>
              {activeModuleType && visibleModules.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-400">
                  当前模块尚未添加内容
                </div>
              ) : null}
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
          const outputScale = resolvePdfPreviewOutputScale(window.devicePixelRatio)

          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) {
            throw new Error('PDF 预览上下文创建失败')
          }

          canvas.width = Math.ceil(viewport.width * outputScale)
          canvas.height = Math.ceil(viewport.height * outputScale)
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
  return `${year}年${Number(month)}月`
}

function formatMonthRange(start: string, end: string) {
  const startText = formatMonth(start)
  const endText = formatMonth(end)
  if (startText && endText) return `${startText} - ${endText}`
  return startText || endText
}

function normalizeExternalUrl(value: string) {
  if (!value) return ''
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function renderContactItem(label: string, value: string, privacyMasked = false) {
  const isLink = !privacyMasked && (label === 'GitHub' || label === '博客')
  const normalizedUrl = isLink ? normalizeExternalUrl(value) : ''

  return (
    <span key={label} className="min-w-0 break-words">
      <span className="text-gray-500">{label}：</span>
      {isLink ? (
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noreferrer"
          className="break-all text-primary-700 hover:text-primary-800 hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="break-all text-gray-700">{value}</span>
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

  return {
    container: alternatingSurface,
    accent,
  }
}

function ModulePreviewSection({
  module,
  modules,
  projectModules,
  index,
  basicInfoContent,
  compactDensity,
  shouldReduceMotion,
}: {
  module: ResumeModule
  modules: ResumeModule[]
  projectModules: ResumeModule[]
  index: number
  basicInfoContent: ReturnType<typeof findBasicInfoContent>
  compactDensity: boolean
  shouldReduceMotion: boolean
}) {
  const label = getModuleDisplayLabel(module.moduleType as ModuleType, basicInfoContent)
  const surfaceTone = getModuleSurfaceTone(module.moduleType, index)
  const useFlatExperienceLayout = module.moduleType === 'internship' || module.moduleType === 'work_experience'

  const renderProjectEntry = (projectModule: ResumeModule) => {
    const content = normalizeProjectContent(projectModule.content)
    const titleLine = [content.projectName, content.role].filter(Boolean).join(' - ')

    return (
      <div key={projectModule.id} className="mb-4 space-y-1.5 last:mb-0">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="font-semibold text-gray-800">{titleLine || '项目 - 角色'}</div>
          <span className="text-sm text-gray-400 sm:shrink-0">
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
          <p className="text-sm text-gray-500">技术栈：{normalizeInlineText(content.techStack)}</p>
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

  const renderContent = () => {
    switch (module.moduleType) {
      case 'basic_info': {
        const content = normalizeBasicInfoContent(module.content)
        const photoSource = normalizePhotoSource(content.photo)
        const photoFrameClassName = content.photoBorder
          ? 'border border-primary-500'
          : 'bg-slate-50'
        const contactItems = [
          ['邮箱', content.email as string],
          ['手机号', content.phone as string],
          ['微信', content.wechat as string],
          ['意向城市', content.targetCity as string],
          ['政治面貌', content.politicalStatusMasked ? 'xx' : content.isPartyMember ? '党员' : ''],
          ['GitHub', content.github as string],
          ['博客', content.blog as string],
          ['籍贯', content.hometown as string],
          ['工作年限', content.workYears as string],
          ['LeetCode', content.leetcode as string],
        ].filter(([, value]) => value)

        return (
          <div className="mb-6 space-y-3">
            <div className={photoSource ? 'grid grid-cols-1 items-start gap-4 sm:grid-cols-[minmax(0,1fr)_108px] sm:gap-5' : 'space-y-3'}>
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[15px]">
                  <p>{renderLabeledText('姓名', (content.name as string) || '未填写', true)}</p>
                  {content.jobIntention && <p>{renderLabeledText('求职意向', content.jobIntention as string)}</p>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
                  {contactItems.map(([itemLabel, itemValue]) => (
                    renderContactItem(itemLabel as string, itemValue as string, content.privacyMasked)
                  ))}
                </div>
              </div>
              {photoSource ? (
                <div className="flex justify-start sm:justify-end">
                  <div className={`aspect-[3/4] w-[108px] overflow-hidden shadow-[0_10px_25px_-18px_rgba(15,23,42,0.4)] ${photoFrameClassName}`}>
                    <img
                      src={photoSource}
                      alt={content.privacyMasked ? '脱敏照片占位图' : '简历照片'}
                      className={`h-full w-full object-cover ${content.privacyMasked ? '[image-rendering:pixelated]' : ''}`}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )
      }
      case 'education': {
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
                const educationDetails = getEducationDetailItems(content)

                return (
                  <div
                    key={educationModule.id}
                    className="space-y-1.5 pb-3 last:pb-0"
                  >
                    {compactDensity ? (
                      <div className="flex flex-col gap-2 text-sm text-gray-700 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
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
                          <div className="text-sm text-gray-500 sm:shrink-0">
                            {formatMonthRange(content.startDate as string, content.endDate as string)}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                            <span className="font-semibold text-gray-900">{(content.school as string) || '未填写'}</span>
                            {schoolTags.map((tag) => (
                              <span key={tag} className="rounded bg-primary-50 px-1.5 py-0.5 text-xs text-primary-600">
                                {tag}
                              </span>
                            ))}
                          </div>
                          {firstRowItems.length > 0 && (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 sm:justify-end">
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
                    {educationDetails.length > 0 ? (
                      <div className="space-y-1 text-sm text-gray-600">
                        {educationDetails.map((detail) => (
                          <p key={detail.key}>
                            <span className="font-semibold text-gray-700">{detail.label}：</span>
                            {detail.value}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
          </div>
        )
      }
      case 'internship':
      case 'work_experience': {
        const experiences = modules
          .filter((item) => item.moduleType === module.moduleType)
          .map((item) => ({ id: item.id, content: normalizeInternshipContent(item.content) }))
        return (
          <div className="mb-4 space-y-5">
            {experiences.map(({ id, content }) => {
              const companyTitle = [content.company, content.position].filter(Boolean).join(' - ')
              const visibleProjects = content.projects.filter((project) => {
                const projectTitle = [project.projectName, project.role].filter(Boolean).join(' - ')
                return Boolean(projectTitle || project.startDate || project.endDate || project.techStack || project.projectDescription || project.responsibilities.some(Boolean))
              })
              return (
                <div key={id}>
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="font-semibold text-gray-800 sm:whitespace-nowrap">{companyTitle || '公司 - 职位'}</div>
                    <span className="text-sm text-gray-400 sm:shrink-0">
                      {formatMonthRange(content.startDate, content.endDate)}
                    </span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {visibleProjects.map((project) => {
                      const projectTitle = [project.projectName, project.role].filter(Boolean).join(' - ')
                      return (
                        <div key={project.id} className="bg-white/80 px-4 py-3.5">
                          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                            {projectTitle ? <p className="whitespace-nowrap text-sm font-semibold text-gray-800">{projectTitle}</p> : <span />}
                            {project.startDate || project.endDate ? (
                              <span className="text-sm text-gray-400 sm:shrink-0">{formatMonthRange(project.startDate, project.endDate)}</span>
                            ) : null}
                          </div>
                          {project.projectDescription ? (
                            <p className="mt-1.5 text-sm text-gray-600"><span className="text-gray-500">项目简介：</span>{project.projectDescription}</p>
                          ) : null}
                          {project.techStack ? (
                            <p className="mt-1.5 text-sm text-gray-500">技术栈：{normalizeInlineText(project.techStack)}</p>
                          ) : null}
                          {project.responsibilities.some(Boolean) ? (
                            <div className="mt-1.5 text-sm text-gray-600">
                              <p className="text-gray-500">核心职责：</p>
                              <div className="mt-1 space-y-1 pl-4">
                                {project.responsibilities.filter(Boolean).map((line, index) => (
                                  <div key={`${index}-${line}`} className="flex gap-2">
                                    <span className="text-gray-400">•</span>
                                    <p className="flex-1 whitespace-pre-wrap leading-6">{renderInlineMarkdownText(line)}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
      case 'project': {
        return <div>{projectModules.map(renderProjectEntry)}</div>
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
              <span className="font-semibold">{content.journalName || '论文'}</span>
              {content.journalType && <span className="text-gray-500 ml-2">({content.journalType})</span>}
              {content.publishTime && <span className="text-gray-400 ml-2">{content.publishTime}</span>}
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
        const awards = modules
          .filter((item) => item.moduleType === 'award')
          .map((item) => ({ id: item.id, content: normalizeAwardContent(item.content) }))
          .filter(({ content }) => content.awardName || content.awardTime)

        if (compactDensity && awards.length >= 5) {
          return (
            <ul className="grid list-disc grid-cols-2 gap-x-6 gap-y-1 pl-5 text-sm text-gray-600">
              {awards.map(({ id, content }) => (
                <li key={id} className="min-w-0 break-words">
                  {formatAwardDisplayText(content.awardName, content.awardTime)}
                </li>
              ))}
            </ul>
          )
        }

        if (compactDensity) {
          return (
            <p className="text-sm leading-relaxed text-gray-600">
              {awards.map(({ content }) => formatAwardDisplayText(content.awardName, content.awardTime)).join('、')}
            </p>
          )
        }

        return (
          <div className="space-y-2 text-sm text-gray-600">
            {awards.map(({ id, content }) => (
              <div key={id}>
                {formatAwardDisplayText(content.awardName, content.awardTime)}
              </div>
            ))}
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
      whileHover={shouldReduceMotion || useFlatExperienceLayout ? undefined : { y: -2 }}
      transition={{
        layout: {
          duration: 0.35,
          ease: [0.22, 1, 0.36, 1],
        },
      }}
      className={useFlatExperienceLayout
        ? 'relative py-2'
        : `relative overflow-hidden rounded-[24px] border ${surfaceTone.container} shadow-[0_20px_45px_-35px_rgba(29,78,216,0.34)]`}
    >
      {!useFlatExperienceLayout ? (
        <>
          <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${surfaceTone.accent}`} />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white via-primary-200/80 to-transparent" />
        </>
      ) : null}
      <div className={useFlatExperienceLayout ? 'relative' : 'relative px-5 py-4 sm:px-6 sm:py-5'}>
        <div className={useFlatExperienceLayout ? 'mb-4' : 'mb-4 border-b border-primary-100/90 pb-3'}>
          <h2 className={useFlatExperienceLayout ? 'text-lg font-semibold text-slate-900' : 'text-base font-semibold text-primary-900'}>{label}</h2>
        </div>
        {renderContent()}
      </div>
    </motion.section>
  )
}
