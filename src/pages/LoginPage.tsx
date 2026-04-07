import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { LogoMark } from '../components/branding/LogoMark'

const REMEMBERED_EMAIL_KEY = 'rememberedEmail'
const REMEMBERED_PASSWORD_KEY = 'rememberedPassword'

function getRememberedCredentials() {
  if (typeof window === 'undefined') {
    return { email: '', password: '', remembered: false }
  }

  const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? ''
  const rememberedPassword = window.localStorage.getItem(REMEMBERED_PASSWORD_KEY) ?? ''
  const remembered = Boolean(rememberedEmail && rememberedPassword)

  return {
    email: rememberedEmail,
    password: rememberedPassword,
    remembered,
  }
}

function clearRememberedCredentials() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(REMEMBERED_EMAIL_KEY)
  window.localStorage.removeItem(REMEMBERED_PASSWORD_KEY)
}

export default function LoginPage() {
  const rememberedCredentials = getRememberedCredentials()
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [email, setEmail] = useState(rememberedCredentials.email)
  const [password, setPassword] = useState(rememberedCredentials.password)
  const [rememberCredentials, setRememberCredentials] = useState(rememberedCredentials.remembered)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('请填写邮箱和密码')
      return
    }

    setLoading(true)
    try {
      await login(email, password)
      if (rememberCredentials) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim())
        localStorage.setItem(REMEMBERED_PASSWORD_KEY, password)
      } else {
        clearRememberedCredentials()
      }
      navigate('/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '登录失败，请检查邮箱和密码'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <LogoMark className="h-12 w-12 shrink-0" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">派简历</h1>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
              autoComplete="current-password"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 select-none">
            <input
              type="checkbox"
              checked={rememberCredentials}
              onChange={(e) => {
                const checked = e.target.checked
                setRememberCredentials(checked)
                if (!checked) {
                  clearRememberedCredentials()
                }
              }}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            记住邮箱和密码
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '登录中...' : '登录'}
          </button>

          <p className="text-center text-sm text-gray-500">
            还没有账号？
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium ml-1">
              立即注册
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
