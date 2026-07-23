import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  creatorMarketplaceApi,
  type CreatorEarning,
  type CreatorEarningsSummary,
  type CreatorListing,
  type CreatorListingPayload,
  type MarketplaceAppeal,
  type MarketplaceAccessType,
} from '../api/marketplace'
import { resumeApi, type ResumeListItem } from '../api/resume'
import { Header } from '../components/layout/Header'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { buildMarketplaceListingPath } from '../utils/navigation'

interface ListingFormState {
  accessType: MarketplaceAccessType
  priceYuan: string
  summary: string
  tags: string
  privacyConfirmed: boolean
}

const EMPTY_FORM: ListingFormState = {
  accessType: 'FREE',
  priceYuan: '0.00',
  summary: '',
  tags: '',
  privacyConfirmed: false,
}

function formatCurrency(cents: number | undefined): string {
  return `¥${((cents ?? 0) / 100).toFixed(2)}`
}

function listingToForm(listing: CreatorListing | null): ListingFormState {
  if (!listing) return { ...EMPTY_FORM }

  return {
    accessType: listing.accessType,
    priceYuan: (listing.priceCents / 100).toFixed(2),
    summary: listing.summary ?? '',
    tags: (listing.tags ?? []).join('，'),
    privacyConfirmed: false,
  }
}

