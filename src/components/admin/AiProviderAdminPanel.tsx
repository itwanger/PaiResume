import { useEffect, useState } from 'react'
import {
  adminApi,
  type AiProviderConfigView,
  type AiProviderModelOption,
} from '../../api/admin'
import { getAdminErrorMessage } from './adminFormat'

const EMPTY_FORM = {
  providerCode: 'DEEPSEEK',
  modelId: 'deepseek-v4-flash',
  apiKey: '',
  autoUpgrade: false,
  enabled: false,
}

const AI_PROVIDER_OPTIONS = [
  {
    code: 'DEEPSEEK',
    name: 'DeepSeek',
    defaultModelId: 'deepseek-v4-flash',
    models: [
      { id: 'deepseek-v4-flash', label: 'DeepSeek V4-Flash' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4-Pro' },
      { id: 'deepseek-v4-flash-vision-exp', label: 'DeepSeek V4-Flash-Vision-Exp' },
    ],
  },
  {
    code: 'GLM',
    name: '智谱 GLM',
    defaultModelId: 'glm-5.3-flash',
    models: [{ id: 'glm-5.3-flash', label: 'GLM-5.3-Flash' }],
  },
] as const

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
          providerCode: data.providerCode,
          modelId: data.generalModel,
          apiKey: '',
          autoUpgrade: data.autoUpgrade,
          enabled: data.enabled,
        })
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(getAdminErrorMessage(reason, 'AI 服务商配置加载失败'))
        }
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

  const handleProviderChange = (providerCode: string) => {
    const provider = AI_PROVIDER_OPTIONS.find((item) => item.code === providerCode)
      ?? AI_PROVIDER_OPTIONS[0]
    update({
      providerCode: provider.code,
      modelId: provider.defaultModelId,
      apiKey: '',
      autoUpgrade: false,
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await adminApi.updateAiProviderConfig(form)
      const data = response.data.data
      setView(data)
      setForm((current) => ({
        ...current,
        providerCode: data.providerCode,
        modelId: data.generalModel,
        apiKey: '',
        autoUpgrade: data.autoUpgrade,
        enabled: data.enabled,
      }))
      setSuccess('AI 服务商配置已保存')
    } catch (reason) {
      setError(getAdminErrorMessage(reason, 'AI 服务商配置保存失败'))
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
      setView((current) => current
        ? { ...current, availableModels: data.availableModels }
        : current)
      setTestResult(
        data.success
          ? `连接成功（${data.latencyMillis}ms）`
          : `连接失败：${data.message}`,
      )
    } catch (reason) {
      setTestResult(getAdminErrorMessage(reason, '连接测试请求失败'))
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" aria-label="正在加载 AI 服务商配置" />
  }

  const selectedProvider = AI_PROVIDER_OPTIONS.find(
    (provider) => provider.code === form.providerCode,
  ) ?? AI_PROVIDER_OPTIONS[0]
  const modelMap = new Map<string, AiProviderModelOption>()
  selectedProvider.models.forEach((model) => modelMap.set(model.id, model))
  if (view?.providerCode === form.providerCode) {
    view.availableModels.forEach((model) => modelMap.set(model.id, model))
  }
  if (!modelMap.has(form.modelId)) {
    modelMap.set(form.modelId, { id: form.modelId, label: form.modelId })
  }
  const availableModels = Array.from(modelMap.values())
  const hasUnsavedChanges = !view
    || form.providerCode !== view.providerCode
    || form.modelId !== view.generalModel
    || form.autoUpgrade !== view.autoUpgrade
    || form.enabled !== view.enabled
    || form.apiKey.length > 0

  return (
    <section className="max-w-4xl bg-white px-6 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">AI 服务商</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing || saving || hasUnsavedChanges}
            title={hasUnsavedChanges ? '请先保存配置' : undefined}
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
          <span className="font-medium text-slate-700">服务商</span>
          <select
            value={form.providerCode}
            onChange={(event) => handleProviderChange(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          >
            {AI_PROVIDER_OPTIONS.map((provider) => (
              <option key={provider.code} value={provider.code}>{provider.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">模型</span>
          <select
            value={form.modelId}
            onChange={(event) => update({ modelId: event.target.value })}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          >
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>{model.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">API Key</span>
          <input
            type="password"
            value={form.apiKey}
            onChange={(event) => update({ apiKey: event.target.value })}
            placeholder={
              view?.providerCode === form.providerCode && view.apiKeyConfigured
                ? view.apiKeyMask
                : '未配置'
            }
            maxLength={512}
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
        </label>
      </div>

      <label className="mt-5 flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.autoUpgrade}
          onChange={(event) => update({ autoUpgrade: event.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600"
        />
        <span>
          <span className="block">自动升级同系列模型</span>
          <span className="mt-1 block text-xs text-slate-500">
            只在 Flash、Pro 或 Vision 各自系列内升级，不跨系列切换。
          </span>
        </span>
      </label>

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
