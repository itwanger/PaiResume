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
import {
  EMPTY_RESUME_CARD_PREVIEW,
  ResumeContentThumbnail,
} from '../components/dashboard/ResumeCard'
import { Header } from '../components/layout/Header'
import { SiteFooter } from '../components/layout/SiteFooter'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import {
  buildMarketplaceListingPath,
  buildShowcasePath,
} from '../utils/navigation'
import {
  getResumeFeatureBadgeClassName,
  getResumeFeatureBadgeTone,
  getResumeStyleFeatureBadges,
} from '../utils/resumeStyleLabels'

function formatCurrency(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}

function ResumeLayoutThumbnail({ accent = 'primary' }: { accent?: 'primary' | 'emerald' }) {
  const barClass = accent === 'emerald' ? 'border-emerald-600 bg-emerald-50' : 'border-primary-600 bg-primary-50'
  const inkClass = accent === 'emerald' ? 'bg-emerald-700' : 'bg-primary-700'

  return (
    <div className="relative mx-auto aspect-[210/297] w-full max-w-[220px] overflow-hidden p-3" aria-hidden="true">
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
        setShowcaseError(err instanceof Error ? err.message : '优质简历加载失败')
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
    navigate(buildShowcasePath(showcase.slug))
  }

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmittedQuery(searchInput.trim())
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />

      <main>
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="sr-only">优质简历</h1>

          {showcaseError ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{showcaseError}</div>
          ) : null}

          {showcaseLoading ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-[520px] animate-pulse border border-slate-200 bg-white" />
              ))}
            </div>
          ) : showcases.length ? (
            <div className="columns-1 gap-6 md:columns-2 xl:columns-3">
              {showcases.map((showcase) => {
                const featureBadges = getResumeStyleFeatureBadges(showcase)
                return (
                  <article key={showcase.id} className="group mb-6 break-inside-avoid overflow-hidden border border-slate-200 bg-white transition hover:border-primary-200 hover:shadow-lg hover:shadow-slate-200/60">
                    <div className="border-b border-slate-100 px-5 pt-5">
                      <ResumeContentThumbnail
                        preview={showcase.preview ?? EMPTY_RESUME_CARD_PREVIEW}
                        resume={showcase}
                      />
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">{showcase.title}</h3>
                        <p className="mt-1 text-sm font-medium text-primary-700">{showcase.scoreLabel}</p>
                      </div>
                      <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">{showcase.summary}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {featureBadges.map((badge) => (
                          <span
                            key={`${badge.category}-${badge.label}`}
                            data-feature-category={badge.category}
                            data-feature-tone={getResumeFeatureBadgeTone(badge.category)}
                            className={`px-2.5 py-1 text-xs ring-1 ring-inset ${getResumeFeatureBadgeClassName(badge.category)}`}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => openShowcase(showcase)}
                        className="mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                      >
                        {showcase.accessType === 'PAID'
                          ? `${formatCurrency(showcase.priceCents)} 解锁完整简历`
                          : showcase.accessType === 'LOGIN'
                            ? '登录后查看'
                            : '查看简历'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">暂无简历</div>
          )}
        </section>

        {marketplaceEnabled ? (
          <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">用户公开简历</h2>
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

            <SegmentedControl
              ariaLabel="简历查看范围"
              value={accessType}
              options={[
                { value: '', label: '全部' },
                { value: 'FREE', label: '免费公开' },
                { value: 'PAID', label: '付费查看' },
              ]}
              onChange={setAccessType}
              size="md"
              className="mt-5"
            />

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
              <div className="mt-6 columns-1 gap-6 md:columns-2 xl:columns-3">
                {marketplaceListings.map((listing) => {
                  const paid = listing.accessType === 'PAID'
                  return (
                    <article key={listing.slug} className="group mb-6 break-inside-avoid overflow-hidden border border-slate-200 bg-slate-50 transition hover:border-emerald-200 hover:shadow-lg hover:shadow-slate-200/60">
                      <div className="relative border-b border-slate-100 px-8 py-7">
                        <ResumeLayoutThumbnail accent="emerald" />
                        <span className={paid
                          ? 'absolute right-4 top-4 bg-amber-600 px-2.5 py-1 text-xs font-medium text-white'
                          : 'absolute right-4 top-4 bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white'}>
                          {paid ? formatCurrency(listing.priceCents) : '免费'}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-5">
                        <h3 className="text-lg font-semibold text-slate-950">{listing.title}</h3>
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
                <p className="text-sm text-slate-500">暂无符合条件的简历</p>
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

      <SiteFooter />
    </div>
  )
}
