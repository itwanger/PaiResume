import { useEffect, useState } from 'react'
import {
  adminApi,
  type WechatPayConfigUpdatePayload,
  type WechatPayConfigView,
} from '../../api/admin'
import { useToast } from '../ui/ToastProvider'
import { getAdminErrorMessage } from './adminFormat'

const EMPTY_FORM: WechatPayConfigUpdatePayload = {
  appId: '',
  merchantId: '',
  privateKey: '',
  merchantSerialNumber: '',
  apiV3Key: '',
  paymentNotifyUrl: 'https://resume.paicoding.com/api/public/payments/wechat/notify',
  refundNotifyUrl: 'https://resume.paicoding.com/api/public/payments/wechat/refund-notify',
  enabled: false,
}

function viewToForm(view: WechatPayConfigView): WechatPayConfigUpdatePayload {
  return {
    appId: view.appId,
    merchantId: view.merchantId,
    privateKey: '',
    merchantSerialNumber: view.merchantSerialNumber,
    apiV3Key: '',
    paymentNotifyUrl: view.paymentNotifyUrl,
    refundNotifyUrl: view.refundNotifyUrl,
    enabled: view.enabled,
  }
}

export function WechatPayAdminPanel() {
  const { showToast } = useToast()
  const [view, setView] = useState<WechatPayConfigView | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void adminApi.getWechatPayConfig()
      .then((response) => {
        if (cancelled) return
        const data = response.data.data
        setView(data)
        setForm(viewToForm(data))
      })
      .catch((reason) => {
        if (!cancelled) {
          showToast({
            tone: 'error',
            message: getAdminErrorMessage(reason, '微信支付配置加载失败'),
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [showToast])

  const update = (patch: Partial<WechatPayConfigUpdatePayload>) => {
    setForm((current) => ({ ...current, ...patch }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const response = await adminApi.updateWechatPayConfig(form)
      const data = response.data.data
      setView(data)
      setForm(viewToForm(data))
      showToast({ tone: 'success', message: '微信支付配置已保存' })
    } catch (reason) {
      showToast({
        tone: 'error',
        message: getAdminErrorMessage(reason, '微信支付配置保存失败'),
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="h-72 animate-pulse bg-white" aria-label="正在加载微信支付配置" />
  }

  const credentialsAvailable = Boolean(
    form.privateKey.trim() && form.apiV3Key.trim(),
  ) || Boolean(view?.storedCredentialsConfigured || view?.environmentFallbackConfigured)
  const formComplete = Boolean(
    form.appId.trim()
    && form.merchantId.trim()
    && form.merchantSerialNumber.trim()
    && form.paymentNotifyUrl.trim()
    && form.refundNotifyUrl.trim()
    && credentialsAvailable,
  )
  const saveUnavailable = !formComplete || (form.enabled && !view?.masterKeyConfigured)

  return (
    <section className="max-w-4xl bg-white px-6 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">微信支付</h2>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || saveUnavailable}
          className={`admin-button admin-button--md ${
            saveUnavailable ? 'admin-button--disabled' : 'admin-button--primary'
          }`}
        >
          {saving ? '保存中…' : '保存配置'}
        </button>
      </div>

      {form.enabled && view && !view.masterKeyConfigured ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
          服务器未配置加密主密钥，暂时不能启用后台支付配置。
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">配置来源</span>
          <select
            value={form.enabled ? 'admin' : 'environment'}
            onChange={(event) => update({ enabled: event.target.value === 'admin' })}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-primary-300"
          >
            <option value="environment">.env 环境变量</option>
            <option value="admin">后台配置</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">App ID</span>
          <input
            value={form.appId}
            onChange={(event) => update({ appId: event.target.value })}
            maxLength={64}
            autoComplete="off"
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-primary-300"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">商户号</span>
          <input
            value={form.merchantId}
            onChange={(event) => update({ merchantId: event.target.value })}
            maxLength={32}
            autoComplete="off"
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-primary-300"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">商户证书序列号</span>
          <input
            value={form.merchantSerialNumber}
            onChange={(event) => update({ merchantSerialNumber: event.target.value })}
            maxLength={128}
            autoComplete="off"
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-primary-300"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">商户私钥</span>
          <input
            type="password"
            value={form.privateKey}
            onChange={(event) => update({ privateKey: event.target.value })}
            placeholder={view?.privateKeyMask ?? '未配置'}
            maxLength={16384}
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-primary-300"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">API v3 Key</span>
          <input
            type="password"
            value={form.apiV3Key}
            onChange={(event) => update({ apiV3Key: event.target.value })}
            placeholder={view?.apiV3KeyMask ?? '未配置'}
            maxLength={64}
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-primary-300"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">支付结果通知地址</span>
          <input
            type="url"
            value={form.paymentNotifyUrl}
            onChange={(event) => update({ paymentNotifyUrl: event.target.value })}
            maxLength={255}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-primary-300"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">退款结果通知地址</span>
          <input
            type="url"
            value={form.refundNotifyUrl}
            onChange={(event) => update({ refundNotifyUrl: event.target.value })}
            maxLength={255}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-primary-300"
          />
        </label>
      </div>
    </section>
  )
}
