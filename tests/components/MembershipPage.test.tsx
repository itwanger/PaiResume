import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MembershipPage from '../../src/pages/MembershipPage'
import type { MembershipPlan } from '../../src/api/membership'

const api = vi.hoisted(() => ({ plans: vi.fn(), quote: vi.fn(), activeOrder: vi.fn(), order: vi.fn(), createOrder: vi.fn() }))
const auth = vi.hoisted(() => ({ user: { membershipStatus: 'FREE', membershipExpiresAt: null as string | null }, refreshUser: vi.fn() }))
vi.mock('../../src/api/membership', () => ({ membershipApi: api }))
vi.mock('../../src/store/authStore', () => ({ useAuthStore: (select: (state: typeof auth) => unknown) => select(auth) }))
vi.mock('../../src/components/layout/Header', () => ({ Header: () => <nav>派简历</nav> }))
vi.mock('../../src/components/membership/MembershipPaymentModal', () => ({ MembershipPaymentModal: ({ open }: { open: boolean }) => open ? <div role="dialog">订单支付</div> : null }))

const annual: MembershipPlan = { code: 'ANNUAL', name: '年卡', entitlementType: 'FIXED_DAYS', membershipDays: 365, priceCents: 6600, enabled: true, recommended: true }
const monthly: MembershipPlan = { ...annual, code: 'MONTHLY', name: '月卡', membershipDays: 30, priceCents: null, enabled: false, recommended: false }
const envelope = (data: unknown) => ({ data: { code: 200, data } })
function mount(path = '/membership') {
  return render(<MemoryRouter initialEntries={[path]}><MembershipPage /></MemoryRouter>)
}
function quote(planCode: string, paymentEnabled = true) {
  return envelope({ planCode, planName: planCode === 'ANNUAL' ? '年卡' : '月卡', entitlementType: 'FIXED_DAYS', listPrice: 6600, discountAmount: 0, payableAmount: 6600, membershipDays: 365, paymentEnabled })
}

describe('MembershipPage availability and checkout', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    sessionStorage.clear()
    auth.user = { membershipStatus: 'FREE', membershipExpiresAt: null }
    api.plans.mockResolvedValue(envelope([monthly, annual]))
    api.activeOrder.mockResolvedValue(envelope(null))
    api.quote.mockImplementation(async (code: string) => quote(code))
  })

  it('隐藏关闭、无价格及零价方案，忽略指向关闭方案的 URL', async () => {
    api.plans.mockResolvedValue(envelope([monthly, annual, { ...monthly, code: 'QUARTERLY', name: '季卡', enabled: true }, { ...monthly, code: 'PERMANENT', name: '终身会员', enabled: true, priceCents: 0 }]))
    mount('/membership?plan=MONTHLY')
    expect(await screen.findByRole('radio', { name: /年卡/ })).toBeChecked()
    expect(screen.getAllByRole('radio')).toHaveLength(1)
    for (const text of ['月卡', '季卡', '终身会员', '待开放']) expect(screen.queryByText(text)).not.toBeInTheDocument()
    await waitFor(() => expect(api.quote).toHaveBeenCalledWith('ANNUAL', undefined))
  })

  it('支付关闭时显示状态和客服入口，隐藏无效结算控件', async () => {
    api.quote.mockResolvedValue(quote('ANNUAL', false))
    mount()
    expect(await screen.findByText('支付暂不可用')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '微信支付开通' })).not.toBeInTheDocument()
    expect(screen.queryByText('使用优惠码')).not.toBeInTheDocument()
    expect(screen.queryByText('应付金额')).not.toBeInTheDocument()
    expect(screen.queryByText('填写问卷获取优惠码')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '联系客服' })).toHaveAttribute('href', '/customer-service')
    expect(api.createOrder).not.toHaveBeenCalled()
  })

  it('多个开放方案可切换，优惠码仍按年卡报价并用于创建订单', async () => {
    const user = userEvent.setup()
    api.plans.mockResolvedValue(envelope([{ ...monthly, enabled: true, priceCents: 1200 }, annual]))
    api.createOrder.mockResolvedValue(envelope({ orderNo: 'order-1', planCode: 'ANNUAL', planName: '年卡', orderStatus: 'PENDING' }))
    mount()
    await user.click(await screen.findByRole('radio', { name: /月卡/ }))
    await waitFor(() => expect(api.quote).toHaveBeenLastCalledWith('MONTHLY', undefined))
    expect(screen.queryByText('使用优惠码')).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /年卡/ }))
    await user.click(await screen.findByText('使用优惠码'))
    await user.type(screen.getByLabelText('优惠码'), 'save10')
    await user.click(screen.getByRole('button', { name: '使用' }))
    await waitFor(() => expect(api.quote).toHaveBeenLastCalledWith('ANNUAL', 'SAVE10'))
    await waitFor(() => expect(screen.getByRole('button', { name: '微信支付开通' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '微信支付开通' }))
    expect(api.createOrder).toHaveBeenCalledWith('ANNUAL', expect.any(String), 'SAVE10')
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('全部方案关闭时保留权益和空状态，不请求报价', async () => {
    api.plans.mockResolvedValue(envelope([monthly]))
    mount()
    expect(await screen.findByText('暂无可选会员方案')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '微信支付开通' })).not.toBeInTheDocument()
    expect(screen.getByText('人工精修免费排队')).toBeInTheDocument()
    expect(api.quote).not.toHaveBeenCalled()
  })

  it('已关闭方案的未完成订单仍保留原快照和继续支付入口', async () => {
    api.plans.mockResolvedValue(envelope([monthly]))
    api.activeOrder.mockResolvedValue(envelope({ orderNo: 'pending-1', planCode: 'MONTHLY', planName: '历史月卡', membershipDays: 30, listPriceCents: 1200, discountAmountCents: 0, payableAmountCents: 1200, orderStatus: 'PENDING' }))
    mount()
    expect(await screen.findByText('历史月卡')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '继续支付当前订单' })).toBeEnabled()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.getByText('¥12.00')).toBeInTheDocument()
  })

  it('终身会员保留继续使用入口，不显示购买表单', async () => {
    auth.user.membershipStatus = 'ACTIVE'
    mount()
    expect(await screen.findByText('终身 VIP 已开通')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '继续使用' })).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(api.quote).not.toHaveBeenCalled()
  })
})
