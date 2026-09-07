import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  membershipApi,
  type MembershipOrder,
  type MembershipPlan,
  type MembershipQuote,
} from '../api/membership'
import { ApiError } from '../api/client'
import { Header } from '../components/layout/Header'
import { MembershipPaymentModal } from '../components/membership/MembershipPaymentModal'
import { useAuthStore } from '../store/authStore'
import { EXCELLENT_RESUMES_PATH, getSafeInternalPath } from '../utils/navigation'

const MEMBERSHIP_ORDER_SESSION_KEY = 'pai-resume:membership-order-no'
const MEMBERSHIP_IDEMPOTENCY_SESSION_KEY_PREFIX = 'pai-resume:membership-idempotency-key'
const MEMBERSHIP_REQUEST_COUPON_SESSION_KEY_PREFIX = 'pai-resume:membership-request-coupon'
const ANNUAL_PLAN_CODE = 'ANNUAL'

function formatCents(value: number) {
  return `¥${(value / 100).toFixed(2)}`
}

function formatMembershipExpiry(value: string) {
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatEntitlement(membershipDays: number | null) {
  return membershipDays === null ? '终身' : `${membershipDays} 天`
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `membership-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getIdempotencySessionKey(planCode: string) {
  return `${MEMBERSHIP_IDEMPOTENCY_SESSION_KEY_PREFIX}:${planCode}`
}

function getRequestCouponSessionKey(planCode: string) {
  return `${MEMBERSHIP_REQUEST_COUPON_SESSION_KEY_PREFIX}:${planCode}`
}

function clearIdempotencyKey(planCode?: string | null) {
  if (planCode) {
    window.sessionStorage.removeItem(getIdempotencySessionKey(planCode))
    window.sessionStorage.removeItem(getRequestCouponSessionKey(planCode))
  }
  window.sessionStorage.removeItem(MEMBERSHIP_IDEMPOTENCY_SESSION_KEY_PREFIX)
  window.sessionStorage.removeItem(MEMBERSHIP_REQUEST_COUPON_SESSION_KEY_PREFIX)
}

function isMembershipOrderTerminal(order: MembershipOrder): boolean {
  return ['PAID', 'CANCELED', 'REFUND_REQUIRED'].includes(order.orderStatus)
}

function isPlanAvailable(plan: MembershipPlan): boolean {
  return plan.enabled
    && plan.priceCents !== null
    && Number.isInteger(plan.priceCents)
    && plan.priceCents > 0
}

function chooseInitialPlan(plans: MembershipPlan[], requestedPlanCode: string | null) {
  const requested = requestedPlanCode
    ? plans.find((plan) => plan.code === requestedPlanCode && isPlanAvailable(plan))
    : undefined
  return requested
    ?? plans.find((plan) => plan.recommended && isPlanAvailable(plan))
    ?? plans.find(isPlanAvailable)
    ?? null
}

export default function MembershipPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const refreshUser = useAuthStore((state) => state.refreshUser)
  const requestedPlanCode = searchParams.get('plan')
  const returnTo = getSafeInternalPath(searchParams.get('redirect'), EXCELLENT_RESUMES_PATH)
  const isVip = user?.membershipStatus === 'ACTIVE'
  const isPermanentVip = isVip && !user?.membershipExpiresAt

  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [plansError, setPlansError] = useState('')
  const [selectedPlanCode, setSelectedPlanCode] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [appliedCouponCode, setAppliedCouponCode] = useState('')
  const [quote, setQuote] = useState<MembershipQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [recoveringOrder, setRecoveringOrder] = useState(true)
  const [orderRecoveryError, setOrderRecoveryError] = useState('')
  const [lockedRequest, setLockedRequest] = useState<{
    planCode: string
    couponCode: string
  } | null>(null)
  const [refreshingOrder, setRefreshingOrder] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [order, setOrder] = useState<MembershipOrder | null>(null)
  const pollingRef = useRef(false)
  const quoteRequestRef = useRef(0)
  const completedOrderRef = useRef<string | null>(null)
  const redirectTimerRef = useRef<number | null>(null)

  const availablePlans = useMemo(() => plans.filter(isPlanAvailable), [plans])

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.code === selectedPlanCode) ?? null,
    [plans, selectedPlanCode],
  )
  const hasResumableOrder = Boolean(order && !isMembershipOrderTerminal(order))
  const paymentBlockedByReview = order?.orderStatus === 'REFUND_REQUIRED'
  const orderSnapshot = hasResumableOrder || paymentBlockedByReview ? order : null
  const quoteMatchesSelectedPlan = Boolean(
    quote
    && selectedPlan
    && quote.planCode === selectedPlan.code,
  )

  const priceRows = useMemo(() => {
    if (orderSnapshot) {
      return [
        { label: '原价', value: formatCents(orderSnapshot.listPriceCents) },
        { label: '优惠减免', value: `-${formatCents(orderSnapshot.discountAmountCents)}` },
        { label: '应付金额', value: formatCents(orderSnapshot.payableAmountCents), strong: true },
      ]
    }
    if (!quote || !quoteMatchesSelectedPlan) {
      return []
    }
    return [
      { label: '原价', value: formatCents(quote.listPrice) },
      { label: '优惠减免', value: `-${formatCents(quote.discountAmount)}` },
      { label: '应付金额', value: formatCents(quote.payableAmount), strong: true },
    ]
  }, [orderSnapshot, quote, quoteMatchesSelectedPlan])

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true)
    setPlansError('')
    try {
      const { data: response } = await membershipApi.plans()
      const nextPlans = response.data
      setPlans(nextPlans)
      setSelectedPlanCode((current) => {
        if (nextPlans.some((plan) => plan.code === current && isPlanAvailable(plan))) {
          return current
        }
        return chooseInitialPlan(nextPlans, requestedPlanCode)?.code ?? ''
      })
    } catch (err: unknown) {
      setPlansError(err instanceof Error ? err.message : '获取会员方案失败')
    } finally {
      setPlansLoading(false)
    }
  }, [requestedPlanCode])

  const fetchQuote = useCallback(async (planCode: string, nextCouponCode?: string) => {
    const requestId = quoteRequestRef.current + 1
    quoteRequestRef.current = requestId
    setQuoteLoading(true)
    setQuoteError('')
    setQuote(null)
    try {
      const { data: response } = await membershipApi.quote(planCode, nextCouponCode)
      if (quoteRequestRef.current === requestId) {
        setQuote(response.data)
      }
    } catch (err: unknown) {
      if (quoteRequestRef.current === requestId) {
        setQuoteError(err instanceof Error ? err.message : '获取会员报价失败')
      }
    } finally {
      if (quoteRequestRef.current === requestId) {
        setQuoteLoading(false)
      }
    }
  }, [])

  const handleOrder = useCallback(async (nextOrder: MembershipOrder) => {
    setOrder(nextOrder)
    setSelectedPlanCode(nextOrder.planCode)
    window.sessionStorage.setItem(MEMBERSHIP_ORDER_SESSION_KEY, nextOrder.orderNo)

    if (nextOrder.orderStatus === 'CANCELED') {
      clearIdempotencyKey(nextOrder.planCode)
      setLockedRequest(null)
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
      clearIdempotencyKey(nextOrder.planCode)
      setLockedRequest(null)
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

  const recoverExistingOrder = useCallback(async () => {
    if (isPermanentVip) {
      window.sessionStorage.removeItem(MEMBERSHIP_ORDER_SESSION_KEY)
      clearIdempotencyKey()
      setOrder(null)
      setOrderRecoveryError('')
      setRecoveringOrder(false)
      return null
    }

    setRecoveringOrder(true)
    setOrderRecoveryError('')
    const storedOrderNo = window.sessionStorage.getItem(MEMBERSHIP_ORDER_SESSION_KEY)
    let storedOrderError: unknown = null

    try {
      if (storedOrderNo) {
        try {
          const { data: storedResponse } = await membershipApi.order(storedOrderNo)
          const storedOrder = storedResponse.data
          if (storedOrder.orderStatus !== 'CANCELED') {
            setPaymentOpen(true)
            await handleOrder(storedOrder)
            return storedOrder
          }
          await handleOrder(storedOrder)
          setOrder(null)
          setPaymentOpen(false)
          window.sessionStorage.removeItem(MEMBERSHIP_ORDER_SESSION_KEY)
        } catch (err: unknown) {
          if (err instanceof ApiError && [7401, 7402].includes(err.code ?? 0)) {
            window.sessionStorage.removeItem(MEMBERSHIP_ORDER_SESSION_KEY)
          } else {
            storedOrderError = err
          }
        }
      }

      const { data: activeResponse } = await membershipApi.activeOrder()
      if (activeResponse.data) {
        setPaymentOpen(true)
        await handleOrder(activeResponse.data)
        return activeResponse.data
      }

      if (storedOrderError) {
        throw storedOrderError
      }
      setOrder(null)
      return null
    } catch (err: unknown) {
      setOrderRecoveryError(
        err instanceof Error ? err.message : '未完成订单恢复失败，请重试',
      )
      return null
    } finally {
      setRecoveringOrder(false)
    }
  }, [handleOrder, isPermanentVip])

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
    if (recoveringOrder || orderRecoveryError) {
      return
    }
    if (order && !isMembershipOrderTerminal(order)) {
      setPaymentOpen(true)
      return
    }
    if (!selectedPlan || !isPlanAvailable(selectedPlan)) {
      setPaymentError('该会员方案暂未开放')
      return
    }
    if (!quote || !quoteMatchesSelectedPlan || !quote.paymentEnabled) {
      setPaymentError('会员报价尚未准备好，请稍后重试')
      return
    }

    setCreatingOrder(true)
    setPaymentError('')
    try {
      const sessionKey = getIdempotencySessionKey(selectedPlan.code)
      const idempotencyKey = window.sessionStorage.getItem(sessionKey) || createIdempotencyKey()
      const requestCouponCode = lockedRequest?.planCode === selectedPlan.code
        ? lockedRequest.couponCode
        : selectedPlan.code === ANNUAL_PLAN_CODE
          ? appliedCouponCode
          : ''
      window.sessionStorage.setItem(sessionKey, idempotencyKey)
      window.sessionStorage.setItem(
        getRequestCouponSessionKey(selectedPlan.code),
        requestCouponCode,
      )
      setLockedRequest({
        planCode: selectedPlan.code,
        couponCode: requestCouponCode,
      })
      const { data: response } = await membershipApi.createOrder(
        selectedPlan.code,
        idempotencyKey,
        requestCouponCode || undefined,
      )
      setPaymentOpen(true)
      await handleOrder(response.data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '会员支付订单创建失败'
      const recovered = await recoverExistingOrder()
      if (!recovered) {
        setPaymentError(message)
      }
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
      clearIdempotencyKey(order.planCode)
      setOrder(null)
      setPaymentError('')
      const nextPlan = chooseInitialPlan(plans, requestedPlanCode)
      setSelectedPlanCode(nextPlan?.code ?? '')
    }
  }, [handleOrder, isVip, navigate, order, plans, requestedPlanCode, returnTo])

  const handleApplyCoupon = () => {
    if (
      !selectedPlan
      || selectedPlan.code !== ANNUAL_PLAN_CODE
      || !isPlanAvailable(selectedPlan)
      || hasResumableOrder
      || lockedRequest
      || recoveringOrder
      || orderRecoveryError
    ) {
      return
    }
    const normalizedCoupon = couponCode.trim()
    setAppliedCouponCode(normalizedCoupon)
    if (normalizedCoupon === appliedCouponCode) {
      void fetchQuote(selectedPlan.code, normalizedCoupon || undefined)
    }
  }

  const handlePlanSelect = (plan: MembershipPlan) => {
    if (
      !isPlanAvailable(plan)
      || hasResumableOrder
      || lockedRequest
      || recoveringOrder
      || orderRecoveryError
    ) {
      return
    }
    if (plan.code !== ANNUAL_PLAN_CODE) {
      setCouponCode('')
      setAppliedCouponCode('')
    }
    setSelectedPlanCode(plan.code)
    setPaymentError('')
  }

  useEffect(() => {
    void fetchPlans()
  }, [fetchPlans])

  useEffect(() => {
    if (plans.length === 0 || hasResumableOrder) {
      return
    }
    const pendingPlan = plans.find((plan) => (
      window.sessionStorage.getItem(getIdempotencySessionKey(plan.code))
      && window.sessionStorage.getItem(getRequestCouponSessionKey(plan.code)) !== null
    ))
    if (!pendingPlan) {
      return
    }

    const pendingCoupon = window.sessionStorage.getItem(
      getRequestCouponSessionKey(pendingPlan.code),
    ) ?? ''
    setLockedRequest({
      planCode: pendingPlan.code,
      couponCode: pendingCoupon,
    })
    setSelectedPlanCode(pendingPlan.code)
    if (pendingPlan.code === ANNUAL_PLAN_CODE) {
      setCouponCode(pendingCoupon)
      setAppliedCouponCode(pendingCoupon)
    }
  }, [hasResumableOrder, plans])

  useEffect(() => {
    if (
      isPermanentVip
      || !selectedPlan
      || !isPlanAvailable(selectedPlan)
      || hasResumableOrder
      || recoveringOrder
      || orderRecoveryError
    ) {
      quoteRequestRef.current += 1
      setQuote(null)
      setQuoteLoading(false)
      setQuoteError('')
      return
    }

    void fetchQuote(
      selectedPlan.code,
      selectedPlan.code === ANNUAL_PLAN_CODE
        ? appliedCouponCode || undefined
        : undefined,
    )
  }, [
    appliedCouponCode,
    fetchQuote,
    hasResumableOrder,
    isPermanentVip,
    orderRecoveryError,
    recoveringOrder,
    selectedPlan,
  ])

  useEffect(() => {
    if (selectedPlanCode === ANNUAL_PLAN_CODE) {
      return
    }
    setCouponCode('')
    setAppliedCouponCode('')
  }, [selectedPlanCode])

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    void recoverExistingOrder()
  }, [recoverExistingOrder])

  useEffect(() => {
    if (!paymentOpen || !order || isMembershipOrderTerminal(order)) return

    const timer = window.setInterval(async () => {
      if (pollingRef.current) return
      pollingRef.current = true
      try {
        const { data: response } = await membershipApi.order(order.orderNo)
        await handleOrder(response.data)
      } catch {
        // 自动轮询失败不打断支付流程，用户仍可主动确认订单状态。
      } finally {
        pollingRef.current = false
      }
    }, 2500)

    return () => window.clearInterval(timer)
  }, [handleOrder, order, paymentOpen])

  const selectedSummary = orderSnapshot
    ? {
        name: orderSnapshot.planName,
        membershipDays: orderSnapshot.membershipDays,
      }
    : selectedPlan
      ? {
          name: selectedPlan.name,
          membershipDays: selectedPlan.membershipDays,
        }
      : null
  const selectedPlanAvailable = Boolean(selectedPlan && isPlanAvailable(selectedPlan))
  const couponEligible = (orderSnapshot?.planCode ?? selectedPlan?.code) === ANNUAL_PLAN_CODE
  const selectionLocked = recoveringOrder
    || Boolean(orderRecoveryError)
    || Boolean(lockedRequest)
  const canCreateOrder = Boolean(
    selectedPlanAvailable
    && quote
    && quoteMatchesSelectedPlan
    && quote.paymentEnabled,
  )
  const checkoutDisabled = creatingOrder
    || recoveringOrder
    || Boolean(orderRecoveryError)
    || paymentBlockedByReview
    || (!hasResumableOrder && (!canCreateOrder || quoteLoading))

  const paymentPaused = Boolean(
    !orderSnapshot && !quoteLoading && quoteMatchesSelectedPlan && quote && !quote.paymentEnabled,
  )
  const showCheckout = Boolean(selectedPlanAvailable || orderSnapshot)
  const hasDiscount = (orderSnapshot?.discountAmountCents ?? quote?.discountAmount ?? 0) > 0

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">派简历 VIP</h1>
          {isVip && user?.membershipExpiresAt ? (
            <p className="text-sm text-emerald-700">
              有效期至 {formatMembershipExpiry(user.membershipExpiresAt)}
            </p>
          ) : null}
        </header>

        {isPermanentVip ? (
          <section className="max-w-xl rounded-2xl border border-emerald-200 bg-white p-8">
            <h2 className="text-xl font-semibold text-slate-950">终身 VIP 已开通</h2>
            <Link to={returnTo} className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white hover:bg-primary-700">
              继续使用
            </Link>
          </section>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid lg:grid-cols-[minmax(0,1fr)_400px]">
            <section className="p-6 sm:p-8 lg:p-10" aria-labelledby="membership-benefits-title">
              <div className="mb-8 flex items-center gap-3 text-primary-600">
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m3 6 4 4 5-7 5 7 4-4-2 13H5L3 6Zm3 10h12" />
                </svg>
                <span className="text-sm font-semibold tracking-widest">会员专享</span>
              </div>
              <h2 id="membership-benefits-title" className="text-2xl font-bold tracking-tight text-slate-950">让简历准备更进一步</h2>
              <ul className="mt-5 divide-y divide-slate-100">
                {[
                  { title: 'AI 简历分析与优化', description: '发现简历中的问题，获得内容与表达建议。', path: 'm12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z' },
                  { title: 'VIP 精选简历', description: '查看 VIP 简历内容，参考经历组织与项目表达。', path: 'M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5Zm4 2h8M8 11h8M8 15h4' },
                  { title: '人工精修免费排队', description: '提交简历 PDF，由二哥逐份精修。', path: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-3 2 2 3-3' },
                ].map((benefit) => (
                  <li key={benefit.title} className="flex gap-4 py-6">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d={benefit.path} /></svg>
                    </span>
                    <div>
                      <h3 className="font-semibold text-slate-900">{benefit.title}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-slate-500">{benefit.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <aside className="border-t border-slate-200 p-6 sm:p-8 lg:border-l lg:border-t-0" aria-labelledby="membership-plans-title">
              <div className="flex items-center justify-between gap-3">
                <h2 id="membership-plans-title" className="text-lg font-semibold text-slate-950">
                  {orderSnapshot ? '当前订单' : isVip ? '续费会员' : '开通会员'}
                </h2>
                {hasResumableOrder ? <span className="text-xs text-amber-700">待支付</span> : null}
              </div>

              {recoveringOrder ? (
                <p className="mt-4 text-sm text-slate-500" role="status">正在检查未完成订单…</p>
              ) : orderRecoveryError ? (
                <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
                  <p>{orderRecoveryError}</p>
                  <button type="button" onClick={() => void recoverExistingOrder()} className="mt-2 font-semibold underline underline-offset-4">重试</button>
                </div>
              ) : lockedRequest && !hasResumableOrder ? (
                <p className="mt-4 text-sm text-amber-700">上次开通请求待确认，方案已锁定。</p>
              ) : null}

              {orderSnapshot && selectedSummary ? (
                <div className="mt-5 border-b border-slate-100 pb-5">
                  <p className="font-semibold text-slate-950">{selectedSummary.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{formatEntitlement(selectedSummary.membershipDays)}</p>
                </div>
              ) : plansLoading ? (
                <div className="mt-5 h-24 animate-pulse rounded-xl bg-slate-100" aria-label="正在加载会员方案" />
              ) : plansError ? (
                <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
                  <p>{plansError}</p>
                  <button type="button" onClick={() => void fetchPlans()} className="mt-2 font-semibold underline underline-offset-4">重新加载</button>
                </div>
              ) : availablePlans.length === 0 ? (
                <p className="py-8 text-sm text-slate-500">暂无可选会员方案</p>
              ) : (
                <div className="mt-5 grid gap-3" role="radiogroup" aria-label="选择会员方案">
                  {availablePlans.map((plan) => {
                    const selected = plan.code === selectedPlanCode
                    return (
                      <button
                        key={plan.code}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={selectionLocked}
                        onClick={() => handlePlanSelect(plan)}
                        className={[
                          'flex items-center justify-between gap-4 rounded-xl border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed',
                          selected ? 'border-primary-500 bg-primary-50/60' : 'border-slate-200 hover:border-primary-300',
                        ].join(' ')}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-950">{plan.name}</span>
                            {plan.recommended && availablePlans.length > 1 ? <span className="text-xs font-medium text-primary-600">推荐</span> : null}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{formatEntitlement(plan.membershipDays)}</p>
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-slate-950">{formatCents(plan.priceCents!)}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {showCheckout && !paymentPaused ? (
                <>
                  {couponEligible && !orderSnapshot ? (
                    <details className="mt-5 text-sm">
                      <summary className="cursor-pointer text-slate-600 hover:text-primary-600">使用优惠码</summary>
                      <div className="mt-3 flex gap-2">
                        <label htmlFor="membership-coupon" className="sr-only">优惠码</label>
                        <input
                          id="membership-coupon"
                          value={couponCode}
                          onChange={(event) => {
                            const next = event.target.value.toUpperCase()
                            setCouponCode(next)
                            if (next.trim() !== appliedCouponCode) setAppliedCouponCode('')
                          }}
                          disabled={!selectedPlanAvailable || selectionLocked}
                          placeholder="输入优惠码"
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:bg-slate-50"
                        />
                        <button type="button" onClick={handleApplyCoupon} disabled={quoteLoading || !selectedPlanAvailable || selectionLocked} className="rounded-lg border border-slate-300 px-3 py-2.5 font-medium text-slate-700 hover:border-primary-300 disabled:opacity-50">
                          {quoteLoading ? '计算中' : '使用'}
                        </button>
                      </div>
                    </details>
                  ) : null}

                  <div className="mt-5 border-t border-slate-100 pt-5">
                    {quoteLoading && !orderSnapshot ? (
                      <p className="text-sm text-slate-500" role="status">正在获取报价…</p>
                    ) : priceRows.length > 0 ? (
                      <div className="space-y-3">
                        {priceRows.filter((row) => row.strong || hasDiscount).map((row) => (
                          <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-slate-500">{row.label}</span>
                            <span className={row.strong ? 'text-2xl font-bold text-slate-950' : 'text-slate-700'}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-slate-500">报价暂不可用</p>}
                  </div>
                  <button type="button" onClick={() => void handleCreateOrder()} disabled={checkoutDisabled} className="mt-5 w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                    {creatingOrder ? '正在创建订单…' : paymentBlockedByReview ? '订单待人工处理，请联系客服' : hasResumableOrder ? '继续支付当前订单' : lockedRequest ? '重试开通' : '微信支付开通'}
                  </button>
                  {couponEligible && !hasResumableOrder && !selectionLocked ? (
                    <Link to="/survey" className="mt-4 block text-center text-sm text-slate-500 hover:text-primary-600">填写问卷获取优惠码</Link>
                  ) : null}
                </>
              ) : null}

              {paymentPaused ? (
                <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">支付暂不可用</p>
              ) : null}
              {quoteError ? <p className="mt-3 text-sm text-red-600" role="alert">{quoteError}</p> : null}
              {paymentError && !paymentOpen ? <p className="mt-3 text-sm text-red-600" role="alert">{paymentError}</p> : null}

              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500">
                <Link to="/customer-service" className="hover:text-primary-600">联系客服</Link>
                <Link to="/refund-policy" className="hover:text-primary-600">退款规则</Link>
              </div>
            </aside>
          </div>
        )}
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
