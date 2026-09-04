import type { ReactNode } from 'react'

interface Props {
  title: string
  collapsed: boolean
  controlsId: string
  onToggle: () => void
  children?: ReactNode
}

export function CollapsibleItemHeader({ title, collapsed, controlsId, onToggle, children }: Props) {
  return (
    <div className={`flex items-center gap-3 ${collapsed ? '' : 'mb-3 border-b border-gray-100 pb-3'}`}>
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls={controlsId}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-2 rounded text-left text-sm font-medium text-gray-700 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <svg className={`h-4 w-4 shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`} aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 5 7 7-7 7" />
        </svg>
        <span className="truncate">{title}</span>
        <span className="ml-auto shrink-0 text-xs text-gray-400">{collapsed ? '展开' : '收起'}</span>
      </button>
      {children}
    </div>
  )
}
