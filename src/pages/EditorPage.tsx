import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { resumeApi } from '../api/resume'
import { useAuthStore } from '../store/authStore'
import { useResumeStore } from '../store/resumeStore'
import { Header } from '../components/layout/Header'
import { ModuleSidebar } from '../components/editor/ModuleSidebar'
import { PreviewPanel } from '../components/editor/PreviewPanel'
import { ChromePreviewFrame } from '../components/editor/ChromePreviewFrame'
import { AiOptimizePanel } from '../components/analysis/AiOptimizePanel'
import { ResumeAnalysis } from '../components/analysis/ResumeAnalysis'
import { BasicInfoForm } from '../components/modules/BasicInfoForm'
import { EducationForm } from '../components/modules/EducationForm'
import { InternshipForm } from '../components/modules/InternshipForm'
import { ProjectForm } from '../components/modules/ProjectForm'
import { SkillForm } from '../components/modules/SkillForm'
import { PaperForm } from '../components/modules/PaperForm'
import { ResearchForm } from '../components/modules/ResearchForm'
import { AwardForm } from '../components/modules/AwardForm'
import { MembershipUpgradeModal } from '../components/membership/MembershipUpgradeModal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { SINGLETON_MODULES, type ModuleType } from '../types'
import { normalizeJobIntentionContent } from '../utils/moduleContent'
import { getModuleDisplayLabelFromModules } from '../utils/resumeDisplay'
import {
  DEFAULT_RESUME_PDF_PREVIEW_CONFIG,
  resolveResumePdfAccentPreset,
  resolveResumePdfDensity,
  resolveResumePdfHeadingStyle,
  resolveResumePdfTemplateId,
  type ResumePdfPageMode,
  type ResumePdfPreviewConfig,
} from '../utils/resumePdf'

type EditorView = 'module' | 'analysis' | 'template-selection'
const AI_OPTIMIZABLE_MODULE_TYPES = new Set<ModuleType>(['research', 'skill'])
const PREVIEW_PANEL_COLLAPSED_STORAGE_KEY = 'pai-resume.preview-panel-collapsed'
const RESUME_PDF_PREVIEW_CONFIG_STORAGE_KEY_PREFIX = 'pai-resume.pdf-preview-config'

