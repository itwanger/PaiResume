import { useState } from 'react'

interface Props {
  items: string[]
  itemLabel: string
  ariaLabel: string
  onReorder: (sourceIndex: number, targetIndex: number) => void
}

export function TextItemSorter({ items, itemLabel, ariaLabel, onReorder }: Props) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const reorder = (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return
    onReorder(sourceIndex, targetIndex)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="space-y-2" aria-label={ariaLabel}>
      {items.map((item, index) => (
        <div
          key={index}
          onDragOver={(event) => {
            if (draggedIndex === null) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setDragOverIndex(index)
          }}
          onDrop={(event) => {
            event.preventDefault()
            if (draggedIndex !== null) reorder(draggedIndex, index)
          }}
          className={`flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3 transition ${
            dragOverIndex === index && draggedIndex !== index
              ? 'bg-primary-50 ring-2 ring-primary-200'
              : 'hover:bg-slate-100'
          } ${draggedIndex === index ? 'opacity-45' : ''}`}
        >
          <button
            type="button"
            draggable
            onDragStart={(event) => {
              setDraggedIndex(index)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', String(index))
            }}
            onDragEnd={() => {
              setDraggedIndex(null)
              setDragOverIndex(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp' && index > 0) {
                event.preventDefault()
                reorder(index, index - 1)
              }
              if (event.key === 'ArrowDown' && index < items.length - 1) {
                event.preventDefault()
                reorder(index, index + 1)
              }
            }}
            className="flex h-9 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-primary-600 active:cursor-grabbing"
            aria-label={`拖动${itemLabel} ${index + 1} 调整顺序，或使用上下方向键`}
            title="拖动排序"
          >
            <svg className="h-5 w-5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="3" r="1" /><circle cx="11" cy="3" r="1" />
              <circle cx="5" cy="8" r="1" /><circle cx="11" cy="8" r="1" />
              <circle cx="5" cy="13" r="1" /><circle cx="11" cy="13" r="1" />
            </svg>
          </button>
          <p className="min-w-0 flex-1 truncate text-sm text-slate-700">{item.trim() || '—'}</p>
        </div>
      ))}
    </div>
  )
}
