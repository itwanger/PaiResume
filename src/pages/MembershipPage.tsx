import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { membershipApi, type MembershipQuote } from '../api/membership'
import { Header } from '../components/layout/Header'
import { useAuthStore } from '../store/authStore'
import { EXCELLENT_RESUMES_PATH, getSafeInternalPath } from '../utils/navigation'

const EMPTY_QUOTE: MembershipQuote = {
  listPrice: 0,
  discountAmount: 0,
  payableAmount: 0,
  couponStatus: 'NOT_APPLIED',
  paymentEnabled: false,
}

function formatCents(value: number) {
  return `¥${(value / 100).toFixed(2)}`
}

export default function MembershipPage() {
  const [searchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const refreshUser = useAuthStore((state) => state.refreshUser)
  const [inviteCode, setInviteCode] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [quote, setQuote] = useState<MembershipQuote>(EMPTY_QUOTE)
  const [loading, setLoading] = useState(false)
  const [redeemingInvite, setRedeemingInvite] = useState(false)
  const [error, setError] = useState('')
  const [inviteError, setInviteError] = useState('')
  const returnTo = getSafeInternalPath(searchParams.get('redirect'), EXCELLENT_RESUMES_PATH)
  const isVip = user?.membershipStatus === 'ACTIVE'

  const priceRows = useMemo(() => ([
    { label: 'VIP 原价', value: formatCents(quote.listPrice) },
    { label: '优惠减免', value: `-${formatCents(quote.discountAmount)}` },
    { label: '应付金额', value: formatCents(quote.payableAmount), strong: true },
  ]), [quote.discountAmount, quote.listPrice, quote.payableAmount])

  const fetchQuote = async (nextCouponCode?: string) => {
    setLoading(true)
    setError('')
    try {
      const { data: response } = await membershipApi.quote(nextCouponCode)
      setQuote(response.data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '获取 VIP 报价失败')
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
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : '邀请码兑换失败')
    } finally {
      setRedeemingInvite(false)
    }
  }

  useEffect(() => {
    void fetchQuote()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8 lg:py-14">
        <section>
          <p className="text-sm font-medium text-primary-700">派简历 VIP</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">解锁 AI 优化与完整投递能力</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            免费账号可以编辑、保存和导入简历；VIP 可进一步使用 AI 优化与分析、智能一页、PDF 导出和优质简历全文。
          </p>

          <div className="mt-6 border border-primary-200 bg-primary-50 px-5 py-4 text-sm leading-6 text-primary-950">
            <p><strong>免费账号：</strong>编辑、保存、导入简历，已有简历数据会持续保留。</p>
            <p><strong>VIP 账号：</strong>在免费功能基础上，解锁全部 AI 功能、智能一页、PDF 导出和优质简历全文。</p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              ['AI 智能优化', '使用 AI 优化模块和字段表达，获得针对性的简历建议。'],
              ['AI 简历分析', '分析内容完整度、表达质量和可改进项。'],
              ['智能一页与 PDF', '把多页简历合成一张连续长页，完整保留内容，并以单页 PDF 导出。'],
              ['优质简历全文', '查看精选简历的完整模块、项目要点和推荐排版。'],
            ].map(([title, description]) => (
              <div key={title} className="border border-slate-200 bg-white px-5 py-5">
                <div className="flex h-8 w-8 items-center justify-center bg-primary-50 text-primary-700">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="mt-4 font-semibold text-slate-900">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="h-fit border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
          {isVip ? (
            <div>
              <div className="flex h-11 w-11 items-center justify-center bg-emerald-50 text-emerald-700">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="mt-5 text-xl font-semibold text-slate-950">你的 VIP 已开通</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {user?.membershipExpiresAt ? `有效期至 ${user.membershipExpiresAt}` : '永久有效'}，AI、智能一页、PDF 导出和优质简历全文均已解锁。
              </p>
              <Link to={returnTo} className="mt-6 inline-flex w-full items-center justify-center bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700">
                继续查看
              </Link>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-primary-700">VIP 开通</div>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">确认价格</h2>
                </div>
                <span className="bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">一次开通</span>
              </div>

              <div className="mt-6 border border-emerald-200 bg-emerald-50 px-4 py-4">
                <label htmlFor="membership-invite" className="block text-sm font-semibold text-emerald-950">VIP 邀请码</label>
                <p className="mt-1 text-xs leading-5 text-emerald-800">邀请码与支付优惠码相互独立，邀请码兑换不需要付款。</p>
                <div className="mt-3 flex gap-2">
                  <input
                    id="membership-invite"
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                    placeholder="输入管理员提供的邀请码"
                    className="min-w-0 flex-1 border border-emerald-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={() => void redeemInvite()}
                    disabled={redeemingInvite}
                    className="bg-emerald-700 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {redeemingInvite ? '兑换中' : '兑换'}
                  </button>
                </div>
                {inviteError ? <p className="mt-2 text-sm text-red-600" role="alert">{inviteError}</p> : null}
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-emerald-900">
                  <li>每个账号只能领取一次，不能叠加，也不能换一个邀请码重复续期。</li>
                  <li>邀请码截止时间只限制领取；在截止前兑换成功，从成功时间起获得完整 30 天 VIP。</li>
                  <li>30 天到期后不会自动续期；如需继续使用，可由管理员在后台延期。</li>
                  <li>到期后简历数据继续保留，编辑、保存和导入功能仍可使用。</li>
                  <li>邀请码仅限本人使用，请勿截图、转发或发布到公开渠道。</li>
                </ul>
              </div>

              <div className="mt-6">
                <label htmlFor="membership-coupon" className="mb-2 block text-sm font-medium text-slate-700">支付优惠码</label>
                <div className="flex gap-2">
                  <input
                    id="membership-coupon"
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                    placeholder="支付抵扣，没有可不填"
                    className="min-w-0 flex-1 border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  />
                  <button
                    type="button"
                    onClick={() => void fetchQuote(couponCode.trim() || undefined)}
                    disabled={loading}
                    className="border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 hover:border-primary-300 hover:text-primary-700 disabled:opacity-50"
                  >
                    {loading ? '计算中' : '使用'}
                  </button>
                </div>
                {error ? <p className="mt-2 text-sm text-red-600" role="alert">{error}</p> : null}
              </div>

              <div className="mt-6 space-y-3 border-y border-slate-100 py-5">
                {priceRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{row.label}</span>
                    <span className={row.strong ? 'text-xl font-semibold text-slate-950' : 'text-slate-700'}>{row.value}</span>
                  </div>
                ))}
              </div>

              {quote.paymentEnabled ? (
                <div className="mt-5 border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  支付通道已配置，但当前版本还缺少下单接口，请联系管理员完成开通。
                </div>
              ) : (
                <div className="mt-5 border border-primary-200 bg-primary-50 px-4 py-3 text-sm leading-6 text-primary-900">
                  在线支付通道正在接入。当前请联系管理员人工开通；开通后刷新页面即可继续查看。
                </div>
              )}

              <button
                type="button"
                disabled
                className="mt-5 w-full cursor-not-allowed bg-slate-300 px-4 py-2.5 text-sm font-medium text-white"
              >
                在线支付暂未开放
              </button>
              <Link to="/survey" className="mt-3 inline-flex w-full items-center justify-center border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-primary-200 hover:text-primary-700">
                先填写问卷获取优惠码
              </Link>
              <p className="mt-4 text-center text-xs leading-5 text-slate-400">优惠码状态：{quote.couponStatus}</p>
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}
