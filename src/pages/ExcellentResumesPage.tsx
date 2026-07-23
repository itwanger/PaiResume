import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getMarketplacePageItems,
  getMarketplaceTotalPages,
  marketplaceApi,
  type MarketplaceAccessType,
  type MarketplaceListingCard,
} from '../api/marketplace'
import { publicApi, type ShowcaseCard } from '../api/public'
import { Header } from '../components/layout/Header'
import { useAuthStore } from '../store/authStore'
import {
  buildLoginPath,
  buildMarketplaceListingPath,
  buildMembershipPath,
  buildShowcasePath,
} from '../utils/navigation'

function formatCurrency(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}

function ResumeLayoutThumbnail({ accent = 'primary' }: { accent?: 'primary' | 'emerald' }) {
  const barClass = accent === 'emerald' ? 'border-emerald-600 bg-emerald-50' : 'border-primary-600 bg-primary-50'
  const inkClass = accent === 'emerald' ? 'bg-emerald-700' : 'bg-primary-700'

  return (
    <div className="relative mx-auto aspect-[210/297] w-full max-w-[220px] overflow-hidden border border-slate-200 bg-white p-3 shadow-sm" aria-hidden="true">
      <div className="grid grid-cols-[38px_minmax(0,1fr)] gap-2">
        <div className="h-12 bg-slate-200" />
        <div className="space-y-1.5 pt-0.5">
          <div className="h-2.5 w-16 bg-slate-800" />
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-1 bg-slate-200" />
            ))}
          </div>
        </div>
      </div>
      {[0, 1, 2].map((section) => (
        <div key={section} className="mt-3">
          <div className={`flex h-4 items-center border-l-2 px-1.5 ${barClass}`}>
            <div className={`h-1.5 w-10 ${inkClass}`} />
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="h-1.5 w-4/5 bg-slate-300" />
            <div className="h-1 w-full bg-slate-200" />
            <div className="h-1 w-11/12 bg-slate-200" />
            {section > 0 ? <div className="h-1 w-3/4 bg-slate-200" /> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ExcellentResumesPage() {
  const navigate = useNavigate()
  const { initialized, isAuthenticated, user } = useAuthStore()
  const [showcases, setShowcases] = useState<ShowcaseCard[]>([])
  const [showcaseLoading, setShowcaseLoading] = useState(true)
  const [showcaseError, setShowcaseError] = useState('')
  const [marketplaceEnabled, setMarketplaceEnabled] = useState<boolean | null>(null)
  const [marketplaceListings, setMarketplaceListings] = useState<MarketplaceListingCard[]>([])
  const [marketplaceLoading, setMarketplaceLoading] = useState(true)
  const [marketplaceError, setMarketplaceError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [accessType, setAccessType] = useState<MarketplaceAccessType | ''>('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    const loadShowcases = async () => {
      setShowcaseLoading(true)
      setShowcaseError('')
      try {
        const { data: response } = await publicApi.home()
        setShowcases(response.data.showcases)
        setMarketplaceEnabled(response.data.marketplaceEnabled)
      } catch (err: unknown) {
        setMarketplaceEnabled(false)
        setShowcaseError(err instanceof Error ? err.message : '官方精选加载失败')
      } finally {
        setShowcaseLoading(false)
      }
    }

    void loadShowcases()
  }, [])

  const loadMarketplace = useCallback(async (nextPage: number) => {
    setMarketplaceLoading(true)
    setMarketplaceError('')
    try {
      const { data: response } = await marketplaceApi.publicListings({
        page: nextPage,
        size: 24,
        q: submittedQuery || undefined,
        accessType,
      })
      const payload = response.data
      setMarketplaceListings(getMarketplacePageItems(payload))
      setPage(payload.page)
      setTotalPages(getMarketplaceTotalPages(payload))
    } catch (err: unknown) {
      setMarketplaceError(err instanceof Error ? err.message : '用户公开简历加载失败')
    } finally {
      setMarketplaceLoading(false)
    }
  }, [accessType, submittedQuery])

  useEffect(() => {
    if (marketplaceEnabled === null) return
    if (!marketplaceEnabled) {
      setMarketplaceListings([])
      setMarketplaceError('')
      setMarketplaceLoading(false)
      return
    }
    void loadMarketplace(1)
  }, [loadMarketplace, marketplaceEnabled])

  const openShowcase = (showcase: ShowcaseCard) => {
    if (!initialized) return

    const showcasePath = buildShowcasePath(showcase.slug)
    if (!isAuthenticated) {
      navigate(buildLoginPath(showcasePath))
      return
    }
    if (user?.membershipStatus !== 'ACTIVE') {
      navigate(buildMembershipPath(showcasePath))
      return
    }
    navigate(showcasePath)
  }

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmittedQuery(searchInput.trim())
  }

  const officialActionLabel = !initialized
    ? '账号加载中...'
    : !isAuthenticated
      ? '登录后查看'
      : user?.membershipStatus === 'ACTIVE'
        ? '查看完整简历'
        : '开通 VIP 查看'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />

      <main>
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700">
                <span>官方精选</span>
                {marketplaceEnabled ? (
                  <>
                    <span className="h-1 w-1 rounded-full bg-primary-400" />
                    <span>用户公开市场</span>
                  </>
                ) : null}
              </div>
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">优质简历</h1>
              <p className="mt-4 text-base leading-7 text-slate-600">
                {marketplaceEnabled
                  ? '官方精选适合对照结构与写法，由 VIP 权益解锁；用户公开简历由作者自主选择免费或付费，购买后在内容正常展示期间当前账号可持续查看。'
                  : '当前阶段仅开放平台官方精选，适合对照简历结构、项目表达与排版方式，由 VIP 权益解锁。用户公开市场将在审核与支付验收完成后另行开放。'}
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-2xl font-semibold text-slate-950">{showcases.length}</div>
                <div className="mt-1 text-sm text-slate-500">官方精选</div>
              </div>
              <div className="border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-2xl font-semibold text-slate-950">{marketplaceEnabled ? '免费 / 付费' : 'VIP 权益'}</div>
                <div className="mt-1 text-sm text-slate-500">{marketplaceEnabled ? '作者自主设置浏览方式' : '服务端校验完整内容权限'}</div>
              </div>
              <div className="border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-2xl font-semibold text-slate-950">{marketplaceEnabled ? '一次购买' : '持续更新'}</div>
                <div className="mt-1 text-sm text-slate-500">{marketplaceEnabled ? '正常展示期间持续查看' : '平台审核后公开展示'}</div>
              </div>
            </div>

            {marketplaceEnabled ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                VIP 只免平台官方精选，不免其他用户发布的付费简历；付费款项进入平台商户，作者收益由平台记录，作者可申请线下结算。
              </div>
            ) : null}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary-700">PaiResume 官方</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">官方精选 · VIP 查看</h2>
            </div>
            <p className="text-sm text-slate-500">管理员筛选、持续更新</p>
          </div>

          {showcaseError ? (
            <div className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{showcaseError}</div>
          ) : null}

          {showcaseLoading ? (
            <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-[520px] animate-pulse border border-slate-200 bg-white" />
              ))}
            </div>
          ) : showcases.length ? (
            <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {showcases.map((showcase) => (
                <article key={showcase.id} className="group flex flex-col overflow-hidden border border-slate-200 bg-white transition hover:border-primary-200 hover:shadow-lg hover:shadow-slate-200/60">
                  <div className="relative border-b border-slate-100 bg-slate-100 px-8 py-7">
                    <ResumeLayoutThumbnail />
                    <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 text-xs font-medium text-white">
                      VIP
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">{showcase.title}</h3>
                        <p className="mt-1 text-sm font-medium text-primary-700">{showcase.scoreLabel}</p>
                      </div>
                      <span className="shrink-0 bg-primary-50 px-2.5 py-1 text-xs text-primary-700">推荐排版</span>
                    </div>
                    <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">{showcase.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(showcase.tags ?? []).map((tag) => (
                        <span key={tag} className="bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{tag}</span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => openShowcase(showcase)}
                      disabled={!initialized}
                      className="mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-wait disabled:opacity-60"
                    >
                      {officialActionLabel}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-6 border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">官方精选正在整理中。</div>
          )}
        </section>

        {marketplaceEnabled ? (
          <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700">社区创作者</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">用户公开简历</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">这里只展示作者主动发布的摘要；完整正文仍由服务端按免费、本人或已购权限返回。</p>
              </div>

              <form onSubmit={handleSearch} className="flex w-full max-w-xl flex-col gap-2 sm:flex-row">
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="搜索岗位、技术栈或标签"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
                <button type="submit" className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800">搜索</button>
              </form>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {([
                ['', '全部'],
                ['FREE', '免费公开'],
                ['PAID', '付费查看'],
              ] as const).map(([value, label]) => (
                <button
                  key={value || 'ALL'}
                  type="button"
                  onClick={() => setAccessType(value)}
                  className={[
                    'rounded-full px-4 py-2 text-sm font-medium transition',
                    accessType === value
                      ? 'bg-emerald-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>

            {marketplaceError ? (
              <div className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{marketplaceError}</div>
            ) : null}

            {marketplaceLoading ? (
              <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-[500px] animate-pulse border border-slate-200 bg-slate-50" />
                ))}
              </div>
            ) : marketplaceListings.length ? (
              <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {marketplaceListings.map((listing) => {
                  const paid = listing.accessType === 'PAID'
                  return (
                    <article key={listing.slug} className="group flex flex-col overflow-hidden border border-slate-200 bg-slate-50 transition hover:border-emerald-200 hover:shadow-lg hover:shadow-slate-200/60">
                      <div className="relative border-b border-slate-100 bg-slate-100 px-8 py-7">
                        <ResumeLayoutThumbnail accent="emerald" />
                        <span className={paid
                          ? 'absolute right-4 top-4 bg-amber-600 px-2.5 py-1 text-xs font-medium text-white'
                          : 'absolute right-4 top-4 bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white'}>
                          {paid ? formatCurrency(listing.priceCents) : '免费'}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-lg font-semibold text-slate-950">{listing.title}</h3>
                          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs text-slate-500">用户公开</span>
                        </div>
                        <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{listing.summary}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {(listing.tags ?? []).map((tag) => (
                            <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">{tag}</span>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(buildMarketplaceListingPath(listing.slug))}
                          className={paid
                            ? 'mt-6 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800'
                            : 'mt-6 inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700'}
                        >
                          {paid
                            ? listing.paymentEnabled
                              ? `${formatCurrency(listing.priceCents)} 解锁查看`
                              : '查看详情（支付维护中）'
                            : '免费查看完整简历'}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="mt-6 border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
                <p className="text-sm text-slate-500">没有找到符合条件的用户公开简历。</p>
              </div>
            )}

            {totalPages > 1 ? (
              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void loadMarketplace(Math.max(1, page - 1))}
                  disabled={page <= 1 || marketplaceLoading}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一页
                </button>
                <span className="text-sm text-slate-500">第 {page} / {totalPages} 页</span>
                <button
                  type="button"
                  onClick={() => void loadMarketplace(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages || marketplaceLoading}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            ) : null}
          </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}
