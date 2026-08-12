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

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
  moduleType: Extract<ModuleType, 'internship' | 'work_experience'>
  moduleLabel: string
  summaryPlaceholder: string
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
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null)
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null)
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)
  const [pendingProjectFocusId, setPendingProjectFocusId] = useState<string | null>(null)
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
    setPendingProjectFocusId(project.id)
    setContent((previous) => ({ ...previous, projects: [...previous.projects, project] }))
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
    setDraggedProjectId(null)
    setDragOverProjectId(null)
  }

  const moveProject = (projectIndex: number, direction: -1 | 1) => {
    const targetIndex = projectIndex + direction
    if (targetIndex < 0 || targetIndex >= content.projects.length) return
    reorderProject(content.projects[projectIndex].id, content.projects[targetIndex].id)
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
    <div className="space-y-5">
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">职位</label>
          <input type="text" value={content.position} onChange={(event) => updateCompany('position', event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500" />
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

      <div className="flex items-center justify-between border-t border-slate-200 pt-5">
        <h3 className="text-base font-semibold text-slate-900">项目</h3>
        <button type="button" onClick={addProject}
          className="text-sm font-medium text-primary-600 hover:text-primary-700">+ 添加项目</button>
      </div>

      <div className="space-y-4">
        {content.projects.map((project, projectIndex) => {
          const projectIssues = timelineIssues.projects[project.id] ?? []
          const projectDisplayName = project.projectName.trim()
          return (
            <section
              key={project.id}
              onDragOver={(event) => {
                if (!draggedProjectId) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setDragOverProjectId(project.id)
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (draggedProjectId) reorderProject(draggedProjectId, project.id)
              }}
              className={`rounded-xl border p-4 transition ${
                dragOverProjectId === project.id && draggedProjectId !== project.id
                  ? 'border-primary-300 bg-primary-50/50 ring-1 ring-primary-200'
                  : 'border-slate-200 bg-slate-50/45'
              } ${draggedProjectId === project.id ? 'opacity-50' : ''}`}
            >
              <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    setDraggedProjectId(project.id)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', project.id)
                  }}
                  onDragEnd={() => {
                    setDraggedProjectId(null)
                    setDragOverProjectId(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp') { event.preventDefault(); moveProject(projectIndex, -1) }
                    if (event.key === 'ArrowDown') { event.preventDefault(); moveProject(projectIndex, 1) }
                  }}
                  aria-label={projectDisplayName
                    ? `拖动${projectDisplayName}调整顺序，或使用上下方向键`
                    : '拖动当前项目调整顺序，或使用上下方向键'}
                  className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-primary-600 active:cursor-grabbing"
                >
                  <svg className="h-5 w-5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="3" r="1" /><circle cx="11" cy="3" r="1" />
                    <circle cx="5" cy="8" r="1" /><circle cx="11" cy="8" r="1" />
                    <circle cx="5" cy="13" r="1" /><circle cx="11" cy="13" r="1" />
                  </svg>
                </button>
                {projectDisplayName ? (
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{projectDisplayName}</p>
                ) : (
                  <span className="flex-1" aria-hidden="true" />
                )}
                {content.projects.length > 1 ? (
                  <button type="button" onClick={() => setDeleteProjectId(project.id)} className="text-xs text-slate-400 hover:text-red-600">删除项目</button>
                ) : null}
              </div>

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

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-gray-700">技术栈</label>
                <AutoResizeTextarea value={project.techStack} onChange={(event) => updateProjectField(projectIndex, 'techStack', event.target.value)} minRows={2}
                  placeholder="Java, Spring Boot, MySQL..."
                  className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500" />
              </div>

              <div className="mt-4">
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

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">核心职责</label>
                  <button type="button" onClick={() => addResponsibility(projectIndex)} className="text-sm text-primary-600 hover:text-primary-700">+ 添加职责</button>
                </div>
                {project.responsibilities.map((item, responsibilityIndex) => {
                  const fieldKey = `project-${projectIndex}-responsibility-${responsibilityIndex}`
                  return (
                    <div key={responsibilityIndex} className={responsibilityIndex === 0 ? '' : 'mt-3'}>
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
                {project.responsibilities.length > 0 ? (
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => addResponsibility(projectIndex)}
                      className="text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      + 继续添加职责
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          )
        })}
        {content.projects.length > 0 ? (
          <div className="text-center">
            <button
              type="button"
              onClick={addProject}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              + 继续添加项目
            </button>
          </div>
        ) : null}
      </div>

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
