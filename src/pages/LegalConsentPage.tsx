import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/auth'
import { LogoMark } from '../components/branding/LogoMark'
import {
  AI_PROVIDER_NAME,
  AI_PROVIDER_PRIVACY_URL,
  LEGAL_DISCLOSURE_READY,
  OPERATOR_NAME,
} from '../config/legalDisclosure'
import { AUTHENTICATED_HOME_PATH } from '../config/site'
import { useAuthStore } from '../store/authStore'
import { getSafeInternalPath } from '../utils/navigation'

export default function LegalConsentPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const refreshUser = useAuthStore((state) => state.refreshUser)
  const logout = useAuthStore((state) => state.logout)
  const [accepted, setAccepted] = useState(false)
  const [pendingAction, setPendingAction] = useState<'accept' | 'logout' | null>(null)
  const [error, setError] = useState('')
  const returnTo = getSafeInternalPath(searchParams.get('redirect'), AUTHENTICATED_HOME_PATH)

  const submit = async () => {
    if (!accepted) {
      setError('请先阅读并同意服务条款与隐私政策')
      return
    }
    setPendingAction('accept')
    setError('')
    try {
      await authApi.acceptLegalConsent()
      await refreshUser()
      navigate(returnTo, { replace: true })
    } catch (consentError: unknown) {
      setError(consentError instanceof Error ? consentError.message : '保存失败，请稍后再试')
    } finally {
      setPendingAction(null)
    }
  }

  const leave = async () => {
    setPendingAction('logout')
    setError('')
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Link to="/" aria-label="返回派简历首页" className="flex items-center gap-3">
          <LogoMark className="h-10 w-10" />
          <span className="text-xl font-bold text-slate-950">派简历</span>
        </Link>
        <h1 className="mt-8 text-2xl font-bold text-slate-950">请确认最新协议</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          我们补充说明了简历数据、第三方 AI 处理、付费退款和账号注销方式。继续使用前，请阅读并确认当前版本。
        </p>
        {!LEGAL_DISCLOSURE_READY ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800" role="alert">
            运营主体、私密客服或第三方 AI 服务商披露尚未配置完整。此构建仅可用于本地开发，不能部署到生产环境。
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            <p>服务运营主体：<strong className="font-semibold text-slate-900">{OPERATOR_NAME}</strong></p>
            <p>
              AI 服务商：<strong className="font-semibold text-slate-900">{AI_PROVIDER_NAME}</strong>（
              <a href={AI_PROVIDER_PRIVACY_URL} target="_blank" rel="noreferrer" className="font-medium text-primary-600 hover:text-primary-700">查看服务商隐私政策</a>）
            </p>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-4 text-sm">
          <Link to="/terms" target="_blank" rel="noreferrer" className="font-medium text-primary-600 hover:text-primary-700">服务条款</Link>
          <Link to="/privacy" target="_blank" rel="noreferrer" className="font-medium text-primary-600 hover:text-primary-700">隐私政策</Link>
          <Link to="/refund-policy" target="_blank" rel="noreferrer" className="font-medium text-primary-600 hover:text-primary-700">退款规则</Link>
        </div>

        <label className="mt-7 flex items-start gap-3 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <span>
            我已阅读并同意当前版本《服务条款》和《隐私政策》，并知悉主动使用 AI 功能时相关简历内容会发送给
            {AI_PROVIDER_NAME || '尚未配置的第三方模型服务商'}处理。
          </span>
        </label>

        {error ? <div role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={pendingAction !== null || !accepted}
          aria-busy={pendingAction === 'accept'}
          className="mt-6 w-full rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pendingAction === 'accept' ? '正在保存...' : '同意并继续'}
        </button>
        <button
          type="button"
          onClick={() => void leave()}
          disabled={pendingAction !== null}
          aria-busy={pendingAction === 'logout'}
          className="mt-3 w-full rounded-lg border border-slate-300 py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pendingAction === 'logout' ? '正在退出...' : '不同意，退出登录'}
        </button>
        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          如不再使用派简历，也可以前往
          <Link to="/settings/account" className="ml-1 font-medium text-slate-700 underline underline-offset-2">
            账号设置
          </Link>
          申请注销账号。
        </p>
      </div>
    </div>
  )
}