interface DeleteDialogState {
  moduleId: number
  moduleLabel: string
  itemLabel: string
}

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const { modules, loading, fetchModules, addModule, deleteModule } = useResumeStore()
  const [activeModuleType, setActiveModuleType] = useState<ModuleType | null>(null)
  const [aiModuleId, setAiModuleId] = useState<number | null>(null)
  const [editorView, setEditorView] = useState<EditorView>('module')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [membershipModalOpen, setMembershipModalOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)
  const [deletingModuleId, setDeletingModuleId] = useState<number | null>(null)
  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  const [pdfPreviewConfig, setPdfPreviewConfig] = useState<ResumePdfPreviewConfig>(DEFAULT_RESUME_PDF_PREVIEW_CONFIG)

  const resumeId = Number(id)
  const requestedModuleType = searchParams.get('moduleType')
  const requestedViewParam = searchParams.get('view')
  const requestedView: EditorView = requestedViewParam === 'analysis'
    ? 'analysis'
    : requestedViewParam === 'chrome-preview' || requestedViewParam === 'template-selection'
      ? 'template-selection'
      : 'module'
  const initialModuleType = requestedModuleType && requestedModuleType in getDefaultContentMap()
    ? requestedModuleType as ModuleType
    : requestedView === 'module'
      ? 'basic_info'
      : null

  useEffect(() => {
    if (resumeId) {
      setActiveModuleType(initialModuleType)
      setAiModuleId(null)
      setEditorView(requestedView)
      void fetchModules(resumeId)
    }
  }, [resumeId, fetchModules, initialModuleType, requestedView])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    setPreviewCollapsed(window.localStorage.getItem(PREVIEW_PANEL_COLLAPSED_STORAGE_KEY) === 'true')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(PREVIEW_PANEL_COLLAPSED_STORAGE_KEY, String(previewCollapsed))
  }, [previewCollapsed])

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

  const openModuleView = useCallback((moduleType: ModuleType) => {
    setActiveModuleType(moduleType)
    setEditorView('module')
    updateEditorLocation('module', moduleType)
  }, [updateEditorLocation])

  const openAnalysisView = useCallback(() => {
    setAiModuleId(null)
    setEditorView('analysis')
    updateEditorLocation('analysis')
  }, [updateEditorLocation])

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

      setDeletingModuleId(deleteDialog.moduleId)
      try {
        await deleteModule(resumeId, deleteDialog.moduleId)
        setDeleteDialog(null)
      } finally {
        setDeletingModuleId(null)
      }
    },
    [deleteDialog, resumeId, deleteModule]
  )

  const handleAddInstanceOfType = useCallback(
    async (moduleType: ModuleType) => {
      const defaultContent = getDefaultContent(moduleType)
      await addModule(resumeId, moduleType, defaultContent)
      setEditorView('module')
      updateEditorLocation('module', moduleType)
    },
    [resumeId, addModule, updateEditorLocation]
  )

  const activeModules = modules.filter((m) => m.moduleType === activeModuleType)
  const canAddAnotherInstance = activeModuleType ? !SINGLETON_MODULES.includes(activeModuleType) : false
  const canOptimizeActiveModule = activeModuleType ? AI_OPTIMIZABLE_MODULE_TYPES.has(activeModuleType) : false
  const analysisContainerClassName = previewCollapsed ? 'mx-auto max-w-6xl' : 'mx-auto max-w-4xl'
  const moduleContainerClassName = previewCollapsed ? 'mx-auto max-w-5xl' : 'mx-auto max-w-3xl'
  const previewToggleRight = previewCollapsed
    ? '42px'
    : 'calc(clamp(500px, 42vw, 540px) - 16px)'

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
      const { blob, fileName } = await resumeApi.exportPdf(resumeId, {
        pageMode,
        templateId: pdfPreviewConfig.templateId,
        density: pdfPreviewConfig.density,
        accentPreset: pdfPreviewConfig.accentPreset,
        headingStyle: pdfPreviewConfig.headingStyle,
      })
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(objectUrl)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '导出 PDF 失败，请稍后重试'
      if (message.includes('会员')) {
        setMembershipModalOpen(true)
      }
      setExportError(message)
    } finally {
      setExporting(false)
    }
  }, [modules.length, pdfPreviewConfig.accentPreset, pdfPreviewConfig.density, pdfPreviewConfig.headingStyle, pdfPreviewConfig.templateId, resumeId, user?.membershipStatus])

  const renderModuleForm = (moduleId: number, content: Record<string, unknown>) => {
    if (!activeModuleType) return null
    const jobIntentionModule = modules.find((module) => module.moduleType === 'job_intention')
    const mergedBasicInfoContent = activeModuleType === 'basic_info' && jobIntentionModule
      ? {
          ...content,
          jobIntention: (content.jobIntention as string) || normalizeJobIntentionContent(jobIntentionModule.content).targetPosition,
          targetCity: (content.targetCity as string) || normalizeJobIntentionContent(jobIntentionModule.content).targetCity,
          salaryRange: (content.salaryRange as string) || normalizeJobIntentionContent(jobIntentionModule.content).salaryRange,
          expectedEntryDate: (content.expectedEntryDate as string) || normalizeJobIntentionContent(jobIntentionModule.content).expectedEntryDate,
        }
      : content
    const props = { resumeId, moduleId, initialContent: mergedBasicInfoContent }
    switch (activeModuleType) {
      case 'basic_info': return <BasicInfoForm {...props} />
      case 'education': return <EducationForm {...props} />
      case 'internship': return <InternshipForm {...props} />
      case 'project': return <ProjectForm {...props} />
      case 'skill': return <SkillForm {...props} />
      case 'paper': return <PaperForm {...props} />
      case 'research': return <ResearchForm {...props} />
      case 'award': return <AwardForm {...props} />
      case 'job_intention': return null
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header
      />

      {editorView !== 'template-selection' && (
        <button
          type="button"
          onClick={() => setPreviewCollapsed((current) => !current)}
          aria-label={previewCollapsed ? '展开预览面板' : '收起预览面板'}
          title={previewCollapsed ? '展开预览面板' : '收起预览面板'}
          style={{ right: previewToggleRight }}
          className="fixed top-1/2 z-30 flex h-24 w-8 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-500 shadow-[0_18px_38px_-18px_rgba(15,23,42,0.32)] backdrop-blur transition hover:border-primary-200 hover:text-primary-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {previewCollapsed ? (
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

      {editorView !== 'template-selection' && previewCollapsed && (
        <div className="fixed right-0 top-[65px] z-20 h-[calc(100vh-65px)] w-14 border-l border-gray-200 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_45%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
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

      <div className="flex flex-1 items-start">
        <ModuleSidebar
          modules={modules}
          activeModuleType={activeModuleType}
          onSelect={openModuleView}
          onAddModule={handleAddModule}
          analysisActive={editorView === 'analysis'}
          onSelectAnalysis={openAnalysisView}
          templateSelectionActive={editorView === 'template-selection'}
          onSelectTemplateSelection={openTemplateSelectionView}
        />

        <main className="min-w-0 flex-1 px-6 py-6 xl:px-8">
          {editorView === 'analysis' ? (
            <div className={analysisContainerClassName}>
              {exportError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {exportError}
                </div>
              )}

              <ResumeAnalysis resumeId={resumeId} />
            </div>
          ) : editorView === 'template-selection' ? (
            <ChromePreviewFrame
              resumeId={resumeId}
              config={pdfPreviewConfig}
              onConfigChange={setPdfPreviewConfig}
              onExportPdf={(pageMode) => void handleExportPdf(pageMode)}
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
                    <div key={mod.id} className="bg-white rounded-xl border border-gray-200 p-5">
                      {activeModules.length > 1 && (
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-500">
                            第 {index + 1} 条
                          </span>
                          <div className="flex gap-2">
                            {canOptimizeActiveModule && (
                              <button
                                onClick={() => setAiModuleId(mod.id)}
                                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                AI 优化
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteDialog({
                                moduleId: mod.id,
                                moduleLabel: getModuleDisplayLabelFromModules(activeModuleType, modules),
                                itemLabel: `第 ${index + 1} 条`,
                              })}
                              className="text-xs text-gray-400 hover:text-red-500"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      )}
                      {activeModules.length === 1 && canOptimizeActiveModule && (
                        <div className="flex justify-end mb-3">
                          <button
                            onClick={() => setAiModuleId(mod.id)}
                            className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            AI 优化
                          </button>
                        </div>
                      )}
                      {renderModuleForm(mod.id, mod.content)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  该模块尚未添加
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400">
              请在左侧选择模块开始编辑
            </div>
          )}
        </main>

        {editorView !== 'template-selection' && (
          <aside
            className={`relative shrink-0 self-start border-l border-gray-200 bg-gray-50 transition-[width,min-width,max-width,padding] duration-300 ease-out ${
              previewCollapsed
                ? 'w-14 min-w-14 max-w-14 p-0'
                : 'w-[540px] min-w-[500px] max-w-[42vw] p-6 xl:px-8'
            }`}
          >
            <div className="relative sticky top-[89px]">
              {!previewCollapsed && (
                <PreviewPanel
                  modules={modules}
                  loading={loading}
                  pdfConfig={pdfPreviewConfig}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {aiModuleId && (
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
        loading={deleteDialog !== null && deletingModuleId === deleteDialog.moduleId}
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
    </div>
  )
}

function getDefaultContentMap(): Record<ModuleType, Record<string, unknown>> {
  return {
    basic_info: {
      name: '', email: '', jobIntention: '', targetCity: '', salaryRange: '', expectedEntryDate: '', phone: '', wechat: '', isPartyMember: false,
      photo: '', hometown: '', blog: '', github: '', leetcode: '', workYears: '',
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
