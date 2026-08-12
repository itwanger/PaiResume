import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useResumeStore } from '../store/resumeStore'
import { resumeApi } from '../api/resume'
import { Header } from '../components/layout/Header'
import { ModuleSidebar } from '../components/editor/ModuleSidebar'
import { PreviewPanel } from '../components/editor/PreviewPanel'
import { ChromePreviewFrame } from '../components/editor/ChromePreviewFrame'
import { AiOptimizePanel } from '../components/analysis/AiOptimizePanel'
import { ResumeAnalysis } from '../components/analysis/ResumeAnalysis'
import { BasicInfoForm } from '../components/modules/BasicInfoForm'
import { EducationForm } from '../components/modules/EducationForm'
import { InternshipForm } from '../components/modules/InternshipForm'
import { WorkExperienceForm } from '../components/modules/WorkExperienceForm'
import { ProjectForm } from '../components/modules/ProjectForm'
import { SkillForm } from '../components/modules/SkillForm'
import { PaperForm } from '../components/modules/PaperForm'
import { ResearchForm } from '../components/modules/ResearchForm'
import { AwardForm } from '../components/modules/AwardForm'
import { MembershipUpgradeModal } from '../components/membership/MembershipUpgradeModal'
import { ResumeReviewModal } from '../components/review/ResumeReviewModal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { flushResumeAutoSaves } from '../hooks/useAutoSave'
import { SINGLETON_MODULES, type ModuleType } from '../types'
import { normalizeJobIntentionContent } from '../utils/moduleContent'
import { buildMembershipPath } from '../utils/navigation'
import { getModuleDisplayLabelFromModules } from '../utils/resumeDisplay'
import {
  DEFAULT_RESUME_PDF_PREVIEW_CONFIG,
  downloadResumePdf,
  resolveResumePdfAccentPreset,
  resolveResumePdfDensity,
  resolveResumePdfHeadingStyle,
  resolveResumePdfTemplateId,
  type ResumePdfPageMode,
  type ResumePdfPreviewConfig,
} from '../utils/resumePdf'

type EditorView = 'module' | 'analysis' | 'template-selection'
const AI_OPTIMIZABLE_MODULE_TYPES = new Set<ModuleType>(['research', 'skill'])
const NON_REMOVABLE_MODULE_TYPES = new Set<ModuleType>(['basic_info'])
const PREVIEW_PANEL_COLLAPSED_STORAGE_KEY = 'pai-resume.preview-panel-collapsed'
const COMPACT_PREVIEW_MEDIA_QUERY = '(max-width: 1279px)'
const DESKTOP_MODULE_SIDEBAR_MEDIA_QUERY = '(min-width: 768px)'
const RESUME_PDF_PREVIEW_CONFIG_STORAGE_KEY_PREFIX = 'pai-resume.pdf-preview-config'
const DESKTOP_MODULE_SIDEBAR_WIDTH = '11rem'

function getStoredDesktopPreviewPreference(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(PREVIEW_PANEL_COLLAPSED_STORAGE_KEY) === 'true'
}

function matchesCompactPreviewViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(COMPACT_PREVIEW_MEDIA_QUERY).matches
}

