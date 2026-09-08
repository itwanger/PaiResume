import { AiOptimizeTextarea } from '../ui/AiOptimizeTextarea'
import { fieldOptimizeInputId } from '../../hooks/useFieldOptimizeReturn'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ExperienceProjectContent, InternshipContent, ModuleType } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { hasExperienceProjectContent, normalizeInternshipContent } from '../../utils/moduleContent'
import { getExperienceTimelineIssues, reorderExperienceProjects } from '../../utils/experienceTimeline'
import { AutoResizeTextarea } from '../ui/AutoResizeTextarea'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { MonthInput } from '../ui/MonthInput'
import { ExperienceFormHeader, type ExperienceItemControls } from './ExperienceFormHeader'
import { LABEL, INPUT, TEXTAREA } from '../ui/experienceFormStyles'
import { ResponsibilityAddButton } from '../ui/ResponsibilityAddButton'
import { ExperienceProjectSorter } from './ExperienceProjectSorter'
import { ExperienceResponsibilitySorter } from './ExperienceResponsibilitySorter'
import { RepeatableListHeader } from '../ui/RepeatableListControls'

interface Props extends ExperienceItemControls {
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
  itemIndex, collapsed: companyCollapsed, onToggleCollapsed, onDelete,
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
  const filledProjectCount = content.projects.filter(hasExperienceProjectContent).length
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
    if (content.projects.length === 0) {
      addProject()
    } else if (filledProjectCount === 0) {
      setCollapsedProjectIds(new Set())
      setPendingProjectFocusId(content.projects[0].id)
    }
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
          <ExperienceFormHeader
            title={content.company.trim() || `第 ${itemIndex + 1} 条${moduleLabel}`}
            collapsed={companyCollapsed} controlsId={`company-fields-${moduleId}`}
            onToggle={onToggleCollapsed} onDelete={onDelete}
            save={{ saveState, errorMessage, hasUnsavedChanges, onSave: saveNow }} />
          <div id={`company-fields-${moduleId}`} hidden={companyCollapsed} className="space-y-4">


