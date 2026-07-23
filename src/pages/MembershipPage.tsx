import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  membershipApi,
  type MembershipOrder,
  type MembershipQuote,
} from '../api/membership'
import { Header } from '../components/layout/Header'
import { MembershipPaymentModal } from '../components/membership/MembershipPaymentModal'
import { useAuthStore } from '../store/authStore'
import { EXCELLENT_RESUMES_PATH, getSafeInternalPath } from '../utils/navigation'

const MEMBERSHIP_ORDER_SESSION_KEY = 'pai-resume:membership-order-no'
const MEMBERSHIP_IDEMPOTENCY_SESSION_KEY = 'pai-resume:membership-idempotency-key'

const EMPTY_QUOTE: MembershipQuote = {
  listPrice: 0,
  discountAmount: 0,
  payableAmount: 0,
  couponStatus: 'NOT_APPLIED',
  paymentEnabled: false,
  membershipDays: 365,
}

function formatCents(value: number) {
  return `¥${(value / 100).toFixed(2)}`
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `membership-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isMembershipOrderTerminal(order: MembershipOrder): boolean {
  return ['PAID', 'CANCELED', 'REFUND_REQUIRED'].includes(order.orderStatus)
}

export default function MembershipPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const refreshUser = useAuthStore((state) => state.refreshUser)
  const [inviteCode, setInviteCode] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [quote, setQuote] = useState<MembershipQuote>(EMPTY_QUOTE)
  const [loading, setLoading] = useState(false)
  const [redeemingInvite, setRedeemingInvite] = useState(false)
  const [error, setError] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [refreshingOrder, setRefreshingOrder] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [order, setOrder] = useState<MembershipOrder | null>(null)
  const pollingRef = useRef(false)
  const completedOrderRef = useRef<string | null>(null)
  const redirectTimerRef = useRef<number | null>(null)
  const returnTo = getSafeInternalPath(searchParams.get('redirect'), EXCELLENT_RESUMES_PATH)
  const isVip = user?.membershipStatus === 'ACTIVE'
  const membershipDays = quote.membershipDays
  const membershipPlanLabel = membershipDays === 365
    ? '年费 VIP（365 天）'
    : `${membershipDays} 天 VIP`
  const hasResumableOrder = Boolean(order && !isMembershipOrderTerminal(order))
  const paymentBlockedByReview = order?.orderStatus === 'REFUND_REQUIRED'

  const priceRows = useMemo(() => ([
    { label: 'VIP 原价', value: formatCents(quote.listPrice) },
    { label: '优惠减免', value: `-${formatCents(quote.discountAmount)}` },
    { label: '应付金额', value: formatCents(quote.payableAmount), strong: true },
  ]), [quote.discountAmount, quote.listPrice, quote.payableAmount])

  const fetchQuote = async (nextCouponCode?: string) => {
    setLoading(true)
    setError('')
    try {
      const { data: response } = await membershipApi.quote(nextCouponCode)
      setQuote(response.data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '获取 VIP 报价失败')
    } finally {
      setLoading(false)
    }
  }

  const handleOrder = useCallback(async (nextOrder: MembershipOrder) => {
    setOrder(nextOrder)
    window.sessionStorage.setItem(MEMBERSHIP_ORDER_SESSION_KEY, nextOrder.orderNo)

    if (nextOrder.orderStatus === 'CANCELED') {
      window.sessionStorage.removeItem(MEMBERSHIP_IDEMPOTENCY_SESSION_KEY)
      return
    }
    if (nextOrder.orderStatus !== 'PAID' || completedOrderRef.current === nextOrder.orderNo) {
      return
    }

    completedOrderRef.current = nextOrder.orderNo
    setPaymentError('')
    try {
      await refreshUser()
      window.sessionStorage.removeItem(MEMBERSHIP_ORDER_SESSION_KEY)
      window.sessionStorage.removeItem(MEMBERSHIP_IDEMPOTENCY_SESSION_KEY)
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current)
      }
      redirectTimerRef.current = window.setTimeout(() => {
        navigate(returnTo, { replace: true })
      }, 1200)
    } catch (err: unknown) {
      completedOrderRef.current = null
      setPaymentError(err instanceof Error
        ? `支付已成功，但会员状态刷新失败：${err.message}`
        : '支付已成功，但会员状态刷新失败，请稍后重试')
    }
  }, [navigate, refreshUser, returnTo])

  const handleRefreshOrder = useCallback(async () => {
    if (!order || refreshingOrder) return

    setRefreshingOrder(true)
    setPaymentError('')
    try {
      const { data: response } = await membershipApi.refreshOrder(order.orderNo)
      await handleOrder(response.data)
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : '会员订单状态刷新失败')
    } finally {
      setRefreshingOrder(false)
    }
  }, [handleOrder, order, refreshingOrder])

  const handleCreateOrder = async () => {
    if (order && !isMembershipOrderTerminal(order)) {
      setPaymentOpen(true)
      return
    }

    setCreatingOrder(true)
    setPaymentError('')
    try {
      const idempotencyKey = window.sessionStorage.getItem(MEMBERSHIP_IDEMPOTENCY_SESSION_KEY)
        || createIdempotencyKey()
      window.sessionStorage.setItem(MEMBERSHIP_IDEMPOTENCY_SESSION_KEY, idempotencyKey)
      const { data: response } = await membershipApi.createOrder(
        idempotencyKey,
        couponCode.trim() || undefined,
      )
      setPaymentOpen(true)
      await handleOrder(response.data)
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : '会员支付订单创建失败')
    } finally {
      setCreatingOrder(false)
    }
  }

  const handleClosePayment = useCallback(() => {
    if (order?.orderStatus === 'PAID') {
      if (!isVip) {
        void handleOrder(order)
        return
      }
      setPaymentOpen(false)
      navigate(returnTo, { replace: true })
      return
    }
    setPaymentOpen(false)
    if (order?.orderStatus === 'CANCELED') {
      window.sessionStorage.removeItem(MEMBERSHIP_ORDER_SESSION_KEY)
      window.sessionStorage.removeItem(MEMBERSHIP_IDEMPOTENCY_SESSION_KEY)
      setOrder(null)
      setPaymentError('')
    }
  }, [handleOrder, isVip, navigate, order, returnTo])

  const redeemInvite = async () => {
    if (!inviteCode.trim()) {
      setInviteError('请输入 VIP 邀请码')
      return
    }
    setRedeemingInvite(true)
    setInviteError('')
    try {
      await membershipApi.redeemInvite(inviteCode.trim())
      await refreshUser()
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : '邀请码兑换失败')
    } finally {
      setRedeemingInvite(false)
    }
  }

  useEffect(() => {
    void fetchQuote()
  }, [])

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isVip) {
      window.sessionStorage.removeItem(MEMBERSHIP_ORDER_SESSION_KEY)
      window.sessionStorage.removeItem(MEMBERSHIP_IDEMPOTENCY_SESSION_KEY)
      return
    }

    const orderNo = window.sessionStorage.getItem(MEMBERSHIP_ORDER_SESSION_KEY)
    if (!orderNo) return

    let canceled = false
    void membershipApi.order(orderNo)
      .then(async ({ data: response }) => {
        if (canceled) return
        setPaymentOpen(true)
        await handleOrder(response.data)
      })
      .catch(() => {
        if (canceled) return
        window.sessionStorage.removeItem(MEMBERSHIP_ORDER_SESSION_KEY)
        window.sessionStorage.removeItem(MEMBERSHIP_IDEMPOTENCY_SESSION_KEY)
      })

    return () => {
      canceled = true
    }
  }, [handleOrder, isVip])

  useEffect(() => {
    if (!paymentOpen || !order || isMembershipOrderTerminal(order)) return

    const timer = window.setInterval(async () => {
      if (pollingRef.current) return
      pollingRef.current = true
      try {
        const { data: response } = await membershipApi.order(order.orderNo)
        await handleOrder(response.data)
      } catch {
        // 自动轮询失败不打断支付流程，用户仍可主动向支付平台确认订单状态。
      } finally {
        pollingRef.current = false
      }
    }, 2500)

    return () => window.clearInterval(timer)
  }, [handleOrder, order, paymentOpen])

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8 lg:py-14">
        <section>
          <p className="text-sm font-medium text-primary-700">派简历 VIP</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">解锁 AI 优化与完整投递能力</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            免费账号可以编辑、保存和导入简历；VIP 可进一步使用 AI 优化与分析、智能一页、PDF 导出和优质简历全文。
          </p>

          <div className="mt-6 border border-primary-200 bg-primary-50 px-5 py-4 text-sm leading-6 text-primary-950">
            <p><strong>免费账号：</strong>编辑、保存、导入简历，已有简历数据会持续保留。</p>
            <p><strong>VIP 账号：</strong>在免费功能基础上，解锁全部 AI 功能、智能一页、PDF 导出和优质简历全文。</p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              ['AI 智能优化', '使用 AI 优化模块和字段表达，获得针对性的简历建议。'],
              ['AI 简历分析', '分析内容完整度、表达质量和可改进项。'],
              ['智能一页与 PDF', '把多页简历合成一张连续长页，完整保留内容，并以单页 PDF 导出。'],
              ['优质简历全文', '查看精选简历的完整模块、项目要点和推荐排版。'],
            ].map(([title, description]) => (
              <div key={title} className="border border-slate-200 bg-white px-5 py-5">
                <div className="flex h-8 w-8 items-center justify-center bg-primary-50 text-primary-700">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="mt-4 font-semibold text-slate-900">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="h-fit border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
          {isVip ? (
            <div>
              <div className="flex h-11 w-11 items-center justify-center bg-emerald-50 text-emerald-700">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="mt-5 text-xl font-semibold text-slate-950">你的 VIP 已开通</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {user?.membershipExpiresAt ? `有效期至 ${user.membershipExpiresAt}` : 'VIP 权益当前有效'}，AI、智能一页、PDF 导出和优质简历全文均已解锁。
              </p>
              <Link to={returnTo} className="mt-6 inline-flex w-full items-center justify-center bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700">
                继续查看
              </Link>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-primary-700">VIP 开通</div>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">确认价格</h2>
                </div>
                <span className="bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">{membershipPlanLabel}</span>
              </div>

              <div className="mt-6 border border-emerald-200 bg-emerald-50 px-4 py-4">
                <label htmlFor="membership-invite" className="block text-sm font-semibold text-emerald-950">VIP 邀请码</label>
                <p className="mt-1 text-xs leading-5 text-emerald-800">邀请码与支付优惠码相互独立，邀请码兑换不需要付款。</p>
                <div className="mt-3 flex gap-2">
                  <input
                    id="membership-invite"
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                    placeholder="输入管理员提供的邀请码"
                    className="min-w-0 flex-1 border border-emerald-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={() => void redeemInvite()}
                    disabled={redeemingInvite}
                    className="bg-emerald-700 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {redeemingInvite ? '兑换中' : '兑换'}
                  </button>
                </div>
                {inviteError ? <p className="mt-2 text-sm text-red-600" role="alert">{inviteError}</p> : null}
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-emerald-900">
                  <li>每个账号只能领取一次，不能叠加，也不能换一个邀请码重复续期。</li>
                  <li>邀请码权益天数由知识星球福利批次决定，兑换后以账号显示的到期时间为准。</li>
                  <li>邀请码截止时间只限制领取，不会缩短已经领取的权益。</li>
                  <li>到期后不会自动续期；如需继续使用，可购买年费会员或由管理员在后台延期。</li>
                  <li>到期后简历数据继续保留，编辑、保存和导入功能仍可使用。</li>
                  <li>邀请码仅限本人使用，请勿截图、转发或发布到公开渠道。</li>
                </ul>
              </div>

              <div className="mt-6">
                <label htmlFor="membership-coupon" className="mb-2 block text-sm font-medium text-slate-700">支付优惠码</label>
                <div className="flex gap-2">
                  <input
                    id="membership-coupon"
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                    placeholder="支付抵扣，没有可不填"
                    className="min-w-0 flex-1 border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  />
                  <button
                    type="button"
                    onClick={() => void fetchQuote(couponCode.trim() || undefined)}
                    disabled={loading}
                    className="border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 hover:border-primary-300 hover:text-primary-700 disabled:opacity-50"
                  >
                    {loading ? '计算中' : '使用'}
                  </button>
                </div>
                {error ? <p className="mt-2 text-sm text-red-600" role="alert">{error}</p> : null}
              </div>

              <div className="mt-6 space-y-3 border-y border-slate-100 py-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">会员期限</span>
                  <span className="font-medium text-slate-800">{membershipDays} 天</span>
                </div>
                {priceRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{row.label}</span>
                    <span className={row.strong ? 'text-xl font-semibold text-slate-950' : 'text-slate-700'}>{row.value}</span>
                  </div>
                ))}
              </div>

              {quote.paymentEnabled ? (
                <div className="mt-5 border border-primary-200 bg-primary-50 px-4 py-3 text-sm leading-6 text-primary-900">
                  创建订单后将展示微信支付二维码。订单 30 分钟内有效，未支付的超时订单会由服务端向支付平台确认后自动取消。
                </div>
              ) : (
                <div className="mt-5 border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  当前暂停创建新的会员订单。已经创建的订单仍可继续查询支付结果；需要新开通时请稍后再试。
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleCreateOrder()}
                disabled={creatingOrder || paymentBlockedByReview || (!quote.paymentEnabled && !hasResumableOrder)}
                className="mt-5 w-full bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {creatingOrder
                  ? '正在创建会员订单...'
                  : paymentBlockedByReview
                    ? '订单待人工处理，请联系客服'
                  : hasResumableOrder
                    ? '继续支付当前订单'
                    : `微信支付开通 ${membershipPlanLabel}`}
              </button>
              {paymentError && !paymentOpen ? (
                <p className="mt-3 text-sm text-red-600" role="alert">{paymentError}</p>
              ) : null}
              <Link to="/survey" className="mt-3 inline-flex w-full items-center justify-center border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-primary-200 hover:text-primary-700">
                先填写问卷获取优惠码
              </Link>
              <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                优惠码状态：{quote.couponStatus}。以上是服务端报价预览，会员期限、优惠和实付金额最终以创建成功的订单快照为准。
              </p>
            </div>
          )}
        </aside>
      </main>

      <MembershipPaymentModal
        open={paymentOpen}
        order={order}
        refreshing={refreshingOrder}
        error={paymentError}
        onRefresh={() => void handleRefreshOrder()}
        onClose={handleClosePayment}
      />
    </div>
  )
}
