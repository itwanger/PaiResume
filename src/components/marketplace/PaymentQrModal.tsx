import { useEffect, useState } from 'react'
import {
  getMarketplaceOrderStatus,
  hasMarketplaceOrderAccess,
  type MarketplaceOrder,
  type MarketplaceOrderStatus,
} from '../../api/marketplace'

interface PaymentQrModalProps {
  open: boolean
  order: MarketplaceOrder | null
  refreshing: boolean
  error?: string
  onClose: () => void
  onRefresh: () => void
}

function formatCurrency(cents: number | undefined): string {
  return `¥${((cents ?? 0) / 100).toFixed(2)}`
}

function getStatusLabel(order: MarketplaceOrder): string {
  const status = getMarketplaceOrderStatus(order)
  if (status === 'DUPLICATE_PAID') return '重复支付，待原路退款'
  if (status === 'REFUND_REQUIRED') return '支付异常，待人工退款'
  if (status === 'REFUNDED') return '订单已退款'
  if (hasMarketplaceOrderAccess(order)) return '支付成功'

  const labels: Partial<Record<MarketplaceOrderStatus, string>> = {
    CREATED: '订单已创建',
    PREPAYING: '正在生成支付二维码',
    PREPAY_UNKNOWN: '支付订单状态待确认',
    PENDING: '等待支付',
    FAILED: '支付失败',
    CLOSED: '订单已关闭',
    EXPIRED: '二维码已过期',
    REFUNDED: '订单已退款',
  }
  return labels[status] ?? status
}

