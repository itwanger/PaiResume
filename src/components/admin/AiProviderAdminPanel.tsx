import { useEffect, useState } from 'react'
import { adminApi, type AiProviderConfigView } from '../../api/admin'

const EMPTY_FORM = {
  displayName: '',
  baseUrl: '',
  generalModel: '',
  analysisModel: '',
  apiKey: '',
  privacyPolicyUrl: '',
  enabled: false,
}

export function AiProviderAdminPanel() {
  const [view, setView] = useState<AiProviderConfigView | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [testResult, setTestResult] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void adminApi.getAiProviderConfig()
      .then((response) => {
        if (cancelled) return
        const data = response.data.data
        setView(data)
        setForm({
          displayName: data.displayName,
          baseUrl: data.baseUrl,
          generalModel: data.generalModel,
          analysisModel: data.analysisModel,
          apiKey: '',
          privacyPolicyUrl: data.privacyPolicyUrl,
          enabled: data.enabled,
        })
      })
      .catch(() => {
        if (!cancelled) setError('AI 服务商配置加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const update = (patch: Partial<typeof EMPTY_FORM>) => {
    setForm((current) => ({ ...current, ...patch }))
    setSuccess('')
    setError('')
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await adminApi.updateAiProviderConfig(form)
      const data = response.data.data
      setView(data)
      setForm((current) => ({ ...current, apiKey: '', enabled: data.enabled }))
      setSuccess('AI 服务商配置已保存')
    } catch {
      setError('AI 服务商配置保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult('')
    try {
      const response = await adminApi.testAiProviderConnection()
      const data = response.data.data
      setTestResult(
        data.success
          ? `连接成功（${data.latencyMillis}ms）`
          : `连接失败：${data.message}`,
      )
    } catch {
      setTestResult('连接测试请求失败')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" aria-label="正在加载 AI 服务商配置" />
  }

  return (
    <section className="max-w-4xl bg-white px-6 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">AI 服务商</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-primary-300 hover:text-primary-700 disabled:cursor-default disabled:opacity-50"
          >
            {testing ? '测试中…' : '测试连接'}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-default disabled:bg-slate-200 disabled:text-slate-500"
          >
            {saving ? '保存中…' : '保存配置'}
          </button>
        </div>
      </div>

      {view && !view.masterKeyConfigured ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
          服务器未配置 AI_PROVIDER_MASTER_KEY，保存加密 API Key 前需先在环境文件中配置主密钥。
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">服务商名称</span>
          <input
            value={form.displayName}
            onChange={(event) => update({ displayName: event.target.value })}
            maxLength={64}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Base URL</span>
          <input
            value={form.baseUrl}
            onChange={(event) => update({ baseUrl: event.target.value })}
            maxLength={255}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">通用模型</span>
          <input
            value={form.generalModel}
            onChange={(event) => update({ generalModel: event.target.value })}
            maxLength={64}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">分析模型</span>
          <input
            value={form.analysisModel}
            onChange={(event) => update({ analysisModel: event.target.value })}
            maxLength={64}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">API Key</span>
          <input
            type="password"
            value={form.apiKey}
            onChange={(event) => update({ apiKey: event.target.value })}
            placeholder={view?.apiKeyConfigured ? view.apiKeyMask : '未配置'}
            maxLength={512}
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">隐私政策链接</span>
          <input
            value={form.privacyPolicyUrl}
            onChange={(event) => update({ privacyPolicyUrl: event.target.value })}
            maxLength={255}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
        </label>
      </div>

      <label className="mt-5 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(event) => update({ enabled: event.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-primary-600"
        />
        启用本配置
      </label>

      {error ? <p className="mt-4 text-sm text-red-600" role="alert">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-emerald-700" role="status">{success}</p> : null}
      {testResult ? (
        <p className={`mt-4 text-sm ${testResult.startsWith('连接成功') ? 'text-emerald-700' : 'text-red-600'}`} role="status">
          {testResult}
        </p>
      ) : null}
    </section>
  )
}
