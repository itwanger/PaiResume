import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, type WechatChallengeCreateData } from '../api/auth'
import { LegalConsentCheckbox } from '../components/auth/LegalConsentCheckbox'
import { LogoMark } from '../components/branding/LogoMark'
import { AUTHENTICATED_HOME_PATH } from '../config/site'
import { useAuthStore } from '../store/authStore'
import { buildRegisterPath, getSafeInternalPath } from '../utils/navigation'

const REMEMBERED_EMAIL_KEY = 'rememberedEmail'
const LEGACY_REMEMBERED_PASSWORD_KEY = 'rememberedPassword'
const QR_POLL_INTERVAL_MS = 1_500

type QrLoginPhase = 'idle' | 'loading' | 'pending' | 'exchanging' | 'expired' | 'consumed' | 'error'

type QrDisplayData = Pick<
  WechatChallengeCreateData,
  'challengeId' | 'qrImageDataUrl' | 'expiresIn'
>

function getRememberedCredentials() {
  if (typeof window === 'undefined') {
    return { email: '', remembered: false }
  }

  window.localStorage.removeItem(LEGACY_REMEMBERED_PASSWORD_KEY)
  const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? ''

  return {
    email: rememberedEmail,
    remembered: Boolean(rememberedEmail),
  }
}

function clearRememberedCredentials() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(REMEMBERED_EMAIL_KEY)
  window.localStorage.removeItem(LEGACY_REMEMBERED_PASSWORD_KEY)
}

