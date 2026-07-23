import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { membershipApi, type MembershipQuote } from '../../api/membership'
import { useAuthStore } from '../../store/authStore'
import { buildMembershipPath } from '../../utils/navigation'

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
  membershipDays: 365,
}

export function MembershipUpgradeModal({ open, onClose }: Props) {
  const location = useLocation()
  const refreshUser = useAuthStore((state) => state.refreshUser)
  const [inviteCode, setInviteCode] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [quote, setQuote] = useState<MembershipQuote>(EMPTY_QUOTE)
  const [loading, setLoading] = useState(false)
  const [redeemingInvite, setRedeemingInvite] = useState(false)
  const [error, setError] = useState('')
  const [inviteError, setInviteError] = useState('')

  const priceRows = useMemo(() => ([
    { label: '会员期限', value: `${quote.membershipDays} 天` },
    { label: '会员原价', value: formatCents(quote.listPrice) },
    { label: '优惠减免', value: `-${formatCents(quote.discountAmount)}` },
    { label: '应付金额', value: formatCents(quote.payableAmount), strong: true },
  ]), [quote.discountAmount, quote.listPrice, quote.membershipDays, quote.payableAmount])
  const returnTo = `${location.pathname}${location.search}${location.hash}`

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
      onClose()
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : '邀请码兑换失败')
    } finally {
      setRedeemingInvite(false)
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
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">开通 VIP，解锁完整功能</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              VIP 可使用 AI 智能优化、简历分析和智能一页，也可查看完整优质简历并导出 PDF。
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
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4">
            <label className="mb-2 block text-sm font-semibold text-emerald-950">VIP 邀请码</label>
            <p className="mb-3 text-xs leading-5 text-emerald-800">每个账号限领一次，不能叠加或换码续期；权益期限由邀请码批次决定，兑换后以账号到期时间为准。</p>
            <div className="flex gap-3">
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                placeholder="输入知识星球 VIP 邀请码"
                className="min-w-0 flex-1 rounded-lg border border-emerald-300 bg-white px-4 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                type="button"
                onClick={() => void redeemInvite()}
                disabled={redeemingInvite}
                className="rounded-lg bg-emerald-700 px-4 py-2.5 text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {redeemingInvite ? '兑换中...' : '兑换邀请码'}
              </button>
            </div>
            {inviteError ? <p className="mt-2 text-sm text-red-600" role="alert">{inviteError}</p> : null}
            <p className="mt-2 text-xs leading-5 text-emerald-800">到期不会自动续期，可重新购买或由管理员延期，简历数据会保留；邀请码仅限本人使用，请勿截图、转发或公开发布。</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">支付优惠码</label>
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
            <p>支付订单创建后 30 分钟内有效，超时未支付会由服务端自动确认并取消。</p>
            <p>免费账号可编辑、保存和导入简历；AI 功能、智能一页、PDF 导出和优质简历全文仅限 VIP。</p>
            <p>VIP 到期后简历数据会保留，免费功能仍可继续使用。</p>
          </div>

          {quote.paymentEnabled ? (
            <Link
              to={buildMembershipPath(returnTo)}
              onClick={onClose}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              前往微信支付开通 {quote.membershipDays} 天 VIP
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-lg bg-slate-300 px-4 py-2.5 text-sm font-medium text-white"
            >
              暂停创建新的会员订单
            </button>
          )}
          <p className="text-center text-xs leading-5 text-slate-500">最终会员期限、优惠和实付金额以会员订单的服务端快照为准。</p>
        </div>
      </div>
    </div>
  )
}