function parseTags(value: string): string[] {
  return Array.from(new Set(
    value
      .split(/[,，\n]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  ))
}

function parseYuanToCents(value: string): number | null {
  const normalized = value.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const [yuan, fraction = ''] = normalized.split('.')
  const cents = Number(yuan) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

function upsertListing(listings: CreatorListing[], nextListing: CreatorListing): CreatorListing[] {
  const exists = listings.some((listing) => listing.resumeId === nextListing.resumeId)
  if (!exists) return [nextListing, ...listings]
  return listings.map((listing) => listing.resumeId === nextListing.resumeId ? nextListing : listing)
}

function getEarningIncome(earning: CreatorEarning): number {
  return earning.walletCreditCents
}

function getEarningSaleAmount(earning: CreatorEarning): number {
  return earning.grossAmountCents
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    HOLDING: '风控冻结中',
    AVAILABLE: '可申请结算',
    PENDING_SETTLEMENT: '等待管理员线下转账',
    SETTLED: '已结算',
    REVERSED: '已冲正',
  }
  return labels[status] ?? status
}

function getReviewLabel(status: CreatorListing['reviewStatus']): string {
  const labels: Record<CreatorListing['reviewStatus'], string> = {
    PENDING: '待审核',
    APPROVED: '审核通过',
    REJECTED: '审核驳回',
  }
  return labels[status]
}

function getReviewBadgeClass(status: CreatorListing['reviewStatus']): string {
  if (status === 'PENDING') return 'rounded-full bg-amber-50 px-3 py-1 text-amber-700'
  if (status === 'REJECTED') return 'rounded-full bg-red-50 px-3 py-1 text-red-700'
  return 'rounded-full bg-emerald-50 px-3 py-1 text-emerald-700'
}

function getAppealStatusLabel(status: MarketplaceAppeal['appealStatus']): string {
  const labels: Record<MarketplaceAppeal['appealStatus'], string> = {
    OPEN: '处理中',
    APPROVED: '申诉通过',
    REJECTED: '申诉驳回',
  }
  return labels[status]
}

export default function CreatorMarketplacePage() {
  const [resumes, setResumes] = useState<ResumeListItem[]>([])
  const [listings, setListings] = useState<CreatorListing[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null)
  const [listing, setListing] = useState<CreatorListing | null>(null)
  const [form, setForm] = useState<ListingFormState>({ ...EMPTY_FORM })
  const [earningsSummary, setEarningsSummary] = useState<CreatorEarningsSummary>({
    heldBalanceCents: 0,
    availableBalanceCents: 0,
    pendingSettlementCents: 0,
    debtBalanceCents: 0,
    debtNotice: null,
    lifetimeEarnedCents: 0,
    lifetimeRefundedCents: 0,
    lifetimeNetEarnedCents: 0,
    paidOutCents: 0,
    holdingCount: 0,
    availableCount: 0,
    pendingSettlementCount: 0,
    settledCount: 0,
    reversedCount: 0,
  })
  const [earnings, setEarnings] = useState<CreatorEarning[]>([])
  const [appeals, setAppeals] = useState<MarketplaceAppeal[]>([])
  const [loading, setLoading] = useState(true)
  const [listingLoading, setListingLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [unpublishing, setUnpublishing] = useState(false)
  const [refreshingRevision, setRefreshingRevision] = useState(false)
  const [settlementRequestingId, setSettlementRequestingId] = useState<number | null>(null)
  const [appealDescription, setAppealDescription] = useState('')
  const [appealSubmitting, setAppealSubmitting] = useState(false)
  const [confirmUnpublishOpen, setConfirmUnpublishOpen] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const selectedResume = useMemo(
    () => resumes.find((resume) => resume.id === selectedResumeId) ?? null,
    [resumes, selectedResumeId],
  )

  const selectedAppeals = useMemo(
    () => listing ? appeals.filter((appeal) => appeal.listingId === listing.id) : [],
    [appeals, listing],
  )

  const refreshEarnings = useCallback(async () => {
    const [summaryResponse, earningResponse] = await Promise.all([
      creatorMarketplaceApi.earningsSummary(),
      creatorMarketplaceApi.earnings(),
    ])
    setEarningsSummary(summaryResponse.data.data)
    setEarnings(earningResponse.data.data)
  }, [])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [resumeResponse, listingResponse, summaryResponse, earningResponse, appealResponse] = await Promise.all([
        resumeApi.list(),
        creatorMarketplaceApi.listings(),
        creatorMarketplaceApi.earningsSummary(),
        creatorMarketplaceApi.earnings(),
        creatorMarketplaceApi.appeals(),
      ])
      const nextResumes = resumeResponse.data.data
      const nextListings = listingResponse.data.data
      setResumes(nextResumes)
      setListings(nextListings)
      setEarningsSummary(summaryResponse.data.data)
      setEarnings(earningResponse.data.data)
      setAppeals(appealResponse.data.data)
      setSelectedResumeId((current) => current ?? nextResumes[0]?.id ?? null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '创作者中心加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    if (!selectedResumeId) {
      setListing(null)
      setForm({ ...EMPTY_FORM })
      return
    }

    let active = true
    const knownListing = listings.find((item) => item.resumeId === selectedResumeId) ?? null
    setListingLoading(true)
    setError('')
    setSuccess('')
    setAppealDescription('')

    creatorMarketplaceApi.listing(selectedResumeId)
      .then(({ data: response }) => {
        if (!active) return
        setListing(response.data)
        setForm(listingToForm(response.data))
      })
      .catch(() => {
        if (!active) return
        setListing(knownListing)
        setForm(listingToForm(knownListing))
      })
      .finally(() => {
        if (active) setListingLoading(false)
      })

    return () => {
      active = false
    }
  }, [listings, selectedResumeId])

  const handlePublish = async () => {
    if (!selectedResumeId || saving) return

    setError('')
    setSuccess('')
    const summary = form.summary.trim()
    if (!summary) {
      setError('请填写公开摘要，先让浏览者知道这份简历值得看什么。')
      return
    }
    if (!form.privacyConfirmed) {
      setError('请先确认你理解公开简历可能暴露个人信息。')
      return
    }

    const paidPriceCents = parseYuanToCents(form.priceYuan)
    if (form.accessType === 'PAID'
      && (paidPriceCents === null || paidPriceCents < 100 || paidPriceCents > 99900)) {
      setError('付费公开的价格需设置在 1.00～999.00 元之间，最多保留两位小数。')
      return
    }

    const tags = parseTags(form.tags)
    if (tags.length > 8 || tags.some((tag) => tag.length > 24)) {
      setError('标签最多 8 个，每个标签不能超过 24 个字符。')
      return
    }

    const payload: CreatorListingPayload = {
      accessType: form.accessType,
      priceCents: form.accessType === 'FREE' ? 0 : paidPriceCents!,
      summary,
      tags,
      privacyConfirmed: true,
    }

    setSaving(true)
    try {
      const { data: response } = await creatorMarketplaceApi.publishListing(selectedResumeId, payload)
      setListing(response.data)
      setListings((current) => upsertListing(current, response.data))
      setForm((current) => ({ ...current, privacyConfirmed: false }))
      setSuccess(response.data.currentRevisionId
        ? '更新已提交审核。审核期间公开页继续展示上一个已通过版本，审核通过后再自动切换。'
        : '首次投稿已提交审核。审核通过前不会公开，也不能被搜索或购买。')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '简历发布失败')
    } finally {
      setSaving(false)
    }
  }

  const handleUnpublish = async () => {
    if (!selectedResumeId || unpublishing) return

    setUnpublishing(true)
    setError('')
    setSuccess('')
    try {
      const { data: response } = await creatorMarketplaceApi.unpublishListing(selectedResumeId)
      setListing(response.data)
      setListings((current) => upsertListing(current, response.data))
      setSuccess('已下架。新用户无法再购买，历史买家的已购查看权仍然保留；平台因违规暂停时除外。')
      setConfirmUnpublishOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '下架失败')
    } finally {
      setUnpublishing(false)
    }
  }

  const handleRefreshRevision = async () => {
    if (!selectedResumeId || refreshingRevision) return

    setError('')
    setSuccess('')
    if (!form.privacyConfirmed) {
      setError('刷新公开快照前，请重新确认你理解简历公开的隐私风险。')
      return
    }

    setRefreshingRevision(true)
    try {
      const { data: response } = await creatorMarketplaceApi.refreshRevision(selectedResumeId, true)
      setListing(response.data)
      setListings((current) => upsertListing(current, response.data))
      setForm((current) => ({ ...current, privacyConfirmed: false }))
      setSuccess('新快照已提交审核。审核期间公开页继续展示上一个已通过版本。')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '公开快照刷新失败')
    } finally {
      setRefreshingRevision(false)
    }
  }

  const handleRequestSettlement = async (earning: CreatorEarning) => {
    if (settlementRequestingId !== null) return
    if (!window.confirm(
      `确认申请结算这笔 ${formatCurrency(getEarningIncome(earning))} 的作者收益？\n\n申请后将等待管理员完成线下转账。`,
    )) {
      return
    }

    setSettlementRequestingId(earning.id)
    setError('')
    setSuccess('')
    try {
      await creatorMarketplaceApi.requestSettlement(earning.id)
      await refreshEarnings()
      setSuccess('结算申请已提交，请等待管理员完成线下转账。')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '结算申请提交失败')
    } finally {
      setSettlementRequestingId(null)
    }
  }

  const handleSubmitAppeal = async () => {
    if (!listing || appealSubmitting) return

    const description = appealDescription.trim()
    if (description.length < 10) {
      setError('请至少填写 10 个字符，说明申诉理由和已经完成的修改。')
      return
    }

    setAppealSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const { data: response } = await creatorMarketplaceApi.submitAppeal(listing.id, description)
      setAppeals((current) => [response.data, ...current])
      setAppealDescription('')
      setSuccess('申诉已提交，平台会在后台复核处理。')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '申诉提交失败')
    } finally {
      setAppealSubmitting(false)
    }
  }

  const totalIncome = earningsSummary.lifetimeNetEarnedCents
  const isPublished = listing?.publicationStatus === 'PUBLISHED'
  const canAppeal = listing?.moderationStatus === 'SUSPENDED' || listing?.reviewStatus === 'REJECTED'
  const hasOpenAppeal = selectedAppeals.some((appeal) => appeal.appealStatus === 'OPEN')

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary-700">简历内容市场</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">创作者中心</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              你可以免费公开简历，也可以设置一次性查看价格。所有首次投稿和版本更新都会先进入平台审核；作者收益由平台记账，可逐笔申请线下结算。
            </p>
          </div>
          <Link to="/dashboard" className="text-sm font-medium text-primary-700 hover:text-primary-800">返回我的简历</Link>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">累计净收益</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{formatCurrency(totalIncome)}</p>
            <p className="mt-1 text-xs text-slate-400">
              成交 {formatCurrency(earningsSummary.lifetimeEarnedCents)} · 退款 {formatCurrency(earningsSummary.lifetimeRefundedCents)}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm text-amber-700">风控冻结中</p>
            <p className="mt-2 text-2xl font-bold text-amber-950">{formatCurrency(earningsSummary.heldBalanceCents)}</p>
            <p className="mt-1 text-xs text-amber-700">{earningsSummary.holdingCount} 笔，观察期结束后转为可结算</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm text-emerald-700">可申请结算</p>
            <p className="mt-2 text-2xl font-bold text-emerald-950">{formatCurrency(earningsSummary.availableBalanceCents)}</p>
          </div>
          <div className="rounded-2xl border border-primary-200 bg-primary-50 p-5">
            <p className="text-sm text-primary-700">线下结算中</p>
            <p className="mt-2 text-2xl font-bold text-primary-950">{formatCurrency(earningsSummary.pendingSettlementCents)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">已结算</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{formatCurrency(earningsSummary.paidOutCents)}</p>
          </div>
        </section>

        {earningsSummary.debtBalanceCents > 0 ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-800" role="alert">
            <strong className="font-semibold text-red-950">
              待抵扣退款欠款：{formatCurrency(earningsSummary.debtBalanceCents)}。
            </strong>{' '}
            {earningsSummary.debtNotice ?? '后续新收益会优先抵扣欠款，抵扣完成前暂不能申请结算。'}
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-primary-200 bg-primary-50 px-5 py-4 text-sm leading-6 text-primary-800">
          <strong className="font-semibold text-primary-950">投稿先审后发：</strong>
          首次投稿在审核通过前不会公开；已公开简历提交更新后，审核期间仍展示上一个已通过版本，不会提前替换线上内容。
        </div>

        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-800">
          <strong className="font-semibold text-red-950">发布前请逐项检查隐私：</strong>
          公开内容可能包含电话、邮箱、微信、照片、住址、学校和任职经历。平台不会自动替你脱敏，请删除不希望陌生人看到的信息后再发布。
        </div>

        {error ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>
        ) : null}
        {success ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{success}</div>
        ) : null}

        {loading ? (
          <div className="mt-8 h-96 animate-pulse rounded-2xl bg-white" />
        ) : resumes.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <h2 className="text-xl font-semibold text-slate-900">先创建一份简历</h2>
            <p className="mt-2 text-sm text-slate-500">完成简历内容后，再来设置免费公开或付费查看。</p>
            <Link to="/dashboard" className="mt-5 inline-flex rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700">去创建简历</Link>
          </section>
        ) : (
          <section className="mt-8 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
            <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
              <h2 className="px-2 text-sm font-semibold text-slate-900">选择要公开的简历</h2>
              <div className="mt-3 space-y-2">
                {resumes.map((resume) => {
                  const resumeListing = listings.find((item) => item.resumeId === resume.id)
                  return (
                    <button
                      key={resume.id}
                      type="button"
                      onClick={() => setSelectedResumeId(resume.id)}
                      className={[
                        'w-full rounded-xl border px-3 py-3 text-left transition',
                        selectedResumeId === resume.id
                          ? 'border-primary-300 bg-primary-50'
                          : 'border-transparent hover:border-slate-200 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <span className="block truncate text-sm font-medium text-slate-900">{resume.title}</span>
                      <span className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                          {resumeListing?.moderationStatus === 'SUSPENDED'
                            ? '平台已下架'
                            : resumeListing?.reviewStatus === 'PENDING'
                              ? '待审核'
                              : resumeListing?.reviewStatus === 'REJECTED'
                                ? '审核驳回'
                                : resumeListing?.publicationStatus === 'PUBLISHED' ? '已公开' : '未公开'}
                        </span>
                        {resumeListing?.accessType === 'PAID' ? <span>{formatCurrency(resumeListing.priceCents)}</span> : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </aside>

            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary-600">公开设置</p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">{selectedResume?.title ?? '当前简历'}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={listing?.moderationStatus === 'SUSPENDED'
                      ? 'rounded-full bg-red-50 px-3 py-1 text-red-700'
                      : isPublished
                        ? 'rounded-full bg-emerald-50 px-3 py-1 text-emerald-700'
                        : 'rounded-full bg-slate-100 px-3 py-1 text-slate-600'}>
                      {listing?.moderationStatus === 'SUSPENDED' ? '平台已下架' : isPublished ? '已公开' : '未公开'}
                    </span>
                    {listing?.reviewStatus ? (
                      <span className={getReviewBadgeClass(listing.reviewStatus)}>{getReviewLabel(listing.reviewStatus)}</span>
                    ) : null}
                  </div>
                </div>

                {listing?.moderationStatus === 'SUSPENDED' ? (
                  <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                    <strong className="font-semibold text-red-950">平台已暂停这份简历：</strong>
                    暂停期间只有你和管理员可以查看，其他访客及历史买家均无法访问。
                    {listing.moderationReason ? ` 原因：${listing.moderationReason}` : ''}
                  </div>
                ) : null}

                {listing?.moderationStatus !== 'SUSPENDED' && listing?.reviewStatus === 'PENDING' ? (
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                    <strong className="font-semibold text-amber-950">版本正在审核：</strong>
                    {listing.currentRevisionId && listing.publicationStatus === 'PUBLISHED'
                      ? '公开页继续展示上一个已通过版本；本次待审版本只有你和管理员可查看，审核通过后才会切换。'
                      : '这是首次投稿，审核通过前不会公开、搜索或开放购买。'}
                  </div>
                ) : null}

                {listing?.moderationStatus !== 'SUSPENDED' && listing?.reviewStatus === 'REJECTED' ? (
                  <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                    <strong className="font-semibold text-red-950">本次投稿未通过审核。</strong>
                    {listing.moderationReason ? ` 原因：${listing.moderationReason}` : ''}
                    {' '}你可以修改后重新提交，也可以在下方发起申诉。
                  </div>
                ) : null}

                {listingLoading ? (
                  <div className="mt-8 py-20 text-center text-sm text-slate-500">正在加载公开设置...</div>
                ) : (
                  <div className="mt-6 space-y-6">
                    <fieldset>
                      <legend className="text-sm font-medium text-slate-800">浏览方式</legend>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {([
                          ['FREE', '免费公开', '任何人都可以直接查看完整简历'],
                          ['PAID', '付费查看', '内容正常展示期间，买家付款一次后可持续查看'],
                        ] as const).map(([value, title, description]) => (
                          <label
                            key={value}
                            className={[
                              'cursor-pointer rounded-xl border p-4 transition',
                              form.accessType === value ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-slate-300',
                            ].join(' ')}
                          >
                            <input
                              type="radio"
                              name="accessType"
                              value={value}
                              checked={form.accessType === value}
                              onChange={() => setForm((current) => ({
                                ...current,
                                accessType: value,
                                priceYuan: value === 'FREE' ? '0.00' : (Number(current.priceYuan) > 0 ? current.priceYuan : '1.00'),
                              }))}
                              className="sr-only"
                            />
                            <span className="block text-sm font-semibold text-slate-900">{title}</span>
                            <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {form.accessType === 'PAID' ? (
                      <div>
                        <label htmlFor="listing-price" className="block text-sm font-medium text-slate-800">单份查看价格</label>
                        <div className="mt-2 flex max-w-xs items-center rounded-lg border border-slate-300 bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
                          <span className="pl-3 text-sm text-slate-500">¥</span>
                          <input
                            id="listing-price"
                            type="number"
                            min="1"
                            max="999"
                            step="0.01"
                            inputMode="decimal"
                            value={form.priceYuan}
                            onChange={(event) => setForm((current) => ({ ...current, priceYuan: event.target.value }))}
                            className="w-full rounded-lg border-0 px-2 py-2.5 text-sm outline-none"
                          />
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">成交后支付先进入平台商户账户；平台手续费和作者应得收益会按订单快照记账。</p>
                      </div>
                    ) : null}

                    <div>
                      <label htmlFor="listing-summary" className="block text-sm font-medium text-slate-800">公开摘要</label>
                      <textarea
                        id="listing-summary"
                        rows={4}
                        maxLength={512}
                        value={form.summary}
                        onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                        placeholder="例如：应届 Java 后端简历，包含 RAG 知识库、AI Agent CLI 两个完整项目。"
                        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                      />
                      <p className="mt-1 text-right text-xs text-slate-400">{form.summary.length}/512</p>
                    </div>

                    <div>
                      <label htmlFor="listing-tags" className="block text-sm font-medium text-slate-800">标签</label>
                      <input
                        id="listing-tags"
                        type="text"
                        value={form.tags}
                        onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                        placeholder="Java，后端，应届，AI Agent"
                        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                      />
                      <p className="mt-2 text-xs text-slate-500">使用中文或英文逗号分隔，最多保留 8 个标签。</p>
                    </div>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                      <input
                        type="checkbox"
                        checked={form.privacyConfirmed}
                        onChange={(event) => setForm((current) => ({ ...current, privacyConfirmed: event.target.checked }))}
                        className="mt-0.5 h-4 w-4 rounded border-red-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm leading-6 text-red-900">
                        我已检查简历正文，并确认同意在审核通过后公开其中可能包含的电话、邮箱、微信、照片及经历信息。每次投稿或更新定价前都需要重新确认。
                      </span>
                    </label>

                    {listing?.snapshotOutdated ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                        原简历已更新，当前公开快照仍是旧版本。点击“提交最新快照审核”，并在审核通过后，才会向新访客展示最新内容。
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() => void handlePublish()}
                        disabled={saving}
                        className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-wait disabled:opacity-60"
                      >
                        {saving ? '正在生成待审快照...' : isPublished ? '提交更新审核' : '提交发布审核'}
                      </button>
                      {isPublished ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleRefreshRevision()}
                            disabled={refreshingRevision}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                          >
                            {refreshingRevision ? '正在生成待审快照...' : '提交最新快照审核'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmUnpublishOpen(true)}
                            className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            下架
                          </button>
                          {listing?.slug ? (
                            <Link
                              to={buildMarketplaceListingPath(listing.slug)}
                              className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-50"
                            >
                              查看公开页
                            </Link>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">审核与申诉</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    投稿被驳回或内容被平台下架后，可以补充修改说明和权利证明，提交一次待处理申诉。
                  </p>
                </div>

                {!listing ? (
                  <div className="mt-5 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">
                    提交投稿后，这里会显示审核结果和申诉记录。
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    {canAppeal ? (
                      hasOpenAppeal ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                          当前已有一条申诉正在处理中。平台给出结果前无需重复提交。
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <label htmlFor="marketplace-appeal-description" className="block text-sm font-medium text-slate-800">
                            {listing.moderationStatus === 'SUSPENDED' ? '下架申诉说明' : '审核驳回申诉说明'}
                          </label>
                          <textarea
                            id="marketplace-appeal-description"
                            rows={4}
                            minLength={10}
                            maxLength={1000}
                            value={appealDescription}
                            onChange={(event) => setAppealDescription(event.target.value)}
                            placeholder="请说明争议点、已经完成的修改，以及平台可以如何核验。"
                            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                          />
                          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-xs text-slate-400">{appealDescription.length}/1000</span>
                            <button
                              type="button"
                              onClick={() => void handleSubmitAppeal()}
                              disabled={appealSubmitting}
                              className="rounded-lg border border-primary-200 bg-white px-4 py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-wait disabled:opacity-60"
                            >
                              {appealSubmitting ? '正在提交...' : '提交申诉'}
                            </button>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
                        当前没有可申诉的驳回或下架状态。
                      </div>
                    )}

                    {selectedAppeals.length ? (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">申诉记录</h3>
                        <div className="mt-3 space-y-3">
                          {selectedAppeals.map((appeal) => (
                            <article key={appeal.id} className="rounded-xl border border-slate-200 px-4 py-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                                    {appeal.appealType === 'TAKEDOWN' ? '下架申诉' : '审核驳回申诉'}
                                  </span>
                                  <span className={appeal.appealStatus === 'OPEN'
                                    ? 'rounded-full bg-amber-50 px-2.5 py-1 text-amber-700'
                                    : appeal.appealStatus === 'APPROVED'
                                      ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700'
                                      : 'rounded-full bg-red-50 px-2.5 py-1 text-red-700'}>
                                    {getAppealStatusLabel(appeal.appealStatus)}
                                  </span>
                                </div>
                                <time className="text-xs text-slate-400">{new Date(appeal.createdAt).toLocaleString('zh-CN')}</time>
                              </div>
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{appeal.description}</p>
                              {appeal.handledReason ? (
                                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                                  平台处理说明：{appeal.handledReason}
                                </p>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">收益记录</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      成交后先进入默认 7 天风控观察期；到期且未退款才可逐笔申请，管理员完成线下转账后会登记流水或备注。
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">申请后由平台线下结算</span>
                </div>

                {earnings.length ? (
                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-[900px] w-full text-left text-sm">
                      <thead className="border-b border-slate-200 text-xs text-slate-500">
                        <tr>
                          <th className="pb-3 pr-4 font-medium">简历 / 订单</th>
                          <th className="pb-3 pr-4 font-medium">成交金额</th>
                          <th className="pb-3 pr-4 font-medium">平台手续费</th>
                          <th className="pb-3 pr-4 font-medium">作者收益</th>
                          <th className="pb-3 pr-4 font-medium">状态</th>
                          <th className="pb-3 pr-4 font-medium">时间</th>
                          <th className="pb-3 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {earnings.map((earning) => (
                          <tr key={earning.id}>
                            <td className="py-4 pr-4">
                              <div className="max-w-[220px] truncate font-medium text-slate-800">{earning.listingSlug || `公开简历 #${earning.listingId}`}</div>
                              <div className="mt-1 max-w-[220px] truncate text-xs text-slate-400" title={earning.orderNo ?? undefined}>{earning.orderNo ?? '原订单已不存在'}</div>
                            </td>
                            <td className="py-4 pr-4 text-slate-700">{formatCurrency(getEarningSaleAmount(earning))}</td>
                            <td className="py-4 pr-4 text-slate-500">{formatCurrency(earning.platformFeeCents)}</td>
                            <td className="py-4 pr-4">
                              <div className={earning.earningStatus === 'REVERSED'
                                ? 'font-semibold text-red-700 line-through'
                                : 'font-semibold text-emerald-700'}>
                                {formatCurrency(getEarningIncome(earning))}
                              </div>
                              {earning.debtOffsetCents > 0 ? (
                                <div className="mt-1 text-xs text-slate-400">
                                  另有 {formatCurrency(earning.debtOffsetCents)} 已抵扣历史退款欠款
                                </div>
                              ) : null}
                            </td>
                            <td className="py-4 pr-4 text-slate-600">
                              {earning.earningStatus === 'AVAILABLE'
                                && earning.walletCreditCents === 0
                                && earning.debtOffsetCents > 0
                                ? '已抵扣退款欠款'
                                : getStatusLabel(earning.earningStatus)}
                            </td>
                            <td className="py-4 pr-4 text-slate-500">{new Date(earning.createdAt).toLocaleString('zh-CN')}</td>
                            <td className="py-4">
                              {earning.sourceOrderStatus === 'REFUND_REQUIRED' ? (
                                <span className="block max-w-[190px] text-xs leading-5 text-red-600">
                                  退款状态正在核验，本笔收益已暂停结算
                                </span>
                              ) : earning.earningStatus === 'AVAILABLE' && earning.walletCreditCents > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => void handleRequestSettlement(earning)}
                                  disabled={settlementRequestingId !== null}
                                  className="min-w-max rounded-lg border border-primary-200 px-3 py-2 text-xs font-medium text-primary-700 hover:border-primary-300 hover:bg-primary-50 disabled:cursor-wait disabled:opacity-50"
                                >
                                  {settlementRequestingId === earning.id ? '提交中...' : '申请线下结算'}
                                </button>
                              ) : earning.earningStatus === 'HOLDING' ? (
                                <span className="block min-w-max text-xs leading-5 text-amber-700">
                                  {earning.availableAt
                                    ? `${new Date(earning.availableAt).toLocaleString('zh-CN')} 后可申请`
                                    : '退款状态核验中，暂不可结算'}
                                </span>
                              ) : earning.earningStatus === 'PENDING_SETTLEMENT' ? (
                                <span className="min-w-max text-xs text-amber-700">等待管理员处理</span>
                              ) : earning.earningStatus === 'REVERSED' ? (
                                <span className="block max-w-[190px] text-xs leading-5 text-red-600">
                                  已全额退款，阅读权和本笔收益均已撤销
                                </span>
                              ) : earning.settlementNote ? (
                                <span className="block max-w-[180px] text-xs leading-5 text-slate-500" title={earning.settlementNote}>
                                  {earning.settlementNote}
                                </span>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-dashed border-slate-300 px-5 py-12 text-center text-sm text-slate-500">
                    暂无收益记录。发布简历并产生成功订单后会显示在这里。
                  </div>
                )}
              </section>
            </div>
          </section>
        )}
      </main>

      <ConfirmDialog
        open={confirmUnpublishOpen}
        title="确认下架这份简历？"
        description="下架后新用户无法搜索或购买，但历史买家的已购查看权仍保留（平台因违规暂停时除外），已有收益记录也不会删除。"
        confirmText="确认下架"
        tone="danger"
        loading={unpublishing}
        onConfirm={handleUnpublish}
        onCancel={() => setConfirmUnpublishOpen(false)}
      />
    </div>
  )
}
