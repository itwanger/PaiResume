import { useEffect, useMemo, useState } from 'react'
import {
  adminContentLibraryApi,
  type ContentTemplateModule,
  type OfficialResumeMaterial,
  type ResumeContentTemplate,
} from '../../api/contentLibrary'
import { MODULE_LABELS, type ModuleType } from '../../types'
import { SegmentedControl } from '../ui/SegmentedControl'

const MATERIAL_TYPES = (Object.keys(MODULE_LABELS) as ModuleType[]).filter((type) => type !== 'basic_info')
type Tab = 'materials' | 'templates'

interface DraftForm {
  id: number | null
  title: string
  moduleType: ModuleType
  targetRole: string
  careerStage: string
  summary: string
  layoutTemplateId: string
  tags: string
  contentJson: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  sourceType: 'MANUAL' | 'AI'
}

const EMPTY_FORM: DraftForm = {
  id: null,
  title: '',
  moduleType: 'project',
  targetRole: '',
  careerStage: '',
  summary: '',
  layoutTemplateId: 'default',
  tags: '',
  contentJson: '{}',
  status: 'DRAFT',
  sourceType: 'MANUAL',
}

export function AdminContentLibraryPanel() {
  const [tab, setTab] = useState<Tab>('materials')
  const [materials, setMaterials] = useState<OfficialResumeMaterial[]>([])
  const [templates, setTemplates] = useState<ResumeContentTemplate[]>([])
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [materialResponse, templateResponse] = await Promise.all([
        adminContentLibraryApi.listMaterials(),
        adminContentLibraryApi.listTemplates(),
      ])
      setMaterials(materialResponse.data.data)
      setTemplates(templateResponse.data.data)
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : '加载内容库失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    setForm({ ...EMPTY_FORM, moduleType: tab === 'materials' ? 'project' : 'project' })
    setError('')
    setMessage('')
  }, [tab])

  const parsedTags = useMemo(() => form.tags.split(/[，,]/).map((item) => item.trim()).filter(Boolean), [form.tags])

  const save = async () => {
    if (!form.title.trim()) {
      setError('请输入标题')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const parsed = JSON.parse(form.contentJson) as Record<string, unknown> | ContentTemplateModule[]
      if (tab === 'materials') {
        if (Array.isArray(parsed)) throw new Error('素材内容必须是 JSON 对象')
        const payload = {
          moduleType: form.moduleType,
          title: form.title.trim(),
          targetRole: form.targetRole.trim(),
          careerStage: form.careerStage.trim(),
          content: parsed,
          tags: parsedTags,
          status: form.status,
          sourceType: form.sourceType,
        }
        const response = form.id === null
          ? await adminContentLibraryApi.createMaterial(payload)
          : await adminContentLibraryApi.updateMaterial(form.id, payload)
        setMaterials((current) => upsert(current, response.data.data))
      } else {
        if (!Array.isArray(parsed)) throw new Error('内容模板模块必须是 JSON 数组')
        const payload = {
          title: form.title.trim(),
          summary: form.summary.trim(),
          targetRole: form.targetRole.trim(),
          careerStage: form.careerStage.trim(),
          layoutTemplateId: form.layoutTemplateId.trim() || 'default',
          modules: parsed,
          tags: parsedTags,
          status: form.status,
          sourceType: form.sourceType,
        }
        const response = form.id === null
          ? await adminContentLibraryApi.createTemplate(payload)
          : await adminContentLibraryApi.updateTemplate(form.id, payload)
        setTemplates((current) => upsert(current, response.data.data))
      }
      setMessage(form.id === null ? '草稿已创建' : '内容已更新')
      setForm({ ...EMPTY_FORM })
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const generate = async () => {
    setGenerating(true)
    setError('')
    setMessage('')
    try {
      let facts: Record<string, unknown> = {}
      try {
        const parsed = JSON.parse(form.contentJson)
        if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') facts = parsed
      } catch {
        // 空或未完成的 JSON 不作为已核实事实发送；AI 只能生成占位参考草稿。
      }
      const response = await adminContentLibraryApi.generateAiDraft({
        kind: tab === 'materials' ? 'MATERIAL' : 'TEMPLATE',
        moduleType: form.moduleType,
        targetRole: form.targetRole.trim(),
        careerStage: form.careerStage.trim(),
        techStack: parsedTags,
        facts,
      })
      const draft = response.data.data
      const draftContent = tab === 'materials' ? draft.content : draft.modules
      setForm((current) => ({
        ...current,
        title: typeof draft.title === 'string' ? draft.title : current.title,
        summary: typeof draft.summary === 'string' ? draft.summary : current.summary,
        targetRole: typeof draft.targetRole === 'string' ? draft.targetRole : current.targetRole,
        careerStage: typeof draft.careerStage === 'string' ? draft.careerStage : current.careerStage,
        tags: Array.isArray(draft.tags) ? draft.tags.filter((item): item is string => typeof item === 'string').join('，') : current.tags,
        contentJson: JSON.stringify(draftContent ?? {}, null, 2),
        sourceType: 'AI',
        status: 'DRAFT',
      }))
      setMessage('AI 草稿已生成，审核并修改后再发布')
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'AI 草稿生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const editMaterial = (item: OfficialResumeMaterial) => {
    setTab('materials')
    setForm({
      ...EMPTY_FORM,
      id: item.id,
      title: item.title,
      moduleType: item.moduleType,
      targetRole: item.targetRole,
      careerStage: item.careerStage,
      tags: (item.tags ?? []).join('，'),
      contentJson: JSON.stringify(item.content, null, 2),
      status: item.status,
      sourceType: item.sourceType,
    })
  }

  const editTemplate = (item: ResumeContentTemplate) => {
    setTab('templates')
    setForm({
      ...EMPTY_FORM,
      id: item.id,
      title: item.title,
      targetRole: item.targetRole,
      careerStage: item.careerStage,
      summary: item.summary,
      layoutTemplateId: item.layoutTemplateId,
      tags: (item.tags ?? []).join('，'),
      contentJson: JSON.stringify(item.modules, null, 2),
      status: item.status,
      sourceType: item.sourceType,
    })
  }

  const list = tab === 'materials' ? materials : templates

  return (
    <section className="space-y-6">
      <SegmentedControl
        ariaLabel="内容库类型"
        value={tab}
        options={[
          { value: 'materials', label: '官方参考素材' },
          { value: 'templates', label: '简历内容模板' },
        ]}
        onChange={setTab}
        size="md"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-950">{form.id === null ? '新建' : '编辑'}{tab === 'materials' ? '参考素材' : '内容模板'}</h2>
            {form.id !== null ? <button type="button" onClick={() => setForm({ ...EMPTY_FORM })} className="text-xs text-slate-500">新建一条</button> : null}
          </div>
          <div className="mt-5 space-y-4">
            <Field label="标题" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-slate-700">模块类型
                <select value={form.moduleType} onChange={(event) => setForm((current) => ({ ...current, moduleType: event.target.value as ModuleType }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  {MATERIAL_TYPES.map((type) => <option key={type} value={type}>{MODULE_LABELS[type]}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">状态
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as DraftForm['status'] }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="DRAFT">草稿</option><option value="PUBLISHED">已发布</option><option value="ARCHIVED">已下架</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="目标岗位" value={form.targetRole} onChange={(value) => setForm((current) => ({ ...current, targetRole: value }))} />
              <Field label="求职阶段" value={form.careerStage} onChange={(value) => setForm((current) => ({ ...current, careerStage: value }))} />
            </div>
            {tab === 'templates' ? <>
              <Field label="适用说明" value={form.summary} onChange={(value) => setForm((current) => ({ ...current, summary: value }))} />
              <Field label="默认版式" value={form.layoutTemplateId} onChange={(value) => setForm((current) => ({ ...current, layoutTemplateId: value }))} />
            </> : null}
            <Field label="标签或技术栈（逗号分隔）" value={form.tags} onChange={(value) => setForm((current) => ({ ...current, tags: value }))} />
            <label className="block text-sm font-medium text-slate-700">
              {tab === 'materials' ? '内容 JSON' : '模块 JSON 数组'}
              <textarea value={form.contentJson} onChange={(event) => setForm((current) => ({ ...current, contentJson: event.target.value }))} rows={14} spellCheck={false} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs leading-5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500" />
            </label>
            {message ? <p className="text-sm text-emerald-700" role="status">{message}</p> : null}
            {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={generating || saving} onClick={() => void generate()} className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 disabled:opacity-50">{generating ? '生成中…' : 'AI 生成草稿'}</button>
              <button type="button" disabled={saving || generating} onClick={() => void save()} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? '保存中…' : '保存'}</button>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-950">{tab === 'materials' ? '参考素材' : '内容模板'}（{list.length}）</h2>
            <button type="button" onClick={() => void load()} className="text-sm text-primary-700">刷新</button>
          </div>
          {loading ? <p className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500">加载中…</p> : null}
          {!loading ? <div className="grid gap-4 md:grid-cols-2">
            {tab === 'materials' ? materials.map((item) => (
              <LibraryCard key={item.id} title={item.title} meta={`${MODULE_LABELS[item.moduleType]} · ${statusLabel(item.status)} · v${item.version}`} detail={[item.targetRole, item.careerStage, ...(item.tags ?? [])].filter(Boolean).join(' · ')} count={item.useCount} onEdit={() => editMaterial(item)} />
            )) : templates.map((item) => (
              <LibraryCard key={item.id} title={item.title} meta={`${statusLabel(item.status)} · ${item.modules.length} 个模块 · v${item.version}`} detail={item.summary || [item.targetRole, item.careerStage].filter(Boolean).join(' · ')} count={item.useCount} onEdit={() => editTemplate(item)} />
            ))}
          </div> : null}
        </div>
      </div>
    </section>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500" /></label>
}

function LibraryCard({ title, meta, detail, count, onEdit }: { title: string; meta: string; detail: string; count: number; onEdit: () => void }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1 text-xs text-slate-500">{meta}</p></div><button type="button" onClick={onEdit} className="text-sm font-medium text-primary-700">编辑</button></div>{detail ? <p className="mt-3 text-sm leading-6 text-slate-600">{detail}</p> : null}<p className="mt-4 text-xs text-slate-400">已使用 {count} 次</p></article>
}

function statusLabel(status: string) {
  if (status === 'PUBLISHED') return '已发布'
  if (status === 'ARCHIVED') return '已下架'
  return '草稿'
}

function upsert<T extends { id: number }>(items: T[], item: T): T[] {
  return items.some((current) => current.id === item.id)
    ? items.map((current) => current.id === item.id ? item : current)
    : [item, ...items]
}
