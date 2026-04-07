import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useResumeStore } from '../store/resumeStore'
import { Header } from '../components/layout/Header'
import { ModuleSidebar } from '../components/editor/ModuleSidebar'
import { PreviewPanel } from '../components/editor/PreviewPanel'
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
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { MODULE_LABELS, SINGLETON_MODULES, type ModuleType } from '../types'
import { normalizeJobIntentionContent } from '../utils/moduleContent'
import { downloadResumePdf } from '../utils/resumePdf'

type EditorView = 'module' | 'analysis'
const AI_OPTIMIZABLE_MODULE_TYPES = new Set<ModuleType>(['research', 'skill'])

interface DeleteDialogState {
  moduleId: number
  moduleLabel: string
  itemLabel: string
}

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { modules, loading, fetchModules, addModule, deleteModule } = useResumeStore()
  const [activeModuleType, setActiveModuleType] = useState<ModuleType | null>(null)
  const [aiModuleId, setAiModuleId] = useState<number | null>(null)
  const [editorView, setEditorView] = useState<EditorView>('module')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)
  const [deletingModuleId, setDeletingModuleId] = useState<number | null>(null)

  const resumeId = Number(id)
  const requestedModuleType = searchParams.get('moduleType')
  const initialModuleType = requestedModuleType && requestedModuleType in getDefaultContentMap()
    ? requestedModuleType as ModuleType
    : null

  useEffect(() => {
    if (resumeId) {
      setActiveModuleType(initialModuleType)
      setAiModuleId(null)
      setEditorView('module')
      fetchModules(resumeId)
    }
  }, [resumeId, fetchModules, initialModuleType])

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
    if (nextActiveModuleType && searchParams.get('moduleType') !== nextActiveModuleType) {
      setSearchParams({ moduleType: nextActiveModuleType }, { replace: true })
    }
  }, [modules, activeModuleType, initialModuleType, searchParams, setSearchParams])

  const updateEditorLocation = useCallback((moduleType: ModuleType) => {
    setSearchParams({ moduleType }, { replace: true })
  }, [setSearchParams])

  const handleAddModule = useCallback(
    async (moduleType: ModuleType) => {
      const defaultContent = getDefaultContent(moduleType)
      await addModule(resumeId, moduleType, defaultContent)
      setActiveModuleType(moduleType)
      setEditorView('module')
      updateEditorLocation(moduleType)
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
      updateEditorLocation(moduleType)
    },
    [resumeId, addModule, updateEditorLocation]
  )

  const activeModules = modules.filter((m) => m.moduleType === activeModuleType)
  const canAddAnotherInstance = activeModuleType ? !SINGLETON_MODULES.includes(activeModuleType) : false
  const canOptimizeActiveModule = activeModuleType ? AI_OPTIMIZABLE_MODULE_TYPES.has(activeModuleType) : false

  const handleExportPdf = useCallback(async () => {
    if (modules.length === 0) {
      setExportError('请先完善简历内容后再导出 PDF')
      return
    }

    setExporting(true)
    setExportError('')
    try {
      await downloadResumePdf(modules, resumeId)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '导出 PDF 失败，请稍后重试'
      setExportError(message)
    } finally {
      setExporting(false)
    }
  }, [modules, resumeId])

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
    <div className="h-screen flex flex-col bg-gray-50">
      <Header
        onExportPdf={() => void handleExportPdf()}
        exporting={exporting}
        smartOnePageHref={resumeId ? `/editor/${resumeId}/smart-onepage` : undefined}
      />

      <div className="flex flex-1 overflow-hidden">
        <ModuleSidebar
          modules={modules}
          activeModuleType={activeModuleType}
          onSelect={(moduleType) => {
            setActiveModuleType(moduleType)
            setEditorView('module')
            updateEditorLocation(moduleType)
          }}
          onAddModule={handleAddModule}
          analysisActive={editorView === 'analysis'}
          onSelectAnalysis={() => {
            setAiModuleId(null)
            setEditorView('analysis')
          }}
        />

        <main className="min-w-0 flex-1 overflow-y-auto p-6 xl:px-8">
          {editorView === 'analysis' ? (
            <div className="mx-auto max-w-4xl">
              {exportError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {exportError}
                </div>
              )}

              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">简历分析</h2>
                <p className="mt-1 text-sm text-gray-500">由服务端 AI 分析当前整份简历，给出更聚焦的优化建议。</p>
              </div>

              <ResumeAnalysis resumeId={resumeId} />
            </div>
          ) : activeModuleType ? (
            <div className="mx-auto max-w-3xl">
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
                                moduleLabel: MODULE_LABELS[activeModuleType],
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

        <div className="w-[540px] max-w-[42vw] min-w-[500px] overflow-y-auto border-l border-gray-200 bg-gray-50 p-6 xl:px-8">
          <PreviewPanel modules={modules} loading={loading} />
        </div>
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
