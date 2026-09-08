import type { ReactNode } from 'react'

interface Props {
  id: string
  open: boolean
  onToggle: () => void
  filledCount: number
  children: ReactNode
}

export function OptionalInfoSection({ id, open, onToggle, filledCount, children }: Props) {
  return (
    <section className="rounded bg-gray-50/70">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id}
        className="group flex w-full items-center gap-3 rounded px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
        <svg className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="m7 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
        <span className="text-sm font-medium text-gray-700">可选信息</span>
        {filledCount > 0 && <span className="text-xs text-gray-400">已填写 {filledCount} 项</span>}
        <span className="ml-auto rounded bg-white px-2.5 py-1 text-xs font-medium text-primary-600 transition-colors duration-150 group-hover:bg-primary-50">{open ? '收起' : '展开'}</span>
      </button>
      <div id={id} hidden={!open}>{children}</div>
    </section>
  )
}
