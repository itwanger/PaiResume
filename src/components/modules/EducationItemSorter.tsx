import { useState } from 'react'
import type { ResumeModule } from '../../api/resume'
import { normalizeEducationContent } from '../../utils/moduleContent'

interface Props {
  modules: ResumeModule[]
  issuesByModuleId: Map<number, string[]>
  onReorder: (moduleIds: number[]) => Promise<void>
}

export function EducationItemSorter({ modules, issuesByModuleId, onReorder }: Props) {
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
    <div className="space-y-2" aria-label="教育背景条目排序">
      {modules.map((module, index) => {
        const content = normalizeEducationContent(module.content)
        const label = [content.degree, content.school].filter(Boolean).join(' · ') || `第 ${index + 1} 条教育背景`
        const issues = issuesByModuleId.get(module.id) ?? []
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
            className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 transition ${
              dragOverId === module.id && draggedId !== module.id
                ? 'border-primary-300 bg-primary-50 ring-1 ring-primary-200'
                : 'border-slate-200'
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
              className="flex h-9 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-primary-600 active:cursor-grabbing disabled:cursor-wait"
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
              <p className="mt-0.5 text-xs text-slate-500">
                {[content.startDate, content.endDate].filter(Boolean).join(' — ') || '时间未填写'}
              </p>
            </div>
            {issues.length > 0 ? <span className="shrink-0 text-xs font-medium text-red-600">时间线需检查</span> : null}
          </div>
        )
      })}
      {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
    </div>
  )
}
