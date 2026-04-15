import { Link, useNavigate } from 'react-router-dom'
import { LogoMark } from '../branding/LogoMark'
import { useAuthStore } from '../../store/authStore'

export function PublicSiteHeader() {
  const navigate = useNavigate()
  const { isAuthenticated, initialized, user, logout } = useAuthStore()
  const readyAuthenticated = initialized && isAuthenticated

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <LogoMark className="h-9 w-9" />
          <span className="text-xl font-bold text-gray-900">派简历</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link to="/" className="text-gray-600 transition-colors hover:text-primary-700">
            首页
          </Link>
          <Link to="/survey" className="text-gray-600 transition-colors hover:text-primary-700">
            问卷
          </Link>

          {readyAuthenticated ? (
            <>
              <Link to="/dashboard" className="text-gray-600 transition-colors hover:text-primary-700">
                我的简历
              </Link>
              {user?.admin ? (
                <Link to="/admin" className="text-gray-600 transition-colors hover:text-primary-700">
                  管理后台
                </Link>
              ) : null}
              <span className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600">
                {user?.membershipStatus === 'ACTIVE' ? '会员已开通' : '免费用户'}
              </span>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-lg border border-gray-200 px-3 py-2 text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
              >
                退出
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-gray-600 transition-colors hover:text-primary-700">
                登录
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-700"
              >
                免费注册
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
