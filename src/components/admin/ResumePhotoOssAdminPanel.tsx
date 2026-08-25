import { useEffect, useState } from 'react'
import {
  adminApi,
  type ResumePhotoOssConfigUpdatePayload,
  type ResumePhotoOssConfigView,
} from '../../api/admin'
import { getAdminErrorMessage } from './adminFormat'

const EMPTY_FORM: ResumePhotoOssConfigUpdatePayload = {
  endpoint: '',
  bucket: '',
  accessKeyId: '',
  accessKeySecret: '',
  privateBucketConfirmed: false,
  corsConfirmed: false,
  stagingLifecycleConfirmed: false,
  ramPolicyConfirmed: false,
  enabled: false,
}

export function ResumePhotoOssAdminPanel() {
  const [view, setView] = useState<ResumePhotoOssConfigView | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [testResult, setTestResult] = useState('')

  useEffect(() => {
    let cancelled = false
    void adminApi.getResumePhotoOssConfig()
      .then((response) => {
        if (cancelled) return
        const data = response.data.data
        setView(data)
        setForm({
          endpoint: data.endpoint,
          bucket: data.bucket,
          accessKeyId: '',
          accessKeySecret: '',
          privateBucketConfirmed: data.privateBucketConfirmed,
          corsConfirmed: data.corsConfirmed,
          stagingLifecycleConfirmed: data.stagingLifecycleConfirmed,
          ramPolicyConfirmed: data.ramPolicyConfirmed,
          enabled: data.enabled,
        })
      })
      .catch((reason) => {
        if (!cancelled) setError(getAdminErrorMessage(reason, '照片 OSS 配置加载失败'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const update = (patch: Partial<ResumePhotoOssConfigUpdatePayload>) => {
    setForm((current) => ({ ...current, ...patch }))
    setError('')
    setSuccess('')
    setTestResult('')
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await adminApi.updateResumePhotoOssConfig(form)
      const data = response.data.data
      setView(data)
      setForm((current) => ({
        ...current,
        accessKeyId: '',
        accessKeySecret: '',
        enabled: data.enabled,
      }))
      setSuccess('照片 OSS 配置已保存')
    } catch (reason) {
      setError(getAdminErrorMessage(reason, '照片 OSS 配置保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setTestResult('')
    try {
      const response = await adminApi.testResumePhotoOssConnection()
      const data = response.data.data
      setTestResult(data.success
        ? `连接成功（${data.latencyMillis}ms）`
        : `连接失败：${data.message}`)
    } catch (reason) {
      setTestResult(getAdminErrorMessage(reason, '连接测试失败'))
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <div className="h-72 animate-pulse bg-white" aria-label="正在加载照片 OSS 配置" />
  }

  return (
    <section className="max-w-4xl bg-white px-6 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">照片 OSS</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void test()}
            disabled={testing || !view?.credentialsConfigured}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {testing ? '测试中…' : '测试连接'}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-500"
          >
            {saving ? '保存中…' : '保存配置'}
          </button>
        </div>
      </div>

      {view && !view.masterKeyConfigured ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
          服务器未配置加密主密钥，暂时不能保存 AccessKey。
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Endpoint</span>
          <input
            value={form.endpoint}
            onChange={(event) => update({ endpoint: event.target.value })}
            placeholder="https://oss-cn-hangzhou.aliyuncs.com"
            maxLength={255}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-primary-300"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Bucket</span>
          <input
            value={form.bucket}
            onChange={(event) => update({ bucket: event.target.value })}
            maxLength={63}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-primary-300"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">AccessKey ID</span>
          <input
            type="password"
            value={form.accessKeyId}
            onChange={(event) => update({ accessKeyId: event.target.value })}
            placeholder={view?.credentialsConfigured ? view.accessKeyIdMask ?? '已配置' : '未配置'}
            autoComplete="new-password"
            maxLength={256}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-primary-300"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">AccessKey Secret</span>
          <input
            type="password"
            value={form.accessKeySecret}
            onChange={(event) => update({ accessKeySecret: event.target.value })}
            placeholder={view?.credentialsConfigured ? view.accessKeySecretMask ?? '已配置' : '未配置'}
            autoComplete="new-password"
            maxLength={512}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-primary-300"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {([
          ['privateBucketConfirmed', '私有 Bucket 已确认'],
          ['corsConfirmed', '生产域名 CORS 已确认'],
          ['stagingLifecycleConfirmed', '暂存对象生命周期已确认'],
          ['ramPolicyConfirmed', 'RAM 最小权限已确认'],
        ] as const).map(([field, label]) => (
          <label key={field} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form[field]}
              onChange={(event) => update({ [field]: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-primary-600"
            />
            {label}
          </label>
        ))}
      </div>

      <label className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-800">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(event) => update({ enabled: event.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-primary-600"
        />
        启用照片 OSS
      </label>

      {error ? <p className="mt-4 text-sm text-red-600" role="alert">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-emerald-700" role="status">{success}</p> : null}
      {testResult ? <p className="mt-4 text-sm text-slate-700" role="status">{testResult}</p> : null}
    </section>
  )
}
