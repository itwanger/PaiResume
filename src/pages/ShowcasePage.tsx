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
import { getShowcaseAccessLabel } from '../utils/showcaseAccess'
import {
  createShowcaseIdempotencyKey,
  getShowcasePurchaseToken,
} from '../utils/showcasePurchaseToken'

function formatCurrency(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}

function LockedResumePreview({ detail }: { detail: ShowcaseDetail }) {
  const unlockHint = detail.accessType === 'LOGIN'
    ? '登录后可查看全部项目、经历与技能细节'
    : '付费后可查看全部项目、经历与技能细节'

  return (
    <div className="mx-auto w-full max-w-[820px] overflow-hidden border border-slate-200 bg-white shadow-[0_24px_70px_-42px_rgba(15,23,42,0.38)]">
      <div className="px-8 pt-8 sm:px-12 sm:pt-12">
        <ResumeContentThumbnail
          preview={detail.preview ?? EMPTY_RESUME_CARD_PREVIEW}
          resume={detail}
        />
      </div>
      <div className="relative min-h-80 overflow-hidden border-t border-slate-100 px-8 py-10 sm:px-12">
        <div aria-hidden="true" className="space-y-8 opacity-55 blur-[3px]">
          {[0, 1, 2].map((section) => (
            <div key={section}>
              <div className="h-3 w-28 bg-slate-300" />
              <div className="mt-3 space-y-2">
                <div className="h-2.5 w-full bg-slate-200" />
                <div className="h-2.5 w-11/12 bg-slate-200" />
                <div className="h-2.5 w-4/5 bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/20 via-white/72 to-white px-6 text-center">
          <div>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 0h10.5a2.25 2.25 0 0 1 2.25 2.25v6A2.25 2.25 0 0 1 17.25 21H6.75a2.25 2.25 0 0 1-2.25-2.25v-6a2.25 2.25 0 0 1 2.25-2.25Z" />
              </svg>
            </div>
            <p className="mt-4 text-lg font-semibold text-slate-950">完整版内容已隐藏</p>
            <p className="mt-1 text-sm text-slate-600">{unlockHint}</p>
          </div>
        </div>
      </div>
    </div>
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

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link to={EXCELLENT_RESUMES_PATH} className="text-sm text-primary-700 transition-colors hover:text-primary-800">
          返回优质简历
        </Link>

        {!initialized || loading ? (
          <div className="mt-8 text-sm text-gray-500">加载中...</div>
        ) : error ? (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : detail ? (
          <div className="mt-7">
            <div className="mx-auto mb-6 max-w-[1120px]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-primary-700">{detail.scoreLabel}</span>
                    <span className={detail.accessType === 'PAID'
                      ? 'bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200'
                      : detail.accessType === 'LOGIN'
                        ? 'bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-200'
                        : 'bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200'}>
                      {getShowcaseAccessLabel(detail.accessType)}
                    </span>
                  </div>
                  <h1 className="mt-2 break-words text-2xl font-semibold text-gray-900">{detail.title}</h1>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {featureLabels.map((label) => (
                    <span key={label} className="bg-white px-2.5 py-1 text-xs text-gray-600 ring-1 ring-inset ring-gray-200">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              {detail.summary ? <p className="mt-3 text-sm leading-6 text-gray-600">{detail.summary}</p> : null}
            </div>

            {detail.locked ? (
              <div className="mx-auto grid max-w-[1120px] gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                <LockedResumePreview detail={detail} />
                <aside className={`border bg-white p-6 shadow-sm lg:sticky lg:top-24 ${
                  detail.accessType === 'LOGIN' ? 'border-sky-200' : 'border-amber-200'
                }`}>
                  <div className={`text-sm font-semibold ${
                    detail.accessType === 'LOGIN' ? 'text-sky-700' : 'text-amber-700'
                  }`}>
                    {detail.accessType === 'PAID'
                      ? `${formatCurrency(detail.priceCents)} 付费查看`
                      : getShowcaseAccessLabel(detail.accessType)}
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    {detail.accessType === 'LOGIN' ? '登录后查看完整简历' : '支付后解锁这份简历'}
                  </h2>
                  {detail.accessType === 'PAID' ? (
                    <p className="mt-4 text-2xl font-bold text-slate-950">
                      {formatCurrency(detail.priceCents)}
                      <span className="ml-1 text-sm font-normal text-slate-500">单份解锁</span>
                    </p>
                  ) : null}
                  <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                    <li>查看这份简历的完整项目、经历与技能内容</li>
                    {detail.accessType === 'PAID' ? (
                      <>
                        <li>无需先登录，直接扫码支付</li>
                        <li>支付成功后本页自动显示完整版</li>
                      </>
                    ) : (
                      <li>登录成功后自动返回本页并显示完整版</li>
                    )}
                  </ul>
                  <button
                    type="button"
                    onClick={() => void handleUnlock()}
                    disabled={purchasing || (detail.accessType === 'PAID' && !detail.paymentEnabled)}
                    className="mt-6 inline-flex w-full items-center justify-center bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {detail.accessType === 'LOGIN'
                      ? '登录后查看'
                      : purchasing
                        ? '正在创建订单…'
                        : detail.paymentEnabled
                          ? `立即支付 ${formatCurrency(detail.priceCents)}`
                          : '暂不可支付'}
                  </button>
                  {paymentError ? <p className="mt-3 text-sm text-red-600" role="alert">{paymentError}</p> : null}
                </aside>
              </div>
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
