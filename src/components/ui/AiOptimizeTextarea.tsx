import type { ComponentProps } from 'react'
import { AutoResizeTextarea } from './AutoResizeTextarea'

interface OptimizeActionProps {
  onOptimize: () => void
  optimizing?: boolean
  optimizeDisabled?: boolean
  optimizeLabel?: string
}

export function AiOptimizeButton({ onOptimize, optimizing, optimizeDisabled, optimizeLabel = 'AI 优化' }: OptimizeActionProps) {
  return (
    <button
      type="button"
      onClick={onOptimize}
      disabled={optimizeDisabled || optimizing}
      className="inline-flex shrink-0 items-center gap-1.5 rounded border border-primary-100 bg-primary-50 px-2.5 py-1.5 text-xs font-medium text-primary-600 transition duration-150 hover:-translate-y-0.5 hover:border-primary-200 hover:bg-primary-100 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none"
    >
      <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      {optimizing ? '跳转中…' : optimizeLabel}
    </button>
  )
}

type Props = ComponentProps<typeof AutoResizeTextarea> & OptimizeActionProps & {
  onDelete?: () => void
  deleteLabel?: string
}

export function AiOptimizeTextarea({
  onOptimize, optimizing, optimizeDisabled, optimizeLabel, onDelete, deleteLabel = '删除', className = '', style, ...props
}: Props) {
  return (
    <div className="relative">
      <AutoResizeTextarea {...props} className={`block ${className}`} style={{ ...style, paddingBottom: '3rem' }} />
      <div className="absolute bottom-2 right-2 flex items-center gap-2">
        <AiOptimizeButton onOptimize={onOptimize} optimizing={optimizing} optimizeDisabled={optimizeDisabled} optimizeLabel={optimizeLabel} />
        {onDelete ? (
          <button type="button" onClick={onDelete} aria-label={deleteLabel}
            className="rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-500 transition duration-150 hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 motion-reduce:transform-none motion-reduce:transition-none">
            删除
          </button>
        ) : null}
      </div>
    </div>
  )
}
