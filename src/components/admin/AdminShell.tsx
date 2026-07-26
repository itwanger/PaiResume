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
    <div className="admin-shell min-h-screen bg-[#f4f7fb] text-slate-950">
      {mobileNavigationOpen ? (
        <button
          type="button"
          aria-label="关闭管理菜单"
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
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
        className={`fixed inset-y-0 left-0 z-50 flex w-[276px] flex-col overflow-y-auto border-r border-white/10 bg-[#0b1220] text-white shadow-2xl shadow-slate-950/20 transition-transform duration-200 lg:translate-x-0 ${
          mobileNavigationOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <LogoMark className="h-10 w-10 shrink-0" />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold tracking-tight">PaiResume</div>
              <div className="mt-0.5 text-xs text-slate-400">运营控制台</div>
            </div>
            <span className="ml-auto hidden rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-1 text-[10px] font-semibold tracking-[0.12em] text-blue-200 lg:inline-flex">
              ADMIN
            </span>
            <button
              ref={mobileNavigationCloseRef}
              type="button"
              aria-label="关闭管理菜单"
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
              onClick={() => setMobileNavigationOpen(false)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-5 px-3 py-5" aria-label="管理后台主菜单">
          {ADMIN_NAVIGATION.map((group) => (
            <div key={group.label}>
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
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
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        active
                          ? 'bg-white text-slate-950 shadow-[0_10px_26px_-16px_rgba(15,23,42,0.9)]'
                          : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                          active
                            ? 'bg-blue-600 text-white'
                            : 'border border-white/10 bg-white/[0.05] text-slate-400 group-hover:text-slate-200'
                        }`}
                        aria-hidden="true"
                      >
                        {item.mark}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.label}</span>
                      {badge ? (
                        <span
                          className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${
                            active ? 'bg-red-50 text-red-600' : 'bg-red-500/15 text-red-300'
                          }`}
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

        <div className="border-t border-white/10 p-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">当前管理员</div>
            <div className="mt-1.5 truncate text-xs font-medium text-slate-200">
              {user?.email || user?.nickname || '管理员账号'}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                to="/dashboard"
                className="rounded-lg border border-white/10 px-2.5 py-2 text-center text-xs text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                用户工作台
              </Link>
              <Link
                to="/"
                className="rounded-lg border border-white/10 px-2.5 py-2 text-center text-xs text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                网站首页
              </Link>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-[276px]">
        <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/90 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              ref={mobileNavigationOpenRef}
              type="button"
              aria-label="打开管理菜单"
              aria-expanded={mobileNavigationOpen}
              aria-controls="admin-mobile-navigation"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg text-slate-700 shadow-sm lg:hidden"
              onClick={() => setMobileNavigationOpen(true)}
            >
              <span aria-hidden="true">≡</span>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>运营控制台</span>
                <span aria-hidden="true">/</span>
                <span className="truncate text-slate-600">{activeMeta.label}</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
                管理员权限已验证
              </div>
              <Link
                to="/dashboard"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
              >
                返回用户端
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto min-w-0 w-full max-w-[1540px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">PaiResume Operations</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[28px]">
                {activeMeta.label}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{activeMeta.description}</p>
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  )
}
