import type { ReactNode } from 'react'

interface Props {
  className?: string
  title: string
  collapsed: boolean
  controlsId: string
  onToggle: () => void
  leadingActions?: ReactNode
  children?: ReactNode
  titleAfter?: ReactNode
  outlinedActions?: boolean
}

export function CollapsibleItemHeader({ title, collapsed, controlsId, onToggle, children, leadingActions, titleAfter, outlinedActions = false, className = '' }: Props) {
  return (
    <div className={`${className} flex flex-wrap items-center gap-3 ${collapsed ? '' : 'mb-4 pb-3 border-b border-gray-100'}`}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls={controlsId}
        onClick={onToggle}
        className={`group flex min-w-0 ${outlinedActions ? '' : 'flex-1'} items-center gap-2.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40`}
      >
        {/* 箭头容器 */}
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-300 transition-all duration-200 group-hover:bg-gray-50 group-hover:text-gray-500">
          <svg
            className={`h-3.5 w-3.5 transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`}
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 5 7 7-7 7" />
          </svg>
        </span>

        {/* 标题 */}
        <span className="truncate text-[15px] font-semibold text-gray-800 transition-colors duration-150 group-hover:text-gray-900">
          {title}
        </span>

        {/* 展开/收起提示 */}
        {!outlinedActions && <span className="ml-auto shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-300 transition-colors duration-150 group-hover:text-gray-400">
          {collapsed ? '展开' : '收起'}
        </span>}
      </button>
      {titleAfter}
      </div>
      {leadingActions}
      {outlinedActions ? (
        <button type="button" onClick={onToggle} aria-expanded={!collapsed} aria-controls={controlsId}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
          <svg className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${collapsed ? '' : 'rotate-180'}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {collapsed ? '展开' : '收起'}
        </button>
      ) : null}
      {children}
    </div>
  )
}
