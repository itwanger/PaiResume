import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, type WechatChallengeCreateData } from '../api/auth'
import { membershipApi } from '../api/membership'
import { LegalConsentNotice } from '../components/auth/LegalConsentNotice'
import { LogoMark } from '../components/branding/LogoMark'
import { getDevelopmentLoginCredentials } from '../config/developmentLogin'
import { AUTHENTICATED_HOME_PATH } from '../config/site'
import { useAuthStore } from '../store/authStore'
import { buildEmailLoginPath, getSafeInternalPath, resolveLoginMethod } from '../utils/navigation'

const REMEMBERED_EMAIL_KEY = 'rememberedEmail'
const LEGACY_REMEMBERED_PASSWORD_KEY = 'rememberedPassword'
const QR_POLL_INTERVAL_MS = 1_500
const MAX_INVITE_CODE_LENGTH = 64

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
  const emailLoginPreferred = resolveLoginMethod(searchParams.get('method')) === 'email'
  const legacyEmailMode = passwordResetSucceeded || emailLoginPreferred
  const adminEmailLogin = legacyEmailMode && returnTo === '/admin'
  const adminEmailLoginPath = buildEmailLoginPath('/admin')
  const passwordResetPath = `/forgot-password?${new URLSearchParams({ redirect: returnTo }).toString()}`
  const developmentDefaultsEnabled = import.meta.env.MODE === 'development' && !passwordResetSucceeded
  const initialCredentials = developmentDefaultsEnabled
    ? getDevelopmentLoginCredentials(rememberedCredentials.email)
    : { email: rememberedCredentials.email, password: '' }

  const [email, setEmail] = useState(initialCredentials.email)
  const [password, setPassword] = useState(initialCredentials.password)
  const [rememberCredentials, setRememberCredentials] = useState(rememberedCredentials.remembered)
  const [emailError, setEmailError] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  const [qrPhase, setQrPhase] = useState<QrLoginPhase>('loading')
  const [qrDisplay, setQrDisplay] = useState<QrDisplayData | null>(null)
  const [qrError, setQrError] = useState('')
  const [qrRefreshKey, setQrRefreshKey] = useState(0)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteClaimToken, setInviteClaimToken] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteApplied, setInviteApplied] = useState(false)
  const challengeRequestRef = useRef<{
    key: string
    request: Promise<WechatChallengeCreateData>
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    let pollTimer: number | null = null

    if (legacyEmailMode) {
      return () => {
        cancelled = true
      }
    }

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

      const requestKey = `${inviteClaimToken ?? 'login'}:${qrRefreshKey}`
      if (challengeRequestRef.current?.key !== requestKey) {
        challengeRequestRef.current = {
          key: requestKey,
          request: authApi.createWechatChallenge(
            inviteClaimToken ? { claimToken: inviteClaimToken } : undefined,
          ).then(({ data: response }) => response.data),
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
        failQrLogin('扫码登录暂不可用，请刷新二维码后重试')
      }
    }

    void startQrLogin()

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [completeWechatLogin, inviteClaimToken, legacyEmailMode, navigate, qrRefreshKey, returnTo])

  const handleEmailChange = (nextEmail: string) => {
    setEmail(nextEmail)
    if (!developmentDefaultsEnabled) {
      return
    }

    setPassword((currentPassword) => {
      const currentDefaultPassword = getDevelopmentLoginCredentials(email).password
      if (currentPassword !== currentDefaultPassword) {
        return currentPassword
      }

      return getDevelopmentLoginCredentials(nextEmail).password
    })
  }

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

  const handleInviteCodeChange = (value: string) => {
    setInviteCode(value.toUpperCase())
    setInviteError('')
    if (inviteApplied) {
      setInviteApplied(false)
      setInviteClaimToken(null)
      challengeRequestRef.current = null
      setQrDisplay(null)
      setQrPhase('loading')
    }
  }

  const handleInviteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedCode = inviteCode.trim().toUpperCase()
    if (!normalizedCode) {
      setInviteError('请输入知识星球邀请码')
      return
    }

    setInviteLoading(true)
    setInviteError('')
    try {
      const { data: response } = await membershipApi.createInviteClaim(normalizedCode)
      if (!response.data.claimToken) {
        throw new Error('邀请码暂时无法使用，请稍后重试')
      }
      challengeRequestRef.current = null
      setQrDisplay(null)
      setInviteClaimToken(response.data.claimToken)
      setInviteApplied(true)
      setQrPhase('loading')
    } catch (error: unknown) {
      setInviteApplied(false)
      setInviteClaimToken(null)
      setInviteError(error instanceof Error ? error.message : '邀请码无效，请核对后重试')
    } finally {
      setInviteLoading(false)
    }
  }

  const qrUnavailable = qrPhase === 'expired' || qrPhase === 'consumed' || qrPhase === 'error'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-3" aria-label="返回派简历首页">
          <LogoMark className="h-12 w-12 shrink-0" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">派简历</h1>
        </Link>

        <main
          aria-label={legacyEmailMode ? '邮箱密码登录' : '微信扫码登录'}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          {legacyEmailMode ? (
            <>
              <h2 className="text-center text-xl font-semibold text-gray-900">
                {adminEmailLogin ? '管理员邮箱登录' : '邮箱密码登录'}
              </h2>
              <form
                id="email-password-login"
                onSubmit={handleEmailSubmit}
                aria-busy={emailLoading}
                className="mt-5 space-y-5"
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
                    onChange={(event) => handleEmailChange(event.target.value)}
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
              </form>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center">
                <div
                  className="relative flex aspect-square w-full max-w-56 items-center justify-center overflow-hidden border border-gray-200 bg-gray-50 p-2"
                  aria-busy={qrPhase === 'loading' || qrPhase === 'exchanging'}
                >
                  {qrDisplay ? (
                    <img
                      src={qrDisplay.qrImageDataUrl}
                      alt="派聪明服务号登录二维码"
                      className={`h-full w-full object-contain ${qrUnavailable ? 'opacity-20' : ''}`}
                      draggable={false}
                    />
                  ) : qrPhase === 'idle' || qrPhase === 'loading' || qrPhase === 'exchanging' ? (
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <LoadingSpinner />
                      <span className="text-sm">正在加载二维码…</span>
                    </div>
                  ) : null}

                  {qrPhase === 'exchanging' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/95 px-4 text-primary-700">
                      <LoadingSpinner />
                      <span className="text-sm font-medium">已确认，正在安全登录…</span>
                    </div>
                  )}

                  {qrUnavailable && (
                    <div
                      role="alert"
                      className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 px-5 text-center"
                    >
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

                {qrPhase === 'pending' && qrDisplay ? (
                  <div className="mt-3 text-center text-sm text-gray-500" aria-live="polite">
                    等待扫码 · 剩余 {formatExpiry(qrDisplay.expiresIn)}
                  </div>
                ) : null}
              </div>

              <LegalConsentNotice className="mt-3" />

              <form onSubmit={handleInviteSubmit} className="mt-4" aria-busy={inviteLoading}>
                <label htmlFor="login-vip-invite" className="block text-sm font-medium text-gray-700">
                  知识星球 VIP 邀请码 <span className="font-normal text-gray-400">选填</span>
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="login-vip-invite"
                    type="text"
                    value={inviteCode}
                    onChange={(event) => handleInviteCodeChange(event.target.value)}
                    maxLength={MAX_INVITE_CODE_LENGTH}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="有邀请码就填在这里"
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  />
                  <button
                    type="submit"
                    disabled={inviteLoading || inviteApplied}
                    className="shrink-0 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100 disabled:cursor-default disabled:border-emerald-200 disabled:bg-emerald-50 disabled:text-emerald-700"
                  >
                    {inviteLoading ? '验证中' : inviteApplied ? '已关联' : '使用'}
                  </button>
                </div>
                {inviteError ? (
                  <p className="mt-2 text-sm text-red-600" role="alert">{inviteError}</p>
                ) : inviteApplied ? (
                  <p className="mt-2 text-sm text-emerald-700" role="status">
                    邀请码已关联，扫码后自动开通 VIP
                  </p>
                ) : null}
              </form>

              <div className="mt-5 border-t border-gray-100 pt-4 text-center">
                <Link
                  to={adminEmailLoginPath}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  管理员邮箱登录
                </Link>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
