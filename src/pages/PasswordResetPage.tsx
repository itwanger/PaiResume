import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/auth'
import { LogoMark } from '../components/branding/LogoMark'
import { AUTHENTICATED_HOME_PATH } from '../config/site'
import { getSafeInternalPath } from '../utils/navigation'

export default function PasswordResetPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [codeRequested, setCodeRequested] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [resendCountdown, setResendCountdown] = useState(0)
  const returnTo = getSafeInternalPath(searchParams.get('redirect'), AUTHENTICATED_HOME_PATH)
  const loginPath = `/login?${new URLSearchParams({
    redirect: returnTo,
    method: 'email',
  }).toString()}`

  useEffect(() => {
    if (resendCountdown <= 0) {
      return
    }

    const timer = window.setTimeout(() => setResendCountdown((current) => current - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [resendCountdown])

  const requestCode = async () => {
    if (!email.trim()) {
      setError('请输入注册邮箱')
      return
    }
    if (codeRequested && resendCountdown > 0) {
      return
    }
    setLoading(true)
    setError('')
    setMessage('')
    try {
      await authApi.requestPasswordReset(email.trim())
      setCodeRequested(true)
      setResendCountdown(60)
      setMessage('如果该邮箱已注册，重置验证码会发送到邮箱。请同时检查垃圾邮件。')
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : '发送失败，请稍后再试')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!codeRequested) {
      await requestCode()
      return
    }
    if (!/^\d{6}$/.test(verificationCode)) {
      setError('请输入 6 位验证码')
      return
    }
    if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,20}$/.test(newPassword)) {
      setError('新密码需 8-20 位，并同时包含字母和数字')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }

    setLoading(true)
    try {
      await authApi.resetPassword({ email: email.trim(), verificationCode, newPassword })
      const loginParams = new URLSearchParams({
        passwordReset: 'success',
        redirect: returnTo,
        method: 'email',
      })
      navigate(`/login?${loginParams.toString()}`, { replace: true })
    } catch (resetError: unknown) {
      setError(resetError instanceof Error ? resetError.message : '重置失败，请检查验证码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-3" aria-label="返回派简历首页">
          <LogoMark className="h-11 w-11" />
          <span className="text-2xl font-bold text-slate-950">派简历</span>
        </Link>
        <form onSubmit={handleSubmit} aria-busy={loading} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-xl font-semibold text-slate-950">找回密码</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">重置成功后，所有设备上的旧登录状态都会失效。</p>
          </div>

          {message ? <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">{message}</div> : null}
          {error ? <div id="password-reset-error" role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <div>
            <label htmlFor="password-reset-email" className="block text-sm font-medium text-slate-700">注册邮箱</label>
            <input
              id="password-reset-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={codeRequested}
              autoComplete="email"
              aria-describedby={error ? 'password-reset-error' : undefined}
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:bg-slate-50"
            />
          </div>

          {codeRequested ? (
            <>
              <div>
                <label htmlFor="password-reset-code" className="block text-sm font-medium text-slate-700">邮箱验证码</label>
                <input
                  id="password-reset-code"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  aria-describedby={error ? 'password-reset-error' : undefined}
                  required
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div>
                <label htmlFor="password-reset-new-password" className="block text-sm font-medium text-slate-700">新密码</label>
                <input
                  id="password-reset-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={20}
                  required
                  aria-describedby={error ? 'password-reset-requirements password-reset-error' : 'password-reset-requirements'}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
                <p id="password-reset-requirements" className="mt-1.5 text-xs text-slate-400">8-20 位，并同时包含字母和数字</p>
              </div>
              <div>
                <label htmlFor="password-reset-confirm-password" className="block text-sm font-medium text-slate-700">确认新密码</label>
                <input
                  id="password-reset-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={20}
                  aria-describedby={error ? 'password-reset-error' : undefined}
                  required
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </div>
            </>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? '处理中...' : codeRequested ? '确认重置密码' : '发送重置验证码'}
          </button>

          <div className="flex items-center justify-between text-sm">
            <Link to={loginPath} className="text-primary-600 hover:text-primary-700">返回登录</Link>
            {codeRequested ? (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setCodeRequested(false)
                    setVerificationCode('')
                    setNewPassword('')
                    setConfirmPassword('')
                    setMessage('')
                    setError('')
                    setResendCountdown(0)
                  }}
                  disabled={loading}
                  className="text-slate-500 hover:text-primary-600"
                >
                  更换邮箱
                </button>
                <button
                  type="button"
                  onClick={() => void requestCode()}
                  disabled={loading || resendCountdown > 0}
                  className="text-slate-500 hover:text-primary-600 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  {resendCountdown > 0 ? `${resendCountdown} 秒后重发` : '重新发送'}
                </button>
              </div>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}
