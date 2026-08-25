import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  getMarketplacePageItems,
  marketplaceApi,
  type MarketplaceListingCard,
} from '../api/marketplace'
import { publicApi, type HomeData } from '../api/public'
import type { ResumeCardPreview } from '../api/resume'
import {
  EMPTY_RESUME_CARD_PREVIEW,
  ResumeContentThumbnail,
} from '../components/dashboard/ResumeCard'
import { Header } from '../components/layout/Header'
import { SiteFooter } from '../components/layout/SiteFooter'
import { RESUME_CREATE_PATH } from '../config/site'
import { useAuthStore } from '../store/authStore'
import {
  buildLoginPath,
  buildMarketplaceListingPath,
  EXCELLENT_RESUMES_PATH,
  IS_LOCAL_DEVELOPMENT,
} from '../utils/navigation'
import type { ResumeStyleSource } from '../utils/resumeStyle'
import { getResumeStyleFeatureLabels } from '../utils/resumeStyleLabels'
import { getShowcaseAccessLabel } from '../utils/showcaseAccess'

interface HomepageShowcaseCard extends ResumeStyleSource {
  id: number
  source: 'MARKETPLACE_FREE' | 'MARKETPLACE_PAID' | 'OFFICIAL'
  accessType: 'FREE' | 'PAID' | 'PUBLIC' | 'LOGIN'
  href: string
  title: string
  summary: string
  tags: string[]
  priceCents: number
  viewCount?: number
  preview?: ResumeCardPreview
}

type HeroFeatureIcon = 'one-page' | 'score' | 'optimize'

const HERO_FEATURES: Array<{
  title: string
  description: string
  icon: HeroFeatureIcon
  iconClassName: string
}> = [
  {
    title: '无损智能一页',
    description: '完整保留全部内容，不删减、不压缩、不挤版面，智能合成一张连续长页，一页完整导出',
    icon: 'one-page',
    iconClassName: 'bg-blue-100 text-blue-700',
  },
  {
    title: 'AI 评分',
    description: '多维分析内容、结构和表达，快速定位简历短板',
    icon: 'score',
    iconClassName: 'bg-amber-100 text-amber-700',
  },
  {
    title: 'AI 优化',
    description: '逐段打磨内容，让职责、行动与成果表达得更具体',
    icon: 'optimize',
    iconClassName: 'bg-violet-100 text-violet-700',
  },
]

function formatCurrency(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}

function formatViewCount(count: number): string {
  if (count <= 0) return '刚刚上架'
  if (count < 10_000) return `${new Intl.NumberFormat('zh-CN').format(count)} 次浏览`

  const wan = count / 10_000
  return `${wan >= 10 ? wan.toFixed(0) : wan.toFixed(1)} 万次浏览`
}

function FeatureIcon({ icon }: { icon: HeroFeatureIcon }) {
  if (icon === 'score') {
    return (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V9m5 10V5m5 14v-7m5 7V3" />
      </svg>
    )
  }

  if (icon === 'optimize') {
    return (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m15 4 .7 2.1L18 7l-2.3.9L15 10l-.7-2.1L12 7l2.3-.9L15 4ZM7.5 10l1.2 3.3L12 14.5l-3.3 1.2L7.5 19l-1.2-3.3L3 14.5l3.3-1.2L7.5 10ZM18.5 13l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
      </svg>
    )
  }

  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3.5V8h4M9 12h6M9 15h6M9 18h4" />
    </svg>
  )
}

const SHOWCASE_PREVIEW_THEMES = [
  { gradient: 'from-blue-600 to-cyan-500', accent: 'bg-blue-500', tint: 'bg-blue-50', text: 'text-blue-700' },
  { gradient: 'from-violet-600 to-fuchsia-500', accent: 'bg-violet-500', tint: 'bg-violet-50', text: 'text-violet-700' },
  { gradient: 'from-emerald-600 to-teal-500', accent: 'bg-emerald-500', tint: 'bg-emerald-50', text: 'text-emerald-700' },
  { gradient: 'from-rose-600 to-orange-400', accent: 'bg-rose-500', tint: 'bg-rose-50', text: 'text-rose-700' },
  { gradient: 'from-indigo-700 to-blue-500', accent: 'bg-indigo-500', tint: 'bg-indigo-50', text: 'text-indigo-700' },
  { gradient: 'from-amber-500 to-orange-500', accent: 'bg-amber-500', tint: 'bg-amber-50', text: 'text-amber-700' },
]

