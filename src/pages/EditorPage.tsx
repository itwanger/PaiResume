import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
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
import { MODULE_LABELS, SINGLETON_MODULES, type ModuleType } from '../types'
import { normalizeJobIntentionContent } from '../utils/moduleContent'
import { downloadResumePdf } from '../utils/resumePdf'

type EditorView = 'module' | 'analysis'

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const { modules, loading, fetchModules, addModule, deleteModule } = useResumeStore()
  const [activeModuleType, setActiveModuleType] = useState<ModuleType | null>(null)
  const [aiModuleId, setAiModuleId] = useState<number | null>(null)
  const [editorView, setEditorView] = useState<EditorView>('module')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const resumeId = Number(id)

  useEffect(() => {
    if (resumeId) {
      setActiveModuleType(null)
      setAiModuleId(null)
      setEditorView('module')
      fetchModules(resumeId)
    }
  }, [resumeId, fetchModules])

  useEffect(() => {
    if (modules.length === 0) {
      return
    }

    const nextActiveModuleType = activeModuleType && modules.some((module) => module.moduleType === activeModuleType)
      ? activeModuleType
      : (modules[0].moduleType as ModuleType)

    if (nextActiveModuleType !== activeModuleType) {
      setActiveModuleType(nextActiveModuleType)
    }
  }, [modules, activeModuleType])

  const handleAddModule = useCallback(
    async (moduleType: ModuleType) => {
      const defaultContent = getDefaultContent(moduleType)
      await addModule(resumeId, moduleType, defaultContent)
      setActiveModuleType(moduleType)
      setEditorView('module')
    },
    [resumeId, addModule]
  )

  const handleDeleteModule = useCallback(
    async (moduleId: number) => {
      if (window.confirm('确定删除该模块？')) {
        await deleteModule(resumeId, moduleId)
      }
    },
    [resumeId, deleteModule]
  )

  const handleAddInstanceOfType = useCallback(
    async (moduleType: ModuleType) => {
      const defaultContent = getDefaultContent(moduleType)
      await addModule(resumeId, moduleType, defaultContent)
      setEditorView('module')
    },
    [resumeId, addModule]
  )

  const activeModules = modules.filter((m) => m.moduleType === activeModuleType)
  const canAddAnotherInstance = activeModuleType ? !SINGLETON_MODULES.includes(activeModuleType) : false

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
      />

      <div className="flex flex-1 overflow-hidden">
        <ModuleSidebar
          modules={modules}
          activeModuleType={activeModuleType}
          onSelect={(moduleType) => {
            setActiveModuleType(moduleType)
            setEditorView('module')
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

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {MODULE_LABELS[activeModuleType]}
                </h2>
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
                            <button
                              onClick={() => setAiModuleId(mod.id)}
                              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              AI 优化
                            </button>
                            <button
                              onClick={() => handleDeleteModule(mod.id)}
                              className="text-xs text-gray-400 hover:text-red-500"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      )}
                      {activeModules.length === 1 && (
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
    </div>
  )
}

function getDefaultContent(moduleType: ModuleType): Record<string, unknown> {
  const defaults: Record<ModuleType, Record<string, unknown>> = {
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
  return defaults[moduleType]
}