          <div className="editor-responsive-grid">
            <div>
              <label className={LABEL}>公司</label>
              <input type="text" value={content.company} onChange={(event) => updateCompany('company', event.target.value)}
                className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>职位</label>
              <input type="text" value={content.position} onChange={(event) => updateCompany('position', event.target.value)}
                className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>开始时间</label>
              <MonthInput value={content.startDate} onChange={(value) => updateCompany('startDate', value)} ariaLabel={`${moduleLabel}开始时间`} />
            </div>
            <div>
              <label className={LABEL}>结束时间</label>
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
            className="group flex w-full items-center justify-center gap-2 rounded border border-primary-200 bg-primary-50/70 px-4 py-3 text-sm font-medium text-primary-700 transition-colors duration-200 hover:border-primary-300 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <svg className="h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-110 motion-reduce:transition-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" strokeLinejoin="round" />
              {filledProjectCount === 0 && <path d="M12 11v6m-3-3h6" strokeLinecap="round" />}
            </svg>
            <span>{filledProjectCount > 0 ? `管理项目（${filledProjectCount}）` : '添加项目'}</span>
            {filledProjectCount > 0 && (
              <svg className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
                <path d="m7 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              </svg>
            )}
          </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={() => {
                setProjectSorting(false)
                setResponsibilitySortingProjectId(null)
                onBackToCompanies?.()
              }}
              className="group inline-flex min-w-0 items-center gap-2 rounded py-2 text-left text-sm font-medium text-primary-600 transition-colors hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <svg className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:-translate-x-0.5 motion-reduce:transition-none" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="m8 4-6 6 6 6M2 10h16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="break-words">返回{content.company.trim() || moduleLabel}</span>
            </button>
            {content.projects.length > 1 && (
              <button type="button" onClick={() => { setResponsibilitySortingProjectId(null); setProjectSorting((current) => !current) }}
                aria-pressed={projectSorting}
                className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${projectSorting
                  ? 'border-primary-600 bg-primary-600 text-white hover:bg-primary-700'
                  : 'border-gray-200 bg-white text-slate-600 hover:border-primary-200 hover:text-primary-700'}`}>
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  {projectSorting
                    ? <path d="m4 10 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                    : <path d="M6 3v14m-3-3 3 3 3-3M14 17V3m-3 3 3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />}
                </svg>
                {projectSorting ? '完成排序' : '调整项目顺序'}
              </button>
            )}
          </div>

          <section>
        {projectSorting ? (
          <ExperienceProjectSorter
            projects={content.projects}
            issuesByProjectId={timelineIssues.projects}
            onReorder={reorderProject}
          />
        ) : (
          <div className="space-y-4">
            {content.projects.map((project, projectIndex) => {
              const projectIssues = timelineIssues.projects[project.id] ?? []
              const collapsed = collapsedProjectIds.has(project.id)
              return (
                <section
                  key={project.id}
                  className="rounded border border-gray-200 bg-white p-4 sm:p-5"
                >
                <ExperienceFormHeader
                  title={project.projectName.trim() || `第 ${projectIndex + 1} 个项目`}
                  collapsed={collapsed}
                  save={{ saveState, errorMessage, hasUnsavedChanges, onSave: saveNow }}
                  onDelete={content.projects.length > 1 ? () => setDeleteProjectId(project.id) : undefined}
                  controlsId={`experience-project-fields-${moduleId}-${project.id}`}
                  onToggle={() => setCollapsedProjectIds((current) => {
                    const next = new Set(current)
                    if (next.has(project.id)) next.delete(project.id)
                    else next.add(project.id)
                    return next
                  })}
                />

              <div id={`experience-project-fields-${moduleId}-${project.id}`} hidden={collapsed}>
              <div className="editor-responsive-grid">
                <div>
                  <label className={LABEL}>项目名称</label>
                  <input type="text" value={project.projectName} onChange={(event) => updateProjectField(projectIndex, 'projectName', event.target.value)}
                    aria-label={`项目 ${projectIndex + 1} 名称`}
                    autoFocus={pendingProjectFocusId === project.id}
                    onFocus={(event) => {
                      if (pendingProjectFocusId === project.id) {
                        event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        setPendingProjectFocusId(null)
                      }
                    }}
                    className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>项目角色</label>
                  <input type="text" value={project.role} onChange={(event) => updateProjectField(projectIndex, 'role', event.target.value)}
                    className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>项目开始时间</label>
                  <MonthInput value={project.startDate} onChange={(value) => updateProjectField(projectIndex, 'startDate', value)} ariaLabel={`项目${projectIndex + 1}开始时间`} />
                </div>
                <div>
                  <label className={LABEL}>项目结束时间</label>
                  <MonthInput value={project.endDate} onChange={(value) => updateProjectField(projectIndex, 'endDate', value)} ariaLabel={`项目${projectIndex + 1}结束时间`} allowPresent />
                </div>
              </div>

              {projectIssues.length > 0 ? (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {projectIssues.map((message) => <p key={message}>{message}</p>)}
                </div>
              ) : null}

              <div className="mt-3">
                <label className={LABEL}>技术栈</label>
                <AutoResizeTextarea value={project.techStack} onChange={(event) => updateProjectField(projectIndex, 'techStack', event.target.value)}
                  placeholder="Java, Spring Boot, MySQL..."
                  className={TEXTAREA} />
              </div>

              <div className="mt-3">
                <label className={LABEL}>项目简介</label>
                <AiOptimizeTextarea
                  onOptimize={() => void openOptimizePage(projectIndex, 'projectDescription')}
                  optimizing={optimizingField === `project-${projectIndex}-description`}
                  optimizeDisabled={optimizingField !== null || !project.projectDescription.trim()}
                  aria-label="项目简介"
                  id={fieldOptimizeInputId(moduleId, projectIndex, 'project_description')} value={project.projectDescription} onChange={(event) => updateProjectField(projectIndex, 'projectDescription', event.target.value)}
                  placeholder={summaryPlaceholder}
                  className={TEXTAREA} />
                {optimizeError && optimizeErrorField === `project-${projectIndex}-description` ? (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{optimizeError}</div>
                ) : null}
              </div>

              <div className="mt-3">
                <RepeatableListHeader
                  label="核心职责"
                  itemCount={project.responsibilities.length}
                  sorting={responsibilitySortingProjectId === project.id}
                  showAdd={false}
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
                ) : project.responsibilities.length === 0 ? (
                  <ResponsibilityAddButton empty onClick={() => addResponsibility(projectIndex)} />
                ) : project.responsibilities.map((item, responsibilityIndex) => {
                  const fieldKey = `project-${projectIndex}-responsibility-${responsibilityIndex}`
                  return (
                    <div key={responsibilityIndex} className="mt-2 flex items-start gap-3">
                      <span className="w-5 shrink-0 pt-2 text-center text-[11px] font-bold text-gray-300">{String(responsibilityIndex + 1).padStart(2, '0')}</span>
                      <div className="min-w-0 flex-1">
                      <AiOptimizeTextarea
                        onOptimize={() => void openOptimizePage(projectIndex, 'responsibility', responsibilityIndex)}
                        optimizing={optimizingField === fieldKey}
                        optimizeDisabled={optimizingField !== null || !item.trim()}
                        onDelete={() => removeResponsibility(projectIndex, responsibilityIndex)}
                        deleteLabel={`删除职责 ${responsibilityIndex + 1}`}
                        id={fieldOptimizeInputId(moduleId, projectIndex, 'responsibility', responsibilityIndex)} value={item} onChange={(event) => updateResponsibility(projectIndex, responsibilityIndex, event.target.value)}
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
                        className={TEXTAREA} />
                      {optimizeError && optimizeErrorField === fieldKey ? (
                        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{optimizeError}</div>
                      ) : null}
                      </div>
                    </div>
                  )
                })}
                {responsibilitySortingProjectId !== project.id && project.responsibilities.length > 0 ? (
                  <div className="pl-8 pt-3"><ResponsibilityAddButton onClick={() => addResponsibility(projectIndex)} /></div>
                ) : null}
              </div>
              </div>
                </section>
              )
            })}
            {!projectSorting ? (
              <div>
                <button
                  type="button"
                  onClick={addProject}
                  className="group flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-transparent px-4 py-4 text-sm font-medium text-slate-500 transition-colors duration-200 hover:border-primary-300 hover:bg-white hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <svg className="h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-110 motion-reduce:transition-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" strokeLinejoin="round" />
                    <path d="M12 11v6m-3-3h6" strokeLinecap="round" />
                  </svg>
                  <span>{content.projects.length ? '继续添加项目' : '添加第一个项目'}</span>
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
