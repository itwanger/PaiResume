import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import App from '../../src/App'

const auth = vi.hoisted(() => ({
  initialized: true, isAuthenticated: true, restoreSession: vi.fn(),
  user: { legalConsentRequired: true, membershipStatus: 'ACTIVE', admin: true },
}))
vi.mock('../../src/store/authStore', () => ({
  useAuthStore: (selector?: (state: typeof auth) => unknown) => selector ? selector(auth) : auth,
}))
vi.mock('../../src/pages/HomePage', () => ({ default: () => <div>home</div> }))
vi.mock('../../src/pages/DashboardPage', () => ({ default: () => <div>dashboard ready</div> }))
vi.mock('../../src/pages/LoginPage', () => ({ default: () => <div>invite login ready</div> }))
vi.mock('../../src/components/seo/RouteSeo', () => ({ RouteSeo: () => null }))

beforeEach(() => { window.history.replaceState(null, '', '/'); vi.clearAllMocks() })

it('旧会话的协议标记不拦截受保护页面', async () => {
  window.history.replaceState(null, '', '/dashboard')
  render(<App />)
  expect(await screen.findByText('dashboard ready')).toBeInTheDocument()
  expect(window.location.pathname).toBe('/dashboard')
})

it('已登录用户携带邀请码仍进入领取登录页', async () => {
  window.history.replaceState(null, '', '/login?invite=VIPTEST123456')
  render(<App />)
  expect(await screen.findByText('invite login ready')).toBeInTheDocument()
  await waitFor(() => expect(window.location.search).not.toContain('invite='))
  expect(window.location.pathname).toBe('/login')
})

it('旧协议页直接返回原目标而不提交同意记录', async () => {
  window.history.replaceState(null, '', '/legal-consent?redirect=%2Fdashboard')
  render(<App />)
  expect(await screen.findByText('dashboard ready')).toBeInTheDocument()
  expect(window.location.pathname).toBe('/dashboard')
})
