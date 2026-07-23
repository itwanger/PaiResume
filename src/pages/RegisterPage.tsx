import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { LogoMark } from '../components/branding/LogoMark'
import { AUTHENTICATED_HOME_PATH } from '../config/site'
import { buildLoginPath, getSafeInternalPath } from '../utils/navigation'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { register, sendCode } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [agreementsAccepted, setAgreementsAccepted] = useState(false)
  const returnTo = getSafeInternalPath(searchParams.get('redirect'), AUTHENTICATED_HOME_PATH)

  const handleSendCode = async () => {
    setError('')
    if (!email.trim()) {
      setError('请先填写邮箱')
      return
    }

    try {
      await sendCode(email)
      setCodeSent(true)
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '发送验证码失败'
      setError(message)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim() || !verificationCode.trim()) {
      setError('请填写所有必填项')
      return
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    if (password.length < 8) {
      setError('密码至少 8 位')
      return
    }

    if (!agreementsAccepted) {
      setError('请先阅读并同意服务条款和隐私政策')
      return
    }

    setLoading(true)
    try {
      await register(
        email,
        password,
        verificationCode,
        agreementsAccepted,
        agreementsAccepted,
        inviteCode.trim() || undefined,
      )
      navigate(returnTo, { replace: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '注册失败，请稍后重试'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 flex items-center justify-center gap-3">
          <Link to="/" className="inline-flex items-center gap-2.5" aria-label="返回派简历首页">
            <LogoMark className="h-10 w-10" />
            <span className="text-xl font-bold tracking-tight text-gray-900">派简历</span>
          </Link>
          <span className="h-5 w-px bg-gray-300" aria-hidden="true" />
          <h1 className="text-base font-medium text-gray-500">创建新账号</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">验证码</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="请输入验证码"
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                maxLength={6}
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={countdown > 0}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-sm"
              >
                {countdown > 0 ? `${countdown}s` : codeSent ? '重新发送' : '获取验证码'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8-20位，需包含字母和数字"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
              autoComplete="new-password"
            />
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4">
            <label className="block text-sm font-medium text-emerald-950 mb-1.5">知识星球 VIP 邀请码（可选）</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="星球用户可填写，权益期限以邀请码批次为准"
              className="w-full px-4 py-2.5 border border-emerald-300 bg-white rounded-lg focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 outline-none transition-colors"
              autoComplete="off"
              maxLength={64}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-gray-600">
            <input
              type="checkbox"
              checked={agreementsAccepted}
              onChange={(event) => setAgreementsAccepted(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              required
            />
            <span>
              我已阅读并同意
              <Link
                to="/terms"
                target="_blank"
                rel="noreferrer"
                className="mx-1 font-medium text-primary-600 hover:text-primary-700"
              >
                《服务条款》
              </Link>
              和
              <Link
                to="/privacy"
                target="_blank"
                rel="noreferrer"
                className="ml-1 font-medium text-primary-600 hover:text-primary-700"
              >
                《隐私政策》
              </Link>
              ，并知悉仅在我主动使用 AI 功能时，相关简历内容会发送给政策所述第三方模型服务商处理
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '注册中...' : '注册'}
          </button>

          <p className="text-center text-sm text-gray-500">
            已有账号？
            <Link to={buildLoginPath(returnTo)} className="text-primary-600 hover:text-primary-700 font-medium ml-1">
              立即登录
            </Link>
          </p>

          <p className="text-center text-xs leading-5 text-gray-400">
            付费前请同时查看
            <Link to="/refund-policy" className="mx-1 hover:text-primary-600">退款规则</Link>
            与
            <Link to="/customer-service" className="ml-1 hover:text-primary-600">客服说明</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
