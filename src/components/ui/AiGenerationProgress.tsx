import { useState } from 'react'
import { MarkdownPreview } from './MarkdownPreview'

interface Props {
  status: 'idle' | 'streaming' | 'completed' | 'error'
  reasoning: string
  stage?: string
}

export function AiGenerationProgress({ status, reasoning, stage }: Props) {
  const [expanded, setExpanded] = useState(false)
  const summary = status === 'streaming' ? stage || '正在优化…'
    : status === 'completed' ? '优化完成'
      : status === 'error' ? '优化未完成' : '准备就绪'
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        {status === 'streaming' ? <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-primary-600 motion-reduce:animate-none" /> : null}
        <span role="status">{summary}</span>
        {reasoning.trim() ? <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primary-600">
          {expanded ? '收起详情' : '查看详情'}
          <svg aria-hidden="true" className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="m4 6 4 4 4-4" /></svg>
        </button> : null}
      </div>
      {expanded ? <MarkdownPreview content={reasoning} emptyText="" className="mt-3 max-h-64 rounded-none border-0 border-l border-slate-200 bg-transparent py-0" /> : null}
    </div>
  )
}
