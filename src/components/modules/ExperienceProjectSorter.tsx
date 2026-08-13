import { useState } from 'react'
import type { ExperienceProjectContent } from '../../types'

interface Props {
  projects: ExperienceProjectContent[]
  issuesByProjectId: Record<string, string[]>
  onReorder: (sourceId: string, targetId: string) => void
}

export function ExperienceProjectSorter({ projects, issuesByProjectId, onReorder }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const reorder = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    onReorder(sourceId, targetId)
    setDraggedId(null)
    setDragOverId(null)
  }

  return (
    <div className="space-y-2" aria-label="项目排序">
      {projects.map((project, index) => {
        const label = [project.projectName, project.role].filter(Boolean).join(' · ') || '项目'
        const dateRange = [project.startDate, project.endDate].filter(Boolean).join(' — ')
        const issues = issuesByProjectId[project.id] ?? []
        return (
          <div
            key={project.id}
            onDragOver={(event) => {
              if (draggedId === null) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              setDragOverId(project.id)
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (draggedId !== null) reorder(draggedId, project.id)
            }}
            className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 transition ${
              dragOverId === project.id && draggedId !== project.id
                ? 'border-primary-300 bg-primary-50 ring-1 ring-primary-200'
                : 'border-slate-200'
            } ${draggedId === project.id ? 'opacity-45' : ''}`}
          >
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                setDraggedId(project.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', project.id)
              }}
              onDragEnd={() => {
                setDraggedId(null)
                setDragOverId(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp' && index > 0) {
                  event.preventDefault()
                  reorder(project.id, projects[index - 1].id)
                }
                if (event.key === 'ArrowDown' && index < projects.length - 1) {
                  event.preventDefault()
                  reorder(project.id, projects[index + 1].id)
                }
              }}
              className="flex h-9 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-primary-600 active:cursor-grabbing"
              aria-label={`拖动${label}调整顺序，或使用上下方向键`}
              title="拖动排序"
            >
              <svg className="h-5 w-5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="3" r="1" /><circle cx="11" cy="3" r="1" />
                <circle cx="5" cy="8" r="1" /><circle cx="11" cy="8" r="1" />
                <circle cx="5" cy="13" r="1" /><circle cx="11" cy="13" r="1" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{label}</p>
              {dateRange ? <p className="mt-0.5 text-xs text-slate-500">{dateRange}</p> : null}
            </div>
            {issues.length > 0 ? <span className="shrink-0 text-xs font-medium text-red-600">时间线需检查</span> : null}
          </div>
        )
      })}
    </div>
  )
}