function ResumeLine({ width, className = 'bg-slate-200' }: { width: string; className?: string }) {
  return <span className={`block h-1 rounded-full ${width} ${className}`} />
}

function MarketplaceListingThumbnail({ index, title }: { index: number; title: string }) {
  const theme = SHOWCASE_PREVIEW_THEMES[index % SHOWCASE_PREVIEW_THEMES.length]
  const variant = index % 3
  const displayName = title.split('·')[0]?.trim() || '候选人'
  const avatarText = displayName.slice(0, 1).toUpperCase()

  if (variant === 1) {
    return (
      <div className="relative h-full overflow-hidden bg-white shadow-[0_18px_45px_-30px_rgba(15,23,42,0.75)] ring-1 ring-inset ring-slate-200/80">
        <div className={`h-20 bg-gradient-to-r ${theme.gradient}`} />
        <div className="absolute left-1/2 top-10 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-slate-100 text-sm font-bold text-slate-700 shadow-sm">
          {avatarText}
        </div>
        <div className="px-5 pb-5 pt-9 text-center">
          <div className="text-[10px] font-bold text-slate-800">{displayName}</div>
          <div className="mt-1 text-[6px] tracking-[0.2em] text-slate-400">RESUME PROFILE</div>
          <div className={`mx-auto mt-3 h-px w-4/5 ${theme.accent}`} />
          <div className="mt-4 space-y-4 text-left">
            {['教育背景', '项目经历', '专业技能'].map((section, sectionIndex) => (
              <div key={section}>
                <div className={`mb-2 text-[7px] font-semibold ${theme.text}`}>{section}</div>
                <div className="space-y-1.5">
                  <ResumeLine width={sectionIndex === 1 ? 'w-full' : 'w-5/6'} />
                  <ResumeLine width={sectionIndex === 2 ? 'w-3/5' : 'w-4/5'} className="bg-slate-100" />
                  {sectionIndex === 1 ? <ResumeLine width="w-2/3" className="bg-slate-100" /> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (variant === 2) {
    return (
      <div className="flex h-full overflow-hidden bg-white shadow-[0_18px_45px_-30px_rgba(15,23,42,0.75)] ring-1 ring-inset ring-slate-200/80">
        <aside className={`w-[32%] bg-gradient-to-b ${theme.gradient} px-3 py-5 text-white`}>
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/70 bg-white/15 text-sm font-bold">
            {avatarText}
          </div>
          <div className="mt-3 text-[9px] font-bold leading-4">{displayName}</div>
          <div className="mt-5 space-y-2">
            <ResumeLine width="w-full" className="bg-white/65" />
            <ResumeLine width="w-4/5" className="bg-white/45" />
            <ResumeLine width="w-3/5" className="bg-white/45" />
          </div>
          <div className="mt-6 space-y-2.5">
            {['技能', '工具', '语言'].map((label) => (
              <div key={label}>
                <div className="text-[6px] font-medium text-white/80">{label}</div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/15">
                  <div className="h-full w-4/5 rounded-full bg-white/75" />
                </div>
              </div>
            ))}
          </div>
        </aside>
        <div className="flex-1 px-4 py-5">
          {['个人亮点', '工作经历', '项目经历', '教育背景'].map((section, sectionIndex) => (
            <div key={section} className={sectionIndex ? 'mt-4' : ''}>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${theme.accent}`} />
                <div className="text-[7px] font-bold text-slate-700">{section}</div>
              </div>
              <div className="mt-2 space-y-1.5 pl-4">
                <ResumeLine width="w-full" />
                <ResumeLine width={sectionIndex % 2 ? 'w-4/5' : 'w-2/3'} className="bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-hidden bg-white shadow-[0_18px_45px_-30px_rgba(15,23,42,0.75)] ring-1 ring-inset ring-slate-200/80">
      <header className={`flex h-16 items-center justify-between bg-gradient-to-r px-5 text-white ${theme.gradient}`}>
        <div>
          <div className="text-[10px] font-bold">{displayName}</div>
          <div className="mt-1 text-[6px] tracking-[0.16em] text-white/75">PROFESSIONAL RESUME</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-sm font-bold ring-1 ring-white/45">
          {avatarText}
        </div>
      </header>
      <div className="px-5 py-4">
        <div className={`rounded-lg px-3 py-2 ${theme.tint}`}>
          <div className={`text-[7px] font-semibold ${theme.text}`}>个人优势</div>
          <div className="mt-1.5 space-y-1.5">
            <ResumeLine width="w-full" className="bg-slate-300/75" />
            <ResumeLine width="w-4/5" className="bg-slate-200/80" />
          </div>
        </div>
        <div className="mt-4 space-y-4">
          {['工作经历', '项目经历', '专业技能'].map((section, sectionIndex) => (
            <div key={section}>
              <div className="flex items-center gap-2">
                <span className={`h-3 w-0.5 rounded-full ${theme.accent}`} />
                <div className="text-[7px] font-bold text-slate-700">{section}</div>
              </div>
              <div className="mt-2 space-y-1.5 pl-2.5">
                <ResumeLine width={sectionIndex === 0 ? 'w-full' : 'w-5/6'} />
                <ResumeLine width={sectionIndex === 2 ? 'w-3/5' : 'w-4/5'} className="bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const shouldReduceMotion = useReducedMotion() ?? false
  const { isAuthenticated, initialized, user } = useAuthStore()
  const readyAuthenticated = initialized && isAuthenticated
  const [homeData, setHomeData] = useState<HomeData | null>(null)
  const [marketplaceListings, setMarketplaceListings] = useState<MarketplaceListingCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const marketplaceEnabled = homeData?.marketplaceEnabled === true
  const testimonials = homeData?.testimonials ?? []
  const marketplaceShowcases: HomepageShowcaseCard[] = (marketplaceEnabled ? marketplaceListings : []).map((listing) => ({
    id: listing.listingId,
    source: listing.accessType === 'PAID' ? 'MARKETPLACE_PAID' : 'MARKETPLACE_FREE',
    accessType: listing.accessType,
    href: buildMarketplaceListingPath(listing.slug),
    title: listing.title,
    summary: listing.summary,
    tags: listing.tags ?? [],
    priceCents: listing.priceCents,
    viewCount: listing.viewCount ?? 0,
  }))
  const officialShowcases: HomepageShowcaseCard[] = (homeData?.showcases ?? []).map((showcase) => ({
    id: showcase.id,
    source: 'OFFICIAL',
    accessType: showcase.accessType,
    href: `/showcases/${encodeURIComponent(showcase.slug)}`,
    title: showcase.title,
    summary: showcase.summary,
    tags: [],
    priceCents: showcase.priceCents,
    pageMode: showcase.pageMode,
    templateId: showcase.templateId,
    density: showcase.density,
    accentPreset: showcase.accentPreset,
    headingStyle: showcase.headingStyle,
    preview: showcase.preview,
  }))
  const showcases = [...marketplaceShowcases, ...officialShowcases].slice(0, 8)

  useEffect(() => {
    const loadHome = async () => {
      setLoading(true)
      setError('')
      try {
        const homeResult = await publicApi.home()
        const nextHomeData = homeResult.data.data
        setHomeData(nextHomeData)
        setMarketplaceListings([])

        if (nextHomeData.marketplaceEnabled) {
          try {
            const marketplaceResult = await marketplaceApi.publicListings({ page: 1, size: 8 })
            setMarketplaceListings(getMarketplacePageItems(marketplaceResult.data.data))
          } catch {
            if (import.meta.env.DEV) {
              console.error('[home] Failed to load marketplace listings', 'RequestError')
            }
            setError('用户公开简历暂时加载失败，已有优质简历仍可正常查看。')
          }
        }
      } catch {
        if (import.meta.env.DEV) {
          console.error('[home] Failed to load public content', 'RequestError')
        }
        setError('优质简历暂时加载失败，请稍后刷新重试。')
      } finally {
        setLoading(false)
      }
    }

    void loadHome()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header />

      <main>
        <section className="relative overflow-hidden border-b border-gray-200 bg-white">
          <div className="pointer-events-none absolute -right-40 -top-48 h-[520px] w-[520px] rounded-full bg-primary-100/60 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-56 left-1/3 h-96 w-96 rounded-full bg-blue-50 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)] lg:gap-16 lg:px-8 lg:py-20">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3.5 py-1.5 text-sm font-medium text-primary-700">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                AI 评分 · 智能优化 · 一页排版
              </div>
              <h1 className="mt-5 text-[1.75rem] font-bold leading-[1.15] tracking-tight text-gray-950 sm:text-[2.6rem] lg:text-5xl">
                <span className="block">让 AI 和你一起，</span>
                <span className="mt-1 block text-primary-600">写一份高质量简历。</span>
                <span className="mt-3 block text-[0.62em] font-semibold leading-snug tracking-normal text-gray-800">
                  面试官和HR看一眼就会爱上
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-gray-600 sm:text-lg">
                从 AI 评分到问题诊断，再到内容优化与智能排版，派简历不仅能为你提供写作灵感，还能把枯燥乏味的工作经历、实习经历和项目经历提炼升华，让你的简历投了就有面试，面试了就能拿offer。
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                {!initialized ? (
                  <button
                    type="button"
                    disabled
                    className="rounded-lg bg-primary-600 px-5 py-3 text-sm font-medium text-white opacity-60"
                  >
                    正在加载…
                  </button>
                ) : readyAuthenticated ? (
                  <Link
                    to={RESUME_CREATE_PATH}
                    className="rounded-lg bg-primary-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                  >
                    开始制作简历
                  </Link>
                ) : (
                  <Link
                    to={buildLoginPath(RESUME_CREATE_PATH)}
                    className="rounded-lg bg-primary-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                  >
                    {IS_LOCAL_DEVELOPMENT ? '邮箱登录后开始制作' : '扫码开始制作'}
                  </Link>
                )}
                <Link
                  to={EXCELLENT_RESUMES_PATH}
                  className="rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-primary-200 hover:text-primary-700"
                >
                  浏览优质简历
                </Link>
                {user?.admin ? (
                  <Link
                    to="/admin"
                    className="rounded-lg border border-primary-200 bg-primary-50 px-5 py-3 text-sm font-medium text-primary-700 transition-colors hover:border-primary-300"
                  >
                    进入管理后台
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl lg:mx-0" aria-label="派简历核心能力">
              <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-primary-100/80 via-white to-blue-100/70 blur-2xl" />
              <div className="relative rounded-[1.75rem] border border-primary-100/80 bg-white/90 p-4 shadow-[0_28px_70px_-28px_rgba(30,64,175,0.35)] backdrop-blur sm:p-5">
                <div className="mb-4 flex items-center justify-between px-1">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">一站式智能简历优化</div>
                    <div className="mt-1 text-xs text-gray-500">从发现问题到完成修改</div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    AI 全程协作
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {HERO_FEATURES.map((feature) => (
                    <div
                      key={feature.title}
                      className="group rounded-2xl border border-gray-100 bg-gray-50/80 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-primary-100 hover:bg-white hover:shadow-md"
                    >
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${feature.iconClassName}`}>
                        <FeatureIcon icon={feature.icon} />
                      </div>
                      <h2 className="mt-4 text-base font-semibold text-gray-900">{feature.title}</h2>
                      <p className="mt-1.5 text-sm leading-6 text-gray-500">{feature.description}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-3 rounded-2xl bg-primary-600 px-4 py-3.5 text-white shadow-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8 12 2.5 2.5L16.5 8.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">内容、表达、排版，层层优化</div>
                    <div className="mt-0.5 text-xs text-primary-100">看得见问题，也看得见怎么改</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100/80">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950">优质简历库</h2>
              </div>
              <Link to={EXCELLENT_RESUMES_PATH} className="hidden text-sm font-medium text-primary-700 transition hover:text-primary-800 sm:inline-flex">
                查看全部简历&nbsp;→
              </Link>
            </div>

            {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}
            {loading ? (
              <div className="mt-6 text-sm text-slate-500">内容加载中…</div>
            ) : showcases.length ? (
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {showcases.map((showcase, index) => {
                  const paid = showcase.accessType === 'PAID'
                  const official = showcase.source === 'OFFICIAL'
                  const officialAccessType = official
                    ? showcase.accessType as 'PUBLIC' | 'LOGIN' | 'PAID'
                    : null
                  const priceLabel = officialAccessType === 'PAID'
                    ? formatCurrency(showcase.priceCents)
                    : officialAccessType
                      ? getShowcaseAccessLabel(officialAccessType)
                    : paid
                      ? formatCurrency(showcase.priceCents)
                      : '免费公开'
                  const actionLabel = officialAccessType === 'PAID'
                    ? `${priceLabel} 解锁完整简历`
                    : officialAccessType === 'LOGIN'
                      ? '登录后查看'
                      : officialAccessType === 'PUBLIC'
                        ? '查看简历'
                    : paid
                      ? `${priceLabel} 解锁完整简历`
                      : '免费查看完整简历'
                  const badgeClassName = paid
                    ? 'bg-amber-50 text-amber-700 ring-amber-200'
                    : officialAccessType === 'LOGIN'
                      ? 'bg-sky-50 text-sky-700 ring-sky-200'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  const featureLabels = official
                    ? getResumeStyleFeatureLabels(showcase)
                    : showcase.tags?.slice(0, 3) ?? []

                  return (
                    <motion.div
                    key={`${showcase.source}-${showcase.id}`}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
                    whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.15 }}
                    transition={{
                      duration: 0.45,
                      delay: Math.min(index * 0.05, 0.3),
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="h-full"
                  >
                    <Link
                      to={showcase.href}
                      className="group flex h-full flex-col overflow-hidden border border-slate-200 bg-white shadow-[0_18px_45px_-34px_rgba(15,23,42,0.5)] transition duration-300 ease-out hover:-translate-y-1.5 hover:border-primary-200 hover:shadow-[0_28px_60px_-32px_rgba(29,78,216,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
                    >
                      {official ? (
                        <div className="relative border-b border-slate-100 px-5 pt-5">
                          <ResumeContentThumbnail
                            preview={showcase.preview ?? EMPTY_RESUME_CARD_PREVIEW}
                            resume={showcase}
                          />
                          <span className={`absolute right-7 top-7 px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badgeClassName}`}>
                            {priceLabel}
                          </span>
                        </div>
                      ) : (
                        <div className="relative h-72 overflow-hidden bg-gradient-to-br from-slate-100 via-white to-primary-50">
                          <div className="h-full origin-top transition duration-300 ease-out group-hover:scale-[1.025] group-focus-visible:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none" aria-hidden="true">
                            <MarketplaceListingThumbnail index={index} title={showcase.title} />
                          </div>
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 via-primary-50/90 to-white opacity-0 backdrop-blur-[2px] transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none" />
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-5 bottom-5 translate-y-3 opacity-0 transition duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 motion-reduce:transform-none motion-reduce:transition-none"
                          >
                            <div className={`inline-flex px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badgeClassName}`}>
                              {priceLabel}
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-700">{showcase.summary}</p>
                            <div className="mt-4 flex items-center justify-between bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-950/20">
                              <span>{actionLabel}</span>
                              <span>→</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="min-w-0 text-lg font-semibold leading-7 text-slate-900">{showcase.title}</h3>
                          {!official ? (
                            <span className={`shrink-0 px-3 py-1 text-sm font-semibold ring-1 ring-inset ${badgeClassName}`}>
                              {priceLabel}
                            </span>
                          ) : null}
                        </div>
                        <p aria-hidden="true" className="mt-3 max-h-12 overflow-hidden text-sm leading-6 text-slate-500 md:hidden">
                          {showcase.summary}
                        </p>
                        <span className="sr-only">{showcase.summary}</span>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {featureLabels.map((label) => (
                            <span key={label} className="bg-slate-100 px-3 py-1 text-xs text-slate-600 ring-1 ring-inset ring-slate-200/70">
                              {label}
                            </span>
                          ))}
                        </div>
                        <div className={`mt-auto flex items-center border-t border-slate-100 pt-4 text-sm font-medium text-slate-500 md:mt-5 ${showcase.viewCount === undefined ? 'justify-end' : 'justify-between'}`}>
                          {showcase.viewCount !== undefined ? (
                            <span className="inline-flex items-center gap-1.5">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.75 12s3.25-5.25 9.25-5.25S21.25 12 21.25 12 18 17.25 12 17.25 2.75 12 2.75 12Z" />
                                <circle cx="12" cy="12" r="2.25" />
                              </svg>
                              {formatViewCount(showcase.viewCount)}
                            </span>
                          ) : null}
                          <span className="text-primary-700 transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transform-none" aria-hidden="true">
                            {actionLabel} →
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                  )
                })}
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-sm text-slate-500">
                更多岗位简历正在持续更新。
              </div>
            )}
          </div>
        </section>

        <section className="border-y border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold text-gray-900">用户评价</h2>

            {loading ? (
              <div className="mt-6 text-sm text-gray-500">内容加载中…</div>
            ) : testimonials.length ? (
              <div className="mt-6 grid gap-5 lg:grid-cols-3">
                {testimonials.map((testimonial, index) => (
                  <motion.article
                    key={testimonial.id}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
                    whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, amount: 0.2 }}
                    whileHover={shouldReduceMotion ? undefined : {
                      y: -6,
                      boxShadow: '0 18px 38px -24px rgba(29, 78, 216, 0.38)',
                    }}
                    transition={{
                      duration: 0.48,
                      delay: Math.min(index * 0.07, 0.35),
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="min-w-0 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-5 transition-colors hover:border-primary-200 hover:bg-white"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        aria-hidden="true"
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${['bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700'][index % 3]}`}
                      >
                        {testimonial.displayName.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-gray-900">{testimonial.displayName}</div>
                          <div className="flex shrink-0 text-sm tracking-wide text-amber-400" aria-label={`${testimonial.rating} 分`}>
                            {Array.from({ length: testimonial.rating }, (_, starIndex) => (
                              <motion.span
                                key={starIndex}
                                aria-hidden="true"
                                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.4, rotate: -18 }}
                                whileInView={shouldReduceMotion ? undefined : { opacity: 1, scale: 1, rotate: 0 }}
                                viewport={{ once: true, amount: 0.8 }}
                                transition={{
                                  duration: 0.28,
                                  delay: Math.min(index * 0.07, 0.35) + starIndex * 0.045,
                                  ease: [0.22, 1, 0.36, 1],
                                }}
                              >
                                ★
                              </motion.span>
                            ))}
                          </div>
                        </div>
                        <div className="mt-1 text-sm leading-5 text-gray-500">
                          {testimonial.schoolOrCompany} · {testimonial.targetRole}
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-gray-600">{testimonial.testimonialText}</p>
                  </motion.article>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-gray-300 px-6 py-10 text-sm text-gray-500">
                用户评价正在陆续更新，欢迎稍后再来看看。
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
