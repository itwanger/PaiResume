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
    ?? plans[0]
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
        if (nextPlans.some((plan) => plan.code === current)) {
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
    if (!quote || !quoteMatchesSelectedPlan) {
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

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {isPermanentVip ? 'VIP 会员' : '选择会员方案'}
          </h1>
          {!isPermanentVip ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">全部方案享受相同 VIP 权益。</p>
          ) : null}
        </header>

        {isPermanentVip ? (
          <section className="mt-8 max-w-xl border border-emerald-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center bg-emerald-50 text-emerald-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="mt-5 text-xl font-semibold text-slate-950">终身 VIP 已开通</h2>
            <Link
              to={returnTo}
              className="mt-6 inline-flex w-full items-center justify-center bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              继续使用
            </Link>
          </section>
        ) : (
          <>
            {isVip && user?.membershipExpiresAt ? (
              <div className="mt-7 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                当前 VIP 有效期至 {formatMembershipExpiry(user.membershipExpiresAt)}
              </div>
            ) : null}

            <section className="mt-8" aria-labelledby="membership-plans-title">
              <div className="flex items-center justify-between gap-4">
                <h2 id="membership-plans-title" className="text-xl font-semibold text-slate-950">会员方案</h2>
                {hasResumableOrder ? (
                  <span className="text-sm text-amber-700">当前订单已锁定方案</span>
                ) : null}
              </div>

              {plansLoading ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="正在加载会员方案">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="h-36 animate-pulse border border-slate-200 bg-white p-5">
                      <div className="h-5 w-24 bg-slate-100" />
                      <div className="mt-5 h-4 w-16 bg-slate-100" />
                      <div className="mt-4 h-7 w-20 bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : plansError ? (
                <div className="mt-4 border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700" role="alert">
                  <p>{plansError}</p>
                  <button
                    type="button"
                    onClick={() => void fetchPlans()}
                    className="mt-3 border border-red-200 bg-white px-3 py-2 font-medium text-red-700 hover:bg-red-100"
                  >
                    重新加载
                  </button>
                </div>
              ) : plans.length === 0 ? (
                <div className="mt-4 border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
                  暂无可选会员方案
                </div>
              ) : (
                <div
                  className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
                  role="radiogroup"
                  aria-label="选择会员方案"
                >
                  {plans.map((plan) => {
                    const available = isPlanAvailable(plan)
                    const selected = plan.code === selectedPlanCode
                    const locked = selectionLocked || (hasResumableOrder && !selected)
                    return (
                      <button
                        key={plan.code}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={!available || locked}
                        onClick={() => handlePlanSelect(plan)}
                        className={[
                          'relative min-h-36 border bg-white p-5 text-left transition',
                          selected
                            ? 'border-primary-500 ring-2 ring-primary-100'
                            : 'border-slate-200 hover:border-primary-300',
                          !available || locked ? 'cursor-not-allowed opacity-60' : '',
                        ].join(' ')}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-semibold text-slate-950">{plan.name}</span>
                          {plan.recommended ? (
                            <span className="shrink-0 bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700">
                              推荐
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-4 text-sm text-slate-500">
                          {formatEntitlement(plan.membershipDays)}
                        </p>
                        <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
                          {available && plan.priceCents !== null ? formatCents(plan.priceCents) : '待开放'}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
              <section className="border border-slate-200 bg-white p-6" aria-labelledby="membership-benefits-title">
                <h2 id="membership-benefits-title" className="text-lg font-semibold text-slate-950">
                  会员权益与增值服务
                </h2>
                <ul className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                  {['AI 简历分析与优化', 'VIP 内容查看', '人工精修免费排队'].map((benefit) => (
                    <li key={benefit} className="flex items-center gap-2">
                      <span className="text-emerald-600" aria-hidden="true">✓</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </section>

              <aside className="h-fit border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
                <h2 className="text-xl font-semibold text-slate-950">确认方案</h2>

                {recoveringOrder ? (
                  <div className="mt-4 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    正在检查未完成订单...
                  </div>
                ) : orderRecoveryError ? (
                  <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                    <p>{orderRecoveryError}</p>
                    <button
                      type="button"
                      onClick={() => void recoverExistingOrder()}
                      className="mt-3 border border-red-200 bg-white px-3 py-2 font-medium hover:bg-red-100"
                    >
                      重试
                    </button>
                  </div>
                ) : lockedRequest && !hasResumableOrder ? (
                  <div className="mt-4 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    上次开通请求待确认，方案已锁定。
                  </div>
                ) : null}

                {selectedSummary ? (
                  <div className="mt-5 flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                      <p className="font-medium text-slate-950">{selectedSummary.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatEntitlement(selectedSummary.membershipDays)}
                      </p>
                    </div>
                    {hasResumableOrder ? (
                      <span className="bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">待支付</span>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-5 border-b border-slate-100 pb-5 text-sm text-slate-500">请选择会员方案</p>
                )}

                {couponEligible ? (
                  <div className="mt-5">
                    <label htmlFor="membership-coupon" className="mb-2 block text-sm font-medium text-slate-700">
                      优惠码
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="membership-coupon"
                        value={couponCode}
                        onChange={(event) => {
                          const nextCouponCode = event.target.value.toUpperCase()
                          setCouponCode(nextCouponCode)
                          if (nextCouponCode.trim() !== appliedCouponCode) {
                            setAppliedCouponCode('')
                          }
                        }}
                        disabled={!selectedPlanAvailable || hasResumableOrder || selectionLocked}
                        placeholder="没有可不填"
                        className="min-w-0 flex-1 border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:bg-slate-50 disabled:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={quoteLoading || !selectedPlanAvailable || hasResumableOrder || selectionLocked}
                        className="border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 hover:border-primary-300 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {quoteLoading ? '计算中' : '使用'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {quoteError ? (
                  <p className="mt-3 text-sm text-red-600" role="alert">{quoteError}</p>
                ) : null}

                <div className="mt-6 min-h-28 border-y border-slate-100 py-5">
                  {quoteLoading && !orderSnapshot ? (
                    <div className="flex min-h-20 items-center justify-center text-sm text-slate-500">
                      正在获取报价…
                    </div>
                  ) : priceRows.length > 0 ? (
                    <div className="space-y-3">
                      {priceRows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">{row.label}</span>
                          <span className={row.strong ? 'text-xl font-semibold text-slate-950' : 'text-slate-700'}>
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-20 items-center justify-center text-sm text-slate-500">
                      {selectedPlanAvailable ? '报价暂不可用' : '该方案待开放'}
                    </div>
                  )}
                </div>

                {!hasResumableOrder && quoteMatchesSelectedPlan && quote && !quote.paymentEnabled ? (
                  <div className="mt-5 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    会员支付维护中
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleCreateOrder()}
                  disabled={checkoutDisabled}
                  className="mt-5 w-full bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {creatingOrder
                    ? '正在创建订单...'
                    : paymentBlockedByReview
                      ? '订单待人工处理，请联系客服'
                      : hasResumableOrder
                        ? '继续支付当前订单'
                        : lockedRequest
                          ? '重试开通'
                        : selectedPlanAvailable
                          ? '微信支付开通'
                          : '暂未开放'}
                </button>

                {paymentError && !paymentOpen ? (
                  <p className="mt-3 text-sm text-red-600" role="alert">{paymentError}</p>
                ) : null}

                {couponEligible && !hasResumableOrder && !selectionLocked ? (
                  <Link
                    to="/survey"
                    className="mt-3 inline-flex w-full items-center justify-center border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-primary-200 hover:text-primary-700"
                  >
                    填写问卷获取优惠码
                  </Link>
                ) : null}
              </aside>
            </div>
          </>
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
