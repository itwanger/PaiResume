import { useEffect, useState } from 'react'
import {
  contentLibraryApi,
  type OfficialResumeMaterial,
  type ResumeHistoryMaterial,
} from '../../api/contentLibrary'
import { MODULE_LABELS, type ModuleType } from '../../types'
import { applyMaterialFields, getMaterialPreview, hasMeaningfulMaterialValue } from '../../utils/materialLibrary'
import { useModuleSaveFeedback } from '../modules/moduleSaveFeedback'
import { SegmentedControl } from '../ui/SegmentedControl'

interface Props<T extends object> {
  resumeId: number
  moduleType: ModuleType
  content: T
  onApply: (content: T) => void
  embedded?: boolean
}

type PickerTab = 'history' | 'official'

export function MaterialActions<T extends object>({
  resumeId,
  moduleType,
  content,
  onApply,
  embedded = false,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<PickerTab>('history')
  const [history, setHistory] = useState<ResumeHistoryMaterial[]>([])
  const [historyChecked, setHistoryChecked] = useState(false)
  const [official, setOfficial] = useState<OfficialResumeMaterial[]>([])
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

  const load = async (nextTab: PickerTab) => {
    setTab(nextTab)
    setOpen(true)
    setLoading(true)
    setError('')
    try {
      if (nextTab === 'history') {
        if (!historyChecked) {
          const response = await contentLibraryApi.listHistoryMaterials({
            moduleType,
            excludeResumeId: resumeId,
          })
          setHistory(response.data.data)
          setHistoryChecked(true)
        }
      } else {
        const response = await contentLibraryApi.listOfficialMaterials({ moduleType })
        setOfficial(response.data.data)
      }
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : '加载资料失败')
    } finally {
      setLoading(false)
    }
  }

  const apply = async (material: ResumeHistoryMaterial | OfficialResumeMaterial) => {
    setError('')
    try {
      const source = 'key' in material
        ? material.content
        : (await contentLibraryApi.useOfficialMaterial(material.id)).data.data.content
      setUndoContent(content)
      onApply(applyMaterialFields(content, source))
      setOpen(false)
      showMessage(`已从${tab === 'history' ? '历史资料' : '官方参考'}填入当前${MODULE_LABELS[moduleType]}`)
    } catch (requestError: unknown) {
      showError(requestError instanceof Error ? requestError.message : '套用资料失败')
    }
  }

  const items = tab === 'history' ? history : official

  return (
    <>
      <div className={embedded ? 'min-w-0 flex-1' : 'rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3'}>
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
            <button type="button" onClick={() => void load('history')} className="rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-50">
              从历史资料填入{history.length ? `（${history.length}）` : ''}
            </button>
            {moduleType !== 'basic_info' ? (
              <button type="button" onClick={() => void load('official')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white">
                参考官方示例
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
            <div className="border-b border-slate-100 px-5 py-3">
              <SegmentedControl
                ariaLabel="资料来源"
                value={tab}
                options={moduleType === 'basic_info'
                  ? [{ value: 'history', label: '历史资料' }]
                  : [
                      { value: 'history', label: '历史资料' },
                      { value: 'official', label: '官方参考' },
                    ]}
                onChange={(nextTab) => void load(nextTab)}
                size="md"
              />
            </div>
            <div className="max-h-[55vh] space-y-3 overflow-y-auto p-5">
              {loading ? <p className="py-8 text-center text-sm text-slate-500">加载中…</p> : null}
              {!loading && !items.length ? <p className="py-8 text-center text-sm text-slate-500">暂无可用资料</p> : null}
              {!loading && items.map((material) => (
                <article key={`${tab}-${'key' in material ? material.key : material.id}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-medium text-slate-900">{material.title}</h3>
                      {'sourceResumeTitle' in material && material.sourceResumeTitle ? (
                        <p className="mt-1 text-xs text-slate-400">来自简历：{material.sourceResumeTitle}</p>
                      ) : null}
                      {'targetRole' in material && material.targetRole ? <p className="mt-1 text-xs text-primary-700">{material.targetRole}{material.careerStage ? ` · ${material.careerStage}` : ''}</p> : null}
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
