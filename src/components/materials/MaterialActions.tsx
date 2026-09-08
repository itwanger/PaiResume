import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { flushResumeAutoSaves } from '../../hooks/useAutoSave'
import {
  contentLibraryApi,
  type ResumeHistoryMaterial,
} from '../../api/contentLibrary'
import { MODULE_LABELS, type ModuleType } from '../../types'
import { applyMaterialFields, getMaterialPreview, hasMeaningfulMaterialValue } from '../../utils/materialLibrary'
import { useModuleSaveFeedback } from '../modules/moduleSaveFeedback'

interface Props<T extends object> {
  resumeId: number
  moduleType: ModuleType
  content: T
  onApply: (content: T) => void
  embedded?: boolean
  compact?: boolean
}

export function MaterialActions<T extends object>({
  resumeId,
  moduleType,
  content,
  onApply,
  embedded = false,
  compact = false,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const [openingResumes, setOpeningResumes] = useState(false)
  const [history, setHistory] = useState<ResumeHistoryMaterial[]>([])
  const [historyChecked, setHistoryChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [undoContent, setUndoContent] = useState<T | null>(null)
  const saveBarFeedback = useModuleSaveFeedback()
  const contentIsEmpty = !hasMeaningfulMaterialValue(content)

  useEffect(() => {
    if (!contentIsEmpty) return
    let cancelled = false
    void contentLibraryApi.listHistoryMaterials({
      moduleType,
      excludeResumeId: resumeId,
    }).then((response) => {
      if (cancelled) return
      setHistory(response.data.data)
      setHistoryChecked(true)
    }).catch(() => {
      if (!cancelled) setHistoryChecked(true)
    })
    return () => {
      cancelled = true
    }
  }, [contentIsEmpty, moduleType, resumeId])

  const showMessage = (nextMessage: string) => {
    setError('')
    setMessage(nextMessage)
    saveBarFeedback?.showFeedback(nextMessage)
  }

  const showError = (nextError: string) => {
    setMessage('')
    setError(nextError)
    saveBarFeedback?.showFeedback(nextError, 'error')
  }

  const load = async () => {
    setOpen(true)
    setLoading(true)
    setError('')
    try {
      if (!historyChecked) {
        const response = await contentLibraryApi.listHistoryMaterials({
          moduleType,
          excludeResumeId: resumeId,
        })
        setHistory(response.data.data)
        setHistoryChecked(true)
      }
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : '加载资料失败')
    } finally {
      setLoading(false)
    }
  }

  const apply = (material: ResumeHistoryMaterial) => {
    setError('')
    try {
      const source = material.content
      setUndoContent(content)
      onApply(applyMaterialFields(content, source))
      setOpen(false)
      showMessage(`已从历史资料填入当前${MODULE_LABELS[moduleType]}`)
    } catch (requestError: unknown) {
      showError(requestError instanceof Error ? requestError.message : '套用资料失败')
    }
  }

  const openExcellentResumes = async () => {
    setOpeningResumes(true)
    try {
      await flushResumeAutoSaves(resumeId)
      navigate('/excellent-resumes')
    } catch (requestError: unknown) {
      showError(requestError instanceof Error ? requestError.message : '保存失败，请重试')
    } finally {
      setOpeningResumes(false)
    }
  }

  const items = history

  return (
    <>
      <div className={compact ? 'min-w-0' : embedded ? 'min-w-0 flex-1' : 'rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3'}>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex flex-wrap gap-2">
            {undoContent ? (
              <button
                type="button"
                onClick={() => {
                  onApply(undoContent)
                  setUndoContent(null)
                  showMessage('已撤销本次填入')
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600"
              >撤销填入</button>
            ) : null}
            <button type="button" onClick={() => void load()} className={compact ? 'inline-flex items-center justify-center gap-1.5 rounded bg-primary-50/70 px-3 py-2 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500' : 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-50'}>
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              从历史资料填入{history.length ? `（${history.length}）` : ''}
            </button>
            {moduleType !== 'basic_info' ? (
              <button type="button" onClick={() => void openExcellentResumes()} disabled={openingResumes} className={compact ? 'inline-flex items-center justify-center gap-1.5 rounded bg-gray-50 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50' : 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50'}>
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M8 13h8m-8 4h5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                参考优质简历
              </button>
            ) : null}
          </div>
        </div>
        {!saveBarFeedback && message ? <p className="mt-2 text-xs text-emerald-700" role="status">{message}</p> : null}
        {!saveBarFeedback && error && !open ? <p className="mt-2 text-xs text-red-600" role="alert">{error}</p> : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
          <div role="dialog" aria-modal="true" aria-label="选择简历资料" className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-950">选择{MODULE_LABELS[moduleType]}</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">关闭</button>
            </div>
            <div className="max-h-[55vh] space-y-3 overflow-y-auto p-5">
              {loading ? <p className="py-8 text-center text-sm text-slate-500">加载中…</p> : null}
              {!loading && !items.length ? <p className="py-8 text-center text-sm text-slate-500">暂无可用资料</p> : null}
              {!loading && items.map((material) => (
                <article key={material.key} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-medium text-slate-900">{material.title}</h3>
                      {material.sourceResumeTitle ? (
                        <p className="mt-1 text-xs text-slate-400">来自简历：{material.sourceResumeTitle}</p>
                      ) : null}
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{getMaterialPreview(material.content) || '结构化资料'}</p>
                    </div>
                    <button type="button" onClick={() => void apply(material)} className="shrink-0 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700">
                      填入当前{MODULE_LABELS[moduleType]}
                    </button>
                  </div>
                </article>
              ))}
              {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
