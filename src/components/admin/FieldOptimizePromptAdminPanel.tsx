import { useEffect, useState } from 'react'
import { adminApi, type FieldOptimizePromptAdmin } from '../../api/admin'

const fields = [
  ['systemPrompt', '系统提示词'],
  ['descriptionPrompt', '项目简介提示词'],
  ['responsibilityPrompt', '核心职责提示词'],
  ['skillPrompt', '专业技能提示词'],
] as const

export function FieldOptimizePromptAdminPanel() {
  const [configs, setConfigs] = useState<FieldOptimizePromptAdmin[]>([])
  const [drafts, setDrafts] = useState<Record<string, FieldOptimizePromptAdmin>>({})
  const [selected, setSelected] = useState('standard')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    void adminApi.listFieldOptimizePrompts().then(({ data }) => {
      if (!active) return
      setConfigs(data.data)
      setDrafts(Object.fromEntries(data.data.map((item) => [item.presetId, item])))
    }).catch(() => { if (active) setError('提示词加载失败，请刷新重试。') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const draft = drafts[selected]
  const saved = configs.find((item) => item.presetId === selected)
  const changed = JSON.stringify(draft) !== JSON.stringify(saved)
  function edit(key: keyof FieldOptimizePromptAdmin, value: string) {
    setDrafts((current) => ({ ...current, [selected]: { ...current[selected], [key]: value } }))
    setNotice('')
  }
  async function save() {
    if (!draft || saving) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const { data } = await adminApi.updateFieldOptimizePrompt(selected, draft)
      setConfigs((current) => current.map((item) => item.presetId === selected ? data.data : item))
      setDrafts((current) => ({ ...current, [selected]: data.data }))
      setNotice('已保存')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试。')
    } finally { setSaving(false) }
  }
  return (
    <section className="mb-8 bg-white p-6 sm:p-8" aria-labelledby="field-prompts-heading">
      <h2 id="field-prompts-heading" className="text-xl font-semibold text-slate-950">字段优化提示词</h2>
      {loading ? <p role="status" className="mt-4 text-sm text-slate-500">加载中…</p> : null}
      <div className="my-5 flex flex-wrap gap-2" role="tablist" aria-label="优化方式">
        {configs.map((item) => <button key={item.presetId} type="button" role="tab" aria-selected={selected === item.presetId} disabled={saving} onClick={() => { setSelected(item.presetId); setNotice(''); setError('') }} className={`rounded-lg px-4 py-2 text-sm ${selected === item.presetId ? 'bg-primary-50 text-primary-700' : 'text-slate-600'}`}>{item.name}</button>)}
      </div>
      {draft ? <div role="tabpanel" aria-label={saved?.name}>
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <label className="text-sm font-medium text-slate-700">方式名称<input value={draft.name} maxLength={40} disabled={saving} onChange={(e) => edit('name', e.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 p-3" /></label>
          <label className="text-sm font-medium text-slate-700">特色说明<input value={draft.description} maxLength={200} disabled={saving} onChange={(e) => edit('description', e.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 p-3" /></label>
        </div>
        <p className="mt-5 text-sm text-slate-500">字段提示词须保留 {'{{original}}'}，用于插入待优化原文。</p>
        <div className="mt-4 grid gap-5 xl:grid-cols-2">
          {fields.map(([key, label]) => <label key={key} className="text-sm font-medium text-slate-700">{label}<textarea value={draft[key]} maxLength={20000} rows={10} disabled={saving} onChange={(e) => edit(key, e.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal leading-6" /></label>)}
        </div>
        <button type="button" onClick={() => void save()} disabled={!changed || saving} className="mt-5 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-500">{saving ? '保存中…' : '保存优化方式'}</button>
      </div> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
      {notice ? <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
    </section>
  )
}
