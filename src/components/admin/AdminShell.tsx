import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import { LogoMark } from '../branding/LogoMark'
import { useAuthStore } from '../../store/authStore'
import {
  ADMIN_NAVIGATION,
  ADMIN_VIEW_META,
  buildAdminViewPath,
  type AdminView,
} from './adminNavigation'
import { AdminNavIcon } from './AdminNavIcon'

interface AdminShellProps {
  activeView: AdminView
  badges?: Partial<Record<AdminView, number>>
  children: ReactNode
}

function formatBadge(value: number | undefined) {
  if (!value) return null
  return value > 99 ? '99+' : String(value)
}

export function AdminShell({
  activeView,
  badges = {},
  children,
}: AdminShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [navScrollHintVisible, setNavScrollHintVisible] = useState(false)
  const mobileNavigationRef = useRef<HTMLElement | null>(null)
  const mobileNavigationCloseRef = useRef<HTMLButtonElement | null>(null)
  const mobileNavigationOpenRef = useRef<HTMLButtonElement | null>(null)
  const user = useAuthStore((state) => state.user)
  const activeMeta = ADMIN_VIEW_META[activeView]

  useEffect(() => {
    setMobileNavigationOpen(false)
  }, [activeView])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const syncViewport = () => {
      setIsDesktop(mediaQuery.matches)
      if (mediaQuery.matches) {
        setMobileNavigationOpen(false)
      }
    }
    syncViewport()
    mediaQuery.addEventListener('change', syncViewport)
    return () => mediaQuery.removeEventListener('change', syncViewport)
  }, [])

  useEffect(() => {
    if (!mobileNavigationOpen || isDesktop) return

    const previousOverflow = document.body.style.overflow
    const openButton = mobileNavigationOpenRef.current
    mobileNavigationRef.current?.removeAttribute('inert')
    document.body.style.overflow = 'hidden'
    mobileNavigationCloseRef.current?.focus()

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setMobileNavigationOpen(false)
    }
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
      openButton?.focus()
    }
  }, [isDesktop, mobileNavigationOpen])

  useEffect(() => {
    const navigation = mobileNavigationRef.current
    if (!navigation) return
    if (!isDesktop && !mobileNavigationOpen) {
      navigation.setAttribute('inert', '')
    } else {
      navigation.removeAttribute('inert')
    }
  }, [isDesktop, mobileNavigationOpen])

  // 侧边栏内容溢出且未滚到底时，底部显示渐隐提示条；滚到底或内容不溢出时隐藏。
  useEffect(() => {
    const navigation = mobileNavigationRef.current
    if (!navigation) return
    const syncScrollHint = () => {
      setNavScrollHintVisible(
        navigation.scrollHeight - navigation.scrollTop - navigation.clientHeight > 8,
      )
    }
    syncScrollHint()
    navigation.addEventListener('scroll', syncScrollHint, { passive: true })
    window.addEventListener('resize', syncScrollHint)
    return () => {
      navigation.removeEventListener('scroll', syncScrollHint)
      window.removeEventListener('resize', syncScrollHint)
    }
  }, [activeView, isDesktop, mobileNavigationOpen])

  const handleMobileNavigationKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (isDesktop || !mobileNavigationOpen || event.key !== 'Tab') return
    const focusableElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )
    if (!focusableElements.length) return
    const first = focusableElements[0]
    const last = focusableElements[focusableElements.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="admin-shell min-h-screen bg-slate-50 text-slate-950">
      {mobileNavigationOpen ? (
        <button
          type="button"
          aria-label="关闭管理菜单"
          className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileNavigationOpen(false)}
        />
      ) : null}

      <aside
        id="admin-mobile-navigation"
        ref={mobileNavigationRef}
        role={!isDesktop ? 'dialog' : undefined}
        aria-modal={!isDesktop && mobileNavigationOpen ? true : undefined}
        aria-label={!isDesktop ? '管理后台导航' : undefined}
        aria-hidden={!isDesktop && !mobileNavigationOpen ? true : undefined}
        onKeyDown={handleMobileNavigationKeyDown}
        className={`fixed inset-y-0 left-0 z-50 flex w-[276px] flex-col overflow-y-auto border-r border-slate-200 bg-white text-slate-900 shadow-2xl shadow-slate-950/10 transition-transform duration-200 lg:translate-x-0 lg:shadow-none ${
          mobileNavigationOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              aria-label="派简历首页"
              className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              <LogoMark className="h-10 w-10 shrink-0" />
              <div className="min-w-0">
                <div className="truncate text-[17px] font-bold tracking-tight text-slate-950">派简历</div>
                <div className="mt-0.5 text-xs text-slate-500">管理后台</div>
              </div>
            </Link>
            <span className="ml-auto hidden rounded-full border border-primary-100 bg-primary-50 px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-primary-700 lg:inline-flex">
              运营端
            </span>
            <button
              ref={mobileNavigationCloseRef}
              type="button"
              aria-label="关闭管理菜单"
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:hidden"
              onClick={() => setMobileNavigationOpen(false)}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-5 px-3 py-5" aria-label="管理后台主菜单">
          {ADMIN_NAVIGATION.map((group) => (
            <div key={group.label}>
              <div className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.08em] text-slate-400">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = item.id === activeView
                  const badge = formatBadge(badges[item.id])
                  return (
                    <Link
                      key={item.id}
                      to={buildAdminViewPath(item.id)}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setMobileNavigationOpen(false)}
                      className={`group relative flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 ${
                        active
                          ? 'border-primary-100 bg-primary-50 text-primary-700 shadow-[0_8px_24px_-18px_rgba(51,105,232,0.65)]'
                          : 'border-transparent text-slate-600 hover:border-slate-100 hover:bg-slate-50 hover:text-slate-950'
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center ${
                          active
                            ? 'text-primary-600'
                            : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                        aria-hidden="true"
                      >
                        <AdminNavIcon view={item.id} className="h-[19px] w-[19px]" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.label}</span>
                      {badge ? (
                        <span
                          className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${
                            active ? 'bg-white text-red-600' : 'bg-red-50 text-red-600'
                          }`}
                          aria-label={`${badge} 项待处理`}
                        >
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700" aria-hidden="true">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-slate-700">
                  {user?.nickname || user?.email || '管理员账号'}
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                to="/dashboard"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-center text-xs font-medium text-slate-600 transition hover:border-primary-200 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                用户工作台
              </Link>
              <Link
                to="/"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-center text-xs font-medium text-slate-600 transition hover:border-primary-200 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                网站首页
              </Link>
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          className={`pointer-events-none sticky bottom-0 z-10 -mt-7 h-7 shrink-0 bg-gradient-to-t from-white via-white/85 to-transparent transition-opacity duration-200 ${
            navScrollHintVisible ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </aside>

      <div className="min-w-0 lg:pl-[276px]">
        <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              ref={mobileNavigationOpenRef}
              type="button"
              aria-label="打开管理菜单"
              aria-expanded={mobileNavigationOpen}
              aria-controls="admin-mobile-navigation"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-primary-200 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:hidden"
              onClick={() => setMobileNavigationOpen(true)}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="hidden font-medium text-slate-500 sm:inline">管理后台</span>
                <span className="hidden text-slate-300 sm:inline" aria-hidden="true">/</span>
                <h1 aria-label={activeMeta.label} className="truncate font-semibold text-slate-900">
                  {activeMeta.shortLabel}
                </h1>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-primary-200 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                返回用户端
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto min-w-0 w-full max-w-[1540px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
