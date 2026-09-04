import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ExperienceProjectContent, InternshipContent, ModuleType } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeInternshipContent } from '../../utils/moduleContent'
import { getExperienceTimelineIssues, reorderExperienceProjects } from '../../utils/experienceTimeline'
import { AutoResizeTextarea } from '../ui/AutoResizeTextarea'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { MonthInput } from '../ui/MonthInput'
import { ModuleSaveBar } from './ModuleSaveBar'
import { MaterialActions } from '../materials/MaterialActions'
import { ExperienceProjectSorter } from './ExperienceProjectSorter'
import { ExperienceResponsibilitySorter } from './ExperienceResponsibilitySorter'
import { ContinueAddButton, RepeatableListHeader } from '../ui/RepeatableListControls'
import { CollapsibleItemHeader } from '../ui/CollapsibleItemHeader'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
  moduleType: Extract<ModuleType, 'internship' | 'work_experience'>
  moduleLabel: string
  summaryPlaceholder: string
  viewMode?: 'company' | 'projects'
  onOpenProjects?: () => void
  onBackToCompanies?: () => void
}

function createProject(): ExperienceProjectContent {
  return {
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `project-${Date.now()}`,
    projectName: '',
    role: '',
    startDate: '',
    endDate: '',
    techStack: '',
    projectDescription: '',
    responsibilities: [],
  }
}

