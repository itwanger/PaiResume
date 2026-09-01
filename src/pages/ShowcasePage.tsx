import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getMarketplaceOrderStatus,
  hasMarketplaceOrderAccess,
  type MarketplaceOrder,
  type MarketplaceOrderStatus,
} from '../api/marketplace'
import { publicApi } from '../api/public'
import {
  showcaseApi,
  type ShowcaseAiReview,
  type ShowcaseDetail,
} from '../api/showcase'
import { PreviewPanel } from '../components/editor/PreviewPanel'
import { Header } from '../components/layout/Header'
import { SiteFooter } from '../components/layout/SiteFooter'
import { useAuthStore } from '../store/authStore'
import {
  buildLoginPath,
  buildShowcasePath,
  EXCELLENT_RESUMES_PATH,
} from '../utils/navigation'
import { normalizeResumeStyle } from '../utils/resumeStyle'
import {
  getResumeFeatureBadgeClassName,
  getResumeFeatureBadgeTone,
  getResumeStyleFeatureBadges,
  type ResumeStyleFeatureBadge,
} from '../utils/resumeStyleLabels'
import {
  createShowcaseIdempotencyKey,
  getShowcasePurchaseToken,
} from '../utils/showcasePurchaseToken'
import { buildLockedShowcasePreviewModules } from '../utils/showcasePreviewModules'

const SHOWCASE_DETAIL_GRID_CLASS_NAME = 'showcase-detail-layout-grid grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'

function formatCurrency(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}

function ShowcaseBackLink() {
  return (
    <Link
      to={EXCELLENT_RESUMES_PATH}
      aria-label="返回优质简历"
      className="-ml-2 inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-sm font-medium text-slate-500 transition hover:bg-white/80 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm" aria-hidden="true">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
        </svg>
      </span>
      优质简历
    </Link>
  )
}