export function PaymentQrModal({
  open,
  order,
  refreshing,
  error,
  onClose,
  onRefresh,
}: PaymentQrModalProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  useEffect(() => {
    setCopied(false)
  }, [order?.orderNo])

  if (!open || !order) {
    return null
  }

  const status = getMarketplaceOrderStatus(order)
  const unlocked = hasMarketplaceOrderAccess(order)
  const duplicatePaid = status === 'DUPLICATE_PAID'
  const refundRequired = status === 'REFUND_REQUIRED'
  const refunded = status === 'REFUNDED'
  const prepayUnknown = status === 'PREPAY_UNKNOWN'
  const expired = status === 'EXPIRED'
  const paid = status === 'PAID' && unlocked
  const terminal = unlocked
    || ['FAILED', 'CLOSED', 'REFUNDED', 'REFUND_REQUIRED'].includes(status)
  const showPaymentCode = !terminal && !prepayUnknown && !expired
  const canRefresh = !unlocked
    && !['FAILED', 'CLOSED', 'REFUNDED', 'REFUND_REQUIRED'].includes(status)
  const canCheckRefund = duplicatePaid || refundRequired
  const expiresAt = order.expiresAt ? new Date(order.expiresAt) : null
  const validExpiresAt = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null

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
        aria-labelledby="marketplace-payment-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 id="marketplace-payment-title" className="text-xl font-semibold text-slate-950">
              {duplicatePaid
                ? '检测到重复支付'
                : refundRequired
                  ? '本笔支付需要退款处理'
                  : refunded
                    ? '本笔订单已退款'
                  : paid
                    ? '简历已解锁'
                    : prepayUnknown
                      ? '支付订单状态待确认'
                      : expired
                        ? '支付二维码已过期'
                        : '扫码解锁这份简历'}
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
              <p className="mt-4 text-lg font-semibold text-emerald-950">支付成功，正在加载完整简历</p>
            </div>
          ) : duplicatePaid ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-7 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM10.3 3.8L2.5 17.3A2 2 0 004.2 20h15.6a2 2 0 001.7-2.7L13.7 3.8a2 2 0 00-3.4 0z" />
                </svg>
              </div>
              <p className="mt-4 text-lg font-semibold text-amber-950">检测到重复支付</p>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                原有查看权已保留，你仍可进入完整简历；平台不会给作者重复入账。本笔付款已进入人工复核清单，需要管理员在商户平台核对并处理原路退款，当前不代表退款已发起或到账。请勿再次支付，并联系客服提供订单号。
              </p>
            </div>
          ) : refundRequired ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-7 text-center">
              <p className="text-lg font-semibold text-red-950">支付结果需要人工核对</p>
              <p className="mt-2 text-sm leading-6 text-red-800">
                {unlocked
                  ? '支付平台返回了退款相关状态，但尚不能证明全额退款已经完成。当前查看权暂时保留，作者收益已停止结算；管理员核实全额退款后才会撤销查看权并冲正收益。'
                  : '本笔订单已进入人工复核清单，请勿继续扫码或重复下单。管理员需要在商户平台核对交易并人工处理原路退款；当前不代表退款已发起或到账，请联系客服并提供下方订单号。'}
              </p>
            </div>
          ) : refunded ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-7 text-center">
              <p className="text-lg font-semibold text-emerald-950">退款结果已登记</p>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                {unlocked
                  ? '本笔款项已退款；当前账号另有有效查看权，因此仍可查看完整简历。到账进度以原支付渠道为准。'
                  : '管理员已根据商户平台的实际退款结果将本订单标记为已退款，到账进度以原支付渠道为准。'}
              </p>
            </div>
          ) : prepayUnknown ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-7 text-center">
              <p className="text-lg font-semibold text-amber-950">暂时无法确认支付订单状态</p>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                当前二维码可能已失效，请勿扫码或重复支付。你可以重新确认订单状态；如果仍无法确认，请稍后重试或联系客服核对。
              </p>
            </div>
          ) : expired ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-7 text-center">
              <p className="text-lg font-semibold text-slate-950">支付二维码已过期</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                如果你刚刚完成支付，请先确认旧订单支付结果；确认未支付后可关闭窗口，再点击购买生成新订单。
              </p>
            </div>
          ) : !showPaymentCode ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-7 text-center">
              <p className="text-lg font-semibold text-slate-950">当前订单已结束</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">请勿继续使用旧支付码。关闭窗口后，可根据页面提示重新发起购买或联系客服。</p>
            </div>
          ) : (
            <>
              <div className="mx-auto flex min-h-[264px] w-full max-w-[264px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                {order.qrCodeDataUrl ? (
                  <img
                    src={order.qrCodeDataUrl}
                    alt="微信支付二维码"
                    className="h-full w-full object-contain"
                  />
                ) : order.codeUrl ? (
                  <div className="px-3 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-800">二维码图片暂未生成</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">请稍后刷新订单状态。</p>
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
                <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{formatCurrency(order.amountCents)}</p>
                {validExpiresAt ? (
                  <p className="mt-2 text-xs text-slate-500">二维码有效期至 {validExpiresAt.toLocaleString('zh-CN')}</p>
                ) : null}
              </div>
            </>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="min-w-0">
              <dt className="text-xs text-slate-500">订单号</dt>
              <dd className="mt-1 truncate font-medium text-slate-800" title={order.orderNo}>{order.orderNo}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">订单状态</dt>
              <dd className={paid
                ? 'mt-1 font-medium text-emerald-700'
                : duplicatePaid || refundRequired || prepayUnknown
                  ? 'mt-1 font-medium text-amber-700'
                  : 'mt-1 font-medium text-slate-800'}>
                {getStatusLabel(order)}
              </dd>
            </div>
          </dl>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {canRefresh || canCheckRefund ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-wait disabled:opacity-60"
              >
                {refreshing
                  ? canCheckRefund
                    ? '正在刷新退款状态...'
                    : '正在向支付平台确认...'
                  : canCheckRefund
                    ? '刷新退款处理状态'
                  : expired
                    ? '确认旧订单支付结果'
                    : prepayUnknown
                      ? '重新确认订单状态'
                      : '我已完成支付'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {unlocked
                ? '查看完整简历'
                : expired
                  ? '关闭后重新下单'
                  : '关闭'}
            </button>
          </div>

          <p className="mt-5 text-xs leading-5 text-slate-500">
            {duplicatePaid || refundRequired
              ? unlocked && refundRequired
                ? '退款状态核验期间不会继续结算作者收益；全额退款确认后，查看权与对应收益会一起撤销。最终进度以支付平台的实际原路退回结果为准。'
                : '异常支付不会重复计入作者收益。退款需要人工复核与处理，最终进度以支付平台的实际原路退回结果为准。'
              : refunded
                ? '本页面只展示后端已登记的退款状态，具体到账时间与结果以原支付渠道为准。'
              : '支付款项进入平台商户账户；页面展示的作者收益由平台记录，作者可逐笔申请线下结算。'}
          </p>
        </div>
      </section>
    </div>
  )
}
