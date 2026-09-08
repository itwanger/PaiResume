import { useState, type ReactNode } from 'react'
import { MarkdownPreview } from './MarkdownPreview'

interface Props {
  status: 'idle' | 'streaming' | 'completed' | 'error'
  reasoning: string
  stage?: string
  action?: ReactNode
  elapsedMs?: number
  layout?: 'default' | 'sidebar'
}

export function AiGenerationProgress({ status, reasoning, stage, action, elapsedMs, layout = 'default' }: Props) {
  const [expanded, setExpanded] = useState(false)
  const seconds = elapsedMs === undefined ? null : Math.max(0, Math.round(elapsedMs / 1000))
  const summary = status === 'streaming' ? stage || '正在优化…'
    : status === 'completed' ? seconds === null ? '已生成' : `用时 ${Math.floor(seconds / 60)} 分 ${String(seconds % 60).padStart(2, '0')} 秒`
      : status === 'error' ? '生成失败' : '准备就绪'
  return (
    <div className={`min-w-0 flex-1 ${layout === 'sidebar' ? 'fo-progress' : ''}`}>
      <div className="fo-progress-actions flex flex-wrap items-center gap-3 text-sm text-slate-600">
        {action}
        {status === 'streaming' ? <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-primary-600 motion-reduce:animate-none" /> : null}
        {layout === 'default' ? <span role="status">{summary}</span> : null}
        {reasoning.trim() || layout === 'sidebar' ? <button type="button" disabled={!reasoning.trim()} aria-label={expanded ? '收起思考过程' : '查看思考过程'} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="fo-thinking-button inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 transition hover:border-primary-300 hover:bg-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-50">
          {layout === 'sidebar' ? <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 13c0-2-2-2-2-5a5 5 0 0 1 10 0c0 3-2 3-2 5M7 14h6m-5 3h4M10 0v2M1 8h2m14 0h2M3 2l2 2m10 0 2-2" /></svg> : null}
          {layout === 'sidebar' ? '思考过程' : expanded ? '收起思考过程' : '查看思考过程'}
          {layout === 'default' ?
          <svg aria-hidden="true" className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="m4 6 4 4 4-4" /></svg>
          : null}
        </button> : null}
      </div>
      {layout === 'sidebar' ? <span role="status" className="mt-3 block text-xs text-slate-500">{summary}</span> : null}
      {expanded ? <section aria-label="模型思考过程" className={layout === 'sidebar' ? 'fo-thinking-content' : ''}>{layout === 'sidebar' ? <h3 className="mb-3 text-sm font-semibold text-primary-700">AI 思考过程</h3> : null}<MarkdownPreview content={reasoning} emptyText="" className="mt-4 max-h-64 rounded-none border-0 border-l border-slate-200 bg-transparent py-0" /></section> : null}
    </div>
  )
}
