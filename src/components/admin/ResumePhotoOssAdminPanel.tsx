import { useEffect, useState } from 'react'
import {
  adminApi,
  type ResumePhotoOssConfigUpdatePayload,
  type ResumePhotoOssConfigView,
} from '../../api/admin'
import { useToast } from '../ui/ToastProvider'
import { getAdminErrorMessage } from './adminFormat'

const EMPTY_FORM: ResumePhotoOssConfigUpdatePayload = {
  endpoint: '',
  bucket: '',
  objectPrefix: 'pairesume',
  accessKeyId: '',
  accessKeySecret: '',
}

export function ResumePhotoOssAdminPanel() {
  const { showToast } = useToast()
  const [view, setView] = useState<ResumePhotoOssConfigView | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

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
          objectPrefix: data.objectPrefix,
          accessKeyId: '',
          accessKeySecret: '',
        })
      })
      .catch((reason) => {
        if (!cancelled) {
          showToast({
            tone: 'error',
            message: getAdminErrorMessage(reason, '照片 OSS 配置加载失败'),
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [showToast])

  const update = (patch: Partial<ResumePhotoOssConfigUpdatePayload>) => {
    setForm((current) => ({ ...current, ...patch }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const response = await adminApi.updateResumePhotoOssConfig(form)
      const data = response.data.data
      setView(data)
      setForm((current) => ({
        ...current,
        endpoint: data.endpoint,
        bucket: data.bucket,
        objectPrefix: data.objectPrefix,
        accessKeyId: '',
        accessKeySecret: '',
      }))
      showToast({ tone: 'success', message: '照片 OSS 配置已保存' })
    } catch (reason) {
      showToast({
        tone: 'error',
        message: getAdminErrorMessage(reason, '照片 OSS 配置保存失败'),
      })
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    try {
      const response = await adminApi.testResumePhotoOssConnection(form)
      const data = response.data.data
      showToast({
        tone: data.success ? 'success' : 'error',
        message: data.success
          ? `连接成功（${data.latencyMillis}ms）`
          : `连接失败：${data.message}`,
      })
    } catch (reason) {
      showToast({
        tone: 'error',
        message: getAdminErrorMessage(reason, '连接测试失败'),
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <div className="h-72 animate-pulse bg-white" aria-label="正在加载照片 OSS 配置" />
  }

  const hasStoredCredentials = Boolean(view?.credentialsConfigured)
  const hasAccessKeyId = Boolean(form.accessKeyId.trim()) || hasStoredCredentials
  const hasAccessKeySecret = Boolean(form.accessKeySecret.trim()) || hasStoredCredentials
  const formComplete = Boolean(form.endpoint.trim() && form.bucket.trim() && form.objectPrefix.trim()
    && hasAccessKeyId && hasAccessKeySecret)
  const testUnavailable = !formComplete
  const saveUnavailable = !formComplete || !view?.masterKeyConfigured

  return (
    <section className="max-w-4xl bg-white px-6 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">照片 OSS</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void test()}
            disabled={testing || testUnavailable}
            className={`admin-button admin-button--md ${
              testUnavailable
                ? 'admin-button--disabled'
                : 'admin-button--quiet'
            }`}
          >
            {testing ? '测试中…' : '测试连接'}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || saveUnavailable}
            className={`admin-button admin-button--md ${
              saveUnavailable
                ? 'admin-button--disabled'
                : 'admin-button--primary'
            }`}
          >
            {saving ? '保存中…' : '保存配置'}
          </button>
        </div>
      </div>

      {view && !view.masterKeyConfigured ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
          服务器未配置加密主密钥，暂时不能保存 AK 和 SK。
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Endpoint</span>
          <input
            value={form.endpoint}
            onChange={(event) => update({ endpoint: event.target.value })}
            placeholder="oss-cn-beijing.aliyuncs.com"
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
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">目录前缀</span>
          <input
            value={form.objectPrefix}
            onChange={(event) => update({ objectPrefix: event.target.value })}
            placeholder="pairesume"
            maxLength={128}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-primary-300"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">AK</span>
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
          <span className="font-medium text-slate-700">SK</span>
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
    </section>
  )
}
