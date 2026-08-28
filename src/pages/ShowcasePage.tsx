import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { MarketplaceOrder } from '../api/marketplace'
import { publicApi } from '../api/public'
import { showcaseApi, type ShowcaseDetail } from '../api/showcase'
import {
  EMPTY_RESUME_CARD_PREVIEW,
  ResumeContentThumbnail,
} from '../components/dashboard/ResumeCard'
import { PreviewPanel } from '../components/editor/PreviewPanel'
import { Header } from '../components/layout/Header'
import { SiteFooter } from '../components/layout/SiteFooter'
import { PaymentQrModal } from '../components/marketplace/PaymentQrModal'
import { useAuthStore } from '../store/authStore'
import {
  buildLoginPath,
  buildShowcasePath,
  EXCELLENT_RESUMES_PATH,
} from '../utils/navigation'
import { normalizeResumeStyle } from '../utils/resumeStyle'
import { getResumeStyleFeatureLabels } from '../utils/resumeStyleLabels'
import {
  createShowcaseIdempotencyKey,
  getShowcasePurchaseToken,
} from '../utils/showcasePurchaseToken'

function formatCurrency(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}

function ShowcaseBackLink() {
  return (
    <Link
      to={EXCELLENT_RESUMES_PATH}
      aria-label="返回优质简历"
      className="-ml-2 inline-flex min-h-10 items-center gap-2 rounded-full px-2 text-sm font-medium text-slate-500 transition hover:bg-white/80 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
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
  featureLabels,
}: {
  detail: ShowcaseDetail
  featureLabels: string[]
}) {
  return (
    <header className="relative isolate mx-auto mb-8 max-w-[1120px] overflow-hidden border-b border-slate-200/80 pb-8 sm:pb-10">
      <div className="pointer-events-none absolute -right-20 -top-24 -z-10 h-64 w-64 rounded-full bg-primary-100/60 blur-3xl" aria-hidden="true" />
      <ShowcaseBackLink />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-primary-700">
          <span className="h-px w-7 bg-primary-600" aria-hidden="true" />
          官方精选
        </span>
        {detail.scoreLabel ? (
          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 ring-1 ring-inset ring-primary-100">
            {detail.scoreLabel}
          </span>
        ) : null}
      </div>

      <h1 className="mt-4 max-w-5xl break-words text-3xl font-semibold leading-tight tracking-[-0.025em] text-slate-950 sm:text-4xl sm:leading-tight">
        {detail.title}
      </h1>

      {detail.summary ? (
        <p className="mt-5 max-w-5xl text-base leading-8 text-slate-600 sm:text-lg sm:leading-8">
          {detail.summary}
        </p>
      ) : null}

      {featureLabels.length ? (
        <div className="mt-6 flex flex-wrap gap-2.5" aria-label="简历版式特点">
          {featureLabels.map((label) => (
            <span key={label} className="rounded-full border border-slate-200/90 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-sm">
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </header>
  )
}

function LockedShowcaseCard({
  detail,
  featureLabels,
  purchasing,
  paymentError,
  onUnlock,
}: {
  detail: ShowcaseDetail
  featureLabels: string[]
  purchasing: boolean
  paymentError: string
  onUnlock: () => void
}) {
  return (
    <article className="mx-auto w-full max-w-[900px] overflow-hidden border border-slate-200 bg-white shadow-[0_24px_70px_-42px_rgba(15,23,42,0.38)]">
      <div className="border-b border-slate-100 px-5 pt-5 sm:px-8 sm:pt-8 lg:px-10 lg:pt-10">
        <ResumeContentThumbnail
          preview={detail.preview ?? EMPTY_RESUME_CARD_PREVIEW}
          resume={detail}
        />
      </div>
      <div className="p-5 sm:p-8 lg:p-10">
        <h1 className="break-words text-2xl font-semibold leading-9 text-slate-950 sm:text-3xl">
          {detail.title}
        </h1>
        <p className="mt-2 text-base font-medium text-primary-700">{detail.scoreLabel}</p>
        {detail.summary ? <p className="mt-5 text-base leading-8 text-slate-600">{detail.summary}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          {featureLabels.map((label) => (
            <span key={label} className="bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
              {label}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={onUnlock}
          disabled={purchasing || (detail.accessType === 'PAID' && !detail.paymentEnabled)}
          className="mt-8 inline-flex w-full items-center justify-center bg-primary-600 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {detail.accessType === 'LOGIN'
            ? '登录后查看'
            : purchasing
              ? '正在创建订单…'
              : detail.paymentEnabled
                ? `${formatCurrency(detail.priceCents)} 解锁完整简历`
                : '暂不可支付'}
        </button>
        {paymentError ? <p className="mt-3 text-sm text-red-600" role="alert">{paymentError}</p> : null}
      </div>
    </article>
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
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [refreshingOrder, setRefreshingOrder] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const pollingRef = useRef(false)
  const resumeStyle = normalizeResumeStyle(detail)
  const featureLabels = detail ? getResumeStyleFeatureLabels(detail) : []
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

  useEffect(() => {
    if (!paymentOpen || !order || order.unlocked
      || ['FAILED', 'CLOSED', 'EXPIRED', 'REFUNDED', 'REFUND_REQUIRED'].includes(order.orderStatus)) {
      return
    }
    const timer = window.setInterval(async () => {
      if (pollingRef.current) return
      pollingRef.current = true
      try {
        const { data: response } = await showcaseApi.refreshOrder(order.orderNo, purchaseToken)
        await acceptPaidOrder(response.data)
      } catch {
        // 自动确认失败时保留当前二维码，用户仍可手动确认。
      } finally {
        pollingRef.current = false
      }
    }, 2500)
    return () => window.clearInterval(timer)
  }, [acceptPaidOrder, order, paymentOpen, purchaseToken])

  const handleUnlock = async () => {
    const returnTo = buildShowcasePath(slug)
    if (detail?.accessType === 'LOGIN') {
      navigate(buildLoginPath(returnTo))
      return
    }
    if (!detail || detail.accessType !== 'PAID' || purchasing || !detail.paymentEnabled) return

    setPurchasing(true)
    setPaymentError('')
    try {
      const { data: response } = await showcaseApi.createOrder(
        slug,
        purchaseToken,
        createShowcaseIdempotencyKey(),
      )
      setPaymentOpen(true)
      await acceptPaidOrder(response.data)
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : '支付订单创建失败')
    } finally {
      setPurchasing(false)
    }
  }

  const handleRefreshOrder = async () => {
    if (!order || refreshingOrder) return
    setRefreshingOrder(true)
    setPaymentError('')
    try {
      const { data: response } = await showcaseApi.refreshOrder(order.orderNo, purchaseToken)
      await acceptPaidOrder(response.data)
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : '订单状态刷新失败')
    } finally {
      setRefreshingOrder(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {!initialized || loading ? (
          <div className="text-sm text-gray-500">加载中...</div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : detail ? (
          <div>
            {detail.locked ? (
              <div className="mx-auto mb-3 max-w-[900px]">
                <ShowcaseBackLink />
              </div>
            ) : (
              <ShowcaseDetailHero detail={detail} featureLabels={featureLabels} />
            )}

            {detail.locked ? (
              <LockedShowcaseCard
                detail={detail}
                featureLabels={featureLabels}
                purchasing={purchasing}
                paymentError={paymentError}
                onUnlock={() => void handleUnlock()}
              />
            ) : (
              <div className="mx-auto max-w-[1120px]">
                <PreviewPanel
                  modules={detail.modules}
                  loading={false}
                  forcedMode="pdf-standard"
                  hideHeader
                  pageMode={resumeStyle.pageMode}
                  pdfConfig={resumeStyle}
                />
              </div>
            )}
          </div>
        ) : null}
      </main>

      <SiteFooter />
      <PaymentQrModal
        open={paymentOpen}
        order={order}
        refreshing={refreshingOrder}
        error={paymentError}
        showMarketplaceSettlementNotice={false}
        onClose={() => setPaymentOpen(false)}
        onRefresh={() => void handleRefreshOrder()}
      />
    </div>
  )
}
