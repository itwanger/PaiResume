import { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from '../../src/pages/LoginPage'
import { PlanetInviteLinkGate } from '../../src/components/auth/PlanetInviteLinkGate'
import { buildPlanetInvitePost, readPlanetInvite } from '../../src/utils/planetInvite'

const apiMocks = vi.hoisted(() => ({
  createWechatChallenge: vi.fn(),
  getWechatChallenge: vi.fn(),
}))

const membershipMocks = vi.hoisted(() => ({
  createInviteClaim: vi.fn(),
  redeemInvite: vi.fn(),
}))

const authState = vi.hoisted(() => ({
  login: vi.fn(),
  isAuthenticated: false,
  refreshUser: vi.fn(),
  completeWechatLogin: vi.fn(),
}))

vi.mock('../../src/api/auth', () => ({
  authApi: apiMocks,
}))

vi.mock('../../src/api/membership', () => ({
  membershipApi: membershipMocks,
}))

vi.mock('../../src/store/authStore', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.isAuthenticated = false
    apiMocks.createWechatChallenge.mockResolvedValue({
      data: {
        data: {
          challengeId: 'C'.repeat(43),
          pollToken: 'P'.repeat(43),
          qrImageDataUrl: 'data:image/png;base64,cXItY29kZQ==',
          expiresIn: 300,
        },
      },
    })
    apiMocks.getWechatChallenge.mockResolvedValue({
      data: {
        data: {
          challengeId: 'C'.repeat(43),
          status: 'PENDING',
          expiresIn: 298,
        },
      },
    })
    membershipMocks.createInviteClaim.mockResolvedValue({
      data: {
        data: {
          claimToken: 'T'.repeat(43),
          status: 'AWAITING_IDENTITY',
          expiresIn: 600,
          expiresAt: '2026-08-25 22:30:00',
        },
      },
    })
  })

  it('首次打开立即生成二维码，不要求先勾选协议', async () => {
    render(
      <MemoryRouter initialEntries={['/login?redirect=%2Fdashboard']}>
        <LoginPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(apiMocks.createWechatChallenge).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('img', { name: '派聪明服务号登录二维码' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /服务条款和隐私政策/ })).not.toBeInTheDocument()
    expect(screen.queryByText('《服务条款》')).not.toBeInTheDocument()
    expect(screen.queryByText('《隐私政策》')).not.toBeInTheDocument()
    expect(screen.queryByText(/扫码登录即代表你已阅读并同意/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '我有知识星球 VIP 邀请码' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '管理员邮箱登录' })).toHaveAttribute(
      'href',
      '/login?method=email&redirect=%2Fadmin',
    )
  })

  it('管理员邮箱入口直接展示邮箱表单且不生成二维码', async () => {
    render(
      <MemoryRouter initialEntries={['/login?method=email&redirect=%2Fadmin']}>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '管理员邮箱登录' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '邮箱' })).toBeInTheDocument()
    expect(screen.getByLabelText('密码')).toBeInTheDocument()
    await waitFor(() => expect(apiMocks.createWechatChallenge).not.toHaveBeenCalled())
  })

  it('手动输入时先收起旧二维码，校验后显示关联的二维码', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    )

    await screen.findByRole('img', { name: '派聪明服务号登录二维码' })
    await user.type(screen.getByRole('textbox', { name: /知识星球 VIP 邀请码/ }), 'vipplanet123')
    expect(screen.queryByRole('img', { name: '派聪明服务号登录二维码' })).not.toBeInTheDocument()
    expect(apiMocks.createWechatChallenge).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: '使用' }))

    await waitFor(() => expect(membershipMocks.createInviteClaim).toHaveBeenCalledWith('VIPPLANET123'))
    await waitFor(() => expect(apiMocks.createWechatChallenge).toHaveBeenLastCalledWith({
      claimToken: 'T'.repeat(43),
    }))
    expect(screen.getByRole('status')).toHaveTextContent('邀请码已关联，扫码后自动开通 VIP')
  })
})

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}{location.search}</div>
}

