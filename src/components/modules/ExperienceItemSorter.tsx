import { useState } from 'react'
import type { ResumeModule } from '../../api/resume'
import { normalizeInternshipContent } from '../../utils/moduleContent'
import { formatMonthInput } from '../../utils/monthInput'

interface Props {
  modules: ResumeModule[]
  moduleLabel: string
  onReorder: (moduleIds: number[]) => Promise<void>
}

function formatDateRange(startDate: string, endDate: string) {
  const start = formatMonthInput(startDate)
  const end = formatMonthInput(endDate)
  if (start && end) return `${start} - ${end}`
  return start || end
}

export function ExperienceItemSorter({ modules, moduleLabel, onReorder }: Props) {
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const reorder = async (sourceId: number, targetId: number) => {
    if (pending || sourceId === targetId) return
    const sourceIndex = modules.findIndex((module) => module.id === sourceId)
    const targetIndex = modules.findIndex((module) => module.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const nextIds = modules.map((module) => module.id)
    nextIds.splice(sourceIndex, 1)
    nextIds.splice(targetIndex, 0, sourceId)
    setPending(true)
    setError('')
    try {
      await onReorder(nextIds)
    } catch {
      setError('顺序保存失败，请重试')
    } finally {
      setPending(false)
      setDraggedId(null)
      setDragOverId(null)
    }
  }

  return (
    <div className="space-y-3" aria-label={`${moduleLabel}排序`}>
      {modules.map((module, index) => {
        const content = normalizeInternshipContent(module.content)
        const title = [content.company, content.position].filter(Boolean).join(' · ') || moduleLabel
        const dateRange = formatDateRange(content.startDate, content.endDate)
        const projectNames = content.projects
          .map((project) => project.projectName.trim())
          .filter(Boolean)
        const projectSummary = projectNames.join('、')

        return (
          <div
            key={module.id}
            onDragOver={(event) => {
              if (pending || draggedId === null) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              setDragOverId(module.id)
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (draggedId !== null) void reorder(draggedId, module.id)
            }}
            className={`flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-4 transition ${
              dragOverId === module.id && draggedId !== module.id
                ? 'bg-primary-50 ring-2 ring-primary-200'
                : 'hover:bg-slate-100/80'
            } ${draggedId === module.id ? 'opacity-45' : ''}`}
          >
            <button
              type="button"
              draggable={!pending}
              disabled={pending}
              onDragStart={(event) => {
                setDraggedId(module.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', String(module.id))
              }}
              onDragEnd={() => {
                setDraggedId(null)
                setDragOverId(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp' && index > 0) {
                  event.preventDefault()
                  void reorder(module.id, modules[index - 1].id)
                }
                if (event.key === 'ArrowDown' && index < modules.length - 1) {
                  event.preventDefault()
                  void reorder(module.id, modules[index + 1].id)
                }
              }}
              className="flex h-9 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-primary-600 active:cursor-grabbing disabled:cursor-wait"
              aria-label={`拖动${title}调整顺序，或使用上下方向键`}
              title="拖动排序"
            >
              <svg className="h-5 w-5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="3" r="1" /><circle cx="11" cy="3" r="1" />
                <circle cx="5" cy="8" r="1" /><circle cx="11" cy="8" r="1" />
                <circle cx="5" cy="13" r="1" /><circle cx="11" cy="13" r="1" />
              </svg>
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{title}</p>
                {dateRange ? <p className="shrink-0 text-xs text-slate-500">{dateRange}</p> : null}
              </div>
              {projectSummary ? (
                <p className="mt-1 truncate text-xs text-slate-500">{projectSummary}</p>
              ) : null}
            </div>

            {content.projects.length > 0 ? (
              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs text-slate-500">
                {content.projects.length} 个项目
              </span>
            ) : null}
          </div>
        )
      })}
      {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
    </div>
  )
}
