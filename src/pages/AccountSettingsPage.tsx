import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi, type WechatChallengeCreateData } from '../api/auth'
import { Header } from '../components/layout/Header'
import { useAuthStore } from '../store/authStore'

type ReauthPhase = 'idle' | 'loading' | 'pending' | 'confirmed' | 'expired' | 'error'

const REAUTH_POLL_INTERVAL_MS = 1500

function formatExpiry(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  return `${minutes}:${(safeSeconds % 60).toString().padStart(2, '0')}`
}

export default function AccountSettingsPage() {
  const navigate = useNavigate()
  const { user, clearSession } = useAuthStore()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reauthRun, setReauthRun] = useState(0)
  const [reauthPhase, setReauthPhase] = useState<ReauthPhase>('idle')
  const [reauthChallenge, setReauthChallenge] = useState<WechatChallengeCreateData | null>(null)
  const [reauthProof, setReauthProof] = useState('')
  const [reauthProofExpiresAt, setReauthProofExpiresAt] = useState(0)
  const [reauthError, setReauthError] = useState('')
  const challengeRequestRef = useRef<{
    key: number
    request: Promise<WechatChallengeCreateData>
  } | null>(null)
  const requiresPassword = Boolean(user?.emailLoginEnabled)

  useEffect(() => {
    if (reauthRun === 0 || requiresPassword) {
      return
    }

    let cancelled = false
    let pollTimer: number | null = null

    const stopPolling = () => {
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer)
        pollTimer = null
      }
    }

    const fail = (message: string, phase: ReauthPhase = 'error') => {
      if (cancelled) return
      stopPolling()
      setReauthPhase(phase)
      setReauthError(message)
    }

    const poll = async (challenge: WechatChallengeCreateData): Promise<void> => {
      if (cancelled) return
      try {
        const { data: response } = await authApi.getWechatReauthChallenge(
          challenge.challengeId,
          challenge.pollToken,
        )
        if (cancelled) return
        const status = response.data
        if (status.challengeId !== challenge.challengeId) {
          fail('扫码确认状态校验失败，请重新生成二维码')
          return
        }
        setReauthChallenge((current) => current ? { ...current, expiresIn: status.expiresIn } : current)
        if (status.status === 'PENDING' && status.expiresIn > 0) {
          pollTimer = window.setTimeout(() => void poll(challenge), REAUTH_POLL_INTERVAL_MS)
          return
        }
        if (status.status === 'CONFIRMED') {
          const { data: exchangeResponse } = await authApi.exchangeWechatReauthChallenge(
            challenge.challengeId,
            challenge.pollToken,
          )
          if (cancelled) return
          setReauthProof(exchangeResponse.data.reauthProof)
          setReauthProofExpiresAt(Date.now() + exchangeResponse.data.expiresIn * 1000)
          setReauthPhase('confirmed')
          setReauthError('')
          return
        }
        if (status.status === 'EXPIRED') {
          fail('二维码已过期，请重新生成', 'expired')
          return
        }
        fail('该二维码已经使用，请重新生成')
      } catch {
        fail('无法完成派聪明扫码确认，请稍后重试')
      }
    }

    const start = async () => {
      setReauthPhase('loading')
      setReauthChallenge(null)
      setReauthProof('')
      setReauthProofExpiresAt(0)
      setReauthError('')

      if (challengeRequestRef.current?.key !== reauthRun) {
        challengeRequestRef.current = {
          key: reauthRun,
          request: authApi.createWechatReauthChallenge()
            .then(({ data: response }) => response.data),
        }
      }

      try {
        const challenge = await challengeRequestRef.current.request
        if (cancelled) return
        setReauthChallenge(challenge)
        setReauthPhase('pending')
        pollTimer = window.setTimeout(() => void poll(challenge), REAUTH_POLL_INTERVAL_MS)
      } catch {
        fail('暂时无法生成身份确认二维码，请稍后重试')
      }
    }

    void start()
    return () => {
      cancelled = true
      stopPolling()
    }
  }, [reauthRun, requiresPassword])

  const handleDeleteAccount = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (confirmation !== '注销账号') {
      setError('请输入“注销账号”确认操作')
      return
    }
    if (requiresPassword && !password) {
      setError('请输入当前密码')
      return
    }
    if (!requiresPassword && (!reauthProof || Date.now() >= reauthProofExpiresAt)) {
      setReauthProof('')
      setReauthProofExpiresAt(0)
      setReauthPhase('expired')
      setReauthError('本次身份确认已过期，请重新生成二维码')
      setError('请先使用派聪明服务号扫码确认本次注销操作')
      return
    }
    if (!window.confirm('账号注销后无法恢复。确认继续吗？')) {
      return
    }

    setLoading(true)
    try {
      await authApi.deleteAccount({
        password: requiresPassword ? password : undefined,
        wechatReauthProof: requiresPassword ? undefined : reauthProof,
        confirmation,
      })
      clearSession()
      window.localStorage.removeItem('rememberedEmail')
      window.localStorage.removeItem('rememberedPassword')
      navigate('/', { replace: true })
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : '账号注销失败，请稍后再试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-950">账号与数据</h1>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6" aria-labelledby="account-documents-title">
          <h2 id="account-documents-title" className="text-lg font-semibold text-slate-950">隐私与服务资料</h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link to="/privacy" className="text-primary-600 hover:text-primary-700">隐私政策</Link>
            <Link to="/terms" className="text-primary-600 hover:text-primary-700">服务条款</Link>
            <Link to="/refund-policy" className="text-primary-600 hover:text-primary-700">退款规则</Link>
            <Link to="/customer-service" className="text-primary-600 hover:text-primary-700">客服说明</Link>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-red-200 bg-white p-6" aria-labelledby="delete-account-title">
          <h2 id="delete-account-title" className="text-lg font-semibold text-red-700">注销账号</h2>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            <p>注销后将立即停用登录、撤销旧会话、下架公开内容，并删除账号下的简历正文与 AI 明文记录。</p>
            <p>存在未完成订单、人工精修申请、待退款记录或尚未结清的作者收益时，需先处理完毕才能注销。</p>
            <p>为保障买家已购权益、处理退款争议和财务审计，已售简历版本以及必要的订单号、金额、状态和匿名用户编号会按规则继续保存；未售版本与问卷联系信息会删除或匿名化。</p>
          </div>

          <form onSubmit={handleDeleteAccount} aria-busy={loading} className="mt-6 space-y-4">
            {error ? <div id="delete-account-error" role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {requiresPassword ? (
              <div>
                <label htmlFor="delete-account-password" className="block text-sm font-medium text-slate-700">当前密码</label>
                <input
                  id="delete-account-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  maxLength={128}
                  required
                  aria-describedby={error ? 'delete-account-error' : undefined}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">使用派聪明服务号再次确认身份</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">身份确认凭证只在当前页面内存中保存，5 分钟后失效，并且只能用于一次注销请求。</p>

                {reauthChallenge ? (
                  <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                    <div className="relative h-40 w-40 shrink-0 border border-slate-200 bg-white p-2">
                      <img
                        src={reauthChallenge.qrImageDataUrl}
                        alt="派聪明服务号注销身份确认二维码"
                        className={`h-full w-full object-contain ${reauthPhase === 'expired' || reauthPhase === 'error' ? 'opacity-25' : ''}`}
                      />
                    </div>
                    <div className="text-sm leading-6 text-slate-600" aria-live="polite">
                      {reauthPhase === 'pending' ? (
                        <p>请使用微信扫描二维码，剩余 {formatExpiry(reauthChallenge.expiresIn)}。</p>
                      ) : null}
                      {reauthPhase === 'confirmed' ? (
                        <p className="font-medium text-emerald-700">身份已确认，可以继续提交注销。</p>
                      ) : null}
                      {reauthError ? <p className="text-red-600">{reauthError}</p> : null}
                      {(reauthPhase === 'expired' || reauthPhase === 'error') ? (
                        <button
                          type="button"
                          onClick={() => setReauthRun((value) => value + 1)}
                          className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-primary-300 hover:text-primary-700"
                        >
                          重新生成二维码
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setReauthRun((value) => value + 1)}
                    disabled={reauthPhase === 'loading'}
                    className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-primary-300 hover:text-primary-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    {reauthPhase === 'loading' ? '正在生成二维码...' : '扫码确认身份'}
                  </button>
                )}
              </div>
            )}
            <div>
              <label htmlFor="delete-account-confirmation" className="block text-sm font-medium text-slate-700">输入“注销账号”确认</label>
              <input
                id="delete-account-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                maxLength={4}
                pattern="注销账号"
                required
                aria-describedby={error ? 'delete-account-error' : undefined}
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              />
            </div>
            <button
              type="submit"
              disabled={loading
                || confirmation !== '注销账号'
                || (requiresPassword ? !password : reauthPhase !== 'confirmed')}
              aria-busy={loading}
              className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? '正在注销...' : '永久注销账号'}
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