function renderInviteLink(code = 'VIPPLANET123', entry = `/?${code}`) {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[entry]}>
        <PlanetInviteLinkGate>
          <LocationProbe />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </PlanetInviteLinkGate>
      </MemoryRouter>
    </StrictMode>,
  )
}

describe('邀请分享链接', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.isAuthenticated = false
    apiMocks.createWechatChallenge.mockResolvedValue({ data: { data: {
      challengeId: 'C'.repeat(43), pollToken: 'P'.repeat(43),
      qrImageDataUrl: 'data:image/png;base64,cXItY29kZQ==', expiresIn: 300,
    } } })
    membershipMocks.createInviteClaim.mockResolvedValue({ data: { data: { claimToken: 'T'.repeat(43) } } })
  })

  it('一行邀请链接先校验再生成一次二维码，并清理地址栏', async () => {
    const post = buildPlanetInvitePost('https://resume.paicoding.com/', 'VIPPLANET123')
    expect(post).toBe('派简历（二哥编程星球专属，支持AI优化、人工精修、智能长一页、多种精美模板、前辈简历参考）：https://resume.paicoding.com/login?invite=VIPPLANET123')
    expect(readPlanetInvite('?invite=vipplanet123')).toBe('VIPPLANET123')
    let resolveClaim!: (value: unknown) => void
    membershipMocks.createInviteClaim.mockImplementation(() => new Promise(resolve => { resolveClaim = resolve }))
    const copiedUrl = new URL(post.split('：')[1])
    renderInviteLink('VIPPLANET123', copiedUrl.pathname + copiedUrl.search)
    await waitFor(() => expect(membershipMocks.createInviteClaim).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('textbox', { name: /知识星球 VIP 邀请码/ })).toHaveValue('VIPPLANET123')
    expect(screen.getByTestId('location')).toHaveTextContent('/login?method=wechat')
    expect(screen.getByTestId('location')).not.toHaveTextContent('VIPPLANET123')
    expect(apiMocks.createWechatChallenge).not.toHaveBeenCalled()
    resolveClaim({ data: { data: { claimToken: 'T'.repeat(43) } } })
    await screen.findByRole('img', { name: '派聪明服务号登录二维码' })
    expect(apiMocks.createWechatChallenge).toHaveBeenCalledTimes(1)
    expect(apiMocks.createWechatChallenge).toHaveBeenCalledWith({ claimToken: 'T'.repeat(43) })
    expect(screen.getByRole('button', { name: '已关联' })).toBeDisabled()
  })

  it('无效邀请链接不生成普通二维码，修正后可重试', async () => {
    membershipMocks.createInviteClaim.mockRejectedValueOnce(new Error('邀请码已过期'))
    renderInviteLink()
    expect(await screen.findByRole('alert')).toHaveTextContent('邀请码已过期')
    expect(apiMocks.createWechatChallenge).not.toHaveBeenCalled()
    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /知识星球 VIP 邀请码/ })
    await user.clear(input)
    await user.type(input, 'VIPNEWCODE')
    await user.click(screen.getByRole('button', { name: '使用' }))
    await screen.findByRole('img', { name: '派聪明服务号登录二维码' })
    expect(membershipMocks.createInviteClaim).toHaveBeenLastCalledWith('VIPNEWCODE')
    expect(apiMocks.createWechatChallenge).toHaveBeenLastCalledWith({ claimToken: 'T'.repeat(43) })
  })

  it('已登录用户通过邀请链接直接领取，无需再次扫码', async () => {
    authState.isAuthenticated = true
    membershipMocks.redeemInvite.mockResolvedValue({ data: { data: { membershipStatus: 'ACTIVE' } } })
    renderInviteLink()
    await userEvent.setup().click(await screen.findByRole('button', { name: '使用' }))
    expect(await screen.findByRole('status')).toHaveTextContent('VIP 已开通')
    expect(membershipMocks.redeemInvite).toHaveBeenCalledWith('VIPPLANET123')
    expect(membershipMocks.createInviteClaim).not.toHaveBeenCalled()
    expect(apiMocks.createWechatChallenge).not.toHaveBeenCalled()
    expect(authState.refreshUser).toHaveBeenCalled()
  })
})
