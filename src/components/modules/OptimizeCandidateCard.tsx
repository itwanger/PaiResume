import { useRef, useState } from 'react'
import { countDisplayCharacters } from '../../utils/displayTextCount'
import { candidateTagLabels, type CandidateTag } from '../../utils/optimizeCandidateTags'

interface Props {
  label: string
  value: string
  saving: boolean
  tags?: CandidateTag[]
  onChange: (value: string) => void
  onAdopt: (value: string) => void
}

export function OptimizeCandidateCard({ label, value, saving, tags = [], onChange, onAdopt }: Props) {
  const [editing, setEditing] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }
  const toggleEdit = () => {
    setEditing(!editing)
    if (!editing) requestAnimationFrame(() => inputRef.current?.focus())
  }
  const iconButton = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 disabled:opacity-50'

  return (
    <article aria-label={label} className="fo-card flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-5">
      <div className="fo-card-heading flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{label}</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs tabular-nums text-slate-500">{countDisplayCharacters(value)} 字</span>
      </div>
      <div className="fo-tags">{tags.map(tag => <span key={tag} className={`fo-tag fo-tag-${tag}`}>{candidateTagLabels[tag]}</span>)}</div>
      {editing ? (
        <textarea
          ref={inputRef}
          aria-label={`${label}内容`}
          value={value}
          disabled={saving}
          onChange={(event) => { onChange(event.target.value); setCopyState('idle') }}
          className="mb-6 min-h-64 w-full flex-1 resize-y rounded-lg border border-primary-200 bg-primary-50/30 p-3 text-sm leading-8 text-slate-700 outline-none focus:ring-2 focus:ring-primary-200"
        />
      ) : (
        <p className="mb-6 min-h-64 flex-1 whitespace-pre-wrap break-words text-sm leading-8 text-slate-700">{value}</p>
      )}
      <div className="fo-card-footer mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <button type="button" disabled={saving || !value.trim()} onClick={() => onAdopt(value.trim())} className="fo-adopt inline-flex min-h-9 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-primary-200 bg-primary-50 px-2 py-2 text-xs font-medium 2xl:text-sm text-primary-700 transition hover:border-primary-400 hover:bg-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-50">
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m4 10 4 4 8-8" /></svg>
          {saving ? '回填中…' : '采纳这个版本'}
        </button>
        <button type="button" aria-label={`${editing ? '完成编辑' : '编辑'}${label}`} aria-pressed={editing} title={editing ? '完成编辑' : '编辑'} disabled={saving} onClick={toggleEdit} className={iconButton}>
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">{editing ? <path d="m4 10 4 4 8-8" /> : <><path d="m12 4 4 4M4 16l4-1L17 6a2.1 2.1 0 0 0-3-3l-9 9-1 4Z" /><path d="M10 3H4a1 1 0 0 0-1 1v13h13v-6" /></>}</svg>
        </button>
        <button type="button" aria-label={`${copyState === 'copied' ? '已复制' : '复制'}${label}`} title={copyState === 'copied' ? '已复制' : '复制'} disabled={!value.trim()} onClick={() => void copy()} className={iconButton}>
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">{copyState === 'copied' ? <path d="m4 10 4 4 8-8" /> : <><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M12 4V3H3v9h1" /></>}</svg>
        </button>
      </div>
      {copyState === 'copied' ? <span className="sr-only" role="status">{label}已复制</span> : null}
      {copyState === 'error' ? <p role="alert" className="mt-3 text-xs text-red-600">复制失败，请选中文字后复制。</p> : null}
    </article>
  )
}