interface DeleteDialogState {
  moduleIds: number[]
  moduleLabel: string
  itemLabel: string
}

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const { resumeList, modules, loading, fetchModules, addModule, deleteModule } = useResumeStore()
  const [activeModuleType, setActiveModuleType] = useState<ModuleType | null>(null)
  const [aiModuleId, setAiModuleId] = useState<number | null>(null)
  const [editorView, setEditorView] = useState<EditorView>('module')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [membershipNavigationError, setMembershipNavigationError] = useState('')
  const [membershipNavigationPending, setMembershipNavigationPending] = useState(false)
  const [membershipModalOpen, setMembershipModalOpen] = useState(false)
  const [resumeReviewModalOpen, setResumeReviewModalOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)
  const [deletingModuleId, setDeletingModuleId] = useState<number | null>(null)
  const [initializingBasicInfo, setInitializingBasicInfo] = useState(false)
  const [modulesLoaded, setModulesLoaded] = useState(false)
  const [initialDesktopPreviewCollapsed] = useState(getStoredDesktopPreviewPreference)
  const desktopPreviewPreferenceRef = useRef(initialDesktopPreviewCollapsed)
  const [desktopPreviewCollapsed, setDesktopPreviewCollapsed] = useState(initialDesktopPreviewCollapsed)
  const [isCompactViewport, setIsCompactViewport] = useState(matchesCompactPreviewViewport)
  const [compactPreviewOpen, setCompactPreviewOpen] = useState(false)
  const [mobileModuleMenuOpen, setMobileModuleMenuOpen] = useState(false)
  const previewToggleRef = useRef<HTMLButtonElement | null>(null)
  const mobilePreviewToggleRef = useRef<HTMLButtonElement | null>(null)
  const resumeReviewTriggerRef = useRef<HTMLButtonElement | null>(null)
  const membershipNavigationPendingRef = useRef(false)
  const compactPreviewDialogRef = useRef<HTMLElement | null>(null)
  const mobileModuleTriggerRef = useRef<HTMLButtonElement | null>(null)
  const mobileModuleDialogRef = useRef<HTMLDivElement | null>(null)
  const editorScrollRef = useRef<HTMLElement | null>(null)
  const editorScrollThumbRef = useRef<HTMLDivElement | null>(null)
  const [pdfPreviewConfig, setPdfPreviewConfig] = useState<ResumePdfPreviewConfig>(DEFAULT_RESUME_PDF_PREVIEW_CONFIG)

  const resumeId = Number(id)
  const resumeTitle = resumeList.find((resume) => resume.id === resumeId)?.title
  const requestedModuleType = searchParams.get('moduleType')
  const requestedViewParam = searchParams.get('view')
  const requestedView: EditorView = requestedViewParam === 'analysis'
    ? 'analysis'
    : requestedViewParam === 'chrome-preview' || requestedViewParam === 'template-selection'
      ? 'template-selection'
      : 'module'
  const resumeReviewEnabled = user?.resumeReviewEnabled === true
  const initialModuleType = requestedModuleType && requestedModuleType in getDefaultContentMap()
    ? requestedModuleType as ModuleType
    : requestedView === 'module'
      ? 'basic_info'
      : null
  const isVip = user?.membershipStatus === 'ACTIVE'

  useEffect(() => {
    if (resumeId) {
      let cancelled = false
      setActiveModuleType(initialModuleType)
      setAiModuleId(null)
      setEditorView(requestedView)
      setInitializingBasicInfo(false)
      setModulesLoaded(false)
      void fetchModules(resumeId).finally(() => {
        if (!cancelled) {
          setModulesLoaded(true)
        }
      })

      return () => {
        cancelled = true
      }
    }
  }, [resumeId, fetchModules, initialModuleType, requestedView])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    desktopPreviewPreferenceRef.current = desktopPreviewCollapsed
    window.localStorage.setItem(PREVIEW_PANEL_COLLAPSED_STORAGE_KEY, String(desktopPreviewCollapsed))
  }, [desktopPreviewCollapsed])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia(COMPACT_PREVIEW_MEDIA_QUERY)
    const handleViewportChange = (event: MediaQueryListEvent) => {
      setIsCompactViewport(event.matches)
      setCompactPreviewOpen(false)
      if (!event.matches) {
        setDesktopPreviewCollapsed(desktopPreviewPreferenceRef.current)
      }
    }

    setIsCompactViewport(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleViewportChange)
    return () => mediaQuery.removeEventListener('change', handleViewportChange)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia(DESKTOP_MODULE_SIDEBAR_MEDIA_QUERY)
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobileModuleMenuOpen(false)
      }
    }

    mediaQuery.addEventListener('change', handleViewportChange)
    return () => mediaQuery.removeEventListener('change', handleViewportChange)
  }, [])

  useEffect(() => {
    const overlayOpen = mobileModuleMenuOpen || (isCompactViewport && compactPreviewOpen)
    if (!overlayOpen || typeof document === 'undefined') {
      return
    }

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      if (mobileModuleMenuOpen) {
        setMobileModuleMenuOpen(false)
        window.requestAnimationFrame(() => mobileModuleTriggerRef.current?.focus())
        return
      }

      setCompactPreviewOpen(false)
      window.requestAnimationFrame(() => {
        const mobileTrigger = mobilePreviewToggleRef.current
        if (mobileTrigger && mobileTrigger.getClientRects().length > 0) {
          mobileTrigger.focus()
          return
        }
        previewToggleRef.current?.focus()
      })
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [compactPreviewOpen, isCompactViewport, mobileModuleMenuOpen])

  useEffect(() => {
    if (mobileModuleMenuOpen) {
      window.requestAnimationFrame(() => mobileModuleDialogRef.current?.focus())
    }
  }, [mobileModuleMenuOpen])

  useEffect(() => {
    if (isCompactViewport && compactPreviewOpen) {
      window.requestAnimationFrame(() => compactPreviewDialogRef.current?.focus())
    }
  }, [compactPreviewOpen, isCompactViewport])

  useEffect(() => {
    setCompactPreviewOpen(false)
    setMobileModuleMenuOpen(false)
  }, [activeModuleType, editorView])

  useEffect(() => {
    if (editorView !== 'module') return
    window.requestAnimationFrame(() => {
      compactPreviewDialogRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    })
  }, [activeModuleType, editorView])

  useEffect(() => {
    if (typeof window === 'undefined' || !resumeId) {
      return
    }

    const storedValue = window.localStorage.getItem(`${RESUME_PDF_PREVIEW_CONFIG_STORAGE_KEY_PREFIX}:${resumeId}`)
    if (!storedValue) {
      setPdfPreviewConfig(DEFAULT_RESUME_PDF_PREVIEW_CONFIG)
      return
    }

    try {
      const parsed = JSON.parse(storedValue) as Partial<ResumePdfPreviewConfig>
      const parsedTemplateId = resolveResumePdfTemplateId(parsed.templateId)
      setPdfPreviewConfig({
        templateId: parsedTemplateId === 'compact' ? 'default' : parsedTemplateId,
        density: parsed.density
          ? resolveResumePdfDensity(parsed.density)
          : parsedTemplateId === 'compact'
            ? 'compact'
            : DEFAULT_RESUME_PDF_PREVIEW_CONFIG.density,
        accentPreset: resolveResumePdfAccentPreset(parsed.accentPreset),
        headingStyle: resolveResumePdfHeadingStyle(parsed.headingStyle),
      })
    } catch {
      setPdfPreviewConfig(DEFAULT_RESUME_PDF_PREVIEW_CONFIG)
    }
  }, [resumeId])

  useEffect(() => {
    if (typeof window === 'undefined' || !resumeId) {
      return
    }

    window.localStorage.setItem(
      `${RESUME_PDF_PREVIEW_CONFIG_STORAGE_KEY_PREFIX}:${resumeId}`,
      JSON.stringify(pdfPreviewConfig)
    )
  }, [pdfPreviewConfig, resumeId])

  const updateEditorLocation = useCallback((nextView: EditorView, moduleType?: ModuleType | null) => {
    const nextParams = new URLSearchParams()
    const effectiveModuleType = moduleType ?? activeModuleType
    if (effectiveModuleType) {
      nextParams.set('moduleType', effectiveModuleType)
    }
    if (nextView !== 'module') {
      nextParams.set('view', nextView)
    }
    setSearchParams(nextParams, { replace: true })
  }, [activeModuleType, setSearchParams])

  const openAnalysisMembershipPage = useCallback(async (replace = false) => {
    if (membershipNavigationPendingRef.current) {
      return
    }
    membershipNavigationPendingRef.current = true
    setMembershipNavigationPending(true)
    setMembershipNavigationError('')

    const nextParams = new URLSearchParams(location.search)
    if (activeModuleType) {
      nextParams.set('moduleType', activeModuleType)
    }
    nextParams.set('view', 'analysis')
    const query = nextParams.toString()
    const returnTo = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`
    try {
      await flushResumeAutoSaves(resumeId)
      navigate(buildMembershipPath(returnTo), { replace })
    } catch (err: unknown) {
      setMembershipNavigationError(
        err instanceof Error ? err.message : '简历保存失败，请重试',
      )
    } finally {
      membershipNavigationPendingRef.current = false
      setMembershipNavigationPending(false)
    }
  }, [activeModuleType, location.hash, location.pathname, location.search, navigate, resumeId])

  useEffect(() => {
    if (!user || isVip || requestedView !== 'analysis') {
      return
    }

    setAiModuleId(null)
    void openAnalysisMembershipPage(true)
  }, [isVip, openAnalysisMembershipPage, requestedView, user])

  useEffect(() => {
    if (user && !isVip) {
      setAiModuleId(null)
    }
  }, [isVip, user])

  useEffect(() => {
    if (!resumeId || requestedView !== 'module' || requestedModuleType || !initialModuleType) {
      return
    }

    updateEditorLocation('module', initialModuleType)
  }, [resumeId, requestedView, requestedModuleType, initialModuleType, updateEditorLocation])

  useEffect(() => {
    if (modules.length === 0) {
      return
    }

    const queryModuleType = initialModuleType && modules.some((module) => module.moduleType === initialModuleType)
      ? initialModuleType
      : null
    const nextActiveModuleType = queryModuleType
      ?? (activeModuleType && modules.some((module) => module.moduleType === activeModuleType)
      ? activeModuleType
      : (modules[0].moduleType as ModuleType)
      )

    if (nextActiveModuleType !== activeModuleType) {
      setActiveModuleType(nextActiveModuleType)
    }

    const currentQueryModuleType = searchParams.get('moduleType')
    const currentQueryViewParam = searchParams.get('view')
    const currentQueryView: EditorView = currentQueryViewParam === 'analysis'
      ? 'analysis'
      : currentQueryViewParam === 'chrome-preview' || currentQueryViewParam === 'template-selection'
        ? 'template-selection'
        : 'module'
    if (nextActiveModuleType && (currentQueryModuleType !== nextActiveModuleType || currentQueryView !== editorView)) {
      updateEditorLocation(editorView, nextActiveModuleType)
    }
  }, [modules, activeModuleType, initialModuleType, searchParams, editorView, updateEditorLocation])

  useEffect(() => {
    if (modules.length === 0) {
      return
    }

    const currentQueryViewParam = searchParams.get('view')
    const currentQueryView: EditorView = currentQueryViewParam === 'analysis'
      ? 'analysis'
      : currentQueryViewParam === 'chrome-preview' || currentQueryViewParam === 'template-selection'
        ? 'template-selection'
        : 'module'
    if (currentQueryView !== editorView) {
      updateEditorLocation(editorView)
    }
  }, [editorView, modules.length, searchParams, updateEditorLocation])

  useEffect(() => {
    if (
      !resumeId
      || !modulesLoaded
      || loading
      || initializingBasicInfo
      || modules.some((module) => module.moduleType === 'basic_info')
    ) {
      return
    }

    let cancelled = false
    setInitializingBasicInfo(true)

    void addModule(resumeId, 'basic_info', getDefaultContent('basic_info'), 0)
      .catch((error) => {
        if (!cancelled) {
          if (import.meta.env.DEV) {
            console.error('初始化基本信息模块失败:', error instanceof Error ? error.name : 'Error')
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInitializingBasicInfo(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [resumeId, modulesLoaded, loading, initializingBasicInfo, modules, addModule])

  const openModuleView = useCallback((moduleType: ModuleType) => {
    setActiveModuleType(moduleType)
    setEditorView('module')
    updateEditorLocation('module', moduleType)
  }, [updateEditorLocation])

  const openAnalysisView = useCallback(() => {
    if (!isVip) {
      setAiModuleId(null)
      void openAnalysisMembershipPage()
      return
    }
    setAiModuleId(null)
    setEditorView('analysis')
    updateEditorLocation('analysis')
  }, [isVip, openAnalysisMembershipPage, updateEditorLocation])

  const openAiOptimize = useCallback((moduleId: number) => {
    if (!isVip) {
      setMembershipModalOpen(true)
      return
    }
    setAiModuleId(moduleId)
  }, [isVip])

  const openTemplateSelectionView = useCallback(() => {
    setAiModuleId(null)
    setEditorView('template-selection')
    updateEditorLocation('template-selection')
  }, [updateEditorLocation])

  const handleAddModule = useCallback(
    async (moduleType: ModuleType) => {
      const defaultContent = getDefaultContent(moduleType)
      await addModule(resumeId, moduleType, defaultContent)
      setActiveModuleType(moduleType)
      setEditorView('module')
      updateEditorLocation('module', moduleType)
    },
    [resumeId, addModule, updateEditorLocation]
  )

  const handleDeleteModule = useCallback(
    async () => {
      if (!deleteDialog) {
        return
      }

      setDeletingModuleId(deleteDialog.moduleIds[0] ?? null)
      try {
        for (const moduleId of deleteDialog.moduleIds) {
          await deleteModule(resumeId, moduleId)
        }
        setDeleteDialog(null)
      } finally {
        setDeletingModuleId(null)
      }
    },
    [deleteDialog, resumeId, deleteModule]
  )

  const openDeleteDialog = useCallback((moduleIds: number[], moduleType: ModuleType, itemLabel: string) => {
    if (moduleIds.length === 0) {
      return
    }

    setDeleteDialog({
      moduleIds,
      moduleLabel: getModuleDisplayLabelFromModules(moduleType, modules),
      itemLabel,
    })
  }, [modules])

  const handleAddInstanceOfType = useCallback(
    async (moduleType: ModuleType) => {
      const defaultContent = getDefaultContent(moduleType)
      await addModule(resumeId, moduleType, defaultContent)
      setEditorView('module')
      updateEditorLocation('module', moduleType)
    },
    [resumeId, addModule, updateEditorLocation]
  )

  const closeMobileModuleMenu = useCallback(() => {
    setMobileModuleMenuOpen(false)
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => mobileModuleTriggerRef.current?.focus())
    }
  }, [])

  const closeCompactPreview = useCallback(() => {
    setCompactPreviewOpen(false)
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        const mobileTrigger = mobilePreviewToggleRef.current
        if (mobileTrigger && mobileTrigger.getClientRects().length > 0) {
          mobileTrigger.focus()
          return
        }
        previewToggleRef.current?.focus()
      })
    }
  }, [])

  const handlePreviewToggle = useCallback(() => {
    if (isCompactViewport) {
      setMobileModuleMenuOpen(false)
      setCompactPreviewOpen((current) => !current)
      return
    }

    setDesktopPreviewCollapsed((current) => !current)
  }, [isCompactViewport])

  const activeModules = modules.filter((m) => m.moduleType === activeModuleType)
  const canAddAnotherInstance = activeModuleType ? !SINGLETON_MODULES.includes(activeModuleType) : false
  const canOptimizeActiveModule = activeModuleType ? AI_OPTIMIZABLE_MODULE_TYPES.has(activeModuleType) : false
  const canDeleteActiveModule = activeModuleType ? !NON_REMOVABLE_MODULE_TYPES.has(activeModuleType) : false
  const previewOpen = isCompactViewport ? compactPreviewOpen : !desktopPreviewCollapsed
  const inlinePreviewOpen = !isCompactViewport && previewOpen
  const analysisContainerClassName = inlinePreviewOpen ? 'mx-auto max-w-4xl' : 'mx-auto max-w-6xl'
  const moduleContainerClassName = inlinePreviewOpen ? 'mx-auto max-w-3xl' : 'mx-auto max-w-5xl'
  const previewToggleStyle = inlinePreviewOpen
    ? { right: `calc((100vw - ${DESKTOP_MODULE_SIDEBAR_WIDTH}) / 2 - 16px)` }
    : undefined
  const previewTogglePositionClassName = previewOpen
    ? (isCompactViewport ? 'right-3' : '')
    : 'right-3 sm:right-[42px]'

  const updateEditorScrollIndicator = useCallback(() => {
    const scroller = editorScrollRef.current
    const thumb = editorScrollThumbRef.current
    if (!scroller || !thumb) return

    const scrollRange = scroller.scrollHeight - scroller.clientHeight
    if (scrollRange <= 1 || !inlinePreviewOpen || editorView === 'template-selection') {
      thumb.style.display = 'none'
      return
    }

    const thumbHeight = Math.max(48, scroller.clientHeight * scroller.clientHeight / scroller.scrollHeight)
    const thumbTravel = Math.max(0, scroller.clientHeight - thumbHeight)
    const thumbTop = scrollRange > 0 ? scroller.scrollTop / scrollRange * thumbTravel : 0
    thumb.style.display = 'block'
    thumb.style.height = `${thumbHeight}px`
    thumb.style.transform = `translateY(${thumbTop}px)`
  }, [editorView, inlinePreviewOpen])

  useEffect(() => {
    const scroller = editorScrollRef.current
    if (!scroller || typeof window === 'undefined') return

    let frameId = 0
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(updateEditorScrollIndicator)
    }
    const resizeObserver = new ResizeObserver(scheduleUpdate)
    const mutationObserver = new MutationObserver(scheduleUpdate)

    resizeObserver.observe(scroller)
    mutationObserver.observe(scroller, { childList: true, subtree: true, characterData: true })
    window.addEventListener('resize', scheduleUpdate)
    scheduleUpdate()

    return () => {
      window.cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [activeModuleType, editorView, modules, updateEditorScrollIndicator])

  const handleEditorScrollThumbPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const scroller = editorScrollRef.current
    const thumb = editorScrollThumbRef.current
    if (!scroller || !thumb) return

    event.preventDefault()
    const startY = event.clientY
    const startScrollTop = scroller.scrollTop
    const thumbTravel = scroller.clientHeight - thumb.getBoundingClientRect().height
    const scrollRange = scroller.scrollHeight - scroller.clientHeight
    if (thumbTravel <= 0 || scrollRange <= 0) return

    const handlePointerMove = (moveEvent: PointerEvent) => {
      scroller.scrollTop = startScrollTop + (moveEvent.clientY - startY) * scrollRange / thumbTravel
    }
    const stopDragging = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopDragging)
      window.removeEventListener('pointercancel', stopDragging)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)
  }, [])

  const handleEditorScrollIndicatorWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    const scroller = editorScrollRef.current
    if (!scroller) return
    event.preventDefault()
    scroller.scrollTop += event.deltaY
  }, [])
  const mobileWorkspaceLabel = editorView === 'analysis'
    ? '简历分析'
    : editorView === 'template-selection'
      ? '预览与导出'
      : activeModuleType
        ? getModuleDisplayLabelFromModules(activeModuleType, modules)
        : '选择模块'

  const handleExportPdf = useCallback(async (pageMode: ResumePdfPageMode) => {
    if (modules.length === 0) {
      setExportError('请先完善简历内容后再导出 PDF')
      return
    }

    if (user?.membershipStatus !== 'ACTIVE') {
      setMembershipModalOpen(true)
      return
    }

    setExporting(true)
    setExportError('')
    try {
      await flushResumeAutoSaves(resumeId)
      // Refresh after flushing so private OSS photos always use a newly signed
      // read URL, even when the editor has stayed open past the URL's TTL.
      const { data: latestModuleResponse } = await resumeApi.getModules(resumeId)
      const latestModules = latestModuleResponse.data
      if (latestModules.length === 0) {
        throw new Error('请先完善简历内容后再导出 PDF')
      }
      await downloadResumePdf(latestModules, resumeId, {
        pageMode,
        documentTitle: resumeTitle,
        templateId: pdfPreviewConfig.templateId,
        density: pdfPreviewConfig.density,
        accentPreset: pdfPreviewConfig.accentPreset,
        headingStyle: pdfPreviewConfig.headingStyle,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '导出 PDF 失败，请稍后重试'
      if (message.includes('会员')) {
        setMembershipModalOpen(true)
      }
      setExportError(message)
    } finally {
      setExporting(false)
    }
  }, [modules.length, pdfPreviewConfig.accentPreset, pdfPreviewConfig.density, pdfPreviewConfig.headingStyle, pdfPreviewConfig.templateId, resumeId, resumeTitle, user?.membershipStatus])

  const closeResumeReviewModal = useCallback(() => {
    setResumeReviewModalOpen(false)
    window.requestAnimationFrame(() => resumeReviewTriggerRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!resumeReviewEnabled) {
      setResumeReviewModalOpen(false)
    }
  }, [resumeReviewEnabled])

  const renderModuleForm = (moduleId: number, content: Record<string, unknown>) => {
    if (!activeModuleType) return null
    const jobIntentionModule = modules.find((module) => module.moduleType === 'job_intention')
    const mergedBasicInfoContent = activeModuleType === 'basic_info' && jobIntentionModule
      ? {
          ...content,
          jobIntention: (content.jobIntention as string) || normalizeJobIntentionContent(jobIntentionModule.content).targetPosition,
          targetCity: (content.targetCity as string) || normalizeJobIntentionContent(jobIntentionModule.content).targetCity,
        }
      : content
    const props = { resumeId, moduleId, initialContent: mergedBasicInfoContent }
    switch (activeModuleType) {
      case 'basic_info': return <BasicInfoForm {...props} />
      case 'education': return <EducationForm {...props} />
      case 'internship': return <InternshipForm {...props} />
      case 'work_experience': return <WorkExperienceForm {...props} />
      case 'project': return <ProjectForm {...props} />
      case 'skill': return <SkillForm {...props} />
      case 'paper': return <PaperForm {...props} />
      case 'research': return <ResearchForm {...props} />
      case 'award': return <AwardForm {...props} />
      case 'job_intention': return null
    }
  }

  return (
    <div className="flex h-screen h-[100dvh] min-h-0 flex-col overflow-hidden bg-gray-50">
      <Header enableResumeDrop />

      {mobileModuleMenuOpen ? (
        <div className="fixed inset-x-0 bottom-0 top-[65px] z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]"
            onClick={closeMobileModuleMenu}
            aria-label="关闭模块菜单"
          />
          <div
            ref={mobileModuleDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="选择简历模块"
            tabIndex={-1}
            className="relative flex h-full w-[min(20rem,calc(100vw-3rem))] flex-col bg-white shadow-2xl outline-none"
          >
            <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4">
              <p className="text-sm font-semibold text-gray-900">选择模块</p>
              <button
                type="button"
                onClick={closeMobileModuleMenu}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
                aria-label="关闭模块菜单"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <ModuleSidebar
                variant="drawer"
                modules={modules}
                activeModuleType={activeModuleType}
                onSelect={(moduleType) => {
                  openModuleView(moduleType)
                  closeMobileModuleMenu()
                }}
                onAddModule={(moduleType) => {
                  closeMobileModuleMenu()
                  void handleAddModule(moduleType)
                }}
                onRemoveModuleType={(moduleType) => {
                  const moduleIds = modules
                    .filter((module) => module.moduleType === moduleType)
                    .map((module) => module.id)
                  closeMobileModuleMenu()
                  openDeleteDialog(moduleIds, moduleType, moduleIds.length > 1 ? '全部内容' : '当前内容')
                }}
                analysisActive={editorView === 'analysis'}
                onSelectAnalysis={() => {
                  openAnalysisView()
                  closeMobileModuleMenu()
                }}
                templateSelectionActive={editorView === 'template-selection'}
                onSelectTemplateSelection={() => {
                  openTemplateSelectionView()
                  closeMobileModuleMenu()
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {editorView !== 'template-selection' && (
        <button
          ref={previewToggleRef}
          type="button"
          onClick={handlePreviewToggle}
          aria-label={previewOpen ? '收起预览面板' : '展开预览面板'}
          aria-expanded={previewOpen}
          aria-controls="resume-preview-panel"
          title={previewOpen ? '收起预览面板' : '展开预览面板'}
          style={previewToggleStyle}
          className={`fixed top-1/2 z-30 hidden h-24 w-8 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-500 shadow-[0_18px_38px_-18px_rgba(15,23,42,0.32)] backdrop-blur transition hover:border-primary-200 hover:text-primary-700 motion-reduce:transition-none sm:flex ${previewTogglePositionClassName}`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {!previewOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 5l-7 7 7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
            )}
          </svg>
          <span className="mt-2 text-[10px] font-semibold tracking-[0.28em] [writing-mode:vertical-rl]">
            预览
          </span>
        </button>
      )}

      {editorView !== 'template-selection' && isCompactViewport && previewOpen ? (
        <button
          type="button"
          className="fixed inset-x-0 bottom-0 top-[65px] z-10 bg-slate-950/25 backdrop-blur-[1px]"
          onClick={closeCompactPreview}
          aria-label="关闭预览面板"
        />
      ) : null}

      {editorView !== 'template-selection' && !previewOpen && (
        <div className="fixed right-0 top-[65px] z-20 hidden h-[calc(100vh-65px)] w-14 border-l border-gray-200 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_45%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] sm:block">
          <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-400">
            <div className="flex flex-col gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-200" />
              <span className="h-1.5 w-1.5 rounded-full bg-primary-300" />
              <span className="h-1.5 w-1.5 rounded-full bg-primary-400" />
            </div>
            <span className="text-[11px] font-medium tracking-[0.32em] text-gray-500 [writing-mode:vertical-rl]">
              右侧预览
            </span>
          </div>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 items-stretch overflow-hidden">
        <ModuleSidebar
          modules={modules}
          activeModuleType={activeModuleType}
          onSelect={openModuleView}
          onAddModule={handleAddModule}
          onRemoveModuleType={(moduleType) => {
            const moduleIds = modules
              .filter((module) => module.moduleType === moduleType)
              .map((module) => module.id)
            openDeleteDialog(moduleIds, moduleType, moduleIds.length > 1 ? '全部内容' : '当前内容')
          }}
          analysisActive={editorView === 'analysis'}
          onSelectAnalysis={openAnalysisView}
          templateSelectionActive={editorView === 'template-selection'}
          onSelectTemplateSelection={openTemplateSelectionView}
        />

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6 xl:px-8">
          {membershipNavigationError ? (
            <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {membershipNavigationError}
            </div>
          ) : null}

          <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
            <button
              ref={mobileModuleTriggerRef}
              type="button"
              onClick={() => {
                setCompactPreviewOpen(false)
                setMobileModuleMenuOpen(true)
              }}
              aria-haspopup="dialog"
              aria-expanded={mobileModuleMenuOpen}
              className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-primary-200 hover:text-primary-700"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="truncate">模块 · {mobileWorkspaceLabel}</span>
            </button>
            {editorView !== 'template-selection' ? (
              <button
                ref={mobilePreviewToggleRef}
                type="button"
                onClick={handlePreviewToggle}
                aria-label={previewOpen ? '收起预览面板' : '展开预览面板'}
                aria-expanded={previewOpen}
                aria-controls="resume-preview-panel"
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-primary-200 hover:text-primary-700 sm:hidden"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="2.5" strokeWidth={2} />
                </svg>
                预览
              </button>
            ) : null}
          </div>

          {resumeReviewEnabled ? (
            <div className="mb-4 flex justify-end">
              <button
                ref={resumeReviewTriggerRef}
                type="button"
                onClick={() => setResumeReviewModalOpen(true)}
                className="group inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-left shadow-sm transition hover:border-primary-300 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
                aria-haspopup="dialog"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 transition group-hover:bg-primary-200" aria-hidden="true">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </span>
                <span className="text-sm font-semibold text-slate-900">请二哥帮我改简历</span>
              </button>
            </div>
          ) : null}

          {editorView === 'analysis' ? (
            <div className={analysisContainerClassName}>
              {exportError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {exportError}
                </div>
              )}

              {isVip ? (
                <ResumeAnalysis resumeId={resumeId} />
              ) : (
                <div className="rounded-xl border border-primary-200 bg-primary-50 px-6 py-10 text-center">
                  <h2 className="text-lg font-semibold text-gray-900">AI 简历分析为 VIP 功能</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-600">开通 VIP 后可使用 AI 分析与优化。</p>
                  <button
                    type="button"
                    onClick={() => void openAnalysisMembershipPage()}
                    disabled={membershipNavigationPending}
                    className="mt-5 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
                  >
                    {membershipNavigationPending ? '正在保存...' : '查看会员方案'}
                  </button>
                </div>
              )}
            </div>
          ) : editorView === 'template-selection' ? (
            <ChromePreviewFrame
              resumeId={resumeId}
              config={pdfPreviewConfig}
              onConfigChange={setPdfPreviewConfig}
              onExportPdf={(pageMode) => void handleExportPdf(pageMode)}
              isVip={isVip}
              onRequireVip={() => setMembershipModalOpen(true)}
              exporting={exporting}
              exportError={exportError}
            />
          ) : activeModuleType ? (
            <div className={moduleContainerClassName}>
              {exportError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {exportError}
                </div>
              )}

              <div className="mb-4 flex justify-end">
                {activeModules.length > 0 && canAddAnotherInstance && (
                  <button
                    onClick={() => handleAddInstanceOfType(activeModuleType)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    + 添加
                  </button>
                )}
              </div>

              {activeModules.length > 0 ? (
                <div className="space-y-4">
                  {activeModules.map((mod, index) => (
                    <div key={mod.id} className="editor-form-container rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                      {activeModules.length > 1 && (
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-500">
                            第 {index + 1} 条
                          </span>
                          <div className="flex gap-2">
                            {canOptimizeActiveModule && (
                              <button
                                onClick={() => openAiOptimize(mod.id)}
                                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                AI 优化{isVip ? '' : ' · VIP'}
                              </button>
                            )}
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => openDeleteDialog([mod.id], activeModuleType, `第 ${index + 1} 条`)}
                              className="text-xs text-gray-400 hover:text-red-500"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      )}
                      {activeModules.length === 1 && (canOptimizeActiveModule || canDeleteActiveModule) && (
                        <div className="mb-3 flex justify-end gap-2">
                          {canOptimizeActiveModule && (
                            <button
                              onClick={() => openAiOptimize(mod.id)}
                              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              AI 优化{isVip ? '' : ' · VIP'}
                            </button>
                          )}
                          {canDeleteActiveModule && (
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => openDeleteDialog([mod.id], activeModuleType, '当前内容')}
                              className="text-xs text-gray-400 hover:text-red-500"
                            >
                              删除
                            </button>
                          )}
                        </div>
                      )}
                      {renderModuleForm(mod.id, mod.content)}
                    </div>
                  ))}
                </div>
              ) : activeModuleType === 'basic_info' && initializingBasicInfo ? (
                <div className="text-center py-12 text-gray-400">
                  正在初始化基本信息...
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  该模块尚未添加
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400">
              请选择模块
            </div>
          )}
        </main>

        {editorView !== 'template-selection' && (
          <aside
            id="resume-preview-panel"
            ref={compactPreviewDialogRef}
            role={isCompactViewport && previewOpen ? 'dialog' : undefined}
            aria-modal={isCompactViewport && previewOpen ? true : undefined}
            aria-label={isCompactViewport && previewOpen ? '简历预览' : undefined}
            tabIndex={isCompactViewport && previewOpen ? -1 : undefined}
            className={`border-l border-gray-200 bg-gray-50 outline-none transition-[width,min-width,max-width,padding,flex-basis] duration-300 ease-out motion-reduce:transition-none ${
              previewOpen
                ? isCompactViewport
                  ? 'fixed bottom-0 right-0 top-[65px] z-20 h-[calc(100vh-65px)] w-full max-w-[540px] overflow-y-auto p-4 sm:p-6'
                  : 'h-full min-h-0 min-w-0 flex-1 basis-0 overflow-y-auto p-6 xl:px-8'
                : 'hidden h-full min-h-0 shrink-0 sm:block sm:w-14 sm:min-w-14 sm:max-w-14 sm:p-0'
            }`}
          >
            <div className="relative min-h-full">
              {isCompactViewport && previewOpen ? (
                <div className="mb-3 flex justify-end sm:hidden">
                  <button
                    type="button"
                    onClick={closeCompactPreview}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:border-primary-200 hover:text-primary-700"
                    aria-label="关闭预览浮层"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    返回编辑
                  </button>
                </div>
              ) : null}
              {previewOpen && (
                <PreviewPanel
                  modules={modules}
                  loading={loading}
                  activeModuleType={editorView === 'module' ? activeModuleType : null}
                  pdfConfig={pdfPreviewConfig}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {aiModuleId && isVip && (
        <AiOptimizePanel
          resumeId={resumeId}
          moduleId={aiModuleId}
          onClose={() => setAiModuleId(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteDialog)}
        title="删除模块内容"
        description={deleteDialog
          ? `确定删除${deleteDialog.moduleLabel}中的${deleteDialog.itemLabel}吗？删除后将无法恢复。`
          : ''}
        confirmText="确认删除"
        cancelText="先保留"
        tone="danger"
        loading={deleteDialog !== null && deletingModuleId !== null}
        onConfirm={handleDeleteModule}
        onCancel={() => {
          if (deletingModuleId !== null) {
            return
          }
          setDeleteDialog(null)
        }}
      />

      <MembershipUpgradeModal
        open={membershipModalOpen}
        onClose={() => setMembershipModalOpen(false)}
      />

      {user && resumeReviewEnabled ? (
        <ResumeReviewModal
          open={resumeReviewModalOpen}
          resumeId={resumeId}
          userId={user.id}
          accountEmail={user.email}
          onClose={closeResumeReviewModal}
        />
      ) : null}
    </div>
  )
}

function getDefaultContentMap(): Record<ModuleType, Record<string, unknown>> {
  return {
    basic_info: {
      name: '', email: '', jobIntention: '', targetCity: '', salaryRange: '', expectedEntryDate: '', phone: '', wechat: '', isPartyMember: false,
      photo: '', photoBorder: false, hometown: '', blog: '', github: '', leetcode: '', workYears: '',
      summary: '',
    },
    education: {
      school: '', schoolLogo: '', department: '', major: '', degree: '',
      startDate: '', endDate: '', is985: false, is211: false, isDoubleFirst: false,
    },
    internship: {
      company: '', projectName: '', position: '', startDate: '', endDate: '',
      techStack: '', projectDescription: '', responsibilities: [],
    },
    work_experience: {
      company: '', projectName: '', position: '', startDate: '', endDate: '',
      techStack: '', projectDescription: '', responsibilities: [],
    },
    project: {
      projectName: '', role: '', startDate: '', endDate: '', techStack: '',
      description: '', achievements: [],
    },
    skill: { categories: [{ name: '', items: [] }] },
    paper: { journalType: '', journalName: '', publishTime: '', content: '' },
    research: { projectName: '', projectCycle: '', background: '', workContent: '', achievements: '' },
    award: { awardName: '', awardTime: '' },
    job_intention: { targetPosition: '', targetCity: '', salaryRange: '', expectedEntryDate: '' },
  }
}

function getDefaultContent(moduleType: ModuleType): Record<string, unknown> {
  return getDefaultContentMap()[moduleType]
}
