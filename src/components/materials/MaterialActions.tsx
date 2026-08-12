import { useEffect, useState } from 'react'
import {
  contentLibraryApi,
  type OfficialResumeMaterial,
  type UserResumeMaterial,
} from '../../api/contentLibrary'
import { MODULE_LABELS, type ModuleType } from '../../types'
import { applyMaterialFields, getMaterialPreview, hasMeaningfulMaterialValue } from '../../utils/materialLibrary'
import { SegmentedControl } from '../ui/SegmentedControl'

interface Props<T extends object> {
  moduleType: Exclude<ModuleType, 'basic_info'>
  content: T
  defaultTitle: string
  instanceKey: string | number
  onApply: (content: T) => void
  embedded?: boolean
}

type PickerTab = 'mine' | 'official'

export function MaterialActions<T extends object>({
  moduleType,
  content,
  defaultTitle,
  instanceKey,
  onApply,
  embedded = false,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<PickerTab>('mine')
  const [mine, setMine] = useState<UserResumeMaterial[]>([])
  const [official, setOfficial] = useState<OfficialResumeMaterial[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [title, setTitle] = useState(defaultTitle)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [undoContent, setUndoContent] = useState<T | null>(null)

  useEffect(() => {
    setTitle(defaultTitle)
  }, [defaultTitle])

  const load = async (nextTab: PickerTab) => {
    setTab(nextTab)
    setOpen(true)
    setLoading(true)
    setError('')
    try {
      if (nextTab === 'mine') {
        const response = await contentLibraryApi.listMyMaterials({ moduleType })
        setMine(response.data.data)
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

  const save = async () => {
    if (!title.trim()) {
      setError('请输入资料名称')
      return
    }
    if (!hasMeaningfulMaterialValue(content)) {
      setError('请先填写当前模块，再保存到资料库')
      return
    }
    setSaving(true)
    setError('')
    try {
      await contentLibraryApi.createMyMaterial({
        moduleType,
        title: title.trim(),
        content: content as Record<string, unknown>,
      })
      setMessage('已保存到我的资料库')
      setSaveOpen(false)
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : '保存资料失败')
    } finally {
      setSaving(false)
    }
  }

  const apply = async (material: UserResumeMaterial | OfficialResumeMaterial) => {
    setError('')
    try {
      const source = 'userId' in material
        ? material.content
        : (await contentLibraryApi.useOfficialMaterial(material.id)).data.data.content
      setUndoContent(content)
      onApply(applyMaterialFields(content, source))
      setOpen(false)
      setMessage(`已从资料库填入当前${MODULE_LABELS[moduleType]}`)
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : '套用资料失败')
    }
  }

  const items = tab === 'mine' ? mine : official

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
                  setMessage('已撤销本次填入')
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600"
              >撤销填入</button>
            ) : null}
            <button type="button" onClick={() => void load('mine')} className="rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-50">
              从资料库填入
            </button>
            <button type="button" onClick={() => void load('official')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white">
              参考官方示例
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setTitle(defaultTitle)
                setError('')
                setMessage('')
                setSaveOpen(true)
              }}
              className="rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              保存到资料库
            </button>
          </div>
        </div>
        {saveOpen ? (
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={`material-title-${moduleType}-${instanceKey}`}>
                资料名称
              </label>
              <input
                id={`material-title-${moduleType}-${instanceKey}`}
                value={title}
                maxLength={128}
                autoFocus
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={saving} onClick={() => setSaveOpen(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 disabled:opacity-50">取消</button>
              <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                {saving ? '保存中…' : '确认保存'}
              </button>
            </div>
          </div>
        ) : null}
        {message ? <p className="mt-2 text-xs text-emerald-700" role="status">{message}</p> : null}
        {error && !open ? <p className="mt-2 text-xs text-red-600" role="alert">{error}</p> : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
          <div role="dialog" aria-modal="true" aria-label="选择简历资料" className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-950">选择{MODULE_LABELS[moduleType]}</h2>
                <p className="mt-1 text-xs text-slate-500">选择一条资料填入当前{MODULE_LABELS[moduleType]}。</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">关闭</button>
            </div>
            <div className="border-b border-slate-100 px-5 py-3">
              <SegmentedControl
                ariaLabel="资料来源"
                value={tab}
                options={[
                  { value: 'mine', label: '我的资料' },
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
                <article key={`${tab}-${material.id}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-medium text-slate-900">{material.title}</h3>
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