function ShowcaseDetailHero({
  detail,
  featureBadges,
}: {
  detail: ShowcaseDetail
  featureBadges: ResumeStyleFeatureBadge[]
}) {
  const hasFeatureLabels = Boolean(detail.scoreLabel || featureBadges.length)

  return (
    <header
      aria-label="优质简历详情头部"
      className="relative isolate mx-auto mb-4 max-w-[1280px] overflow-hidden"
    >
      <div className="pointer-events-none absolute -right-16 -top-24 -z-10 h-48 w-48 rounded-full bg-primary-100/55 blur-3xl" aria-hidden="true" />

      <div
        className={`${SHOWCASE_DETAIL_GRID_CLASS_NAME} showcase-detail-hero__columns lg:items-stretch`}
        role="group"
        aria-label="简历详情头部双栏"
      >
        <div className="showcase-detail-hero__column flex h-full min-w-0 flex-col" role="group" aria-label="简历名称与版式信息">
          <div className="flex flex-wrap items-center gap-1.5">
            <ShowcaseBackLink />

            {hasFeatureLabels ? (
              <div className="flex flex-wrap items-center gap-1.5" aria-label="简历定位与版式特点">
                {detail.scoreLabel ? (
                  <span
                    data-feature-category="position"
                    data-feature-tone={getResumeFeatureBadgeTone('position')}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${getResumeFeatureBadgeClassName('position')}`}
                  >
                    {detail.scoreLabel}
                  </span>
                ) : null}
                {featureBadges.map((badge) => (
                  <span
                    key={`${badge.category}-${badge.label}`}
                    data-feature-category={badge.category}
                    data-feature-tone={getResumeFeatureBadgeTone(badge.category)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${getResumeFeatureBadgeClassName(badge.category)}`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <h1 className="mt-1.5 min-w-0 break-words pl-9 text-xl font-semibold leading-tight tracking-[-0.02em] text-slate-950 sm:text-2xl">
            {detail.title}
          </h1>
        </div>

        {detail.summary ? (
          <div className="showcase-detail-hero__column flex h-full min-w-0 items-start" role="group" aria-label="简历简介栏">
            <p
              aria-label="简历简介"
              data-max-lines="3"
              className="showcase-detail-hero__summary--clamp-3 line-clamp-3 min-w-0 text-sm leading-6 text-slate-600"
              title={detail.summary}
            >
              {detail.summary}
            </p>
          </div>
        ) : null}
      </div>
    </header>
  )
}

function getMaskedNameFromPublicTitle(title: string): string {
  const separatorIndex = title.indexOf('-')
  if (separatorIndex <= 0) return ''
  const prefix = title.slice(0, separatorIndex).trim()
  return prefix.length <= 12 && /[xX*某]/.test(prefix) ? prefix : ''
}

function LockedShowcasePreview({ detail }: { detail: ShowcaseDetail }) {
  const resumeStyle = normalizeResumeStyle(detail)
  const previewModules = useMemo(
    () => buildLockedShowcasePreviewModules(
      detail.preview.name.trim()
        ? detail.preview
        : {
            ...detail.preview,
            name: getMaskedNameFromPublicTitle(detail.title),
          },
    ),
    [detail.preview, detail.title],
  )
  const lockTitle = detail.accessType === 'LOGIN'
    ? '完整版内容已隐藏'
    : '完整版简历需要支付后查看'
  const unlockHint = detail.accessType === 'LOGIN'
    ? '登录后可查看全部项目、经历与技能细节'
    : '包括全部项目经历、专业技能、实习经历、工作经历等'

  return (
    <article
      aria-label="完整简历内容已遮挡"
      className="relative max-h-[760px] w-full overflow-hidden bg-white"
    >
      <div aria-label="脱敏 PDF 简历预览">
        <PreviewPanel
          modules={previewModules}
          loading={false}
          forcedMode="pdf-standard"
          hideHeader
          pageMode={resumeStyle.pageMode}
          pdfConfig={resumeStyle}
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-72 items-start justify-center bg-gradient-to-b from-white/20 via-white/90 to-white px-6 pt-8 text-center">
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 0h10.5a2.25 2.25 0 0 1 2.25 2.25v6A2.25 2.25 0 0 1 17.25 21H6.75a2.25 2.25 0 0 1-2.25-2.25v-6a2.25 2.25 0 0 1 2.25-2.25Z" />
            </svg>
          </div>
          <p className="mt-3 text-lg font-semibold text-slate-950">{lockTitle}</p>
          <p className="mt-1 text-sm text-slate-600">{unlockHint}</p>
        </div>
      </div>
    </article>
  )
}

function ShowcaseAiReviewPanel({
  review,
}: {
  review: ShowcaseAiReview
}) {
  const score = Number.isFinite(review.overallScore)
    ? Math.max(0, Math.min(100, Math.round(review.overallScore)))
    : null
  const sections = review.sections?.filter((section) => (
    section.title?.trim() && section.reason?.trim()
  )) ?? []
  const improvements = review.improvements?.filter((item) => item?.trim()).slice(0, 3) ?? []
  const verdict = review.verdict?.trim()

  return (
    <aside
      aria-label="AI 精选点评"
      className="border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.38)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-primary-700">
            AI 简历点评
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-slate-950">
            为什么值得参考
          </h2>
        </div>
        {score != null ? (
          <div
            aria-label={`AI 综合评分 ${score} 分`}
            className="shrink-0 border-l border-primary-100 pl-4 text-right"
          >
            <span className="text-3xl font-semibold tracking-[-0.04em] text-primary-700">{score}</span>
            <span className="ml-1 text-xs text-slate-400">/ 100</span>
          </div>
        ) : null}
      </div>

      {verdict ? (
        <p className="mt-5 bg-primary-50/70 px-4 py-3 text-sm font-medium leading-6 text-slate-700">
          {verdict}
        </p>
      ) : null}

      {sections.length ? (
        <ol className="mt-5 divide-y divide-slate-100">
          {sections.map((section, index) => {
            const evidence = section.evidence?.filter((item) => item?.trim()).slice(0, 3) ?? []
            return (
              <li key={`${section.moduleType}-${section.title}-${index}`} className="py-5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                    {index + 1}
                  </span>
                  <h3 className="font-semibold text-slate-950">{section.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{section.reason}</p>
                {evidence.length ? (
                  <ul className="mt-3 space-y-2" aria-label={`${section.title}对应证据`}>
                    {evidence.map((item, evidenceIndex) => (
                      <li key={`${item}-${evidenceIndex}`} className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary-500" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ol>
      ) : null}

      {improvements.length ? (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <h3 className="text-sm font-semibold text-slate-950">还可以更好</h3>
          <ul className="mt-3 space-y-2">
            {improvements.map((item, index) => (
              <li key={`${item}-${index}`} className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  )
}

function formatDateTime(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('zh-CN', { hour12: false })
}

function getOrderStatusLabel(status: MarketplaceOrderStatus): string {
  const labels: Record<MarketplaceOrderStatus, string> = {
    CREATED: '订单已创建',
    PREPAYING: '二维码生成中',
    PREPAY_UNKNOWN: '订单状态待确认',
    PENDING: '等待支付',
    PAID: '支付成功',
    DUPLICATE_PAID: '重复支付待处理',
    REFUND_REQUIRED: '退款待处理',
    CLOSED: '订单已关闭',
    FAILED: '支付失败',
    EXPIRED: '二维码已过期',
    REFUNDED: '订单已退款',
  }
  return labels[status]
}

function ShowcasePaymentPanel({
  detail,
  order,
  purchasing,
  refreshing,
  error,
  refreshMessage,
  onCreate,
  onRefresh,
}: {
  detail: ShowcaseDetail
  order: MarketplaceOrder | null
  purchasing: boolean
  refreshing: boolean
  error: string
  refreshMessage: string
  onCreate: () => void
  onRefresh: () => void
}) {
  const status = order ? getMarketplaceOrderStatus(order) : null
  const paidOrder = order ? hasMarketplaceOrderAccess(order) : false
  const unlocked = paidOrder || !detail.locked
  const hasQrCode = status === 'PENDING' && Boolean(order?.qrCodeDataUrl)
  const canRefresh = order && status
    ? !unlocked && !['FAILED', 'CLOSED', 'EXPIRED', 'REFUNDED', 'REFUND_REQUIRED'].includes(status)
    : false
  const canCreate = detail.locked
    && detail.paymentEnabled
    && (!order || (status != null && ['FAILED', 'CLOSED', 'EXPIRED', 'REFUNDED'].includes(status)))

  return (
    <aside
      aria-label="简历支付信息"
      className="border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.38)] sm:p-6"
    >
      <p className="text-xs font-semibold tracking-[0.16em] text-primary-700">解锁完整简历</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
        {formatCurrency(order?.amountCents ?? detail.priceCents)}
      </p>

      {unlocked ? (
        <div className="mt-6 flex items-start gap-3 bg-emerald-50 px-4 py-4 text-emerald-950">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white" aria-hidden="true">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <div>
            <p className="font-semibold">
              {paidOrder ? '已支付，完整简历已解锁' : '已拥有完整简历查看权限'}
            </p>
            {order?.paidAt ? <p className="mt-1 text-sm text-emerald-800">支付时间 {formatDateTime(order.paidAt)}</p> : null}
          </div>
        </div>
      ) : hasQrCode ? (
        <div className="mt-6 text-center">
          <img
            src={order?.qrCodeDataUrl ?? ''}
            alt="微信支付二维码"
            className="mx-auto aspect-square w-full max-w-[248px] border border-slate-200 bg-white p-2"
          />
          <p className="mt-4 font-semibold text-slate-950">微信扫码支付</p>
          {order?.expiresAt ? (
            <p className="mt-1 text-sm text-slate-500">有效期至 {formatDateTime(order.expiresAt)}</p>
          ) : null}
        </div>
      ) : purchasing ? (
        <div className="mt-6 flex aspect-square w-full items-center justify-center bg-slate-50 text-sm text-slate-500">
          支付二维码生成中…
        </div>
      ) : !detail.paymentEnabled ? (
        <p className="mt-6 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">当前暂不可支付</p>
      ) : order ? (
        <div className="mt-6 bg-amber-50 px-4 py-5 text-sm leading-6 text-amber-900">
          {status === 'PREPAY_UNKNOWN'
            ? '支付平台返回结果待确认，请先查询订单状态。'
            : status === 'PENDING'
              ? '支付二维码已失效，请查询订单状态后重试。'
              : `当前状态：${getOrderStatusLabel(status ?? 'FAILED')}`}
        </div>
      ) : (
        <div className="mt-6 flex aspect-square w-full items-center justify-center bg-slate-50 text-sm text-slate-500">
          等待生成支付二维码
        </div>
      )}

      {order ? (
        <dl className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-sm">
          <div>
            <dt className="text-slate-500">订单号</dt>
            <dd className="mt-1 break-all font-medium text-slate-800">{order.orderNo}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">订单状态</dt>
            <dd className="font-medium text-slate-800">{getOrderStatusLabel(status ?? 'FAILED')}</dd>
          </div>
        </dl>
      ) : null}

      {error ? <p className="mt-4 text-sm leading-6 text-red-600" role="alert">{error}</p> : null}
      {refreshMessage ? (
        <p className="mt-4 text-sm leading-6 text-slate-600" role="status" aria-live="polite">
          {refreshMessage}
        </p>
      ) : null}

      {canRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="mt-6 inline-flex w-full items-center justify-center bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-wait disabled:bg-primary-300"
        >
          {refreshing ? '正在查询…' : hasQrCode ? '我已完成支付' : '查询订单状态'}
        </button>
      ) : canCreate ? (
        <button
          type="button"
          onClick={onCreate}
          disabled={purchasing}
          className="mt-6 inline-flex w-full items-center justify-center bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-wait disabled:bg-primary-300"
        >
          {purchasing ? '正在生成…' : '重新生成支付二维码'}
        </button>
      ) : null}
    </aside>
  )
}

export default function ShowcasePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { initialized, isAuthenticated } = useAuthStore()
  const [detail, setDetail] = useState<ShowcaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [order, setOrder] = useState<MarketplaceOrder | null>(null)
  const [purchasing, setPurchasing] = useState(false)
  const [refreshingOrder, setRefreshingOrder] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [orderRefreshMessage, setOrderRefreshMessage] = useState('')
  const [autoRefreshPaused, setAutoRefreshPaused] = useState(false)
  const orderRefreshInFlightRef = useRef<Promise<MarketplaceOrder> | null>(null)
  const orderBootstrapRef = useRef('')
  const resumeStyle = normalizeResumeStyle(detail)
  const featureBadges = detail ? getResumeStyleFeatureBadges(detail) : []
  const purchaseToken = getShowcasePurchaseToken()

  const loadDetail = useCallback(async (showLoading = true) => {
    if (!initialized || !slug) return
    if (showLoading) setLoading(true)
    try {
      setError('')
      const { data: res } = isAuthenticated
        ? await showcaseApi.detail(slug, purchaseToken)
        : await publicApi.showcaseDetail(slug, purchaseToken)
      setDetail(res.data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '样例加载失败')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [initialized, isAuthenticated, purchaseToken, slug])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const acceptPaidOrder = useCallback(async (nextOrder: MarketplaceOrder) => {
    setOrder(nextOrder)
    if (nextOrder.unlocked) {
      await loadDetail(false)
    }
  }, [loadDetail])

  const refreshPaymentOrder = useCallback((): Promise<MarketplaceOrder> | null => {
    if (!order) return null
    if (orderRefreshInFlightRef.current) return orderRefreshInFlightRef.current

    const request = Promise.resolve().then(async () => {
      const { data: response } = await showcaseApi.refreshOrder(order.orderNo, purchaseToken)
      const nextOrder = response.data
      await acceptPaidOrder(nextOrder)
      setPaymentError('')
      if (getMarketplaceOrderStatus(nextOrder) !== 'PENDING') {
        setOrderRefreshMessage('')
      }
      return nextOrder
    })
    orderRefreshInFlightRef.current = request
    const clearRequest = () => {
      if (orderRefreshInFlightRef.current === request) {
        orderRefreshInFlightRef.current = null
      }
    }
    void request.then(clearRequest, clearRequest)
    return request
  }, [acceptPaidOrder, order, purchaseToken])

  useEffect(() => {
    if (!order || autoRefreshPaused || hasMarketplaceOrderAccess(order)
      || ['FAILED', 'CLOSED', 'EXPIRED', 'REFUNDED', 'REFUND_REQUIRED'].includes(getMarketplaceOrderStatus(order))) {
      return
    }
    const timer = window.setInterval(() => {
      const request = refreshPaymentOrder()
      if (!request) return
      void request.catch(() => {
        // 自动确认失败后暂停轮询，保留当前订单供用户手动重试。
        setAutoRefreshPaused(true)
      })
    }, 2500)
    return () => window.clearInterval(timer)
  }, [autoRefreshPaused, order, refreshPaymentOrder])

  useEffect(() => {
    setAutoRefreshPaused(false)
  }, [order?.orderNo])

  const createPaymentOrder = useCallback(async () => {
    if (!detail || detail.accessType !== 'PAID' || purchasing || !detail.paymentEnabled) return

    setPurchasing(true)
    setPaymentError('')
    setOrderRefreshMessage('')
    try {
      const { data: response } = await showcaseApi.createOrder(
        slug,
        purchaseToken,
        createShowcaseIdempotencyKey(),
      )
      await acceptPaidOrder(response.data)
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : '支付订单创建失败')
    } finally {
      setPurchasing(false)
    }
  }, [acceptPaidOrder, detail, purchaseToken, purchasing, slug])

  useEffect(() => {
    if (!detail || detail.accessType !== 'PAID') return
    const bootstrapKey = `${detail.id}:${purchaseToken}`
    if (orderBootstrapRef.current === bootstrapKey) return
    orderBootstrapRef.current = bootstrapKey

    const bootstrapOrder = async () => {
      setPurchasing(true)
      setPaymentError('')
      setOrderRefreshMessage('')
      try {
        const { data: latestResponse } = await showcaseApi.latestOrder(slug, purchaseToken)
        if (orderBootstrapRef.current !== bootstrapKey) return
        const latestOrder = latestResponse.data
        if (latestOrder) {
          await acceptPaidOrder(latestOrder)
          const latestStatus = getMarketplaceOrderStatus(latestOrder)
          if (hasMarketplaceOrderAccess(latestOrder)
            || !detail.locked
            || !detail.paymentEnabled
            || !['FAILED', 'CLOSED', 'EXPIRED', 'REFUNDED'].includes(latestStatus)) {
            return
          }
        } else if (!detail.locked || !detail.paymentEnabled) {
          return
        }

        const { data: createResponse } = await showcaseApi.createOrder(
          slug,
          purchaseToken,
          createShowcaseIdempotencyKey(),
        )
        if (orderBootstrapRef.current === bootstrapKey) {
          await acceptPaidOrder(createResponse.data)
        }
      } catch (err: unknown) {
        if (orderBootstrapRef.current === bootstrapKey) {
          setPaymentError(err instanceof Error ? err.message : '支付订单加载失败')
        }
      } finally {
        if (orderBootstrapRef.current === bootstrapKey) setPurchasing(false)
      }
    }

    void bootstrapOrder()
  }, [acceptPaidOrder, detail, purchaseToken, slug])

  const handleRefreshOrder = async () => {
    if (!order || refreshingOrder) return
    setRefreshingOrder(true)
    setPaymentError('')
    setOrderRefreshMessage('')
    try {
      const nextOrder = await refreshPaymentOrder()
      if (!nextOrder) return
      setAutoRefreshPaused(false)
      const nextStatus = getMarketplaceOrderStatus(nextOrder)
      setOrderRefreshMessage(nextStatus === 'PENDING'
        ? '已查询，当前仍等待支付'
        : `已查询，${getOrderStatusLabel(nextStatus)}`)
    } catch (err: unknown) {
      setAutoRefreshPaused(true)
      setPaymentError(err instanceof Error ? err.message : '订单状态刷新失败')
    } finally {
      setRefreshingOrder(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        {!initialized || loading ? (
          <div className="text-sm text-gray-500">加载中...</div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : detail ? (
          <div>
            <ShowcaseDetailHero detail={detail} featureBadges={featureBadges} />

            <div className="mx-auto max-w-[1280px]">
              <div
                className={`${SHOWCASE_DETAIL_GRID_CLASS_NAME} lg:items-start`}
                role="group"
                aria-label="简历详情正文双栏"
              >
                <div className="min-w-0" role="region" aria-label="简历预览主栏">
                  {detail.locked ? (
                    <LockedShowcasePreview detail={detail} />
                  ) : (
                    <PreviewPanel
                      modules={detail.modules}
                      loading={false}
                      forcedMode="pdf-standard"
                      hideHeader
                      pageMode={resumeStyle.pageMode}
                      pdfConfig={resumeStyle}
                    />
                  )}
                </div>

                <div className="min-w-0 space-y-6" role="complementary" aria-label="简历支付与点评侧栏">
                  {detail.accessType === 'PAID' ? (
                    <ShowcasePaymentPanel
                      detail={detail}
                      order={order}
                      purchasing={purchasing}
                      refreshing={refreshingOrder}
                      error={paymentError}
                      refreshMessage={orderRefreshMessage}
                      onCreate={() => void createPaymentOrder()}
                      onRefresh={() => void handleRefreshOrder()}
                    />
                  ) : null}

                  {detail.aiReview ? (
                    <ShowcaseAiReviewPanel review={detail.aiReview} />
                  ) : null}

                  {detail.accessType !== 'PAID' && detail.locked ? (
                    <button
                      type="button"
                      onClick={() => navigate(buildLoginPath(buildShowcasePath(slug)))}
                      className="inline-flex w-full items-center justify-center bg-primary-600 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-primary-700"
                    >
                      登录后查看
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  )
}
