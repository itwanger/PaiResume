import { useEffect, useMemo, useRef, useState } from 'react'
import type { MembershipOrder, MembershipOrderStatus } from '../../api/membership'

interface MembershipPaymentModalProps {
  open: boolean
  order: MembershipOrder | null
  refreshing: boolean
  error?: string
  onClose: () => void
  onRefresh: () => void
}

const ACTIVE_STATUSES: MembershipOrderStatus[] = ['CREATED', 'PREPAYING', 'PENDING']

function formatCents(value: number): string {
  return `¥${(value / 100).toFixed(2)}`
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getStatusLabel(status: MembershipOrderStatus): string {
  const labels: Record<MembershipOrderStatus, string> = {
    CREATED: '订单已创建',
    PREPAYING: '正在生成支付二维码',
    PREPAY_UNKNOWN: '支付状态待确认',
    PENDING: '等待支付',
    PAID: '支付成功',
    EXPIRED: '已超时，待确认关单',
    CANCELED: '订单已取消',
    REFUND_REQUIRED: '支付异常，待人工退款',
  }
  return labels[status]
}

export function MembershipPaymentModal({
  open,
  order,
  refreshing,
  error,
  onClose,
  onRefresh,
}: MembershipPaymentModalProps) {
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)
  const autoRefreshOrderRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open) return

    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [open, order?.orderNo])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  useEffect(() => {
    setCopied(false)
  }, [order?.orderNo])

  const expiresAtMs = useMemo(() => {
    if (!order?.expiresAt) return null
    const value = new Date(order.expiresAt).getTime()
    return Number.isNaN(value) ? null : value
  }, [order?.expiresAt])
  const remainingSeconds = expiresAtMs === null
    ? null
    : Math.max(0, Math.ceil((expiresAtMs - now) / 1000))
  const locallyTimedOut = Boolean(
    order
    && ACTIVE_STATUSES.includes(order.orderStatus)
    && remainingSeconds === 0,
  )

  useEffect(() => {
    if (!order || !locallyTimedOut || autoRefreshOrderRef.current === order.orderNo) return
    autoRefreshOrderRef.current = order.orderNo
    onRefresh()
  }, [locallyTimedOut, onRefresh, order])

  if (!open || !order) return null

  const { orderStatus } = order
  const paid = orderStatus === 'PAID'
  const canceled = orderStatus === 'CANCELED'
  const expired = orderStatus === 'EXPIRED'
  const prepayUnknown = orderStatus === 'PREPAY_UNKNOWN'
  const refundRequired = orderStatus === 'REFUND_REQUIRED'
  const active = ACTIVE_STATUSES.includes(orderStatus) && !locallyTimedOut
  const showPaymentCode = active && order.payableAmountCents > 0
  const canRefresh = !paid && !canceled && !refundRequired

  const copyCodeUrl = async () => {
    if (!order.codeUrl) return
    try {
      await navigator.clipboard.writeText(order.codeUrl)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="membership-payment-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary-600">微信支付 · VIP 会员</p>
            <h2 id="membership-payment-title" className="mt-1 text-xl font-semibold text-slate-950">
              {paid
                ? 'VIP 已开通'
                : canceled
                  ? '订单已取消'
                  : refundRequired
                    ? '本笔支付需要人工处理'
                    : expired || locallyTimedOut
                      ? '支付时间已结束'
                      : prepayUnknown
                        ? '支付订单状态待确认'
                        : `开通 ${order.membershipDays} 天 VIP`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="关闭支付窗口"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-6 sm:px-6">
          {paid ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="mt-4 text-lg font-semibold text-emerald-950">支付成功，已开通 {order.membershipDays} 天 VIP</p>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                {order.membershipExpiresAt
                  ? `会员有效期至 ${new Date(order.membershipExpiresAt).toLocaleString('zh-CN')}，正在刷新账号权益并返回原页面。`
                  : '正在刷新账号权益并返回原页面。'}
              </p>
            </div>
          ) : canceled ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-7 text-center">
              <p className="text-lg font-semibold text-slate-950">订单已由支付平台确认取消</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">这笔订单未完成付款，旧二维码已经失效。关闭窗口后可重新下单。</p>
            </div>
          ) : refundRequired ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-7 text-center">
              <p className="text-lg font-semibold text-red-950">支付结果需要人工核对</p>
              <p className="mt-2 text-sm leading-6 text-red-800">
                支付平台返回了需要退款处理的结果。请勿再次付款，并联系客服提供订单号；当前提示不代表退款已经到账。
              </p>
              {order.paymentReviewReason ? (
                <p className="mt-3 text-xs leading-5 text-red-700">复核说明：{order.paymentReviewReason}</p>
              ) : null}
            </div>
          ) : expired || locallyTimedOut ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-7 text-center">
              <p className="text-lg font-semibold text-amber-950">30 分钟支付时间已结束</p>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                服务端正在向支付平台确认最后状态并关闭订单。超时本身不能证明支付失败，请先刷新确认；仅当状态变为“订单已取消”后再重新下单。
              </p>
            </div>
          ) : prepayUnknown ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-7 text-center">
              <p className="text-lg font-semibold text-amber-950">暂时无法确认支付订单状态</p>
              <p className="mt-2 text-sm leading-6 text-amber-800">请勿重复支付。可以主动刷新订单状态，仍无法确认时请稍后重试或联系客服。</p>
            </div>
          ) : showPaymentCode ? (
            <>
              <div className="mx-auto flex min-h-[264px] w-full max-w-[264px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                {order.qrCodeDataUrl ? (
                  <img src={order.qrCodeDataUrl} alt="微信支付二维码" className="h-full w-full object-contain" />
                ) : order.codeUrl ? (
                  <div className="px-3 text-center">
                    <p className="text-sm font-medium text-slate-800">二维码图片暂未生成</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">请稍后刷新；开发排查时也可复制支付码。</p>
                    <button
                      type="button"
                      onClick={() => void copyCodeUrl()}
                      className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {copied ? '已复制支付码' : '复制支付码'}
                    </button>
                  </div>
                ) : (
                  <p className="px-4 text-center text-sm leading-6 text-slate-500">支付二维码生成中，请稍后刷新订单状态。</p>
                )}
              </div>
              <div className="mt-5 text-center">
                <p className="text-sm font-medium text-slate-900">请使用微信扫一扫完成支付</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{formatCents(order.payableAmountCents)}</p>
                {remainingSeconds !== null ? (
                  <p className="mt-2 text-sm font-medium text-amber-700">剩余支付时间 {formatCountdown(remainingSeconds)}</p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-primary-200 bg-primary-50 px-5 py-7 text-center">
              <p className="text-lg font-semibold text-primary-950">正在确认会员开通结果</p>
              <p className="mt-2 text-sm leading-6 text-primary-800">0 元优惠订单无需扫码，服务端会直接结算并开通会员。</p>
            </div>
          )}

          <dl className="mt-6 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">会员期限</dt>
              <dd className="font-medium text-slate-900">{order.membershipDays} 天</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">订单原价</dt>
              <dd className="text-slate-700">{formatCents(order.listPriceCents)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">优惠减免</dt>
              <dd className="text-emerald-700">-{formatCents(order.discountAmountCents)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3">
              <dt className="font-medium text-slate-700">订单实付</dt>
              <dd className="text-lg font-semibold text-slate-950">{formatCents(order.payableAmountCents)}</dd>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3">
              <div className="min-w-0">
                <dt className="text-xs text-slate-500">订单号</dt>
                <dd className="mt-1 truncate font-medium text-slate-800" title={order.orderNo}>{order.orderNo}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">订单状态</dt>
                <dd className={paid ? 'mt-1 font-medium text-emerald-700' : 'mt-1 font-medium text-slate-800'}>
                  {getStatusLabel(orderStatus)}
                </dd>
              </div>
            </div>
          </dl>

          <p className="mt-3 text-xs leading-5 text-slate-500">本区域展示的是服务端创建订单时固化的会员期限、优惠与金额快照，不使用浏览器本地计算结果。</p>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {canRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-wait disabled:opacity-60"
              >
                {refreshing ? '正在向支付平台确认...' : expired || locallyTimedOut ? '确认支付或取消结果' : '我已完成支付'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {canceled ? '关闭后重新下单' : paid ? '返回原页面' : '关闭'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
