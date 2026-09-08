import type { ComponentProps, ReactNode } from 'react'
import { CollapsibleItemHeader } from '../ui/CollapsibleItemHeader'
import { ModuleSaveBar } from './ModuleSaveBar'

export interface ExperienceItemControls {
  itemIndex: number
  collapsed: boolean
  onToggleCollapsed: () => void
  onDelete: () => void
}

export function ExperienceFormHeader({ title, collapsed, controlsId, onToggle, onDelete, save, children, tools, className }: {
  className?: string
  title: string
  collapsed: boolean
  controlsId: string
  onToggle: () => void
  onDelete?: () => void
  save: ComponentProps<typeof ModuleSaveBar>
  tools?: ReactNode
  children?: ReactNode
}) {
  return (
    <CollapsibleItemHeader className={className} title={title} collapsed={collapsed} controlsId={controlsId} onToggle={onToggle}
      leadingActions={tools} outlinedActions titleAfter={<ModuleSaveBar {...save} compact />}>
      {children}
      {onDelete && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onDelete}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M3 5h14M7 5V3h6v2M5 5l1 12h8l1-12M8 8v6m4-6v6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        删除
      </button>}
    </CollapsibleItemHeader>
  )
}
