import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getMarketplaceOrderStatus,
  hasMarketplaceAccess,
  hasMarketplaceOrderAccess,
  marketplaceApi,
  type MarketplaceAccess,
  type MarketplaceContent,
  type MarketplaceListingOffer,
  type MarketplaceOrder,
  type MarketplaceReportType,
} from '../api/marketplace'
import type { ResumeModule } from '../api/resume'
import { Header } from '../components/layout/Header'
import { SiteFooter } from '../components/layout/SiteFooter'
import { PaymentQrModal } from '../components/marketplace/PaymentQrModal'
import { ExcellentResumePreview } from '../components/showcase/ExcellentResumePreview'
import { useAuthStore } from '../store/authStore'
import {
  buildLoginPath,
  buildMarketplaceListingPath,
  EXCELLENT_RESUMES_PATH,
} from '../utils/navigation'

function formatCurrency(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `marketplace-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function toResumeModules(content: MarketplaceContent): ResumeModule[] {
  const timestamp = new Date().toISOString()
  return content.modules.map((module, index) => ({
    id: -(index + 1),
    resumeId: 0,
    moduleType: module.moduleType,
    content: module.content,
    sortOrder: module.sortOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))
}

function getAccessDescription(access: MarketplaceAccess | null): string {
  if (!access) return ''

  const descriptions: Record<string, string> = {
    OWNER: '这是你公开的简历，可直接查看。',
    ADMIN: '管理员账号可直接查看。',
    FREE: '作者已将这份简历免费公开。',
    PURCHASED: '当前账号已购买，可查看已购版本。',
    PAYMENT_REQUIRED: '购买后在内容正常展示期间可持续查看，刷新页面不会重复收费。',
  }

  return descriptions[access.accessStatus]
}

const REPORT_TYPE_OPTIONS: Array<{ value: MarketplaceReportType; label: string }> = [
  { value: 'PRIVACY', label: '泄露个人隐私' },
  { value: 'COPYRIGHT', label: '抄袭或侵权' },
  { value: 'FRAUD', label: '欺诈或虚假交易' },
  { value: 'MISLEADING', label: '误导性内容' },
  { value: 'ILLEGAL', label: '违法违规内容' },
  { value: 'OTHER', label: '其他问题' },
]

export default function MarketplaceResumePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { initialized, isAuthenticated } = useAuthStore()
  const [offer, setOffer] = useState<MarketplaceListingOffer | null>(null)
  const [access, setAccess] = useState<MarketplaceAccess | null>(null)
  const [content, setContent] = useState<MarketplaceContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [purchasing, setPurchasing] = useState(false)
  const [order, setOrder] = useState<MarketplaceOrder | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [refreshingOrder, setRefreshingOrder] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportType, setReportType] = useState<MarketplaceReportType>('PRIVACY')
  const [reportDescription, setReportDescription] = useState('')
  const [reportContact, setReportContact] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportError, setReportError] = useState('')
  const [reportReceiptId, setReportReceiptId] = useState<number | null>(null)
  const pollingRef = useRef(false)
  const recordedViewRef = useRef<string | null>(null)

  const loadAuthorizedContent = useCallback(async () => {
    const { data: response } = await marketplaceApi.content(slug)
    setContent(response.data)
  }, [slug])

  const loadPage = useCallback(async () => {
    if (!slug || !initialized) return

    setLoading(true)
    setError('')
    setAccess(null)
    setContent(null)

    try {
      if (isAuthenticated) {
        const { data: accessResponse } = await marketplaceApi.access(slug)
        const nextAccess = accessResponse.data
        setAccess(nextAccess)
        if (hasMarketplaceAccess(nextAccess)) {
          const { data: contentResponse } = await marketplaceApi.content(slug)
          setContent(contentResponse.data)
          setOffer(contentResponse.data)
          return
        }
      }

      const { data: offerResponse } = await marketplaceApi.publicOffer(slug)
      const nextOffer = offerResponse.data
      setOffer(nextOffer)

      if (nextOffer.accessType !== 'FREE') {
        return
      }

      const { data: contentResponse } = await marketplaceApi.publicContent(slug)
      setContent(contentResponse.data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '公开简历加载失败')
    } finally {
      setLoading(false)
    }
  }, [initialized, isAuthenticated, slug])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  useEffect(() => {
    if (!slug || recordedViewRef.current === slug) return

    recordedViewRef.current = slug
    void marketplaceApi.recordView(slug).catch((err: unknown) => {
      if (import.meta.env.DEV) {
        console.warn('[marketplace] Failed to record listing view', err instanceof Error ? err.name : 'Error')
      }
    })
  }, [slug])

  const handlePaidOrder = useCallback(async (nextOrder: MarketplaceOrder) => {
    setOrder(nextOrder)
    if (!hasMarketplaceOrderAccess(nextOrder)) {
      if (nextOrder.orderStatus === 'REFUNDED') {
        setContent(null)
        setAccess(null)
      }
      return
    }

    setPaymentError('')
    try {
      await loadAuthorizedContent()
      const { data: accessResponse } = await marketplaceApi.access(slug)
      setAccess(accessResponse.data)
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : '支付成功，但完整简历加载失败，请稍后刷新页面')
    }
  }, [loadAuthorizedContent, slug])

  useEffect(() => {
    if (!paymentOpen || !order || hasMarketplaceOrderAccess(order)) return
    if ([
      'FAILED',
      'CLOSED',
      'EXPIRED',
      'REFUNDED',
      'PREPAY_UNKNOWN',
      'REFUND_REQUIRED',
      'DUPLICATE_PAID',
    ].includes(getMarketplaceOrderStatus(order))) return

    const timer = window.setInterval(async () => {
      if (pollingRef.current) return

      pollingRef.current = true
      try {
        const { data: response } = await marketplaceApi.order(order.orderNo)
        await handlePaidOrder(response.data)
      } catch {
        // 自动轮询失败不打断用户，仍可使用“我已完成支付”主动向支付平台确认。
      } finally {
        pollingRef.current = false
      }
    }, 2500)

    return () => window.clearInterval(timer)
  }, [handlePaidOrder, order, paymentOpen])

  const handlePurchase = async () => {
    const returnTo = buildMarketplaceListingPath(slug)
    if (!isAuthenticated) {
      navigate(buildLoginPath(returnTo))
      return
    }

    setPurchasing(true)
    setPaymentError('')
    try {
      const { data: response } = await marketplaceApi.createOrder(slug, createIdempotencyKey())
      const nextOrder = response.data
      setOrder(nextOrder)
      setPaymentOpen(true)
      await handlePaidOrder(nextOrder)
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
      const { data: response } = await marketplaceApi.refreshOrder(order.orderNo)
      await handlePaidOrder(response.data)
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : '订单状态刷新失败')
    } finally {
      setRefreshingOrder(false)
    }
  }

  const openReportDialog = () => {
    setReportType('PRIVACY')
    setReportDescription('')
    setReportContact('')
    setReportError('')
    setReportReceiptId(null)
    setReportOpen(true)
  }

  const handleSubmitReport = async () => {
    if (reportSubmitting) return

    const description = reportDescription.trim()
    if (description.length < 10) {
      setReportError('请至少填写 10 个字符，说明具体问题和可核验线索。')
      return
    }

    setReportSubmitting(true)
    setReportError('')
    try {
      const { data: response } = await marketplaceApi.submitReport(slug, {
        type: reportType,
        description,
        contact: reportContact.trim() || undefined,
      })
      setReportReceiptId(response.data.id)
    } catch (err: unknown) {
      setReportError(err instanceof Error ? err.message : '投诉提交失败，请稍后再试')
    } finally {
      setReportSubmitting(false)
    }
  }

  const paymentEnabled = access?.paymentEnabled ?? offer?.paymentEnabled ?? false
  const canView = Boolean(content) || (access ? hasMarketplaceAccess(access) : offer?.accessType === 'FREE')
  const modules = content ? toResumeModules(content) : []

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Link to={EXCELLENT_RESUMES_PATH} className="text-sm font-medium text-primary-700 transition hover:text-primary-800">
          返回优质简历
        </Link>

        {loading ? (
          <div className="mt-8 grid gap-8 lg:grid-cols-[330px_minmax(0,1fr)]">
            <div className="h-80 animate-pulse rounded-2xl bg-white" />
            <div className="aspect-[210/297] animate-pulse bg-white" />
          </div>
        ) : error ? (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700" role="alert">
            {error}
          </div>
        ) : offer ? (
          <div className="mt-8 grid gap-8 lg:grid-cols-[330px_minmax(0,1fr)] lg:items-start">
            <aside className="space-y-5 lg:sticky lg:top-24">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={offer.accessType === 'FREE'
                    ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700'
                    : 'rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700'}>
                    {offer.accessType === 'FREE' ? '免费公开' : `${formatCurrency(offer.priceCents)} 解锁`}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">用户公开</span>
                </div>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{offer.title}</h1>
                <p className="mt-4 text-sm leading-6 text-slate-600">{offer.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(offer.tags ?? []).map((tag) => (
                    <span key={tag} className="rounded-full bg-primary-50 px-3 py-1 text-xs text-primary-700">{tag}</span>
                  ))}
                </div>

                {canView ? (
                  <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
                    {offer.accessType === 'FREE' ? '作者已免费公开完整简历。' : getAccessDescription(access)}
                  </div>
                ) : !isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => navigate(buildLoginPath(buildMarketplaceListingPath(slug)))}
                    className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-primary-700"
                  >
                    登录后购买查看
                  </button>
                ) : paymentEnabled ? (
                  <button
                    type="button"
                    onClick={() => void handlePurchase()}
                    disabled={purchasing}
                    className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    {purchasing ? '正在创建支付订单...' : `${formatCurrency(offer.priceCents)} 购买查看权`}
                  </button>
                ) : (
                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                    在线支付暂未启用，这份付费简历目前无法购买，请稍后再试。
                  </div>
                )}

                {paymentError && !paymentOpen ? (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                    {paymentError}
                  </div>
                ) : null}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
                <h2 className="font-semibold text-slate-900">查看与结算说明</h2>
                <ul className="mt-3 space-y-2">
                  <li>• 付费简历购买一次后，内容正常展示期间当前账号可持续查看。</li>
                  <li>• VIP 仅覆盖平台设置为付费查看的优质简历，不免用户发布的付费简历。</li>
                  <li>• 违规内容被平台暂停后，包括历史买家在内的非作者访问都会被阻止。</li>
                  <li>• 支付款项进入平台商户，作者收益由平台记录，作者可申请线下结算。</li>
                </ul>
                <button
                  type="button"
                  onClick={openReportDialog}
                  className="mt-4 inline-flex text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-red-700"
                >
                  举报内容或提交侵权投诉
                </button>
              </section>
            </aside>

            <section>
              {content ? (
                <ExcellentResumePreview modules={modules} />
              ) : (
                <div className="flex min-h-[620px] items-center justify-center border border-slate-200 bg-white px-6 py-20 text-center shadow-sm">
                  <div className="max-w-md">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 0h10.5A2.25 2.25 0 0119.5 12.75v6A2.25 2.25 0 0117.25 21H6.75a2.25 2.25 0 01-2.25-2.25v-6a2.25 2.25 0 012.25-2.25z" />
                      </svg>
                    </div>
                    <h2 className="mt-5 text-xl font-semibold text-slate-950">完整简历尚未解锁</h2>
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </main>

      <PaymentQrModal
        open={paymentOpen}
        order={order}
        refreshing={refreshingOrder}
        error={paymentError}
        onRefresh={() => void handleRefreshOrder()}
        onClose={() => setPaymentOpen(false)}
      />

      {reportOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketplace-report-title"
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="marketplace-report-title" className="text-xl font-semibold text-slate-950">举报与侵权投诉</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  请提供具体事实或可核验线索。平台只将联系方式用于跟进本次投诉。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                disabled={reportSubmitting}
                aria-label="关闭投诉表单"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {reportReceiptId !== null ? (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-800" role="status">
                投诉已提交，受理编号为 #{reportReceiptId}。平台会在后台完成核验和处理。
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div>
                  <label htmlFor="marketplace-report-type" className="block text-sm font-medium text-slate-800">问题类型</label>
                  <select
                    id="marketplace-report-type"
                    value={reportType}
                    onChange={(event) => setReportType(event.target.value as MarketplaceReportType)}
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  >
                    {REPORT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="marketplace-report-description" className="block text-sm font-medium text-slate-800">问题说明</label>
                  <textarea
                    id="marketplace-report-description"
                    rows={5}
                    minLength={10}
                    maxLength={1000}
                    value={reportDescription}
                    onChange={(event) => setReportDescription(event.target.value)}
                    placeholder="请说明具体内容、权利归属或其他可核验线索。"
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm leading-6 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  />
                  <p className="mt-1 text-right text-xs text-slate-400">{reportDescription.length}/1000</p>
                </div>

                <div>
                  <label htmlFor="marketplace-report-contact" className="block text-sm font-medium text-slate-800">联系方式（选填）</label>
                  <input
                    id="marketplace-report-contact"
                    type="text"
                    maxLength={255}
                    value={reportContact}
                    onChange={(event) => setReportContact(event.target.value)}
                    placeholder="邮箱、手机号或其他可联系到你的方式"
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  />
                </div>

                {reportError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{reportError}</div>
                ) : null}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                disabled={reportSubmitting}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {reportReceiptId !== null ? '完成' : '取消'}
              </button>
              {reportReceiptId === null ? (
                <button
                  type="button"
                  onClick={() => void handleSubmitReport()}
                  disabled={reportSubmitting}
                  className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {reportSubmitting ? '正在提交...' : '提交投诉'}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      <SiteFooter />
    </div>
  )
}