export function ExperienceModuleForm({
  resumeId,
  moduleId,
  initialContent,
  moduleType,
  moduleLabel,
  summaryPlaceholder,
  viewMode = 'company',
  onOpenProjects,
  onBackToCompanies,
}: Props) {
  const navigate = useNavigate()
  const [content, setContent, { saveNow, saveState, errorMessage, hasUnsavedChanges }] = useModuleContentState<InternshipContent>({
    resumeId,
    moduleId,
    initialContent,
    normalize: normalizeInternshipContent,
  })
  const [optimizingField, setOptimizingField] = useState<string | null>(null)
  const [optimizeError, setOptimizeError] = useState('')
  const [optimizeErrorField, setOptimizeErrorField] = useState<string | null>(null)
  const [projectSorting, setProjectSorting] = useState(false)
  const [responsibilitySortingProjectId, setResponsibilitySortingProjectId] = useState<string | null>(null)
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)
  const [pendingProjectFocusId, setPendingProjectFocusId] = useState<string | null>(null)
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<string>>(new Set())
  const [pendingResponsibilityFocus, setPendingResponsibilityFocus] = useState<{
    projectId: string
    responsibilityIndex: number
  } | null>(null)
  const timelineIssues = useMemo(() => getExperienceTimelineIssues(content), [content])

  const updateCompany = (field: 'company' | 'position' | 'startDate' | 'endDate', value: string) => {
    setContent((previous) => ({ ...previous, [field]: value }))
  }

  const updateProject = (projectIndex: number, updater: (project: ExperienceProjectContent) => ExperienceProjectContent) => {
    setContent((previous) => ({
      ...previous,
      projects: previous.projects.map((project, index) => index === projectIndex ? updater(project) : project),
    }))
  }

  const updateProjectField = (
    projectIndex: number,
    field: Exclude<keyof ExperienceProjectContent, 'id' | 'responsibilities'>,
    value: string,
  ) => updateProject(projectIndex, (project) => ({ ...project, [field]: value }))

  const addProject = () => {
    const project = createProject()
    setCollapsedProjectIds(new Set(content.projects.map((item) => item.id)))
    setResponsibilitySortingProjectId(null)
    setPendingProjectFocusId(project.id)
    setContent((previous) => ({ ...previous, projects: [...previous.projects, project] }))
  }

  const openProjectEditor = () => {
    if (content.projects.length === 0) addProject()
    onOpenProjects?.()
  }

  const addResponsibility = (projectIndex: number) => {
    const project = content.projects[projectIndex]
    if (!project) return
    setPendingResponsibilityFocus({
      projectId: project.id,
      responsibilityIndex: project.responsibilities.length,
    })
    updateProject(projectIndex, (project) => ({ ...project, responsibilities: [...project.responsibilities, ''] }))
  }

  const updateResponsibility = (projectIndex: number, responsibilityIndex: number, value: string) => {
    updateProject(projectIndex, (project) => {
      const responsibilities = [...project.responsibilities]
      responsibilities[responsibilityIndex] = value
      return { ...project, responsibilities }
    })
  }

  const removeResponsibility = (projectIndex: number, responsibilityIndex: number) => {
    updateProject(projectIndex, (project) => ({
      ...project,
      responsibilities: project.responsibilities.filter((_, index) => index !== responsibilityIndex),
    }))
  }

  const reorderProject = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    setContent((previous) => {
      const projects = reorderExperienceProjects(previous.projects, sourceId, targetId)
      if (projects === previous.projects) return previous
      return { ...previous, projects }
    })
  }

  const reorderResponsibility = (projectIndex: number, sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return
    updateProject(projectIndex, (project) => {
      const responsibilities = [...project.responsibilities]
      const [moved] = responsibilities.splice(sourceIndex, 1)
      responsibilities.splice(targetIndex, 0, moved)
      return { ...project, responsibilities }
    })
  }

  const openOptimizePage = async (
    projectIndex: number,
    field: 'projectDescription' | 'responsibility',
    responsibilityIndex?: number,
  ) => {
    const fieldKey = field === 'projectDescription'
      ? `project-${projectIndex}-description`
      : `project-${projectIndex}-responsibility-${responsibilityIndex}`
    setOptimizingField(fieldKey)
    setOptimizeError('')
    setOptimizeErrorField(null)

    try {
      await saveNow()
      const searchParams = new URLSearchParams()
      searchParams.set('fieldType', field === 'projectDescription' ? 'project_description' : 'responsibility')
      searchParams.set('returnModuleType', moduleType)
      searchParams.set('projectIndex', String(projectIndex))
      if (typeof responsibilityIndex === 'number') searchParams.set('index', String(responsibilityIndex))
      navigate(`/editor/${resumeId}/modules/${moduleId}/field-optimize?${searchParams.toString()}`)
    } catch (error: unknown) {
      setOptimizeError(error instanceof Error ? error.message : '进入 AI 优化页失败，请稍后重试')
      setOptimizeErrorField(fieldKey)
    } finally {
      setOptimizingField(null)
    }
  }

  const confirmDeleteProject = () => {
    if (!deleteProjectId || content.projects.length <= 1) return
    setContent((previous) => ({
      ...previous,
      projects: previous.projects.filter((project) => project.id !== deleteProjectId),
    }))
    setDeleteProjectId(null)
  }

  return (
    <div className="space-y-3">
      {viewMode === 'company' ? (
        <>
          <ModuleSaveBar saveState={saveState} errorMessage={errorMessage} hasUnsavedChanges={hasUnsavedChanges} onSave={saveNow}>
            <MaterialActions
              resumeId={resumeId}
              moduleType={moduleType}
              content={content}
              onApply={(nextContent) => setContent(normalizeInternshipContent(nextContent as unknown as Record<string, unknown>))}
              embedded
            />
          </ModuleSaveBar>

          <div className="editor-responsive-grid">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">公司</label>
              <input type="text" value={content.company} onChange={(event) => updateCompany('company', event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">职位</label>
              <input type="text" value={content.position} onChange={(event) => updateCompany('position', event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">开始时间</label>
              <MonthInput value={content.startDate} onChange={(value) => updateCompany('startDate', value)} ariaLabel={`${moduleLabel}开始时间`} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">结束时间</label>
              <MonthInput value={content.endDate} onChange={(value) => updateCompany('endDate', value)} ariaLabel={`${moduleLabel}结束时间`} allowPresent />
            </div>
          </div>

          {timelineIssues.company.length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {timelineIssues.company.map((message) => <p key={message}>{message}</p>)}
            </div>
          ) : null}

          <button
            type="button"
            onClick={openProjectEditor}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary-200 bg-primary-50/70 px-4 py-3 text-sm font-medium text-primary-700 transition hover:border-primary-300 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <span>{content.projects.length > 0 ? `管理项目（${content.projects.length}）` : '添加项目'}</span>
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="m7 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </button>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <button
              type="button"
              onClick={() => {
                setProjectSorting(false)
                setResponsibilitySortingProjectId(null)
                onBackToCompanies?.()
              }}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              ← 返回{moduleLabel}
            </button>
            <p className="min-w-0 truncate text-sm font-medium text-slate-600">
              {[content.company, content.position].filter(Boolean).join(' · ') || '当前公司'}
            </p>
          </div>

          <ModuleSaveBar saveState={saveState} errorMessage={errorMessage} hasUnsavedChanges={hasUnsavedChanges} onSave={saveNow}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {content.projects.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setResponsibilitySortingProjectId(null)
                      setProjectSorting((current) => !current)
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {projectSorting ? '完成项目排序' : '调整项目顺序'}
                  </button>
                ) : null}
                {!projectSorting ? (
                  <button
                    type="button"
                    onClick={addProject}
                    className="rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-50"
                  >
                    添加项目
                  </button>
                ) : null}
              </div>
            </div>
          </ModuleSaveBar>

          <section>
        {projectSorting ? (
          <ExperienceProjectSorter
            projects={content.projects}
            issuesByProjectId={timelineIssues.projects}
            onReorder={reorderProject}
          />
        ) : (
          <div className="space-y-3">
            {content.projects.map((project, projectIndex) => {
              const projectIssues = timelineIssues.projects[project.id] ?? []
              const collapsed = collapsedProjectIds.has(project.id)
              return (
                <section
                  key={project.id}
                  className={projectIndex === 0
                    ? 'py-4'
                    : 'border-t border-slate-100 py-4'}
                >
                <CollapsibleItemHeader
                  title={project.projectName.trim() || `第 ${projectIndex + 1} 个项目`}
                  collapsed={collapsed}
                  controlsId={`experience-project-fields-${moduleId}-${project.id}`}
                  onToggle={() => setCollapsedProjectIds((current) => {
                    const next = new Set(current)
                    if (next.has(project.id)) next.delete(project.id)
                    else next.add(project.id)
                    return next
                  })}
                >
                  {content.projects.length > 1 ? (
                    <button type="button" onClick={() => setDeleteProjectId(project.id)} className="text-xs text-slate-400 hover:text-red-600">删除项目</button>
                  ) : null}
                </CollapsibleItemHeader>

              <div id={`experience-project-fields-${moduleId}-${project.id}`} hidden={collapsed}>
              <div className="editor-responsive-grid">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">项目名称</label>
                  <input type="text" value={project.projectName} onChange={(event) => updateProjectField(projectIndex, 'projectName', event.target.value)}
                    aria-label={`项目 ${projectIndex + 1} 名称`}
                    autoFocus={pendingProjectFocusId === project.id}
                    onFocus={(event) => {
                      if (pendingProjectFocusId === project.id) {
                        event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        setPendingProjectFocusId(null)
                      }
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">项目角色</label>
                  <input type="text" value={project.role} onChange={(event) => updateProjectField(projectIndex, 'role', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">项目开始时间</label>
                  <MonthInput value={project.startDate} onChange={(value) => updateProjectField(projectIndex, 'startDate', value)} ariaLabel={`项目${projectIndex + 1}开始时间`} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">项目结束时间</label>
                  <MonthInput value={project.endDate} onChange={(value) => updateProjectField(projectIndex, 'endDate', value)} ariaLabel={`项目${projectIndex + 1}结束时间`} allowPresent />
                </div>
              </div>

              {projectIssues.length > 0 ? (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {projectIssues.map((message) => <p key={message}>{message}</p>)}
                </div>
              ) : null}

              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium text-gray-700">技术栈</label>
                <AutoResizeTextarea value={project.techStack} onChange={(event) => updateProjectField(projectIndex, 'techStack', event.target.value)} minRows={2}
                  placeholder="Java, Spring Boot, MySQL..."
                  className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500" />
              </div>

              <div className="mt-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-gray-700">项目简介</label>
                  <button type="button" onClick={() => void openOptimizePage(projectIndex, 'projectDescription')}
                    disabled={optimizingField !== null || !project.projectDescription.trim()}
                    className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    {optimizingField === `project-${projectIndex}-description` ? '跳转中...' : 'AI 优化'}
                  </button>
                </div>
                <AutoResizeTextarea value={project.projectDescription} onChange={(event) => updateProjectField(projectIndex, 'projectDescription', event.target.value)} minRows={3}
                  placeholder={summaryPlaceholder}
                  className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500" />
                {optimizeError && optimizeErrorField === `project-${projectIndex}-description` ? (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{optimizeError}</div>
                ) : null}
              </div>

              <div className="mt-3">
                <RepeatableListHeader
                  label="核心职责"
                  itemCount={project.responsibilities.length}
                  sorting={responsibilitySortingProjectId === project.id}
                  addLabel="添加职责"
                  sortLabel="调整职责顺序"
                  onAdd={() => addResponsibility(projectIndex)}
                  onToggleSorting={() => setResponsibilitySortingProjectId((current) => current === project.id ? null : project.id)}
                />
                {responsibilitySortingProjectId === project.id ? (
                  <ExperienceResponsibilitySorter
                    responsibilities={project.responsibilities}
                    onReorder={(sourceIndex, targetIndex) => reorderResponsibility(projectIndex, sourceIndex, targetIndex)}
                  />
                ) : project.responsibilities.map((item, responsibilityIndex) => {
                  const fieldKey = `project-${projectIndex}-responsibility-${responsibilityIndex}`
                  return (
                    <div key={responsibilityIndex} className={responsibilityIndex === 0 ? '' : 'mt-2'}>
                      <div className="mb-2 flex items-center justify-end gap-3">
                        <button type="button" onClick={() => void openOptimizePage(projectIndex, 'responsibility', responsibilityIndex)}
                          disabled={optimizingField !== null || !item.trim()}
                          className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          {optimizingField === fieldKey ? '跳转中...' : 'AI 优化'}
                        </button>
                        <button type="button" onClick={() => removeResponsibility(projectIndex, responsibilityIndex)} className="text-xs text-slate-400 hover:text-red-600">删除</button>
                      </div>
                      <AutoResizeTextarea value={item} onChange={(event) => updateResponsibility(projectIndex, responsibilityIndex, event.target.value)} minRows={3}
                        aria-label={`核心职责 ${responsibilityIndex + 1}`}
                        autoFocus={pendingResponsibilityFocus?.projectId === project.id && pendingResponsibilityFocus.responsibilityIndex === responsibilityIndex}
                        onFocus={(event) => {
                          if (pendingResponsibilityFocus?.projectId === project.id && pendingResponsibilityFocus.responsibilityIndex === responsibilityIndex) {
                            event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            setPendingResponsibilityFocus(null)
                          }
                        }}
                        onKeyDown={(event) => {
                          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && responsibilityIndex === project.responsibilities.length - 1) {
                            event.preventDefault()
                            addResponsibility(projectIndex)
                          }
                        }}
                        className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500" />
                      {optimizeError && optimizeErrorField === fieldKey ? (
                        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{optimizeError}</div>
                      ) : null}
                    </div>
                  )
                })}
                {responsibilitySortingProjectId !== project.id && project.responsibilities.length > 0 ? (
                  <ContinueAddButton label="职责" onClick={() => addResponsibility(projectIndex)} />
                ) : null}
              </div>
              </div>
                </section>
              )
            })}
            {content.projects.length > 0 ? (
              <div className="pt-3">
                <button
                  type="button"
                  onClick={addProject}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary-200 bg-primary-50/70 px-4 py-3 text-sm font-medium text-primary-700 transition hover:border-primary-300 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  <span className="text-base leading-none" aria-hidden="true">+</span>
                  <span>继续添加项目</span>
                </button>
              </div>
            ) : null}
          </div>
        )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={deleteProjectId !== null}
        title="删除项目"
        description="项目内容和职责将一并删除。"
        confirmText="删除"
        tone="danger"
        onConfirm={confirmDeleteProject}
        onCancel={() => setDeleteProjectId(null)}
      />
    </div>
  )
}
