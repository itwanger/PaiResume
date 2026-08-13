interface RepeatableListHeaderProps {
  label: string
  itemCount: number
  sorting: boolean
  addLabel: string
  sortLabel: string
  onAdd: () => void
  onToggleSorting: () => void
}

export function RepeatableListHeader({
  label,
  itemCount,
  sorting,
  addLabel,
  sortLabel,
  onAdd,
  onToggleSorting,
}: RepeatableListHeaderProps) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-3">
        {itemCount > 1 ? (
          <button
            type="button"
            onClick={onToggleSorting}
            className="text-xs font-medium text-slate-500 hover:text-primary-700"
          >
            {sorting ? '完成排序' : sortLabel}
          </button>
        ) : null}
        {!sorting ? (
          <button type="button" onClick={onAdd} className="text-sm text-primary-600 hover:text-primary-700">
            + {addLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function ContinueAddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="mt-4 text-center">
      <button
        type="button"
        onClick={onClick}
        className="text-sm font-medium text-primary-600 hover:text-primary-700"
      >
        + 继续添加{label}
      </button>
    </div>
  )
}
