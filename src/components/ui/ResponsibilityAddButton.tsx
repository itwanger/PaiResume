export function ResponsibilityAddButton({ empty = false, onClick, icon = 'responsibility', emptyLabel = '添加第一条核心职责', continueLabel = '继续添加职责', emptyHint = '用 STAR 法则描述具体工作' }: {
  icon?: 'responsibility' | 'skill'
  empty?: boolean
  onClick: () => void
  emptyLabel?: string
  continueLabel?: string
  emptyHint?: string | null
}) {
  return (
    <button type="button" onClick={onClick}
      className={`group inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded border px-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${empty
        ? 'w-full border-primary-200 bg-primary-50/70 py-3 text-primary-700 hover:border-primary-300 hover:bg-primary-100'
        : 'border-primary-200 bg-primary-50/70 py-2 text-primary-700 hover:border-primary-300 hover:bg-primary-100'}`}>
      <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium">
        <svg className="h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-110 motion-reduce:transition-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          {icon === 'skill' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="m13 3-9 11h7l-1 7 9-11h-7l1-7Z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 5h13M4 10h13M4 15h6m6-2v8m-4-4h8" />
          )}
        </svg>
        {empty ? emptyLabel : continueLabel}
      </span>
      {empty && emptyHint && <span className="text-xs text-gray-400">{emptyHint}</span>}
    </button>
  )
}
