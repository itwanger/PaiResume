import { useEffect, useMemo, useState } from 'react'
import { membershipApi, type MembershipQuote } from '../../api/membership'

interface Props {
  open: boolean
  onClose: () => void
}

function formatCents(value: number) {
  return `¥${(value / 100).toFixed(2)}`
}

const EMPTY_QUOTE: MembershipQuote = {
  listPrice: 0,
  discountAmount: 0,
  payableAmount: 0,
  couponStatus: 'NOT_APPLIED',
  paymentEnabled: false,
}

export function MembershipUpgradeModal({ open, onClose }: Props) {
  const [couponCode, setCouponCode] = useState('')
  const [quote, setQuote] = useState<MembershipQuote>(EMPTY_QUOTE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const priceRows = useMemo(() => ([
    { label: '会员原价', value: formatCents(quote.listPrice) },
    { label: '优惠减免', value: `-${formatCents(quote.discountAmount)}` },
    { label: '应付金额', value: formatCents(quote.payableAmount), strong: true },
  ]), [quote.discountAmount, quote.listPrice, quote.payableAmount])

  const fetchQuote = async (nextCouponCode?: string) => {
    setLoading(true)
    setError('')
    try {
      const { data: res } = await membershipApi.quote(nextCouponCode)
      setQuote(res.data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '获取会员报价失败'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) {
      return
    }
    void fetchQuote()
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">开通会员后可导出 PDF</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              当前版本还没有接入在线支付。你可以先输入优惠码查看最终价格，再联系管理员人工开通。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            关闭
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">优惠码</label>
            <div className="flex gap-3">
              <input
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="可选，输入后查看减免"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => void fetchQuote(couponCode.trim() || undefined)}
                disabled={loading}
                className="rounded-lg bg-primary-600 px-4 py-2.5 text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? '计算中...' : '计算价格'}
              </button>
            </div>
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4">
            <div className="space-y-3">
              {priceRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{row.label}</span>
                  <span className={row.strong ? 'text-lg font-semibold text-gray-900' : 'text-gray-700'}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-primary-200 bg-primary-50 px-4 py-4 text-sm leading-6 text-primary-900">
            <p>优惠码状态：{quote.couponStatus}</p>
            <p>在线支付：{quote.paymentEnabled ? '已开启' : '暂未开启'}</p>
            <p>开通后你仍然保留现有的简历编辑、保存和 AI 功能。</p>
          </div>
        </div>
      </div>
    </div>
  )
}