function formatExpiry(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function LoadingSpinner({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-75"
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function LoginPage() {
  const rememberedCredentials = getRememberedCredentials()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useAuthStore((state) => state.login)
  const completeWechatLogin = useAuthStore((state) => state.completeWechatLogin)
  const returnTo = getSafeInternalPath(searchParams.get('redirect'), AUTHENTICATED_HOME_PATH)
  const passwordResetSucceeded = searchParams.get('passwordReset') === 'success'
  const emailLoginPreferred = searchParams.get('method') === 'email'
  const passwordResetPath = `/forgot-password?${new URLSearchParams({ redirect: returnTo }).toString()}`

  const [email, setEmail] = useState(rememberedCredentials.email)
  const [password, setPassword] = useState('')
  const [rememberCredentials, setRememberCredentials] = useState(rememberedCredentials.remembered)
  const [emailError, setEmailError] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailLoginOpen, setEmailLoginOpen] = useState(
    passwordResetSucceeded || emailLoginPreferred,
  )

  const [agreementsAccepted, setAgreementsAccepted] = useState(false)
  const [qrPhase, setQrPhase] = useState<QrLoginPhase>('idle')
  const [qrDisplay, setQrDisplay] = useState<QrDisplayData | null>(null)
  const [qrError, setQrError] = useState('')
  const [qrRefreshKey, setQrRefreshKey] = useState(0)
  const challengeRequestRef = useRef<{
    key: number
    request: Promise<WechatChallengeCreateData>
  } | null>(null)

  useEffect(() => {
    if (!agreementsAccepted) {
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

    const failQrLogin = (message: string) => {
      if (cancelled) {
        return
      }
      stopPolling()
      setQrPhase('error')
      setQrError(message)
    }

    const pollChallenge = async (challenge: WechatChallengeCreateData): Promise<void> => {
      if (cancelled) {
        return
      }

      try {
        const { data: response } = await authApi.getWechatChallenge(
          challenge.challengeId,
          challenge.pollToken,
        )
        if (cancelled) {
          return
        }

        const status = response.data
        if (status.challengeId !== challenge.challengeId) {
          failQrLogin('扫码登录状态校验失败，请刷新二维码后重试')
          return
        }
        setQrDisplay((current) => current ? { ...current, expiresIn: status.expiresIn } : current)

        if (status.status === 'PENDING' && status.expiresIn > 0) {
          pollTimer = window.setTimeout(() => {
            void pollChallenge(challenge)
          }, QR_POLL_INTERVAL_MS)
          return
        }

        if (status.status === 'CONFIRMED') {
          setQrPhase('exchanging')
          setQrError('')
          try {
            await completeWechatLogin(
              challenge.challengeId,
              challenge.pollToken,
              agreementsAccepted,
            )
            if (!cancelled) {
              navigate(returnTo, { replace: true })
            }
          } catch {
            failQrLogin('登录未完成，二维码可能已过期，请刷新后重试')
          }
          return
        }

        if (status.status === 'CONSUMED') {
          setQrPhase('consumed')
          setQrError('该二维码已使用，请刷新后重试')
          return
        }

        setQrPhase('expired')
        setQrError('二维码已过期，请刷新后重试')
      } catch {
        failQrLogin('网络连接异常，请刷新二维码后重试')
      }
    }

    const startQrLogin = async () => {
      setQrPhase('loading')
      setQrDisplay(null)
      setQrError('')

      if (challengeRequestRef.current?.key !== qrRefreshKey) {
        challengeRequestRef.current = {
          key: qrRefreshKey,
          request: authApi.createWechatChallenge().then(({ data: response }) => response.data),
        }
      }

      try {
        const challenge = await challengeRequestRef.current.request
        if (cancelled) {
          return
        }

        setQrDisplay({
          challengeId: challenge.challengeId,
          qrImageDataUrl: challenge.qrImageDataUrl,
          expiresIn: challenge.expiresIn,
        })
        setQrPhase('pending')
        pollTimer = window.setTimeout(() => {
          void pollChallenge(challenge)
        }, QR_POLL_INTERVAL_MS)
      } catch {
        failQrLogin('扫码登录暂不可用，请刷新重试或使用邮箱密码登录')
      }
    }

    void startQrLogin()

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [agreementsAccepted, completeWechatLogin, navigate, qrRefreshKey, returnTo])

  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setEmailError('')

    if (!email.trim() || !password.trim()) {
      setEmailError('请填写邮箱和密码')
      return
    }

    setEmailLoading(true)
    try {
      await login(email, password)
      if (rememberCredentials) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim())
      } else {
        clearRememberedCredentials()
      }
      navigate(returnTo, { replace: true })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '登录失败，请检查邮箱和密码'
      setEmailError(message)
    } finally {
      setEmailLoading(false)
    }
  }

  const refreshQrCode = () => {
    setQrRefreshKey((value) => value + 1)
  }

  const handleAgreementsAcceptedChange = (checked: boolean) => {
    setAgreementsAccepted(checked)
    if (!checked) {
      challengeRequestRef.current = null
      setQrDisplay(null)
      setQrPhase('idle')
      setQrError('')
    }
  }

  const qrUnavailable = qrPhase === 'expired' || qrPhase === 'consumed' || qrPhase === 'error'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-3" aria-label="返回派简历首页">
          <LogoMark className="h-12 w-12 shrink-0" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">派简历</h1>
        </Link>

        <main className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">派聪明·服务号</p>
            <h2 className="mt-2 text-xl font-semibold text-gray-900">微信扫码登录</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              使用微信扫码，关注或进入「派聪明」服务号后即可完成登录。
            </p>
          </div>

          <LegalConsentCheckbox
            checked={agreementsAccepted}
            onChange={handleAgreementsAcceptedChange}
            disabled={qrPhase === 'exchanging'}
            className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
          />

          <div className="mt-5 flex flex-col items-center">
            <div
              className="relative flex h-56 w-56 items-center justify-center overflow-hidden border border-gray-200 bg-gray-50 p-2"
              aria-busy={qrPhase === 'loading' || qrPhase === 'exchanging'}
            >
              {qrDisplay ? (
                <img
                  src={qrDisplay.qrImageDataUrl}
                  alt="派聪明服务号登录二维码"
                  className={`h-full w-full object-contain ${qrUnavailable ? 'opacity-20' : ''}`}
                  draggable={false}
                />
              ) : qrPhase === 'idle' ? (
                <div className="px-5 text-center text-sm leading-6 text-gray-500">
                  请先阅读并勾选上方协议，随后生成登录二维码
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <LoadingSpinner />
                  <span className="text-sm">正在加载二维码…</span>
                </div>
              )}

              {qrPhase === 'exchanging' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/95 px-4 text-primary-700">
                  <LoadingSpinner />
                  <span className="text-sm font-medium">已确认，正在安全登录…</span>
                </div>
              )}

              {qrUnavailable && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 px-5 text-center">
                  <p className="text-sm leading-6 text-gray-600">{qrError}</p>
                  <button
                    type="button"
                    onClick={refreshQrCode}
                    className="border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  >
                    刷新二维码
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 min-h-6 text-center text-sm text-gray-500" aria-live="polite">
              {qrPhase === 'pending' && qrDisplay && (
                <span>等待扫码·剩余 {formatExpiry(qrDisplay.expiresIn)}</span>
              )}
              {qrPhase === 'idle' && <span>勾选协议后即可扫码登录</span>}
              {qrPhase === 'loading' && <span>正在连接派聪明服务号…</span>}
              {qrPhase === 'exchanging' && <span>请稍候，登录即将完成</span>}
            </div>
          </div>

          <div className="mt-3 border-l-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            本二维码仅用于「派聪明」扫码登录。
          </div>

          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-900">
            <p>
              <strong className="font-semibold">已有邮箱账号？请不要直接扫码。</strong>
              直接扫码会创建一个独立微信账号，原账号里的简历和会员不会自动合并。
            </p>
            <button
              type="button"
              onClick={() => setEmailLoginOpen(true)}
              aria-controls="email-password-login"
              className="mt-1 font-semibold text-amber-950 underline underline-offset-2 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2"
            >
              使用原邮箱账号登录
            </button>
            <p className="mt-1 text-xs">
              从未注册过的用户勾选上方协议并扫码后，会创建一个新的微信账号。
            </p>
          </div>

          <Link
            to="/vip/claim"
            className="mt-4 flex w-full items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
          >
            我有知识星球 VIP 邀请码
          </Link>

          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">兼容登录</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <button
            type="button"
            onClick={() => setEmailLoginOpen((open) => !open)}
            aria-expanded={emailLoginOpen}
            aria-controls="email-password-login"
            className="flex w-full items-center justify-center gap-2 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            使用邮箱密码登录
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className={`h-4 w-4 transition-transform ${emailLoginOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {emailLoginOpen && (
            <form
              id="email-password-login"
              onSubmit={handleEmailSubmit}
              aria-busy={emailLoading}
              className="mt-5 space-y-5 border-t border-gray-100 pt-5"
            >
              {passwordResetSucceeded && (
                <div role="status" className="bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  密码已重置，请使用新密码登录。其他设备上的旧登录状态已失效。
                </div>
              )}
              {emailError && (
                <div id="login-error" role="alert" className="bg-red-50 px-4 py-3 text-sm text-red-700">
                  {emailError}
                </div>
              )}

              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-gray-700">邮箱</label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  autoComplete="email"
                  aria-describedby={emailError ? 'login-error' : undefined}
                  required
                />
              </div>

              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-gray-700">密码</label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入密码"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  autoComplete="current-password"
                  aria-describedby={emailError ? 'login-error' : undefined}
                  required
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="flex select-none items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={rememberCredentials}
                    onChange={(event) => {
                      const checked = event.target.checked
                      setRememberCredentials(checked)
                      if (!checked) {
                        clearRememberedCredentials()
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  记住邮箱
                </label>
                <Link to={passwordResetPath} className="text-sm font-medium text-primary-600 hover:text-primary-700">
                  忘记密码？
                </Link>
              </div>

              <button
                type="submit"
                disabled={emailLoading}
                className="w-full rounded-lg bg-primary-600 py-2.5 font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {emailLoading ? '登录中...' : '邮箱登录'}
              </button>

              <p className="text-center text-sm text-gray-500">
                还没有邮箱账号？
                <Link to={buildRegisterPath(returnTo)} className="ml-1 font-medium text-primary-600 hover:text-primary-700">
                  邮箱注册
                </Link>
              </p>
            </form>
          )}
        </main>
      </div>
    </div>
  )
}
