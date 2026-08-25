import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  adminApi,
  type AdminMarketListing,
  type CouponAdmin,
  type FeedbackSubmissionAdmin,
  type MembershipAdminAuditLog,
  type MembershipPlanAdmin,
  type MembershipPaymentAdminOrder,
  type MembershipPaymentAdminSummary,
  type MembershipPaymentOrderStatus,
  type MembershipPaymentReviewStatus,
  type MarketplaceListingModerationAction,
  type MarketplacePaymentReview,
  type MarketplacePaymentReviewStatus,
  type PlatformConfig,
  type ResumeShowcaseAccessType,
  type ResumeShowcaseAdmin,
  type UserAdmin,
  type VipInviteAdmin,
  type VipInviteRedemptionAdmin,
} from '../api/admin'
import {
  getMarketplacePageItems,
  getMarketplaceTotalPages,
  type CreatorEarning,
  type MarketplaceReviewStatus,
} from '../api/marketplace'
import { resumeApi, type ResumeListItem } from '../api/resume'
import { AdminOverview } from '../components/admin/AdminOverview'
import {
  AdminActionDialogProvider,
  useAdminActionDialog,
} from '../components/admin/AdminActionDialog'
import {
  getUserAdminLabel,
} from '../components/admin/adminData'
import {
  formatAdminCents,
  getAdminErrorMessage,
} from '../components/admin/adminFormat'
import {
  CouponStatusBadge,
  FeedbackPublishStatusBadge,
  FeedbackReviewStatusBadge,
  RedemptionStatusBadge,
  VipInviteStatusBadge,
} from '../components/admin/adminStatus'
import {
  ADMIN_DATA_SECTION_LABELS,
  ADMIN_VIEW_LOAD_SECTIONS,
  getAdminViewFailedSections,
  getAdminViewLoadState,
  OVERVIEW_LOAD_SECTIONS,
  type AdminDataSection,
} from '../components/admin/adminLoadPlan'
import {
  AdminShell,
} from '../components/admin/AdminShell'
import { AdminTableScroller } from '../components/admin/AdminUi'
import {
  type AdminView,
  isAdminView,
} from '../components/admin/adminNavigation'
import { MarketplaceGovernancePanel } from '../components/admin/MarketplaceGovernancePanel'
import { ResumeReviewAdminPanel } from '../components/admin/ResumeReviewAdminPanel'
import { AdminShowcasePanel } from '../components/admin/AdminShowcasePanel'
import { AdminContentLibraryPanel } from '../components/admin/AdminContentLibraryPanel'
import { ResumeAnalysisPromptAdminPanel } from '../components/admin/ResumeAnalysisPromptAdminPanel'
import { AiProviderAdminPanel } from '../components/admin/AiProviderAdminPanel'

interface PlatformPriceDraft {
  questionnaireCouponAmountYuan: string
  resumeReviewPriceYuan: string
}

const MAX_PRICE_CENTS = 2_147_483_647

function formatYuanInput(value: number | null) {
  return value === null ? '' : (value / 100).toFixed(2)
}

function parseYuanToCents(value: string): number | null {
  const normalized = value.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null

  const [yuan, fraction = ''] = normalized.split('.')
  const cents = Number(yuan) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= MAX_PRICE_CENTS ? cents : null
}

function isCouponExpired(coupon: CouponAdmin): boolean {
  if (!coupon.expiresAt) return false
  const expiresAt = Date.parse(coupon.expiresAt.replace(' ', 'T'))
  return Number.isFinite(expiresAt) && expiresAt <= Date.now()
}

function isCouponResendable(coupon: CouponAdmin): boolean {
  return coupon.status === 'ISSUED' && !isCouponExpired(coupon)
}

function platformConfigToPriceDraft(config: PlatformConfig): PlatformPriceDraft {
  return {
    questionnaireCouponAmountYuan: formatYuanInput(config.questionnaireCouponAmountCents),
    resumeReviewPriceYuan: formatYuanInput(config.resumeReviewPriceCents),
  }
}

function membershipPlansToPriceDrafts(plans: MembershipPlanAdmin[]) {
  return Object.fromEntries(plans.map((plan) => [plan.code, formatYuanInput(plan.priceCents)]))
}

function upsertShowcase(
  current: ResumeShowcaseAdmin[],
  nextShowcase: ResumeShowcaseAdmin,
) {
  const existingIndex = current.findIndex(
    (showcase) => showcase.resumeId === nextShowcase.resumeId,
  )
  if (existingIndex < 0) return [...current, nextShowcase]
  return current.map((showcase, index) => index === existingIndex ? nextShowcase : showcase)
}

function formatMembershipEntitlement(
  entitlementType: MembershipPlanAdmin['entitlementType'],
  membershipDays: number | null,
) {
  return entitlementType === 'PERMANENT' ? '终身' : `${membershipDays ?? '-'} 天`
}

function getCreatorEarningIncome(earning: CreatorEarning) {
  return earning.walletCreditCents
}

const EMPTY_INVITE_FORM = {
  remark: '知识星球专属',
  expiresInDays: '30',
  maxRedemptions: '100',
  membershipDays: '30',
}

const MEMBERSHIP_AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE_VIP_INVITE: '生成邀请码',
  GRANT_MEMBERSHIP: '手工开通 VIP',
  EXTEND_MEMBERSHIP: '延长 VIP',
  REVOKE_MEMBERSHIP: '手工撤销 VIP',
  UPDATE_MEMBERSHIP_PLAN: '更新会员方案',
  INVALIDATE_VIP_INVITE: '作废邀请码',
  REVOKE_VIP_INVITE_REDEMPTION: '撤销异常邀请码兑换',
}

const MARKETPLACE_ORDER_STATUS_LABELS: Record<string, string> = {
  CREATED: '订单已创建',
  PREPAYING: '正在创建预支付',
  PREPAY_UNKNOWN: '预支付结果待确认',
  PENDING: '支付平台仍待支付',
  EXPIRED: '已过期待确认关闭',
  CLOSED: '已关闭',
  FAILED: '支付失败',
  PAID: '已支付',
  DUPLICATE_PAID: '重复支付',
  REFUND_REQUIRED: '待人工退款复核',
  REFUNDED: '已退款',
}

const MEMBERSHIP_PAYMENT_ORDER_STATUS_LABELS: Record<MembershipPaymentOrderStatus, string> = {
  CREATED: '订单已创建',
  PREPAYING: '正在创建预支付',
  PREPAY_UNKNOWN: '预支付结果待确认',
  PENDING: '待支付',
  EXPIRED: '已过期待关单',
  CANCELED: '已取消',
  PAID: '支付成功',
  REFUND_REQUIRED: '需要人工复核',
}

const MEMBERSHIP_PAYMENT_REVIEW_STATUS_LABELS: Record<MembershipPaymentReviewStatus, string> = {
  NONE: '无需复核',
  PENDING: '待处理',
  REFUND_PROCESSING: '退款处理中',
  REFUNDED: '已退款',
  REJECTED: '已驳回',
  CLOSED: '已关闭',
}

const MEMBERSHIP_PAYMENT_AUDIT_ACTION_LABELS: Record<string, string> = {
  START_REFUND: '标记退款处理中',
  CONFIRM_REFUNDED: '确认商户平台已退款',
  REJECT_REFUND: '驳回退款复核',
  CLOSE_REVIEW: '关闭人工复核',
}

function getInviteDisplayStatus(invite: VipInviteAdmin): VipInviteAdmin['status'] {
  if (invite.status !== 'ACTIVE' || !invite.expiresAt) {
    return invite.status
  }
  const expiresAt = Date.parse(invite.expiresAt.replace(' ', 'T'))
  return Number.isNaN(expiresAt) || expiresAt > Date.now() ? 'ACTIVE' : 'EXPIRED'
}

function isInvitePublishable(invite: VipInviteAdmin) {
  return getInviteDisplayStatus(invite) === 'ACTIVE'
    && invite.redeemedCount < invite.maxRedemptions
}

function formatMembershipSnapshot(
  status: string | null,
  source: string | null,
  expiresAt: string | null,
) {
  if (!status && !source && !expiresAt) {
    return '-'
  }
  return [status ?? '-', source ?? '-', expiresAt ?? (status === 'ACTIVE' ? '永久' : '-')].join(' / ')
}

function AdminPageContent() {
  const {
    confirm: confirmAdminAction,
    prompt: promptAdminValue,
  } = useAdminActionDialog()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedView = searchParams.get('view')
  const activeView: AdminView = isAdminView(requestedView) ? requestedView : 'overview'
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>({
    membershipPriceCents: 6600,
    questionnaireCouponAmountCents: 1000,
    resumeReviewPriceCents: 0,
  })
  const [platformPriceDraft, setPlatformPriceDraft] = useState<PlatformPriceDraft>({
    questionnaireCouponAmountYuan: '10.00',
    resumeReviewPriceYuan: '0.00',
  })
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlanAdmin[]>([])
  const [membershipPlanPriceDrafts, setMembershipPlanPriceDrafts] = useState<Record<string, string>>({})
  const [feedbacks, setFeedbacks] = useState<FeedbackSubmissionAdmin[]>([])
  const [coupons, setCoupons] = useState<CouponAdmin[]>([])
  const [vipInvites, setVipInvites] = useState<VipInviteAdmin[]>([])
  const [inviteRedemptions, setInviteRedemptions] = useState<VipInviteRedemptionAdmin[]>([])
  const [selectedInviteId, setSelectedInviteId] = useState<number | null>(null)
  const [membershipAuditLogs, setMembershipAuditLogs] = useState<MembershipAdminAuditLog[]>([])
  const [users, setUsers] = useState<UserAdmin[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [userMembershipFilter, setUserMembershipFilter] = useState<'' | 'ACTIVE' | 'FREE'>('')
  const [userPage, setUserPage] = useState(1)
  const [userTotal, setUserTotal] = useState(0)
  const [userTotalPages, setUserTotalPages] = useState(1)
  const [allUserTotal, setAllUserTotal] = useState<number | null>(null)
  const [activeUserTotal, setActiveUserTotal] = useState<number | null>(null)
  const [showcases, setShowcases] = useState<ResumeShowcaseAdmin[]>([])
  const [marketListings, setMarketListings] = useState<AdminMarketListing[]>([])
  const [marketListingPage, setMarketListingPage] = useState(1)
  const [marketListingTotalPages, setMarketListingTotalPages] = useState(1)
  const [marketListingTotal, setMarketListingTotal] = useState(0)
  const [pendingMarketListingCount, setPendingMarketListingCount] = useState(0)
  const [marketPublicationFilter, setMarketPublicationFilter] = useState<'' | 'PUBLISHED' | 'UNPUBLISHED'>('')
  const [marketModerationFilter, setMarketModerationFilter] = useState<'' | 'APPROVED' | 'SUSPENDED'>('')
  const [marketReviewFilter, setMarketReviewFilter] = useState<'' | MarketplaceReviewStatus>('PENDING')
  const [governanceAuditRefreshKey, setGovernanceAuditRefreshKey] = useState(0)
  const [pendingCreatorEarnings, setPendingCreatorEarnings] = useState<CreatorEarning[]>([])
  const [pendingCreatorEarningCount, setPendingCreatorEarningCount] = useState(0)
  const [paymentReviews, setPaymentReviews] = useState<MarketplacePaymentReview[]>([])
  const [marketplacePaymentIssueCount, setMarketplacePaymentIssueCount] = useState(0)
  const [paymentCloseWork, setPaymentCloseWork] = useState<MarketplacePaymentReview[]>([])
  const [paymentReviewFilter, setPaymentReviewFilter] = useState<'' | MarketplacePaymentReviewStatus>('')
  const [paymentOrderLookup, setPaymentOrderLookup] = useState('')
  const [paymentOrderLookupResult, setPaymentOrderLookupResult] = useState<MarketplacePaymentReview | null>(null)
  const [membershipPaymentOrders, setMembershipPaymentOrders] = useState<MembershipPaymentAdminOrder[]>([])
  const [membershipPaymentSummary, setMembershipPaymentSummary] = useState<MembershipPaymentAdminSummary | null>(null)
  const [membershipPaymentPage, setMembershipPaymentPage] = useState(1)
  const [membershipPaymentTotalPages, setMembershipPaymentTotalPages] = useState(1)
  const [membershipPaymentTotal, setMembershipPaymentTotal] = useState(0)
  const [membershipPaymentOrderFilter, setMembershipPaymentOrderFilter] = useState<'' | MembershipPaymentOrderStatus>('REFUND_REQUIRED')
  const [membershipPaymentReviewFilter, setMembershipPaymentReviewFilter] = useState<'' | MembershipPaymentReviewStatus>('')
  const [selectedMembershipPaymentOrder, setSelectedMembershipPaymentOrder] = useState<MembershipPaymentAdminOrder | null>(null)
  const [resumes, setResumes] = useState<ResumeListItem[]>([])
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE_FORM)
  const [loadedSections, setLoadedSections] = useState<Set<AdminDataSection>>(new Set())
  const [loadingSections, setLoadingSections] = useState<Set<AdminDataSection>>(new Set())
  const [failedSections, setFailedSections] = useState<Set<AdminDataSection>>(new Set())
  const [overviewLastUpdatedAt, setOverviewLastUpdatedAt] = useState<Date | null>(null)
  const [pendingGovernanceCount, setPendingGovernanceCount] = useState(0)
  const [pendingResumeReviewCount, setPendingResumeReviewCount] = useState(0)
  const [savingConfig, setSavingConfig] = useState(false)
  const [savingMembershipPlanCode, setSavingMembershipPlanCode] = useState<string | null>(null)
  const [showcaseActionResumeId, setShowcaseActionResumeId] = useState<number | null>(null)
  const [showcaseActionError, setShowcaseActionError] = useState<{
    resumeId: number
    message: string
  } | null>(null)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [marketListingsLoading, setMarketListingsLoading] = useState(false)
  const [creatorEarningsLoading, setCreatorEarningsLoading] = useState(false)
  const [paymentReviewsLoading, setPaymentReviewsLoading] = useState(false)
  const [paymentCloseWorkLoading, setPaymentCloseWorkLoading] = useState(false)
  const [paymentOrderLookupLoading, setPaymentOrderLookupLoading] = useState(false)
  const [confirmingRefundOrderNo, setConfirmingRefundOrderNo] = useState<string | null>(null)
  const [membershipPaymentsLoading, setMembershipPaymentsLoading] = useState(false)
  const [membershipPaymentSummaryLoading, setMembershipPaymentSummaryLoading] = useState(false)
  const [membershipPaymentDetailLoading, setMembershipPaymentDetailLoading] = useState(false)
  const [membershipPaymentActionOrderNo, setMembershipPaymentActionOrderNo] = useState<string | null>(null)
  const [moderatingListingId, setModeratingListingId] = useState<number | null>(null)
  const [settlingEarningId, setSettlingEarningId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [feedbackActionId, setFeedbackActionId] = useState<number | null>(null)
  const [couponActionId, setCouponActionId] = useState<number | null>(null)
  const [membershipActionUserId, setMembershipActionUserId] = useState<number | null>(null)
  const [auditActionFilter, setAuditActionFilter] = useState('')
  const [auditKeyword, setAuditKeyword] = useState('')
  const usersQueryRef = useRef<{
    keyword: string
    membershipStatus: '' | 'ACTIVE' | 'FREE'
    page: number
  }>({ keyword: '', membershipStatus: '', page: 1 })
  const userSearchDebounceRef = useRef<number | null>(null)
  const redemptionsPanelRef = useRef<HTMLDivElement | null>(null)

  const handleAdminNavigate = (view: AdminView) => {
    const nextSearchParams = new URLSearchParams(searchParams)
    if (view === 'overview') {
      nextSearchParams.delete('view')
    } else {
      nextSearchParams.set('view', view)
    }
    setSearchParams(nextSearchParams)
  }

  const markSectionLoading = useCallback((section: AdminDataSection) => {
    setLoadingSections((current) => {
      const next = new Set(current)
      next.add(section)
      return next
    })
    setFailedSections((current) => {
      const next = new Set(current)
      next.delete(section)
      return next
    })
  }, [])

  const markSectionLoaded = useCallback((section: AdminDataSection) => {
    setLoadedSections((current) => {
      const next = new Set(current)
      next.add(section)
      return next
    })
    setFailedSections((current) => {
      const next = new Set(current)
      next.delete(section)
      return next
    })
  }, [])

  const markSectionFailed = useCallback((section: AdminDataSection) => {
    setLoadedSections((current) => {
      const next = new Set(current)
      next.delete(section)
      return next
    })
    setFailedSections((current) => {
      const next = new Set(current)
      next.add(section)
      return next
    })
  }, [])

  const markSectionFinished = useCallback((section: AdminDataSection) => {
    setLoadingSections((current) => {
      const next = new Set(current)
      next.delete(section)
      return next
    })
  }, [])

  const runSectionLoad = useCallback(async (
    section: AdminDataSection,
    load: () => Promise<void>,
  ) => {
    markSectionLoading(section)
    try {
      await load()
      markSectionLoaded(section)
    } catch (loadError) {
      markSectionFailed(section)
      throw loadError
    } finally {
      markSectionFinished(section)
    }
  }, [markSectionFailed, markSectionFinished, markSectionLoaded, markSectionLoading])

  // 用户与会员列表的服务端分页加载：记录最近一次查询，供进视图初始化与操作后刷新复用；
  // 同时用 size=1 的查询取「有效 VIP」总数供总览页展示，避免整页拉取用户。
  const loadUsersSection = useCallback(async (query: {
    keyword: string
    membershipStatus: '' | 'ACTIVE' | 'FREE'
    page: number
  }) => {
    usersQueryRef.current = query
    await runSectionLoad('users', async () => {
      const [pageResponse, activeResponse] = await Promise.all([
        adminApi.listUsers({
          keyword: query.keyword || undefined,
          membershipStatus: query.membershipStatus,
          page: query.page,
          size: 20,
        }),
        adminApi.listUsers({ membershipStatus: 'ACTIVE', page: 1, size: 1 }),
      ])
      const payload = pageResponse.data.data
      setUsers(payload.records)
      setUserPage(payload.page)
      setUserTotal(payload.total)
      setUserTotalPages(Math.max(1, payload.totalPages))
      if (!query.keyword && !query.membershipStatus) {
        setAllUserTotal(payload.total)
      }
      setActiveUserTotal(activeResponse.data.data.total)
    })
  }, [runSectionLoad])

  const loadSection = useCallback(async (section: AdminDataSection) => {
    await runSectionLoad(section, async () => {
      switch (section) {
        case 'platformConfig': {
          const [configResponse, plansResponse] = await Promise.all([
            adminApi.getPlatformConfig(),
            adminApi.listMembershipPlans(),
          ])
          const nextConfig = configResponse.data.data
          const nextPlans = plansResponse.data.data
          setPlatformConfig(nextConfig)
          setPlatformPriceDraft(platformConfigToPriceDraft(nextConfig))
          setMembershipPlans(nextPlans)
          setMembershipPlanPriceDrafts(membershipPlansToPriceDrafts(nextPlans))
          return
        }
        case 'feedbacks': {
          const response = await adminApi.listFeedbackSubmissions()
          setFeedbacks(response.data.data)
          return
        }
        case 'coupons': {
          const response = await adminApi.listCoupons()
          setCoupons(response.data.data)
          return
        }
        case 'vipInvites': {
          const response = await adminApi.listVipInvites()
          setVipInvites(response.data.data)
          return
        }
        case 'users': {
          // 进视图统一回到未筛选的第 1 页；之后筛选/翻页由视图内状态驱动重载。
          setUserSearch('')
          setUserMembershipFilter('')
          await loadUsersSection({ keyword: '', membershipStatus: '', page: 1 })
          return
        }
        case 'membershipAuditLogs': {
          const response = await adminApi.listMembershipAuditLogs()
          setMembershipAuditLogs(response.data.data)
          return
        }
        case 'showcases': {
          const response = await adminApi.listShowcases()
          setShowcases(response.data.data)
          return
        }
        case 'resumes': {
          const response = await resumeApi.list()
          setResumes(response.data.data)
          return
        }
        case 'marketListings': {
          const response = await adminApi.listMarketplaceListings({
            page: 1,
            size: 20,
            reviewStatus: 'PENDING',
          })
          const payload = response.data.data
          setMarketListings(getMarketplacePageItems(payload))
          setMarketListingPage(payload.page)
          setMarketListingTotal(payload.total)
          setPendingMarketListingCount(payload.total)
          setMarketListingTotalPages(Math.max(1, getMarketplaceTotalPages(payload)))
          return
        }
        case 'creatorEarnings': {
          const response = await adminApi.listCreatorEarnings()
          setPendingCreatorEarnings(response.data.data)
          return
        }
        case 'creatorEarningCount': {
          const response = await adminApi.getCreatorEarningCount()
          setPendingCreatorEarningCount(response.data.data)
          return
        }
        case 'paymentReviews': {
          const response = await adminApi.listMarketplacePaymentReviews()
          setPaymentReviews(response.data.data)
          return
        }
        case 'marketPaymentIssues': {
          const response = await adminApi.getMarketplacePaymentReviewCount()
          setMarketplacePaymentIssueCount(response.data.data)
          return
        }
        case 'paymentCloseWork': {
          const response = await adminApi.listMarketplaceCloseWork()
          setPaymentCloseWork(response.data.data)
          return
        }
        case 'membershipSummary': {
          const response = await adminApi.getMembershipPaymentSummary()
          setMembershipPaymentSummary(response.data.data)
          return
        }
        case 'membershipOrders': {
          const response = await adminApi.listMembershipPaymentOrders({
            page: 1,
            size: 20,
            orderStatus: 'REFUND_REQUIRED',
            reviewStatus: '',
          })
          setMembershipPaymentOrders(response.data.data.records)
          setMembershipPaymentPage(response.data.data.page)
          setMembershipPaymentTotal(response.data.data.total)
          setMembershipPaymentTotalPages(Math.max(1, response.data.data.totalPages))
          return
        }
        case 'governance': {
          const [reportResponse, appealResponse] = await Promise.all([
            adminApi.listMarketplaceReports({ page: 1, size: 1, status: 'OPEN' }),
            adminApi.listMarketplaceAppeals({ page: 1, size: 1, status: 'OPEN' }),
          ])
          setPendingGovernanceCount(
            reportResponse.data.data.total + appealResponse.data.data.total,
          )
          return
        }
        case 'resumeReviewActionCount': {
          const response = await adminApi.getResumeReviewActionCount()
          setPendingResumeReviewCount(response.data.data)
          return
        }
      }
    })
  }, [loadUsersSection, runSectionLoad])

  const loadView = useCallback(async (view: AdminView) => {
    setError('')
    const sections = ADMIN_VIEW_LOAD_SECTIONS[view]
    await Promise.allSettled(sections.map((section) => loadSection(section)))
    if (view === 'overview') {
      setOverviewLastUpdatedAt(new Date())
    }
  }, [loadSection])

  const retryFailedSections = useCallback(async (view: AdminView) => {
    const sections = ADMIN_VIEW_LOAD_SECTIONS[view]
      .filter((section) => failedSections.has(section))
    await Promise.allSettled(sections.map((section) => loadSection(section)))
  }, [failedSections, loadSection])

  useEffect(() => {
    setError('')
    setSuccess('')
    setShowcaseActionError(null)
    window.scrollTo({ top: 0 })
    void loadView(activeView)
  }, [activeView, loadView])

  useEffect(() => {
    if (requestedView === null || isAdminView(requestedView)) return
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('view')
    setSearchParams(nextSearchParams, { replace: true })
  }, [requestedView, searchParams, setSearchParams])

  // 成功提示 5 秒后自动消失；视图切换或新消息会重置计时，错误提示保持手动清除。
  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(''), 5000)
    return () => window.clearTimeout(timer)
  }, [success])

  // 组件卸载时清理未触发的用户搜索防抖。
  useEffect(() => () => {
    if (userSearchDebounceRef.current !== null) {
      window.clearTimeout(userSearchDebounceRef.current)
    }
  }, [])

  // 展开兑换记录面板时滚动进可视区域（仅在 selectedInviteId 变化展开时触发）。
  useEffect(() => {
    if (selectedInviteId === null) return
    redemptionsPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }, [selectedInviteId])

  async function refreshFeedbacks() {
    await runSectionLoad('feedbacks', async () => {
      const { data: res } = await adminApi.listFeedbackSubmissions()
      setFeedbacks(res.data)
    })
  }

  async function refreshUsers() {
    await loadUsersSection(usersQueryRef.current)
  }

  // 视图内的搜索/筛选/翻页重载：分块状态由 runSectionLoad 维护，错误落到页面级错误条。
  async function reloadUsersPage(
    page: number,
    keyword = userSearch,
    membershipStatus = userMembershipFilter,
  ) {
    try {
      await loadUsersSection({ keyword: keyword.trim(), membershipStatus, page })
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '用户列表加载失败'))
    }
  }

  // 搜索框 300ms 防抖后走服务端查询；切换会员状态筛选立即查询，并取消未触发的防抖。
  const handleUserSearchChange = (value: string) => {
    setUserSearch(value)
    if (userSearchDebounceRef.current !== null) {
      window.clearTimeout(userSearchDebounceRef.current)
    }
    userSearchDebounceRef.current = window.setTimeout(() => {
      userSearchDebounceRef.current = null
      void reloadUsersPage(1, value)
    }, 300)
  }

  const handleUserMembershipFilterChange = (value: '' | 'ACTIVE' | 'FREE') => {
    setUserMembershipFilter(value)
    if (userSearchDebounceRef.current !== null) {
      window.clearTimeout(userSearchDebounceRef.current)
      userSearchDebounceRef.current = null
    }
    void reloadUsersPage(1, userSearch, value)
  }

  async function refreshMembershipAuditLogs() {
    await runSectionLoad('membershipAuditLogs', async () => {
      const { data: res } = await adminApi.listMembershipAuditLogs()
      setMembershipAuditLogs(res.data)
    })
  }

  async function refreshVipInvites() {
    await runSectionLoad('vipInvites', async () => {
      const { data: res } = await adminApi.listVipInvites()
      setVipInvites(res.data)
    })
  }

  async function refreshInviteRedemptions(inviteId: number) {
    setInviteRedemptions([])
    const { data: res } = await adminApi.listVipInviteRedemptions(inviteId)
    setInviteRedemptions(res.data)
  }

  async function refreshMarketplaceListings(
    page = marketListingPage,
    publicationStatus = marketPublicationFilter,
    moderationStatus = marketModerationFilter,
    reviewStatus = marketReviewFilter,
  ) {
    setMarketListingsLoading(true)
    try {
      await runSectionLoad('marketListings', async () => {
        const { data: res } = await adminApi.listMarketplaceListings({
          page,
          size: 20,
          publicationStatus,
          moderationStatus,
          reviewStatus,
        })
        setMarketListings(getMarketplacePageItems(res.data))
        setMarketListingPage(res.data.page)
        setMarketListingTotal(res.data.total)
        if (reviewStatus === 'PENDING' && !publicationStatus && !moderationStatus) {
          setPendingMarketListingCount(res.data.total)
        }
        setMarketListingTotalPages(Math.max(1, getMarketplaceTotalPages(res.data)))
      })
    } finally {
      setMarketListingsLoading(false)
    }
  }

  async function refreshPendingCreatorEarnings() {
    setCreatorEarningsLoading(true)
    try {
      await Promise.all([
        runSectionLoad('creatorEarnings', async () => {
          const { data: res } = await adminApi.listCreatorEarnings()
          setPendingCreatorEarnings(res.data)
        }),
        runSectionLoad('creatorEarningCount', async () => {
          const { data: res } = await adminApi.getCreatorEarningCount()
          setPendingCreatorEarningCount(res.data)
        }),
      ])
    } finally {
      setCreatorEarningsLoading(false)
    }
  }

  async function refreshMarketplacePaymentReviews(
    status = paymentReviewFilter,
  ) {
    setPaymentReviewsLoading(true)
    try {
      await runSectionLoad('paymentReviews', async () => {
        const { data: res } = await adminApi.listMarketplacePaymentReviews(status)
        setPaymentReviews(res.data)
      })
    } finally {
      setPaymentReviewsLoading(false)
    }
  }

  async function refreshMarketplacePaymentIssueCount() {
    await runSectionLoad('marketPaymentIssues', async () => {
      const { data: response } = await adminApi.getMarketplacePaymentReviewCount()
      setMarketplacePaymentIssueCount(response.data)
    })
  }

  async function refreshMarketplaceCloseWork() {
    setPaymentCloseWorkLoading(true)
    try {
      await runSectionLoad('paymentCloseWork', async () => {
        const { data: res } = await adminApi.listMarketplaceCloseWork()
        setPaymentCloseWork(res.data)
      })
    } finally {
      setPaymentCloseWorkLoading(false)
    }
  }

  async function refreshMembershipPaymentOrders(
    page: number,
    orderStatus: '' | MembershipPaymentOrderStatus,
    reviewStatus: '' | MembershipPaymentReviewStatus,
  ) {
    setMembershipPaymentsLoading(true)
    try {
      await runSectionLoad('membershipOrders', async () => {
        const { data: res } = await adminApi.listMembershipPaymentOrders({
          page,
          size: 20,
          orderStatus,
          reviewStatus,
        })
        setMembershipPaymentOrders(res.data.records)
        setMembershipPaymentPage(res.data.page)
        setMembershipPaymentTotal(res.data.total)
        setMembershipPaymentTotalPages(Math.max(1, res.data.totalPages))
      })
    } finally {
      setMembershipPaymentsLoading(false)
    }
  }

  async function refreshMembershipPaymentSummary() {
    setMembershipPaymentSummaryLoading(true)
    try {
      await runSectionLoad('membershipSummary', async () => {
        const { data: res } = await adminApi.getMembershipPaymentSummary()
        setMembershipPaymentSummary(res.data)
      })
    } finally {
      setMembershipPaymentSummaryLoading(false)
    }
  }

  async function refreshMembershipPaymentDashboard() {
    await Promise.all([
      refreshMembershipPaymentOrders(1, membershipPaymentOrderFilter, membershipPaymentReviewFilter),
      refreshMembershipPaymentSummary(),
    ])
  }

  async function showMembershipPaymentDetail(orderNo: string) {
    setMembershipPaymentDetailLoading(true)
    setError('')
    try {
      const { data: res } = await adminApi.getMembershipPaymentOrder(orderNo)
      setSelectedMembershipPaymentOrder(res.data)
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '会员支付订单详情加载失败'))
    } finally {
      setMembershipPaymentDetailLoading(false)
    }
  }

  async function lookupMarketplaceOrder() {
    const orderNo = paymentOrderLookup.trim()
    if (!orderNo) {
      setError('请输入完整的平台订单号')
      return
    }
    setPaymentOrderLookupLoading(true)
    setError('')
    setSuccess('')
    try {
      const { data: res } = await adminApi.getMarketplacePaymentReview(orderNo)
      setPaymentOrderLookupResult(res.data)
    } catch (err: unknown) {
      setPaymentOrderLookupResult(null)
      setError(getAdminErrorMessage(err, '订单查询失败'))
    } finally {
      setPaymentOrderLookupLoading(false)
    }
  }

  const requestRequiredReason = (message: string) => promptAdminValue({
    title: '填写操作原因',
    description: `${message}\n\n原因会写入审计记录，请填写可复核的真实说明。`,
    label: '操作原因',
    placeholder: '请填写具体原因',
    required: true,
    maxLength: 255,
    multiline: true,
    confirmText: '继续',
  })

  const handleSaveConfig = async () => {
    if (!platformConfigLoaded) {
      setError('会员价格配置尚未成功读取，已阻止保存默认值')
      return
    }

    const priceFields = [
      ['问卷优惠金额', platformPriceDraft.questionnaireCouponAmountYuan],
      ['人工精修单次价格', platformPriceDraft.resumeReviewPriceYuan],
    ] as const
    const parsedPrices = priceFields.map(([label, value]) => [label, parseYuanToCents(value)] as const)
    const invalidField = parsedPrices.find(([, value]) => value === null)
    if (invalidField) {
      setError(`${invalidField[0]}请输入大于等于 0 且最多两位小数的金额（元）`)
      return
    }
    if (!Number.isInteger(platformConfig.membershipPriceCents) || platformConfig.membershipPriceCents < 0) {
      setError('会员价格配置读取异常，请重新加载')
      return
    }

    const nextConfig: PlatformConfig = {
      ...platformConfig,
      questionnaireCouponAmountCents: parsedPrices[0][1]!,
      resumeReviewPriceCents: parsedPrices[1][1]!,
    }
    const confirmed = await confirmAdminAction({
      title: '保存会员价格配置',
      description: `问卷优惠金额：${formatAdminCents(nextConfig.questionnaireCouponAmountCents)}\n人工精修单次价格：${formatAdminCents(nextConfig.resumeReviewPriceCents)}`,
      confirmText: '确认保存',
    })
    if (!confirmed) return
    setSavingConfig(true)
    setError('')
    setSuccess('')
    try {
      const { data: res } = await adminApi.updatePlatformConfig(nextConfig)
      setPlatformConfig(res.data)
      setPlatformPriceDraft(platformConfigToPriceDraft(res.data))
      setSuccess('会员价格配置已更新')
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '会员价格配置更新失败'))
    } finally {
      setSavingConfig(false)
    }
  }

  const handleSaveMembershipPlan = async (plan: MembershipPlanAdmin) => {
    const priceYuan = membershipPlanPriceDrafts[plan.code] ?? formatYuanInput(plan.priceCents)
    const priceCents = priceYuan.trim() === '' ? null : parseYuanToCents(priceYuan)
    if (priceYuan.trim() !== '' && (priceCents === null || priceCents <= 0)) {
      setError(`${plan.name}价格请输入大于 0 且最多两位小数的金额（元）`)
      return
    }
    if (plan.enabled && priceCents === null) {
      setError(`请先填写${plan.name}价格`)
      return
    }

    const confirmed = await confirmAdminAction({
      title: `更新${plan.name}`,
      description: `状态：${plan.enabled ? '启用' : '关闭'}\n价格：${priceCents === null ? '未配置' : formatAdminCents(priceCents)}\n权益：${formatMembershipEntitlement(plan.entitlementType, plan.membershipDays)}`,
      confirmText: '确认更新',
      tone: plan.enabled ? 'default' : 'danger',
    })
    if (!confirmed) return

    setSavingMembershipPlanCode(plan.code)
    setError('')
    setSuccess('')
    try {
      const { data: res } = await adminApi.updateMembershipPlan(plan.code, {
        priceCents,
        enabled: plan.enabled,
      })
      setMembershipPlans((current) => current.map((item) => (
        item.code === res.data.code ? res.data : item
      )))
      setMembershipPlanPriceDrafts((current) => ({
        ...current,
        [res.data.code]: formatYuanInput(res.data.priceCents),
      }))
      await refreshMembershipAuditLogs()
      setSuccess(`${res.data.name}已更新`)
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '会员方案更新失败'))
    } finally {
      setSavingMembershipPlanCode(null)
    }
  }

  const handleApprove = async (feedback: FeedbackSubmissionAdmin) => {
    const reviewNote = await promptAdminValue({
      title: '通过问卷审核',
      description: '通过后，这条问卷会进入可发布评价状态。若当前活动配置了问卷奖励，系统会自动生成优惠码，可前往“支付优惠码”查看。',
      label: '审核备注（可选）',
      defaultValue: feedback.reviewNote ?? '',
      maxLength: 255,
      multiline: true,
      confirmText: '确认通过',
    })
    if (reviewNote === null) return
    setFeedbackActionId(feedback.id)
    setError('')
    setSuccess('')
    try {
      await adminApi.approveFeedback(feedback.id, reviewNote || undefined)
      await refreshFeedbacks()
      setSuccess('问卷已通过')
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '审核通过失败'))
    } finally {
      setFeedbackActionId(null)
    }
  }

  const handleReject = async (feedback: FeedbackSubmissionAdmin) => {
    const reviewNote = await promptAdminValue({
      title: '拒绝问卷',
      description: '拒绝原因会保留在审核记录中。',
      label: '拒绝原因',
      defaultValue: feedback.reviewNote ?? '',
      required: true,
      maxLength: 255,
      multiline: true,
      confirmText: '确认拒绝',
      tone: 'danger',
    })
    if (!reviewNote) return
    setFeedbackActionId(feedback.id)
    setError('')
    setSuccess('')
    try {
      await adminApi.rejectFeedback(feedback.id, reviewNote)
      await refreshFeedbacks()
      setSuccess('问卷已拒绝')
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '拒绝问卷失败'))
    } finally {
      setFeedbackActionId(null)
    }
  }

  const handlePublish = async (feedback: FeedbackSubmissionAdmin, nextAction: 'publish' | 'unpublish') => {
    if (!await confirmAdminAction(nextAction === 'publish'
      ? {
        title: '发布评价',
        description: '发布后，这条评价将展示到首页用户口碑区域，所有访客可见。\n\n确认发布？',
        confirmText: '确认发布',
      }
      : {
        title: '下线评价',
        description: '下线后，这条评价将立即从首页移除。\n\n确认下线？',
        confirmText: '确认下线',
        tone: 'danger',
      })) {
      return
    }
    setFeedbackActionId(feedback.id)
    setError('')
    setSuccess('')
    try {
      if (nextAction === 'publish') {
        await adminApi.publishFeedback(feedback.id)
      } else {
        await adminApi.unpublishFeedback(feedback.id)
      }
      await refreshFeedbacks()
      setSuccess(nextAction === 'publish' ? '评价已发布' : '评价已下线')
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '操作失败'))
    } finally {
      setFeedbackActionId(null)
    }
  }

  const handleResendCoupon = async (coupon: CouponAdmin) => {
    const confirmed = await confirmAdminAction({
      title: '重发优惠码邮件',
      description: `优惠码：${coupon.code}\n收件账号：${coupon.recipientEmail}\n\n确认重新发送？`,
      confirmText: '确认重发',
    })
    if (!confirmed) return

    setCouponActionId(coupon.id)
    setError('')
    setSuccess('')
    try {
      const { data: response } = await adminApi.resendCoupon(coupon.id)
      setCoupons((current) => current.map((item) => (
        item.id === response.data.id ? response.data : item
      )))
      setSuccess('优惠码已重发')
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '重发失败'))
    } finally {
      setCouponActionId(null)
    }
  }

  const handleMembership = async (user: UserAdmin, action: 'grant' | 'revoke') => {
    const userLabel = getUserAdminLabel(user)
    const reason = await requestRequiredReason(
      action === 'grant'
        ? `请输入为 ${userLabel} 手工开通永久 VIP 的原因（必填）`
        : `请输入撤销 ${userLabel} VIP 权益的原因（必填）`,
    )
    if (!reason) {
      return
    }
    if (!await confirmAdminAction({
      title: action === 'grant' ? '开通永久 VIP' : '撤销 VIP 权益',
      description: action === 'grant'
        ? `确认为 ${userLabel} 手工开通永久 VIP？\n\n操作原因会写入审计日志。`
        : `确认撤销 ${userLabel} 当前的 VIP 权益？\n\n用户会立即失去对应会员能力，操作原因会写入审计日志。`,
      confirmText: action === 'grant' ? '确认开通' : '确认撤销',
      tone: action === 'revoke' ? 'danger' : 'default',
    })) return
    setMembershipActionUserId(user.id)
    setError('')
    setSuccess('')
    try {
      if (action === 'grant') {
        await adminApi.grantMembership(user.id, reason)
      } else {
        await adminApi.revokeMembership(user.id, reason)
      }
      await Promise.all([refreshUsers(), refreshMembershipAuditLogs()])
      setSuccess(action === 'grant' ? '会员已开通' : '会员已撤销')
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '会员操作失败'))
    } finally {
      setMembershipActionUserId(null)
    }
  }

  const handleExtendMembership = async (user: UserAdmin) => {
    const userLabel = getUserAdminLabel(user)
    const rawDays = await promptAdminValue({
      title: '延长会员有效期',
      description: `为 ${userLabel} 增加会员有效期。`,
      label: '延期天数',
      defaultValue: '30',
      required: true,
      maxLength: 4,
      inputMode: 'numeric',
      confirmText: '下一步',
      validate: (value) => {
        const parsed = Number(value)
        return Number.isInteger(parsed) && parsed >= 1 && parsed <= 3650
          ? null
          : '延期天数必须是 1-3650 之间的整数'
      },
    })
    if (!rawDays) {
      return
    }
    const days = Number(rawDays)
    const reason = await requestRequiredReason(`请输入为 ${userLabel} 延期 ${days} 天的原因（必填）`)
    if (!reason) {
      return
    }
    if (!await confirmAdminAction({
      title: '确认延长会员有效期',
      description: `为 ${userLabel} 延期 ${days} 天。\n\n操作原因会写入审计日志。`,
      confirmText: '确认延期',
    })) return
    setMembershipActionUserId(user.id)
    setError('')
    setSuccess('')
    try {
      await adminApi.extendMembership(user.id, days, reason)
      await Promise.all([refreshUsers(), refreshMembershipAuditLogs()])
      setSuccess(`已为 ${userLabel} 延期 ${days} 天`)
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '会员延期失败'))
    } finally {
      setMembershipActionUserId(null)
    }
  }

  const handleCreateInvite = async () => {
    const expiresInDays = Number(inviteForm.expiresInDays)
    const maxRedemptions = Number(inviteForm.maxRedemptions)
    const membershipDays = Number(inviteForm.membershipDays)
    if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365) {
      setError('邀请码有效天数必须是 1-365 之间的整数')
      return
    }
    if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 100000) {
      setError('邀请码兑换名额必须是 1-100000 之间的整数')
      return
    }
    if (![30, 90, 365].includes(membershipDays)) {
      setError('邀请码会员权益只能选择 30 天、90 天或 365 天')
      return
    }
    setCreatingInvite(true)
    setError('')
    setSuccess('')
    try {
      const { data: res } = await adminApi.createVipInvite({
        remark: inviteForm.remark.trim() || undefined,
        expiresInDays,
        maxRedemptions,
        membershipDays,
      })
      await Promise.all([refreshVipInvites(), refreshMembershipAuditLogs()])
      setSuccess(`VIP 邀请码 ${res.data.code} 已生成`)
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '邀请码生成失败'))
    } finally {
      setCreatingInvite(false)
    }
  }

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setSuccess(successMessage)
    } catch {
      await promptAdminValue({
        title: '手动复制内容',
        description: '浏览器没有授予自动复制权限，请选中下面的内容手动复制。',
        label: '待复制内容',
        defaultValue: text,
        multiline: true,
        confirmText: '关闭',
        cancelText: '取消',
      })
    }
  }

  const buildPlanetPost = (invite: VipInviteAdmin) => {
    const configuredPublicUrl = (import.meta.env.VITE_APP_PUBLIC_URL as string | undefined)?.trim()
    const publicOrigin = (configuredPublicUrl || window.location.origin).replace(/\/+$/, '')
    const remaining = Math.max(0, invite.maxRedemptions - invite.redeemedCount)
    return [
      `【二哥编程星球专属｜派简历 ${invite.membershipDays} 天 VIP】`,
      '',
      `派简历网站：${publicOrigin}`,
      `领取入口：${publicOrigin}/vip/claim`,
      `VIP 邀请码：${invite.code}`,
      '',
      '使用方法：',
      '1. 打开领取入口并输入邀请码；',
      '2. 未登录用户使用派聪明扫码注册领取，已登录用户直接领取。',
      '',
      `兑换成功后，从兑换成功的时间开始获得完整 ${invite.membershipDays} 天 VIP。`,
      '普通用户可以编辑、保存和导入简历，也可以查看公开的优质简历。',
      'VIP 用户可使用 AI 优化与分析、PDF 导出，并解锁需要 VIP 权益的优质简历。',
      '',
      `兑换截止：${invite.expiresAt ?? '以后台状态为准'}`,
      `剩余名额：${remaining}/${invite.maxRedemptions}，先到先得。`,
      '',
      '请注意：',
      '- 这是“VIP 邀请码”，不是支付优惠码，兑换时不需要付款；',
      '- 每个账号只能领取一次，不能叠加，也不能用新的邀请码重复续期；',
      `- 兑换截止时间只限制何时领取，不会缩短已经领取的 ${invite.membershipDays} 天权益；`,
      '- VIP 到期后不会自动续期，如需继续使用，可重新购买或由管理员在后台延期；',
      '- 邀请码仅限本知识星球成员本人使用，请勿截图、转发或发布到公开渠道；如发现泄露，邀请码可能立即作废，异常领取的 VIP 权益也可能被撤销。',
      '',
      '若遇到兑换问题，请在星球内联系我，并提供派简历用户编号，方便核查。',
    ].join('\n')
  }

  const handleInvalidateInvite = async (invite: VipInviteAdmin) => {
    if (!await confirmAdminAction({
      title: `作废邀请码 ${invite.code}`,
      description: '作废只会阻止新用户继续兑换，不会影响已经领取的 VIP 权益。',
      confirmText: '确认作废',
      tone: 'danger',
    })) {
      return
    }
    const reason = await requestRequiredReason('请输入作废该邀请码的原因（必填）')
    if (!reason) {
      return
    }
    setError('')
    setSuccess('')
    try {
      await adminApi.invalidateVipInvite(invite.id, reason)
      await Promise.all([refreshVipInvites(), refreshMembershipAuditLogs()])
      setSuccess(`邀请码 ${invite.code} 已作废，已领取权益不受影响`)
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '邀请码作废失败'))
    }
  }

  const handleViewInviteRedemptions = async (invite: VipInviteAdmin) => {
    if (selectedInviteId === invite.id) {
      setSelectedInviteId(null)
      setInviteRedemptions([])
      return
    }
    try {
      await refreshInviteRedemptions(invite.id)
      setSelectedInviteId(invite.id)
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '兑换记录加载失败'))
    }
  }

  const handleRevokeInviteRedemption = async (redemption: VipInviteRedemptionAdmin) => {
    const reason = await requestRequiredReason(
      `请输入撤销 ${redemption.userEmail} 这条异常兑换的原因（必填）`,
    )
    if (!reason) {
      return
    }
    if (!await confirmAdminAction({
      title: '撤销异常邀请码兑换',
      description: '如果用户当前 VIP 仍来自这次兑换，权益会立即撤销；如果已由支付或管理员另行开通，则保留当前权益。',
      confirmText: '确认撤销',
      tone: 'danger',
    })) {
      return
    }
    setError('')
    setSuccess('')
    try {
      await adminApi.revokeVipInviteRedemption(
        redemption.inviteCodeId,
        redemption.id,
        reason,
      )
      await Promise.all([
        refreshInviteRedemptions(redemption.inviteCodeId),
        refreshVipInvites(),
        refreshUsers(),
        refreshMembershipAuditLogs(),
      ])
      setSuccess(`已撤销 ${redemption.userEmail} 的异常兑换记录`)
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '异常兑换撤销失败'))
    }
  }

  const handleModerateMarketplaceListing = async (
    listing: AdminMarketListing,
    action: MarketplaceListingModerationAction,
  ) => {
    const actionLabel = action === 'APPROVE'
      ? '通过投稿'
      : action === 'REJECT'
        ? '驳回投稿'
        : action === 'TAKEDOWN'
          ? '下架条目'
          : '恢复条目'
    const reason = await requestRequiredReason(`请输入“${actionLabel}《${listing.title}》”的原因（必填，将写入审计记录）`)
    if (!reason) return
    const confirmation = action === 'APPROVE'
      ? '确认通过这次投稿？\n\n待审版本会成为新的公开版本；如果创作者在等待期间主动取消发布，审核通过也不会自动重新上架。'
      : action === 'REJECT'
        ? '确认驳回这次投稿？\n\n已有已通过版本会继续展示，待审版本不会公开；创作者可以发起申诉。'
        : action === 'TAKEDOWN'
          ? '确认下架这份公开简历？\n\n下架后，除作者和管理员外的所有访问都会被阻止，包括历史买家；同时会关闭该版本尚未完成的成交。'
          : '确认恢复这份公开简历的访问资格？\n\n恢复只解除平台风控下架，不会覆盖创作者自己的发布/下架选择。'
    if (!await confirmAdminAction({
      title: actionLabel,
      description: confirmation,
      confirmText: `确认${actionLabel}`,
      tone: action === 'APPROVE' || action === 'RESTORE' ? 'default' : 'danger',
    })) {
      return
    }

    setModeratingListingId(listing.id)
    setError('')
    setSuccess('')
    try {
      await adminApi.moderateMarketplaceListing(listing.id, action, reason)
      await refreshMarketplaceListings()
      setGovernanceAuditRefreshKey((current) => current + 1)
      setSuccess(`《${listing.title}》已${actionLabel}`)
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '公开简历审核失败'))
    } finally {
      setModeratingListingId(null)
    }
  }

  const handleSettleCreatorEarning = async (earning: CreatorEarning) => {
    const seller = earning.sellerEmail || `作者 #${earning.sellerUserId}`
    const settlementNote = await requestRequiredReason(
      `请填写向 ${seller} 转账的流水号或结算备注（必填）`,
    )
    if (!settlementNote) return
    if (!await confirmAdminAction({
      title: '确认线下结算',
      description: `确认已向 ${seller} 线下转账 ${formatAdminCents(getCreatorEarningIncome(earning))}？\n\n确认后该笔收益会标记为已结算。`,
      confirmText: '确认已转账',
      tone: 'danger',
    })) {
      return
    }

    setSettlingEarningId(earning.id)
    setError('')
    setSuccess('')
    try {
      await adminApi.settleCreatorEarning(earning.id, settlementNote)
      await refreshPendingCreatorEarnings()
      setSuccess(`已登记 ${seller} 的线下转账，收益状态已更新为已结算`)
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '线下结算登记失败'))
    } finally {
      setSettlingEarningId(null)
    }
  }

  const handleConfirmMarketplaceRefund = async (review: MarketplacePaymentReview) => {
    const rawReference = await promptAdminValue({
      title: '登记市场订单退款',
      description: '请先在支付商户平台核实并完成全额原路退款。本页面只登记结果，不会自动发起退款。',
      label: '商户退款单号或核验流水',
      required: true,
      maxLength: 128,
      confirmText: '下一步',
      tone: 'danger',
    })
    if (rawReference === null) return
    const refundReference = rawReference.trim()
    if (!refundReference || refundReference.length > 128) {
      setError('退款单号或核验流水不能为空，且不能超过 128 个字符')
      return
    }

    const rawNote = await promptAdminValue({
      title: '补充退款核对说明',
      description: `订单 ${review.orderNo} · ${formatAdminCents(review.amountCents)}`,
      label: '退款核对备注',
      placeholder: '例如退款渠道、核对人和用户沟通情况',
      required: true,
      maxLength: 255,
      multiline: true,
      confirmText: '下一步',
      tone: 'danger',
    })
    if (rawNote === null) return
    const note = rawNote.trim()
    if (!note || note.length > 255) {
      setError('退款备注不能为空，且不能超过 255 个字符')
      return
    }

    if (!await confirmAdminAction({
      title: '再次确认外部退款已完成',
      description: `你已经在 ${review.provider} 商户平台为订单 ${review.orderNo} 实际完成 ${formatAdminCents(review.amountCents)} 的原路退款。\n\n本操作只登记退款结果，不会发起退款；确认后订单将标记为已退款。`,
      confirmText: '确认已退款',
      tone: 'danger',
    })) {
      return
    }

    setConfirmingRefundOrderNo(review.orderNo)
    setError('')
    setSuccess('')
    try {
      const { data: response } = await adminApi.confirmMarketplaceRefund(review.orderNo, refundReference, note)
      if (paymentOrderLookupResult?.orderNo === review.orderNo) {
        setPaymentOrderLookupResult(response.data)
      }
      await Promise.all([
        refreshMarketplacePaymentReviews(),
        refreshMarketplacePaymentIssueCount(),
      ])
      setSuccess(`订单 ${review.orderNo} 的外部退款结果已登记`)
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, '退款结果登记失败'))
    } finally {
      setConfirmingRefundOrderNo(null)
    }
  }

  const handleMembershipPaymentReviewAction = async (
    order: MembershipPaymentAdminOrder,
    action: 'START_REFUND' | 'CONFIRM_REFUNDED' | 'REJECT_REFUND' | 'CLOSE_REVIEW',
  ) => {
    const hasGrantedEntitlement = Boolean(order.membershipStartedAt || order.membershipExpiresAt)
    if (hasGrantedEntitlement && (action === 'START_REFUND' || action === 'CONFIRM_REFUNDED')) {
      setError('本订单已经发放会员权益。请先按权益来源重算并完成人工权益处置，不能直接登记退款。')
      return
    }

    const actionName = MEMBERSHIP_PAYMENT_AUDIT_ACTION_LABELS[action]
    const reason = await requestRequiredReason(`请输入“${actionName}”的操作原因（必填，将写入审计日志）`)
    if (!reason) return

    let refundReference = ''
    if (action === 'START_REFUND' || action === 'CONFIRM_REFUNDED') {
      const rawReference = await promptAdminValue({
        title: action === 'CONFIRM_REFUNDED' ? '确认会员订单退款' : '登记退款处理中',
        description: action === 'CONFIRM_REFUNDED'
          ? '请填写商户平台的真实退款单号或核验流水。本页面不会发起退款。'
          : '如商户平台已经生成退款单号，可在此填写。本页面只登记处理状态，不会发起退款。',
        label: action === 'CONFIRM_REFUNDED' ? '退款单号或核验流水' : '退款单号或核验流水（可选）',
        defaultValue: order.refundReference ?? '',
        required: action === 'CONFIRM_REFUNDED',
        maxLength: 128,
        confirmText: '下一步',
        tone: 'danger',
      })
      if (rawReference === null) return
      refundReference = rawReference.trim()
      if (action === 'CONFIRM_REFUNDED' && !refundReference) {
        setError('确认退款必须填写商户平台退款单号或核验流水')
        return
      }
      if (refundReference.length > 128) {
        setError('退款单号或核验流水不能超过 128 个字符')
        return
      }
    }

    const confirmation = action === 'CONFIRM_REFUNDED'
      ? `确认已在商户平台为会员订单 ${order.orderNo} 完成原路退款？\n\n本操作只登记商户平台结果，不会发起退款。`
      : action === 'START_REFUND'
        ? `确认已在商户平台开始处理会员订单 ${order.orderNo} 的退款？\n\n本操作只更新后台复核状态，不会发起退款。`
        : `确认${actionName}会员订单 ${order.orderNo}？\n\n操作原因会永久写入审计记录。`
    if (!await confirmAdminAction({
      title: actionName,
      description: confirmation,
      confirmText: `确认${actionName}`,
      tone: action === 'CLOSE_REVIEW' ? 'default' : 'danger',
    })) return

    setMembershipPaymentActionOrderNo(order.orderNo)
    setError('')
    setSuccess('')
    try {
      const response = action === 'START_REFUND'
        ? await adminApi.startMembershipRefund(order.orderNo, reason, refundReference || undefined)
        : action === 'CONFIRM_REFUNDED'
          ? await adminApi.confirmMembershipRefund(order.orderNo, reason, refundReference)
          : action === 'REJECT_REFUND'
            ? await adminApi.rejectMembershipRefund(order.orderNo, reason)
            : await adminApi.closeMembershipPaymentReview(order.orderNo, reason)
      setSelectedMembershipPaymentOrder(response.data.data)
      await Promise.all([
        refreshMembershipPaymentOrders(
          membershipPaymentPage,
          membershipPaymentOrderFilter,
          membershipPaymentReviewFilter,
        ),
        refreshMembershipPaymentSummary(),
      ])
      setSuccess(`会员订单 ${order.orderNo}：${actionName}成功`)
    } catch (err: unknown) {
      setError(getAdminErrorMessage(err, `${actionName}失败`))
    } finally {
      setMembershipPaymentActionOrderNo(null)
    }
  }

  const handleFeatureShowcase = async (
    resume: ResumeListItem,
    accessType: ResumeShowcaseAccessType,
    priceCents: number,
  ) => {
    setShowcaseActionResumeId(resume.id)
    setShowcaseActionError(null)
    setError('')
    setSuccess('')
    try {
      const wasFeatured = showcases.some(
        (showcase) => showcase.resumeId === resume.id && showcase.publishStatus === 'PUBLISHED',
      )
      const response = await adminApi.featureShowcaseResume(resume.id, { accessType, priceCents })
      setShowcases((current) => upsertShowcase(current, response.data.data))
      setSuccess(wasFeatured
        ? `已更新「${resume.title}」的展示设置`
        : `已精选「${resume.title}」`)
    } catch (err: unknown) {
      setShowcaseActionError({
        resumeId: resume.id,
        message: getAdminErrorMessage(err, '精选失败'),
      })
    } finally {
      setShowcaseActionResumeId(null)
    }
  }

  const handleUnfeatureShowcase = async (resume: ResumeListItem) => {
    setShowcaseActionResumeId(resume.id)
    setShowcaseActionError(null)
    setError('')
    setSuccess('')
    try {
      const response = await adminApi.unfeatureShowcaseResume(resume.id)
      setShowcases((current) => upsertShowcase(current, response.data.data))
      setSuccess(`已取消精选「${resume.title}」`)
    } catch (err: unknown) {
      setShowcaseActionError({
        resumeId: resume.id,
        message: getAdminErrorMessage(err, '取消精选失败'),
      })
    } finally {
      setShowcaseActionResumeId(null)
    }
  }

  const usersLoaded = loadedSections.has('users')
  const invitesLoaded = loadedSections.has('vipInvites')
  const showcasesLoaded = loadedSections.has('showcases')
  const feedbacksLoaded = loadedSections.has('feedbacks')
  const marketListingsLoaded = loadedSections.has('marketListings')
  const creatorEarningCountLoaded = loadedSections.has('creatorEarningCount')
  const marketPaymentIssuesLoaded = loadedSections.has('marketPaymentIssues')
  const membershipSummaryLoaded = loadedSections.has('membershipSummary')
  const governanceLoaded = loadedSections.has('governance')
  const resumeReviewActionCountLoaded = loadedSections.has('resumeReviewActionCount')
  const platformConfigLoaded = loadedSections.has('platformConfig')
  const activeViewLoadState = getAdminViewLoadState(
    activeView,
    loadedSections,
    loadingSections,
    failedSections,
  )
  // 已完整加载过（含失败）的视图在手动刷新、筛选或翻页重载期间保留现有内容，
  // 只让对应按钮进入"刷新中…"，避免整屏骨架反复闪烁；首次进入仍显示骨架。
  const activeViewLoadedOnce = ADMIN_VIEW_LOAD_SECTIONS[activeView].every(
    (section) => loadedSections.has(section) || failedSections.has(section),
  )
  const activeViewLoading = activeViewLoadState === 'loading' && !activeViewLoadedOnce
  const activeViewFailedSections = getAdminViewFailedSections(activeView, failedSections)
  const failedSectionLabels = activeViewFailedSections.map(
    (section) => ADMIN_DATA_SECTION_LABELS[section],
  )
  const retryingFailedSections = activeViewFailedSections.some(
    (section) => loadingSections.has(section),
  )
  const overviewDataComplete = OVERVIEW_LOAD_SECTIONS.every((section) => loadedSections.has(section))
  const overviewRefreshing = OVERVIEW_LOAD_SECTIONS.some((section) => loadingSections.has(section))
  const usersLoading = loadingSections.has('users')
  const membershipAuditLogsLoading = loadingSections.has('membershipAuditLogs')
  const activeMemberCount = usersLoaded ? activeUserTotal : null
  const selectedInvite = selectedInviteId === null
    ? null
    : vipInvites.find((invite) => invite.id === selectedInviteId) ?? null
  const auditActionOptions = useMemo(() => (
    Array.from(new Set(membershipAuditLogs.map((log) => log.action)))
  ), [membershipAuditLogs])
  const filteredAuditLogs = useMemo(() => {
    const keyword = auditKeyword.trim().toLowerCase()
    return membershipAuditLogs.filter((log) => {
      if (auditActionFilter && log.action !== auditActionFilter) return false
      if (!keyword) return true
      return [log.adminEmail, log.targetUserEmail, log.reason, log.details]
        .some((field) => (field ?? '').toLowerCase().includes(keyword))
    })
  }, [auditActionFilter, auditKeyword, membershipAuditLogs])
  const activeInviteCount = invitesLoaded ? vipInvites.filter(isInvitePublishable).length : null
  const publishedShowcaseCount = showcasesLoaded
    ? showcases.filter((showcase) => showcase.publishStatus === 'PUBLISHED').length
    : null
  const pendingFeedbackCount = feedbacksLoaded
    ? feedbacks.filter((feedback) => feedback.reviewStatus === 'PENDING').length
    : null
  const membershipPaymentIssueCount = membershipSummaryLoaded && membershipPaymentSummary
    ? membershipPaymentSummary.pendingReviews + membershipPaymentSummary.refundProcessingReviews
    : null
  const adminBadges: Partial<Record<AdminView, number>> = {
    'marketplace-listings': marketListingsLoaded ? pendingMarketListingCount : undefined,
    'marketplace-governance': governanceLoaded ? pendingGovernanceCount : undefined,
    'creator-earnings': creatorEarningCountLoaded ? pendingCreatorEarningCount : undefined,
    'marketplace-payments': marketPaymentIssuesLoaded ? marketplacePaymentIssueCount : undefined,
    'membership-payments': membershipPaymentIssueCount ?? undefined,
    'resume-reviews': resumeReviewActionCountLoaded ? pendingResumeReviewCount : undefined,
    surveys: pendingFeedbackCount ?? undefined,
  }

  return (
    <AdminShell
      activeView={activeView}
      badges={adminBadges}
    >
      <div className="admin-workspace space-y-6">
        {failedSectionLabels.length ? (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="leading-5">
              加载失败：{failedSectionLabels.join('、')}；对应模块已暂停操作。
            </span>
            <button
              type="button"
              onClick={() => void retryFailedSections(activeView)}
              disabled={retryingFailedSections}
              className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
            >
              {retryingFailedSections ? '重试中…' : '重试失败模块'}
            </button>
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold" aria-hidden="true">!</span>
            <span className="leading-5">{error}</span>
          </div>
        ) : null}
        {success ? (
          <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold" aria-hidden="true">✓</span>
            <span className="leading-5">{success}</span>
          </div>
        ) : null}

        {activeViewLoading ? (
          <div className="space-y-5" aria-label="正在加载管理数据">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="m-5 h-3 w-20 rounded bg-slate-100" />
                  <div className="mx-5 mt-5 h-8 w-16 rounded bg-slate-100" />
                </div>
              ))}
            </div>
            <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
          </div>
        ) : activeViewFailedSections.length ? (
          <section role="alert" className="rounded-2xl border border-red-200 bg-white px-6 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-lg font-bold text-red-600" aria-hidden="true">
              !
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-950">当前模块数据加载失败</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
              {activeViewFailedSections.map((section) => ADMIN_DATA_SECTION_LABELS[section]).join('、')}
              加载失败，本页操作已暂停。
            </p>
            <button
              type="button"
              onClick={() => void loadView(activeView)}
              className="mt-5 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              重新加载当前模块
            </button>
          </section>
        ) : (
          <>
            {activeView === 'overview' ? (
              <AdminOverview
                activeInviteCount={activeInviteCount}
                activeMemberCount={activeMemberCount}
                dataComplete={overviewDataComplete}
                failedSections={failedSectionLabels}
                lastUpdatedAt={overviewLastUpdatedAt}
                marketplacePaymentIssueCount={marketPaymentIssuesLoaded ? marketplacePaymentIssueCount : null}
                membershipPaymentIssueCount={membershipPaymentIssueCount}
                pendingCreatorEarningCount={creatorEarningCountLoaded ? pendingCreatorEarningCount : null}
                pendingFeedbackCount={pendingFeedbackCount}
                pendingGovernanceCount={governanceLoaded ? pendingGovernanceCount : null}
                pendingListingCount={marketListingsLoaded ? pendingMarketListingCount : null}
                pendingResumeReviewCount={resumeReviewActionCountLoaded ? pendingResumeReviewCount : null}
                publishedShowcaseCount={publishedShowcaseCount}
                refreshing={overviewRefreshing}
                totalUserCount={usersLoaded ? allUserTotal : null}
                reconciliationFailureCount={
                  membershipSummaryLoaded
                    ? membershipPaymentSummary?.reconciliationFailuresSinceStart ?? 0
                    : null
                }
                lastReconciliationFailureAt={membershipPaymentSummary?.lastReconciliationFailureAt ?? null}
                onNavigate={handleAdminNavigate}
                onRefresh={() => void loadView('overview')}
              />
            ) : null}
            {activeView === 'platform-config' || activeView === 'showcases' ? (
              <section className={activeView === 'platform-config' ? 'max-w-5xl' : ''}>
                {activeView === 'platform-config' ? (
                  <div className="space-y-6">
                    {!platformConfigLoaded ? (
                      <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                        当前配置读取失败，请重新加载。
                      </div>
                    ) : null}

                    <div className="rounded-lg border border-gray-200 bg-white px-6 py-6">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900">会员方案</h2>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {membershipPlans.map((plan) => (
                          <div key={plan.code} className="rounded-lg border border-gray-200 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                                  {plan.recommended ? (
                                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">推荐</span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-sm text-gray-500">
                                  {plan.entitlementType === 'PERMANENT' ? '永久有效' : `${plan.membershipDays ?? '-'} 天`}
                                </p>
                              </div>
                              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={plan.enabled}
                                  disabled={!platformConfigLoaded || savingMembershipPlanCode === plan.code}
                                  onChange={(event) => setMembershipPlans((current) => current.map((item) => (
                                    item.code === plan.code ? { ...item, enabled: event.target.checked } : item
                                  )))}
                                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                开放
                              </label>
                            </div>
                            <label className="mt-4 block">
                              <span className="mb-2 block text-sm font-medium text-gray-700">价格（元）</span>
                              <input
                                type="number"
                                min={0.01}
                                step={0.01}
                                inputMode="decimal"
                                value={membershipPlanPriceDrafts[plan.code] ?? formatYuanInput(plan.priceCents)}
                                disabled={!platformConfigLoaded || savingMembershipPlanCode === plan.code}
                                onChange={(event) => setMembershipPlanPriceDrafts((current) => ({
                                  ...current,
                                  [plan.code]: event.target.value,
                                }))}
                                placeholder="未设置"
                                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => void handleSaveMembershipPlan(plan)}
                              disabled={!platformConfigLoaded || savingMembershipPlanCode !== null}
                              className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                            >
                              {savingMembershipPlanCode === plan.code ? '保存中...' : '保存'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white px-6 py-6">
                      <h2 className="text-lg font-semibold text-gray-900">其他价格</h2>
                      <div className="mt-5 space-y-4">
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-gray-700">问卷优惠金额（元）</span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            inputMode="decimal"
                            disabled={!platformConfigLoaded}
                            value={platformPriceDraft.questionnaireCouponAmountYuan}
                            onChange={(event) => setPlatformPriceDraft((current) => ({
                              ...current,
                              questionnaireCouponAmountYuan: event.target.value,
                            }))}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-gray-700">人工精修单次价格（元）</span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            inputMode="decimal"
                            required
                            disabled={!platformConfigLoaded}
                            value={platformPriceDraft.resumeReviewPriceYuan}
                            onChange={(event) => setPlatformPriceDraft((current) => ({
                              ...current,
                              resumeReviewPriceYuan: event.target.value,
                            }))}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void handleSaveConfig()}
                          disabled={savingConfig || !platformConfigLoaded}
                          className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                        >
                          {savingConfig ? '保存中...' : '保存配置'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeView === 'showcases' ? (
                  <AdminShowcasePanel
                    resumes={resumes}
                    showcases={showcases}
                    actionResumeId={showcaseActionResumeId}
                    actionError={showcaseActionError}
                    loading={loadingSections.has('showcases') || loadingSections.has('resumes')}
                    onFeature={(resume, accessType, priceCents) => void handleFeatureShowcase(resume, accessType, priceCents)}
                    onUnfeature={(resume) => void handleUnfeatureShowcase(resume)}
                  />
                ) : null}
              </section>
            ) : null}

            {activeView === 'resume-reviews' ? (
              <ResumeReviewAdminPanel
                onActionCountChanged={() => loadSection('resumeReviewActionCount')}
              />
            ) : null}

            {activeView === 'content-library' ? (
              <AdminContentLibraryPanel />
            ) : null}
            {activeView === 'analysis-prompts' ? (
              <ResumeAnalysisPromptAdminPanel />
            ) : null}
            {activeView === 'ai-provider' ? (
              <AiProviderAdminPanel />
            ) : null}

            {activeView === 'marketplace-listings' ? (
              <section className="rounded-lg border border-blue-200 bg-white px-6 py-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">投稿审核与上下架</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <select
                    aria-label="投稿审核状态筛选"
                    value={marketReviewFilter}
                    onChange={(event) => {
                      const value = event.target.value as '' | MarketplaceReviewStatus
                      setMarketReviewFilter(value)
                      setMarketListingPage(1)
                      void refreshMarketplaceListings(
                        1,
                        marketPublicationFilter,
                        marketModerationFilter,
                        value,
                      ).catch((err: unknown) => {
                        setError(getAdminErrorMessage(err, '投稿审核列表加载失败'))
                      })
                    }}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="">全部投稿状态</option>
                    <option value="PENDING">待审核</option>
                    <option value="REJECTED">已驳回</option>
                    <option value="APPROVED">已通过</option>
                  </select>
                  <select
                    aria-label="发布状态筛选"
                    value={marketPublicationFilter}
                    onChange={(event) => {
                      const value = event.target.value as '' | 'PUBLISHED' | 'UNPUBLISHED'
                      setMarketPublicationFilter(value)
                      setMarketListingPage(1)
                      void refreshMarketplaceListings(1, value, marketModerationFilter, marketReviewFilter).catch((err: unknown) => {
                        setError(getAdminErrorMessage(err, '公开简历列表加载失败'))
                      })
                    }}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="">全部发布状态</option>
                    <option value="PUBLISHED">已发布</option>
                    <option value="UNPUBLISHED">已下架</option>
                  </select>
                  <select
                    aria-label="平台风控状态筛选"
                    value={marketModerationFilter}
                    onChange={(event) => {
                      const value = event.target.value as '' | 'APPROVED' | 'SUSPENDED'
                      setMarketModerationFilter(value)
                      setMarketListingPage(1)
                      void refreshMarketplaceListings(1, marketPublicationFilter, value, marketReviewFilter).catch((err: unknown) => {
                        setError(getAdminErrorMessage(err, '公开简历列表加载失败'))
                      })
                    }}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="">全部风控状态</option>
                    <option value="APPROVED">平台正常</option>
                    <option value="SUSPENDED">平台已下架</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void refreshMarketplaceListings().catch((err: unknown) => {
                      setError(getAdminErrorMessage(err, '公开简历列表加载失败'))
                    })}
                    disabled={marketListingsLoading}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-gray-300 hover:text-gray-900 disabled:cursor-wait disabled:opacity-50"
                  >
                    {marketListingsLoading ? '刷新中...' : '刷新'}
                  </button>
                </div>
              </div>

              {marketListingsLoading && marketListings.length === 0 ? (
                <p className="mt-5 text-sm text-gray-500">正在加载公开简历...</p>
              ) : marketListings.length ? (
                <AdminTableScroller className="mt-5" label="市场投稿列表">
                  <table className="min-w-[1320px] w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-3 pr-4 font-medium">简历 / 作者</th>
                        <th className="py-3 pr-4 font-medium">浏览方式</th>
                        <th className="py-3 pr-4 font-medium">发布状态</th>
                        <th className="py-3 pr-4 font-medium">投稿审核</th>
                        <th className="py-3 pr-4 font-medium">平台风控 / 原因</th>
                        <th className="py-3 pr-4 font-medium">更新时间</th>
                        <th className="py-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {marketListings.map((listingItem) => (
                        <tr key={listingItem.id} className="align-top">
                          <td className="py-4 pr-4">
                            <div className="max-w-[260px] truncate font-medium text-gray-900">{listingItem.title}</div>
                            <div className="mt-1 max-w-[260px] truncate text-xs text-gray-500">/{listingItem.slug}</div>
                            <div className="mt-1 text-xs text-gray-400">作者 #{listingItem.sellerUserId} · 简历 #{listingItem.resumeId}</div>
                          </td>
                          <td className="py-4 pr-4">
                            <span className={listingItem.accessType === 'PAID'
                              ? 'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700'
                              : 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700'}>
                              {listingItem.accessType === 'PAID' ? formatAdminCents(listingItem.priceCents) : '免费公开'}
                            </span>
                          </td>
                          <td className="py-4 pr-4">
                            {listingItem.publicationStatus === 'PUBLISHED' ? '已发布' : '已下架'}
                          </td>
                          <td className="py-4 pr-4">
                            <div className={listingItem.reviewStatus === 'PENDING'
                              ? 'font-medium text-amber-700'
                              : listingItem.reviewStatus === 'REJECTED'
                                ? 'font-medium text-red-700'
                                : 'font-medium text-emerald-700'}>
                              {listingItem.reviewStatus === 'PENDING'
                                ? '待审核'
                                : listingItem.reviewStatus === 'REJECTED'
                                  ? '已驳回'
                                  : '已通过'}
                            </div>
                            {listingItem.pendingRevisionId ? (
                              <div className="mt-1 text-xs text-gray-500">待审版本 #{listingItem.pendingRevisionId}</div>
                            ) : null}
                            {listingItem.reviewSubmittedAt ? (
                              <div className="mt-1 text-xs text-gray-400">提交于 {listingItem.reviewSubmittedAt}</div>
                            ) : null}
                            {listingItem.currentRevisionId ? (
                              <div className="mt-1 text-xs text-gray-400">当前版本 #{listingItem.currentRevisionId}</div>
                            ) : null}
                          </td>
                          <td className="py-4 pr-4">
                            <div className={listingItem.moderationStatus === 'SUSPENDED' ? 'text-red-700' : 'text-emerald-700'}>
                              {listingItem.moderationStatus === 'SUSPENDED' ? '平台已下架' : '平台正常'}
                            </div>
                            {listingItem.moderationReason ? (
                              <div className="mt-1 max-w-sm text-xs leading-5 text-gray-500">
                                {listingItem.moderatedAt ?? '已审核'} · {listingItem.moderationReason}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-4 pr-4 text-xs text-gray-500">{listingItem.updatedAt}</td>
                          <td className="py-4">
                            <div className="flex min-w-[220px] flex-wrap gap-2">
                              {listingItem.pendingRevisionId ? (
                                <button
                                  type="button"
                                  onClick={() => void handleModerateMarketplaceListing(listingItem, 'APPROVE')}
                                  disabled={moderatingListingId !== null}
                                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-50"
                                >
                                  {moderatingListingId === listingItem.id ? '处理中...' : '通过投稿'}
                                </button>
                              ) : null}
                              {listingItem.reviewStatus === 'PENDING' && listingItem.pendingRevisionId ? (
                                <button
                                  type="button"
                                  onClick={() => void handleModerateMarketplaceListing(listingItem, 'REJECT')}
                                  disabled={moderatingListingId !== null}
                                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
                                >
                                  驳回投稿
                                </button>
                              ) : null}
                              {listingItem.currentRevisionId && listingItem.moderationStatus === 'APPROVED' ? (
                                <button
                                  type="button"
                                  onClick={() => void handleModerateMarketplaceListing(listingItem, 'TAKEDOWN')}
                                  disabled={moderatingListingId !== null}
                                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
                                >
                                  平台下架
                                </button>
                              ) : null}
                              {listingItem.currentRevisionId && listingItem.moderationStatus === 'SUSPENDED' ? (
                                <button
                                  type="button"
                                  onClick={() => void handleModerateMarketplaceListing(listingItem, 'RESTORE')}
                                  disabled={moderatingListingId !== null}
                                  className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-50"
                                >
                                  恢复访问
                                </button>
                              ) : null}
                              {!listingItem.pendingRevisionId && !listingItem.currentRevisionId ? (
                                <span className="text-xs text-gray-400">暂无可处理版本</span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AdminTableScroller>
              ) : (
                <p className="mt-5 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                  暂无匹配简历
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
                <span>共 {marketListingTotal} 份 · 第 {marketListingPage} / {marketListingTotalPages} 页</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={marketListingPage <= 1 || marketListingsLoading}
                    onClick={() => void refreshMarketplaceListings(marketListingPage - 1).catch((err: unknown) => {
                      setError(getAdminErrorMessage(err, '公开简历列表加载失败'))
                    })}
                    className="rounded-lg border border-gray-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    disabled={marketListingPage >= marketListingTotalPages || marketListingsLoading}
                    onClick={() => void refreshMarketplaceListings(marketListingPage + 1).catch((err: unknown) => {
                      setError(getAdminErrorMessage(err, '公开简历列表加载失败'))
                    })}
                    className="rounded-lg border border-gray-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    下一页
                  </button>
                </div>
              </div>
              </section>
            ) : null}

            {activeView === 'marketplace-governance' ? (
              <MarketplaceGovernancePanel
                auditRefreshKey={governanceAuditRefreshKey}
                onListingsChanged={async () => {
                  await refreshMarketplaceListings()
                }}
                onPendingCountChanged={() => loadSection('governance')}
              />
            ) : null}

            {activeView === 'creator-earnings' ? (
              <section className="rounded-lg border border-amber-200 bg-white px-6 py-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">作者收益线下结算</h2>
                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    待结算 {pendingCreatorEarningCount} 条 · 最早 200 条
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshPendingCreatorEarnings().catch((err: unknown) => {
                    setError(getAdminErrorMessage(err, '待结算收益加载失败'))
                  })}
                  disabled={creatorEarningsLoading}
                  className="w-fit rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-gray-300 hover:text-gray-900 disabled:cursor-wait disabled:opacity-50"
                >
                  {creatorEarningsLoading ? '刷新中...' : '刷新待结算'}
                </button>
              </div>

              {pendingCreatorEarnings.length ? (
                <AdminTableScroller className="mt-5" label="待结算作者收益列表">
                  <table className="min-w-[960px] w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-3 pr-4 font-medium">作者</th>
                        <th className="py-3 pr-4 font-medium">简历 / 订单</th>
                        <th className="py-3 pr-4 font-medium">成交 / 手续费</th>
                        <th className="py-3 pr-4 font-medium">应转金额</th>
                        <th className="py-3 pr-4 font-medium">申请信息</th>
                        <th className="py-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {pendingCreatorEarnings.map((earning) => (
                        <tr key={earning.id} className="align-top">
                          <td className="py-4 pr-4">
                            <div className="font-medium text-gray-900">{earning.sellerEmail || `作者 #${earning.sellerUserId}`}</div>
                            {earning.sellerEmail ? <div className="mt-1 text-xs text-gray-400">用户 #{earning.sellerUserId}</div> : null}
                          </td>
                          <td className="py-4 pr-4">
                            <div>{earning.listingSlug || `简历 #${earning.listingId}`}</div>
                            <div className="mt-1 max-w-[220px] truncate text-xs text-gray-400" title={earning.orderNo ?? undefined}>{earning.orderNo ?? '原订单已不存在'}</div>
                          </td>
                          <td className="py-4 pr-4">
                            <div>{formatAdminCents(earning.grossAmountCents)}</div>
                            <div className="mt-1 text-xs text-gray-400">手续费 {formatAdminCents(earning.platformFeeCents)}</div>
                          </td>
                          <td className="py-4 pr-4 font-semibold text-emerald-700">{formatAdminCents(getCreatorEarningIncome(earning))}</td>
                          <td className="py-4 pr-4 text-xs leading-5 text-gray-500">
                            <div>状态：等待线下转账</div>
                            <div>{earning.availableAt || earning.createdAt}</div>
                          </td>
                          <td className="py-4">
                            {earning.sourceOrderStatus === 'PAID' ? (
                              <button
                                type="button"
                                onClick={() => void handleSettleCreatorEarning(earning)}
                                disabled={settlingEarningId !== null}
                                className="min-w-max rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-50"
                              >
                                {settlingEarningId === earning.id ? '登记中...' : '确认已转账'}
                              </button>
                            ) : (
                              <span className="block max-w-[180px] text-xs leading-5 text-red-600">
                                来源订单正在退款复核，禁止转账
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AdminTableScroller>
              ) : (
                <p className="mt-5 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                  暂无结算申请
                </p>
              )}
              </section>
            ) : null}

            {activeView === 'membership-payments' ? (
              <section className="rounded-lg border border-orange-200 bg-white px-6 py-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">会员支付复核</h2>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshMembershipPaymentDashboard().catch((err: unknown) => {
                    setError(getAdminErrorMessage(err, '会员支付复核数据加载失败'))
                  })}
                  disabled={membershipPaymentsLoading || membershipPaymentSummaryLoading}
                  className="w-fit rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-gray-300 hover:text-gray-900 disabled:cursor-wait disabled:opacity-50"
                >
                  {membershipPaymentsLoading || membershipPaymentSummaryLoading ? '刷新中...' : '刷新会员支付'}
                </button>
              </div>

              <div className="mt-5 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm leading-6 text-orange-900">
                <strong>操作边界：</strong>
                本页面只登记商户平台的人工处理结果，不会调用微信或其他支付平台发起退款。若订单已经发放本单会员权益，必须先按权益来源重算并完成人工权益处置，不能直接登记退款完成。
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['待处理复核', membershipPaymentSummary?.pendingReviews ?? '-'],
                  ['退款处理中', membershipPaymentSummary?.refundProcessingReviews ?? '-'],
                  ['重复付款复核', membershipPaymentSummary?.duplicatePaymentReviews ?? '-'],
                  ['本进程对账失败', membershipPaymentSummary?.reconciliationFailuresSinceStart ?? '-'],
                  ['已确认退款', membershipPaymentSummary?.refundedReviews ?? '-'],
                  ['已驳回', membershipPaymentSummary?.rejectedReviews ?? '-'],
                  ['已关闭', membershipPaymentSummary?.closedReviews ?? '-'],
                  ['会员订单总数', membershipPaymentSummary?.totalOrders ?? '-'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="text-xs text-gray-500">{label}</div>
                    <div className="mt-1 text-xl font-semibold text-gray-950">{value}</div>
                  </div>
                ))}
              </div>
              {membershipPaymentSummary?.reconciliationFailuresSinceStart ? (
                <p className="mt-3 text-xs leading-5 text-red-700">
                  最近一次对账失败：{membershipPaymentSummary.lastReconciliationFailureAt || '时间未记录'}；计数自 {membershipPaymentSummary.observabilityStartedAt} 本进程启动后累计。
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <select
                  aria-label="会员支付订单状态筛选"
                  value={membershipPaymentOrderFilter}
                  onChange={(event) => {
                    const value = event.target.value as '' | MembershipPaymentOrderStatus
                    setMembershipPaymentOrderFilter(value)
                    setMembershipPaymentPage(1)
                    void refreshMembershipPaymentOrders(1, value, membershipPaymentReviewFilter).catch((err: unknown) => {
                      setError(getAdminErrorMessage(err, '会员支付订单加载失败'))
                    })
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                >
                  <option value="">全部支付状态</option>
                  {Object.entries(MEMBERSHIP_PAYMENT_ORDER_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <select
                  aria-label="会员支付复核状态筛选"
                  value={membershipPaymentReviewFilter}
                  onChange={(event) => {
                    const value = event.target.value as '' | MembershipPaymentReviewStatus
                    setMembershipPaymentReviewFilter(value)
                    setMembershipPaymentPage(1)
                    void refreshMembershipPaymentOrders(1, membershipPaymentOrderFilter, value).catch((err: unknown) => {
                      setError(getAdminErrorMessage(err, '会员支付订单加载失败'))
                    })
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                >
                  <option value="">全部复核状态</option>
                  {Object.entries(MEMBERSHIP_PAYMENT_REVIEW_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {membershipPaymentsLoading && membershipPaymentOrders.length === 0 ? (
                <p className="mt-5 text-sm text-gray-500">正在加载会员支付订单...</p>
              ) : membershipPaymentOrders.length ? (
                <AdminTableScroller className="mt-5" label="会员支付订单列表">
                  <table className="min-w-[1120px] w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-3 pr-4 font-medium">会员 / 订单</th>
                        <th className="py-3 pr-4 font-medium">金额 / 支付</th>
                        <th className="py-3 pr-4 font-medium">支付状态</th>
                        <th className="py-3 pr-4 font-medium">复核状态</th>
                        <th className="py-3 pr-4 font-medium">复核原因 / 最近处理</th>
                        <th className="py-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {membershipPaymentOrders.map((order) => (
                        <tr key={order.id} className="align-top">
                          <td className="py-4 pr-4">
                            <div className="font-medium text-gray-900">{order.userEmail || `用户 #${order.userId}`}</div>
                            <div className="mt-1 max-w-[250px] break-all text-xs text-gray-500">{order.orderNo}</div>
                            <div className="mt-1 text-xs text-gray-400">创建于 {order.createdAt}</div>
                          </td>
                          <td className="py-4 pr-4">
                            <div className="font-semibold text-gray-900">{formatAdminCents(order.payableAmountCents)}</div>
                            <div className="mt-1 text-xs text-gray-500">
                              {order.planName} · {formatMembershipEntitlement(order.entitlementType, order.membershipDays)}
                            </div>
                            <div className="mt-1 text-xs text-gray-400">原价 {formatAdminCents(order.listPriceCents)}</div>
                            <div className="mt-1 text-xs text-gray-400">{order.provider} · {order.currency}</div>
                          </td>
                          <td className="py-4 pr-4">
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800">
                              {MEMBERSHIP_PAYMENT_ORDER_STATUS_LABELS[order.orderStatus]}
                            </span>
                            <div className="mt-2 text-xs text-gray-400">{order.paidAt || order.expiresAt || '-'}</div>
                          </td>
                          <td className="py-4 pr-4">
                            <span className={order.reviewStatus === 'REFUNDED'
                              ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700'
                              : order.reviewStatus === 'PENDING' || order.reviewStatus === 'REFUND_PROCESSING'
                                ? 'rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-800'
                                : 'rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700'}>
                              {MEMBERSHIP_PAYMENT_REVIEW_STATUS_LABELS[order.reviewStatus]}
                            </span>
                            {order.refundReference ? (
                              <div className="mt-2 max-w-[220px] break-all text-xs text-emerald-700">退款流水：{order.refundReference}</div>
                            ) : null}
                          </td>
                          <td className="max-w-sm py-4 pr-4 text-xs leading-5">
                            <div className="font-medium text-red-700">{order.paymentReviewReason || '无异常原因'}</div>
                            {order.adminActionReason ? (
                              <div className="mt-1 text-gray-500">
                                {order.handlerEmail || (order.handledBy ? `管理员 #${order.handledBy}` : '管理员')}：{order.adminActionReason}
                              </div>
                            ) : null}
                            {order.reviewUpdatedAt ? <div className="mt-1 text-gray-400">{order.reviewUpdatedAt}</div> : null}
                          </td>
                          <td className="py-4">
                            <button
                              type="button"
                              onClick={() => void showMembershipPaymentDetail(order.orderNo)}
                              disabled={membershipPaymentDetailLoading}
                              className="min-w-max text-primary-700 hover:text-primary-800 disabled:cursor-wait disabled:opacity-50"
                            >
                              {membershipPaymentDetailLoading ? '加载中...' : '查看详情与处理'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AdminTableScroller>
              ) : (
                <p className="mt-5 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                  暂无匹配订单
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
                <span>共 {membershipPaymentTotal} 笔 · 第 {membershipPaymentPage} / {membershipPaymentTotalPages} 页</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={membershipPaymentPage <= 1 || membershipPaymentsLoading}
                    onClick={() => void refreshMembershipPaymentOrders(
                      membershipPaymentPage - 1,
                      membershipPaymentOrderFilter,
                      membershipPaymentReviewFilter,
                    ).catch((err: unknown) => {
                      setError(getAdminErrorMessage(err, '会员支付订单加载失败'))
                    })}
                    className="rounded-lg border border-gray-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    disabled={membershipPaymentPage >= membershipPaymentTotalPages || membershipPaymentsLoading}
                    onClick={() => void refreshMembershipPaymentOrders(
                      membershipPaymentPage + 1,
                      membershipPaymentOrderFilter,
                      membershipPaymentReviewFilter,
                    ).catch((err: unknown) => {
                      setError(getAdminErrorMessage(err, '会员支付订单加载失败'))
                    })}
                    className="rounded-lg border border-gray-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    下一页
                  </button>
                </div>
              </div>

              {selectedMembershipPaymentOrder ? (
                <div className="mt-6 rounded-lg border border-orange-200 bg-orange-50/50 p-5">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-950">订单详情</h3>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-700">
                          {MEMBERSHIP_PAYMENT_ORDER_STATUS_LABELS[selectedMembershipPaymentOrder.orderStatus]}
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs text-orange-800">
                          {MEMBERSHIP_PAYMENT_REVIEW_STATUS_LABELS[selectedMembershipPaymentOrder.reviewStatus]}
                        </span>
                      </div>
                      <div className="mt-2 break-all text-xs text-gray-500">{selectedMembershipPaymentOrder.orderNo}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMembershipPaymentOrder(null)}
                      className="w-fit text-sm text-gray-500 hover:text-gray-800"
                    >
                      关闭详情
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 text-xs leading-6 text-gray-600 md:grid-cols-2 lg:grid-cols-3">
                    <div>用户：{selectedMembershipPaymentOrder.userEmail || `#${selectedMembershipPaymentOrder.userId}`}</div>
                    <div>
                      方案：{selectedMembershipPaymentOrder.planName} · {formatMembershipEntitlement(
                        selectedMembershipPaymentOrder.entitlementType,
                        selectedMembershipPaymentOrder.membershipDays,
                      )}
                    </div>
                    <div>实付：{formatAdminCents(selectedMembershipPaymentOrder.payableAmountCents)}</div>
                    <div>支付交易号：<span className="break-all">{selectedMembershipPaymentOrder.providerTransactionId || '未记录'}</span></div>
                    <div>支付时间：{selectedMembershipPaymentOrder.paidAt || '-'}</div>
                    <div>复核原因：{selectedMembershipPaymentOrder.paymentReviewReason || '-'}</div>
                    <div>退款流水：{selectedMembershipPaymentOrder.refundReference || '-'}</div>
                    <div>权益起点：{selectedMembershipPaymentOrder.membershipStartedAt || '本单未发放'}</div>
                    <div>
                      权益终点：{selectedMembershipPaymentOrder.entitlementType === 'PERMANENT'
                        && selectedMembershipPaymentOrder.membershipStartedAt
                        ? '永久'
                        : selectedMembershipPaymentOrder.membershipExpiresAt || '本单未发放'}
                    </div>
                    <div>最近处理：{selectedMembershipPaymentOrder.reviewUpdatedAt || '-'}</div>
                  </div>

                  {selectedMembershipPaymentOrder.membershipStartedAt || selectedMembershipPaymentOrder.membershipExpiresAt ? (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                      本单已经发放会员权益，退款登记按钮已禁用。请先核对后续续费、邀请码和管理员权益，并按权益来源重算；不要直接撤销整段 VIP。
                    </div>
                  ) : null}

                  {selectedMembershipPaymentOrder.reviewStatus === 'PENDING'
                    || selectedMembershipPaymentOrder.reviewStatus === 'REFUND_PROCESSING' ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {!selectedMembershipPaymentOrder.membershipStartedAt
                          && !selectedMembershipPaymentOrder.membershipExpiresAt
                          && selectedMembershipPaymentOrder.reviewStatus === 'PENDING' ? (
                            <button
                              type="button"
                              onClick={() => void handleMembershipPaymentReviewAction(selectedMembershipPaymentOrder, 'START_REFUND')}
                              disabled={membershipPaymentActionOrderNo !== null}
                              className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-medium text-white hover:bg-orange-700 disabled:cursor-wait disabled:opacity-50"
                            >
                              {membershipPaymentActionOrderNo === selectedMembershipPaymentOrder.orderNo ? '处理中...' : '标记退款处理中'}
                            </button>
                          ) : null}
                        {!selectedMembershipPaymentOrder.membershipStartedAt
                          && !selectedMembershipPaymentOrder.membershipExpiresAt
                          && selectedMembershipPaymentOrder.reviewStatus === 'REFUND_PROCESSING' ? (
                            <button
                              type="button"
                              onClick={() => void handleMembershipPaymentReviewAction(selectedMembershipPaymentOrder, 'CONFIRM_REFUNDED')}
                              disabled={membershipPaymentActionOrderNo !== null}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-50"
                            >
                              {membershipPaymentActionOrderNo === selectedMembershipPaymentOrder.orderNo ? '处理中...' : '确认商户平台已退款'}
                            </button>
                          ) : null}
                        <button
                          type="button"
                          onClick={() => void handleMembershipPaymentReviewAction(selectedMembershipPaymentOrder, 'REJECT_REFUND')}
                          disabled={membershipPaymentActionOrderNo !== null}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:border-gray-400 disabled:cursor-wait disabled:opacity-50"
                        >
                          驳回复核
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleMembershipPaymentReviewAction(selectedMembershipPaymentOrder, 'CLOSE_REVIEW')}
                          disabled={membershipPaymentActionOrderNo !== null}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:border-gray-400 disabled:cursor-wait disabled:opacity-50"
                        >
                          关闭复核
                        </button>
                      </div>
                    ) : null}

                  <div className="mt-5">
                    <h4 className="text-sm font-semibold text-gray-900">人工处置审计记录</h4>
                    {selectedMembershipPaymentOrder.auditLogs.length ? (
                      <AdminTableScroller
                        className="mt-3 rounded-lg border border-gray-200 bg-white"
                        label="会员支付人工处置审计记录"
                      >
                        <table className="min-w-[900px] w-full divide-y divide-gray-200 text-xs">
                          <thead>
                            <tr className="text-left text-gray-500">
                              <th className="py-3 pr-4 font-medium">时间 / 管理员</th>
                              <th className="py-3 pr-4 font-medium">动作</th>
                              <th className="py-3 pr-4 font-medium">状态变化</th>
                              <th className="py-3 pr-4 font-medium">操作原因</th>
                              <th className="py-3 font-medium">退款流水</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-gray-700">
                            {selectedMembershipPaymentOrder.auditLogs.map((audit) => (
                              <tr key={audit.id} className="align-top">
                                <td className="py-3 pr-4">
                                  <div>{audit.createdAt}</div>
                                  <div className="mt-1 text-gray-400">{audit.adminEmail || `管理员 #${audit.adminUserId}`}</div>
                                </td>
                                <td className="py-3 pr-4">{MEMBERSHIP_PAYMENT_AUDIT_ACTION_LABELS[audit.action] || audit.action}</td>
                                <td className="py-3 pr-4">
                                  {MEMBERSHIP_PAYMENT_REVIEW_STATUS_LABELS[audit.fromStatus]} → {MEMBERSHIP_PAYMENT_REVIEW_STATUS_LABELS[audit.toStatus]}
                                </td>
                                <td className="max-w-sm py-3 pr-4 leading-5">{audit.reason}</td>
                                <td className="max-w-[220px] break-all py-3">{audit.refundReference || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </AdminTableScroller>
                    ) : (
                      <p className="mt-3 text-xs text-gray-500">尚无人工处置记录。</p>
                    )}
                  </div>
                </div>
              ) : null}
              </section>
            ) : null}

            {activeView === 'marketplace-payments' ? (
              <section className="rounded-lg border border-red-200 bg-white px-6 py-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">支付异常人工复核</h2>
                  <p className="mt-1 text-xs leading-5 text-red-700">
                    待复核 {marketplacePaymentIssueCount} 条 · 最多 200 条
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <select
                    aria-label="支付异常状态筛选"
                    value={paymentReviewFilter}
                    onChange={(event) => {
                      const value = event.target.value as '' | MarketplacePaymentReviewStatus
                      setPaymentReviewFilter(value)
                      void refreshMarketplacePaymentReviews(value).catch((err: unknown) => {
                        setError(getAdminErrorMessage(err, '支付异常列表加载失败'))
                      })
                    }}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  >
                    <option value="">全部异常状态</option>
                    <option value="REFUND_REQUIRED">无效成交待退款复核</option>
                    <option value="DUPLICATE_PAID">重复支付待退款复核</option>
                    <option value="REFUNDED">已确认退款历史</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void refreshMarketplacePaymentReviews().catch((err: unknown) => {
                      setError(getAdminErrorMessage(err, '支付异常列表加载失败'))
                    })}
                    disabled={paymentReviewsLoading}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-gray-300 hover:text-gray-900 disabled:cursor-wait disabled:opacity-50"
                  >
                    {paymentReviewsLoading ? '刷新中...' : '刷新复核单'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void refreshMarketplaceCloseWork().catch((err: unknown) => {
                      setError(getAdminErrorMessage(err, '待关单列表加载失败'))
                    })}
                    disabled={paymentCloseWorkLoading}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-gray-300 hover:text-gray-900 disabled:cursor-wait disabled:opacity-50"
                  >
                    {paymentCloseWorkLoading ? '刷新中...' : '刷新待关单'}
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-amber-950">失效销售待支付平台关单</h3>
                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      这些销售已经下架、改版、转为免费或被暂停，但支付平台侧的订单仍未确认关闭。旧二维码不得继续使用；若之后发生实付，会进入下方人工退款复核清单。
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-amber-800">{paymentCloseWork.length} 笔</span>
                </div>

                {paymentCloseWork.length ? (
                  <AdminTableScroller className="mt-4 rounded-lg bg-white" label="待支付平台关单列表">
                    <table className="min-w-[900px] w-full divide-y divide-gray-200 text-xs">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="py-3 pr-4 font-medium">状态 / 金额</th>
                          <th className="py-3 pr-4 font-medium">订单</th>
                          <th className="py-3 pr-4 font-medium">买家 / 作者</th>
                          <th className="py-3 pr-4 font-medium">简历版本</th>
                          <th className="py-3 font-medium">销售关闭原因</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700">
                        {paymentCloseWork.map((work) => (
                          <tr key={work.id} className="align-top">
                            <td className="py-3 pr-4">
                              <div className="font-medium text-amber-800">{MARKETPLACE_ORDER_STATUS_LABELS[work.orderStatus] ?? work.orderStatus}</div>
                              <div className="mt-1">{formatAdminCents(work.amountCents)} · {work.provider}</div>
                            </td>
                            <td className="py-3 pr-4">
                              <div className="max-w-[240px] break-all">{work.orderNo}</div>
                              <div className="mt-1 text-gray-400">创建于 {work.createdAt}</div>
                              <div className="text-gray-400">最近查单 {work.lastCheckedAt || '尚未查单'}</div>
                            </td>
                            <td className="py-3 pr-4 leading-5">
                              <div>买家：{work.buyerEmail || `#${work.buyerUserId}`}</div>
                              <div>作者：{work.sellerEmail || `#${work.sellerUserId}`}</div>
                            </td>
                            <td className="py-3 pr-4 leading-5">
                              <div>{work.listingSlug || `Listing #${work.listingId}`}</div>
                              <div className="text-gray-400">版本 #{work.listingRevisionId}</div>
                            </td>
                            <td className="py-3 leading-5">
                              <div>{work.saleCloseReason || '销售条件已失效'}</div>
                              <div className="mt-1 text-gray-400">{work.saleClosedAt || '-'}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </AdminTableScroller>
                ) : (
                  <p className="mt-3 text-xs text-amber-800">当前没有仍待支付平台关闭确认的失效销售订单。</p>
                )}
              </div>

              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                <strong className="font-semibold text-red-950">退款操作提醒：</strong>
                请先在对应支付商户平台核对订单号、支付交易号和实付金额，再人工发起原路退款。不要用线下转账替代原路退款，也不要仅凭本页面状态向用户承诺退款已完成。
              </div>

              <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <label className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-800">按订单号处理正常成交退款</span>
                    <span className="mt-1 block text-xs leading-5 text-gray-500">
                      正常已支付订单不会出现在异常清单中。商户平台完成全额退款后，可在这里核对并登记；登记会撤销买家阅读权并冲正作者收益，已经线下结算的部分会形成作者待抵扣欠款。
                    </span>
                    <input
                      value={paymentOrderLookup}
                      aria-label="支付平台订单号"
                      onChange={(event) => setPaymentOrderLookup(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void lookupMarketplaceOrder()
                      }}
                      placeholder="输入完整平台订单号"
                      className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void lookupMarketplaceOrder()}
                    disabled={paymentOrderLookupLoading}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 disabled:cursor-wait disabled:opacity-50"
                  >
                    {paymentOrderLookupLoading ? '查询中...' : '查询订单'}
                  </button>
                </div>

                {paymentOrderLookupResult ? (
                  <div className="mt-4 flex flex-col justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 text-xs leading-6 text-gray-600">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-medium text-gray-800">
                          {MARKETPLACE_ORDER_STATUS_LABELS[paymentOrderLookupResult.orderStatus] ?? paymentOrderLookupResult.orderStatus}
                        </span>
                        <strong className="text-sm text-gray-950">{formatAdminCents(paymentOrderLookupResult.amountCents)}</strong>
                      </div>
                      <div className="mt-2 break-all">订单号：{paymentOrderLookupResult.orderNo}</div>
                      <div className="break-all">支付交易号：{paymentOrderLookupResult.providerTransactionId || '后端未记录'}</div>
                      <div>
                        最近查单：{paymentOrderLookupResult.lastCheckedAt || '尚未查单'} · 最近支付平台验真：{paymentOrderLookupResult.providerReconciledAt || '尚未验真'}
                      </div>
                      <div>
                        买家：{paymentOrderLookupResult.buyerEmail || `#${paymentOrderLookupResult.buyerUserId}`} · 作者：{paymentOrderLookupResult.sellerEmail || `#${paymentOrderLookupResult.sellerUserId}`}
                      </div>
                      {paymentOrderLookupResult.refundReference ? (
                        <div className="font-medium text-emerald-700">退款流水：{paymentOrderLookupResult.refundReference}</div>
                      ) : null}
                    </div>
                    {['PAID', 'REFUND_REQUIRED', 'DUPLICATE_PAID'].includes(paymentOrderLookupResult.orderStatus) ? (
                      <button
                        type="button"
                        onClick={() => void handleConfirmMarketplaceRefund(paymentOrderLookupResult)}
                        disabled={confirmingRefundOrderNo !== null}
                        className="min-w-max rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-50"
                      >
                        {confirmingRefundOrderNo === paymentOrderLookupResult.orderNo ? '登记中...' : '确认商户平台已全额退款'}
                      </button>
                    ) : (
                      <span className="min-w-max text-xs text-gray-500">
                        {paymentOrderLookupResult.orderStatus === 'REFUNDED' ? '退款结果已登记' : '当前状态不可登记退款'}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>

              {paymentReviews.length ? (
                <AdminTableScroller className="mt-5" label="市场支付异常复核列表">
                  <table className="min-w-[1260px] w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-3 pr-4 font-medium">异常状态 / 金额</th>
                        <th className="py-3 pr-4 font-medium">支付交易 / 订单</th>
                        <th className="py-3 pr-4 font-medium">买家</th>
                        <th className="py-3 pr-4 font-medium">作者</th>
                        <th className="py-3 pr-4 font-medium">简历</th>
                        <th className="py-3 pr-4 font-medium">复核原因</th>
                        <th className="py-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {paymentReviews.map((review) => (
                        <tr key={review.id} className="align-top">
                          <td className="py-4 pr-4">
                            <span className={review.orderStatus === 'REFUNDED'
                              ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700'
                              : review.orderStatus === 'DUPLICATE_PAID'
                                ? 'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800'
                                : 'rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700'}>
                              {MARKETPLACE_ORDER_STATUS_LABELS[review.orderStatus] ?? review.orderStatus}
                            </span>
                            <div className="mt-2 font-semibold text-gray-900">{formatAdminCents(review.amountCents)}</div>
                            <div className="mt-1 text-xs text-gray-400">{review.currency} · {review.provider}</div>
                          </td>
                          <td className="py-4 pr-4 text-xs leading-5">
                            <div className="max-w-[260px] break-all text-gray-700">
                              交易号：{review.providerTransactionId || '后端未记录'}
                            </div>
                            <div className="mt-1 max-w-[260px] break-all text-gray-500">订单号：{review.orderNo}</div>
                            <div className="mt-1 text-gray-400">支付时间：{review.paidAt || review.createdAt}</div>
                            <div className="text-gray-400">最近平台验真：{review.providerReconciledAt || '尚未验真'}</div>
                            {review.refundReference ? (
                              <div className="mt-2 max-w-[260px] break-all font-medium text-emerald-700">退款流水：{review.refundReference}</div>
                            ) : null}
                          </td>
                          <td className="py-4 pr-4">
                            <div>{review.buyerEmail || `用户 #${review.buyerUserId}`}</div>
                            {review.buyerEmail ? <div className="mt-1 text-xs text-gray-400">用户 #{review.buyerUserId}</div> : null}
                          </td>
                          <td className="py-4 pr-4">
                            <div>{review.sellerEmail || `作者 #${review.sellerUserId}`}</div>
                            {review.sellerEmail ? <div className="mt-1 text-xs text-gray-400">用户 #{review.sellerUserId}</div> : null}
                          </td>
                          <td className="py-4 pr-4 text-xs leading-5">
                            <div className="max-w-[200px] truncate text-gray-700">{review.listingSlug || `简历 #${review.listingId}`}</div>
                            <div className="mt-1 text-gray-400">Listing #{review.listingId} · 版本 #{review.listingRevisionId}</div>
                          </td>
                          <td className="max-w-sm py-4 pr-4 text-xs leading-5">
                            <div className="font-medium text-red-700">{review.reviewReason || '待管理员核对支付上下文'}</div>
                            {review.saleCloseReason ? (
                              <div className="mt-1 text-gray-500">
                                成交关闭：{review.saleCloseReason}{review.saleClosedAt ? ` · ${review.saleClosedAt}` : ''}
                              </div>
                            ) : null}
                            {review.refundNote ? (
                              <div className="mt-2 text-emerald-700">
                                退款备注：{review.refundNote}
                                {review.refundResolvedAt ? ` · ${review.refundResolvedAt}` : ''}
                                {review.refundResolvedBy ? ` · 管理员 #${review.refundResolvedBy}` : ''}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-4">
                            <div className="flex min-w-max flex-col items-start gap-2 text-xs">
                              {review.providerTransactionId ? (
                                <button
                                  type="button"
                                  onClick={() => void copyText(review.providerTransactionId ?? '', '支付交易号已复制')}
                                  className="text-primary-700 hover:text-primary-800"
                                >
                                  复制支付交易号
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => void copyText(review.orderNo, '订单号已复制')}
                                className="text-gray-700 hover:text-gray-900"
                              >
                                复制订单号
                              </button>
                              {review.orderStatus === 'REFUND_REQUIRED' || review.orderStatus === 'DUPLICATE_PAID' ? (
                                <button
                                  type="button"
                                  onClick={() => void handleConfirmMarketplaceRefund(review)}
                                  disabled={confirmingRefundOrderNo !== null}
                                  className="rounded-lg bg-red-600 px-3 py-2 font-medium text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-50"
                                >
                                  {confirmingRefundOrderNo === review.orderNo ? '登记中...' : '确认商户平台已退款'}
                                </button>
                              ) : (
                                <span className="text-emerald-700">退款结果已登记</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AdminTableScroller>
              ) : (
                <p className="mt-5 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                  {paymentReviewFilter === 'REFUNDED'
                    ? '暂无退款历史'
                    : '暂无异常订单'}
                </p>
              )}
              </section>
            ) : null}

            {activeView === 'vip-invites' ? (
              <section className="rounded-lg border border-emerald-200 bg-white px-6 py-6">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                <h2 className="text-lg font-semibold text-gray-900">知识星球 VIP 邀请码</h2>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  作废批次码只阻止新兑换，不影响已领取用户；泄露后请在兑换记录中逐条撤销异常权益。
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">批次备注</span>
                  <input
                    value={inviteForm.remark}
                    onChange={(event) => setInviteForm((current) => ({ ...current, remark: event.target.value }))}
                    placeholder="例如：2026年7月星球福利"
                    maxLength={128}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">兑换截止（天）</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={inviteForm.expiresInDays}
                    onChange={(event) => setInviteForm((current) => ({ ...current, expiresInDays: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">最多兑换人数</span>
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={inviteForm.maxRedemptions}
                    onChange={(event) => setInviteForm((current) => ({ ...current, maxRedemptions: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">VIP 权益（天）</span>
                  <select
                    value={inviteForm.membershipDays}
                    onChange={(event) => setInviteForm((current) => ({ ...current, membershipDays: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="30">30 天体验</option>
                    <option value="90">90 天福利</option>
                    <option value="365">365 天年度福利</option>
                  </select>
                </label>
              </div>

              <button
                type="button"
                onClick={() => void handleCreateInvite()}
                disabled={creatingInvite}
                className="mt-4 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {creatingInvite ? '生成中...' : `生成 ${inviteForm.membershipDays || '-'} 天 VIP 邀请码`}
              </button>

              <AdminTableScroller className="mt-6" label="VIP 邀请码列表">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-3 pr-4 font-medium">邀请码</th>
                      <th className="py-3 pr-4 font-medium">备注</th>
                      <th className="py-3 pr-4 font-medium">权益期限</th>
                      <th className="py-3 pr-4 font-medium">兑换进度</th>
                      <th className="py-3 pr-4 font-medium">截止时间</th>
                      <th className="py-3 pr-4 font-medium">状态</th>
                      <th className="py-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {vipInvites.map((invite) => {
                      const displayStatus = getInviteDisplayStatus(invite)
                      const publishable = isInvitePublishable(invite)
                      return (
                      <tr key={invite.id}>
                        <td className="py-3 pr-4 font-mono font-semibold text-emerald-800">{invite.code}</td>
                        <td className="py-3 pr-4">{invite.remark || '-'}</td>
                        <td className="py-3 pr-4">{invite.membershipDays} 天</td>
                        <td className="py-3 pr-4">{invite.redeemedCount} / {invite.maxRedemptions}</td>
                        <td className="py-3 pr-4">{invite.expiresAt ?? '-'}</td>
                        <td className="py-3 pr-4">
                          <div><VipInviteStatusBadge status={displayStatus} /></div>
                          {invite.invalidateReason ? (
                            <div className="mt-1 max-w-xs text-xs leading-5 text-red-600">
                              {invite.invalidatedAt ?? '已作废'} · {invite.invalidateReason}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3">
                          <div className="flex min-w-max flex-wrap gap-3">
                            {publishable ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void copyText(invite.code, '邀请码已复制')}
                                  className="text-primary-700 hover:text-primary-800"
                                >
                                  复制码
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void copyText(buildPlanetPost(invite), '星球发布文案已复制')}
                                  className="text-emerald-700 hover:text-emerald-800"
                                >
                                  复制星球文案
                                </button>
                              </>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => void handleViewInviteRedemptions(invite)}
                              className="text-gray-700 hover:text-gray-900"
                            >
                              {selectedInviteId === invite.id ? '收起记录' : '兑换记录'}
                            </button>
                            {displayStatus !== 'INVALID' ? (
                              <button
                                type="button"
                                onClick={() => void handleInvalidateInvite(invite)}
                                className="text-red-700 hover:text-red-800"
                              >
                                作废
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </AdminTableScroller>

              {selectedInviteId !== null ? (
                <div ref={redemptionsPanelRef} className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-4">
                  <h3 className="text-sm font-semibold text-gray-900">
                    兑换用户{selectedInvite ? ` · ${selectedInvite.code}` : ''}
                  </h3>
                  {inviteRedemptions.length ? (
                    <AdminTableScroller className="mt-3" label="邀请码兑换记录列表">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="py-2 pr-4 font-medium">用户</th>
                            <th className="py-2 pr-4 font-medium">兑换时间</th>
                            <th className="py-2 pr-4 font-medium">VIP 到期</th>
                            <th className="py-2 pr-4 font-medium">兑换状态 / 撤销信息</th>
                            <th className="py-2 font-medium">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {inviteRedemptions.map((redemption) => (
                            <tr key={redemption.id}>
                              <td className="py-2 pr-4">{redemption.userEmail}</td>
                              <td className="py-2 pr-4">{redemption.redeemedAt}</td>
                              <td className="py-2 pr-4">{redemption.membershipExpiresAt}</td>
                              <td className="py-2 pr-4">
                                <div><RedemptionStatusBadge status={redemption.redemptionStatus} /></div>
                                {redemption.redemptionStatus === 'REVOKED' ? (
                                  <div className="mt-1 max-w-md text-xs leading-5 text-red-600">
                                    {redemption.revokedAt ?? '已撤销'}
                                    {redemption.revokedBy ? ` · 管理员 #${redemption.revokedBy}` : ''}
                                    {redemption.revokeReason ? ` · ${redemption.revokeReason}` : ''}
                                  </div>
                                ) : null}
                              </td>
                              <td className="py-2">
                                {redemption.redemptionStatus === 'ACTIVE' ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleRevokeInviteRedemption(redemption)}
                                    className="min-w-max text-red-700 hover:text-red-800"
                                  >
                                    撤销异常权益
                                  </button>
                                ) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </AdminTableScroller>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">暂无兑换</p>
                  )}
                </div>
              ) : null}
              </section>
            ) : null}

            {activeView === 'surveys' ? (
              <section className="rounded-lg border border-gray-200 bg-white px-6 py-6">
              <h2 className="text-lg font-semibold text-gray-900">问卷审核</h2>
              {feedbacks.length ? (
              <div className="mt-5 space-y-4">
                {feedbacks.map((feedback) => {
                  const feedbackActionPending = feedbackActionId !== null
                  const currentFeedbackActionPending = feedbackActionId === feedback.id
                  return (
                  <article key={feedback.id} className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {feedback.displayName} · {feedback.schoolOrCompany} · {feedback.targetRole}
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          {feedback.contactEmail} · 评分 {feedback.rating} / 5 · 提交于 {feedback.createdAt}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <FeedbackReviewStatusBadge status={feedback.reviewStatus} />
                        <FeedbackPublishStatusBadge status={feedback.publishStatus} />
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-gray-700">{feedback.testimonialText}</p>
                    {feedback.desiredFeatures ? <p className="mt-3 text-sm leading-6 text-gray-600">需求：{feedback.desiredFeatures}</p> : null}
                    {feedback.bugFeedback ? <p className="mt-3 text-sm leading-6 text-gray-600">Bug：{feedback.bugFeedback}</p> : null}
                    {feedback.reviewNote ? <p className="mt-3 text-sm leading-6 text-gray-500">审核备注：{feedback.reviewNote}</p> : null}

                    <div className="mt-5 flex flex-wrap gap-3">
                      {feedback.reviewStatus === 'PENDING' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleApprove(feedback)}
                            disabled={feedbackActionPending}
                            className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white transition-colors hover:bg-primary-700 disabled:cursor-wait disabled:opacity-50"
                          >
                            {currentFeedbackActionPending ? '处理中…' : '通过审核'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleReject(feedback)}
                            disabled={feedbackActionPending}
                            className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 transition-colors hover:border-red-300 disabled:cursor-wait disabled:opacity-50"
                          >
                            {currentFeedbackActionPending ? '处理中…' : '拒绝'}
                          </button>
                        </>
                      ) : null}
                      {feedback.publishStatus === 'PUBLISHED' ? (
                        <button
                          type="button"
                          onClick={() => void handlePublish(feedback, 'unpublish')}
                          disabled={feedbackActionPending}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:border-gray-300 disabled:cursor-wait disabled:opacity-50"
                        >
                          {currentFeedbackActionPending ? '处理中…' : '下线评价'}
                        </button>
                      ) : feedback.reviewStatus === 'APPROVED' ? (
                        <button
                          type="button"
                          onClick={() => void handlePublish(feedback, 'publish')}
                          disabled={feedbackActionPending}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:border-gray-300 disabled:cursor-wait disabled:opacity-50"
                        >
                          {currentFeedbackActionPending ? '处理中…' : '发布评价'}
                        </button>
                      ) : null}
                    </div>
                  </article>
                  )
                })}
              </div>
              ) : (
                <p className="mt-5 text-sm text-gray-500">暂无问卷提交</p>
              )}
              </section>
            ) : null}

            {activeView === 'coupons' || activeView === 'members' ? (
              <section>
                {activeView === 'coupons' ? (
                  <div className="rounded-lg border border-gray-200 bg-white px-6 py-6">
                <h2 className="text-lg font-semibold text-gray-900">支付优惠码</h2>
                {coupons.length ? (
                <AdminTableScroller className="mt-5" label="优惠码列表">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-3 pr-4 font-medium">优惠码</th>
                        <th className="py-3 pr-4 font-medium">账号</th>
                        <th className="py-3 pr-4 font-medium">面额</th>
                        <th className="py-3 pr-4 font-medium">状态</th>
                        <th className="py-3 pr-4 font-medium">有效期</th>
                        <th className="py-3 pr-4 font-medium">邮件发送</th>
                        <th className="py-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {coupons.map((coupon) => {
                        const currentCouponActionPending = couponActionId === coupon.id
                        const couponExpired = isCouponExpired(coupon)
                        const effectiveCouponStatus = coupon.status === 'ISSUED' && couponExpired
                          ? 'EXPIRED'
                          : coupon.status
                        return (
                        <tr key={coupon.id}>
                          <td className="py-3 pr-4 font-medium text-gray-900">{coupon.code}</td>
                          <td className="py-3 pr-4">{coupon.recipientEmail}</td>
                          <td className="py-3 pr-4">{formatAdminCents(coupon.amountCents)}</td>
                          <td className="py-3 pr-4">
                            <CouponStatusBadge status={effectiveCouponStatus} />
                          </td>
                          <td className="py-3 pr-4 text-xs text-gray-500">
                            {coupon.expiresAt ?? '长期有效'}
                          </td>
                          <td className="py-3 pr-4 text-xs text-gray-500">
                            {coupon.emailSentAt ?? '尚未发送'}
                          </td>
                          <td className="py-3">
                            {isCouponResendable(coupon) ? (
                              <button
                                type="button"
                                onClick={() => void handleResendCoupon(coupon)}
                                disabled={couponActionId !== null}
                                className="min-w-max text-primary-700 hover:text-primary-800 disabled:cursor-wait disabled:opacity-50"
                              >
                                {currentCouponActionPending ? '发送中…' : '重发邮件'}
                              </button>
                            ) : '-'}
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </AdminTableScroller>
                ) : (
                  <p className="mt-5 text-sm text-gray-500">暂无优惠码</p>
                )}
                  </div>
                ) : null}

                {activeView === 'members' ? (
                  <div className="rounded-lg border border-gray-200 bg-white px-6 py-6">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <p className="text-sm text-gray-500">共 {userTotal} 个账号</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="search"
                      value={userSearch}
                      onChange={(event) => handleUserSearchChange(event.target.value)}
                      placeholder="搜索邮箱或昵称"
                      aria-label="搜索用户"
                      className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-56"
                    />
                    <select
                      value={userMembershipFilter}
                      onChange={(event) => handleUserMembershipFilterChange(event.target.value as '' | 'ACTIVE' | 'FREE')}
                      aria-label="筛选会员状态"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">全部会员状态</option>
                      <option value="ACTIVE">有效 VIP</option>
                      <option value="FREE">普通用户</option>
                    </select>
                  </div>
                </div>
                {usersLoading && !users.length ? (
                  <p className="mt-5 text-sm text-gray-500">正在加载用户...</p>
                ) : (
                <AdminTableScroller className="mt-5" label="用户与会员列表">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-3 pr-4 font-medium">邮箱</th>
                        <th className="py-3 pr-4 font-medium">角色</th>
                        <th className="py-3 pr-4 font-medium">会员状态 / 到期</th>
                        <th className="py-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {users.map((user) => {
                        const membershipActionPending = membershipActionUserId !== null
                        const currentUserActionPending = membershipActionUserId === user.id
                        return (
                        <tr key={user.id}>
                          <td className="py-3 pr-4">
                            <div className="font-medium text-gray-900">{getUserAdminLabel(user)}</div>
                            <div className="mt-1 text-xs text-gray-400">
                              {user.email ? `用户 #${user.id}` : `微信扫码账号 · 用户 #${user.id}`}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">{user.createdAt}</div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                              user.role === 'ADMIN'
                                ? 'bg-violet-50 text-violet-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {user.role === 'ADMIN' ? '管理员' : '用户'}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className={`font-medium ${
                              user.membershipStatus === 'ACTIVE' ? 'text-emerald-700' : 'text-slate-500'
                            }`}>
                              {user.membershipStatus === 'ACTIVE' ? '有效 VIP' : '普通用户'}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {user.membershipExpiresAt ?? (user.membershipStatus === 'ACTIVE' ? '永久' : '-')}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex min-w-max flex-wrap gap-3">
                              {user.membershipExpiresAt ? (
                                <button
                                  type="button"
                                  onClick={() => void handleExtendMembership(user)}
                                  disabled={membershipActionPending}
                                  className="text-emerald-700 transition-colors hover:text-emerald-800 disabled:cursor-wait disabled:opacity-50"
                                >
                                  {currentUserActionPending
                                    ? '处理中…'
                                    : user.membershipStatus === 'ACTIVE' ? '延期' : '到期后续期'}
                                </button>
                              ) : null}
                              {user.membershipStatus === 'ACTIVE' ? (
                                <button
                                  type="button"
                                  onClick={() => void handleMembership(user, 'revoke')}
                                  disabled={membershipActionPending}
                                  className="text-red-700 transition-colors hover:text-red-800 disabled:cursor-wait disabled:opacity-50"
                                >
                                  {currentUserActionPending ? '处理中…' : '撤销会员'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleMembership(user, 'grant')}
                                  disabled={membershipActionPending}
                                  className="text-primary-700 transition-colors hover:text-primary-800 disabled:cursor-wait disabled:opacity-50"
                                >
                                  {currentUserActionPending ? '处理中…' : '开通永久 VIP'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {!users.length ? (
                    <div className="border-t border-gray-100 px-4 py-12 text-center text-sm text-gray-500">
                      暂无匹配用户
                    </div>
                  ) : null}
                </AdminTableScroller>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
                  <span>共 {userTotal} 条 · 第 {userPage} / {userTotalPages} 页</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={userPage <= 1 || usersLoading}
                      onClick={() => void reloadUsersPage(userPage - 1)}
                      className="rounded-lg border border-gray-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      上一页
                    </button>
                    <button
                      type="button"
                      disabled={userPage >= userTotalPages || usersLoading}
                      onClick={() => void reloadUsersPage(userPage + 1)}
                      className="rounded-lg border border-gray-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      下一页
                    </button>
                  </div>
                </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {activeView === 'audit-logs' ? (
              <section className="rounded-lg border border-gray-200 bg-white px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">最近会员管理审计日志</h2>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshMembershipAuditLogs().catch((err: unknown) => {
                    setError(getAdminErrorMessage(err, '审计日志加载失败'))
                  })}
                  disabled={membershipAuditLogsLoading}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-gray-300 hover:text-gray-900 disabled:cursor-wait disabled:opacity-50"
                >
                  {membershipAuditLogsLoading ? '刷新中…' : '刷新日志'}
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <select
                  value={auditActionFilter}
                  onChange={(event) => setAuditActionFilter(event.target.value)}
                  aria-label="筛选操作类型"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">全部操作类型</option>
                  {auditActionOptions.map((action) => (
                    <option key={action} value={action}>
                      {MEMBERSHIP_AUDIT_ACTION_LABELS[action] ?? action}
                    </option>
                  ))}
                </select>
                <input
                  type="search"
                  value={auditKeyword}
                  onChange={(event) => setAuditKeyword(event.target.value)}
                  placeholder="搜索管理员、对象、原因或详情"
                  aria-label="搜索审计日志"
                  className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-64"
                />
              </div>

              {filteredAuditLogs.length ? (
                <AdminTableScroller className="mt-5" label="会员管理审计日志列表">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-3 pr-4 font-medium">时间 / 管理员</th>
                        <th className="py-3 pr-4 font-medium">操作 / 对象</th>
                        <th className="py-3 pr-4 font-medium">会员状态变化</th>
                        <th className="py-3 font-medium">原因 / 结果</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {filteredAuditLogs.map((log) => (
                        <tr key={log.id} className="align-top">
                          <td className="py-3 pr-4">
                            <div>{log.createdAt}</div>
                            <div className="mt-1 text-xs text-gray-500">
                              {log.adminEmail || `管理员 #${log.adminUserId}`}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="font-medium text-gray-900">
                              {MEMBERSHIP_AUDIT_ACTION_LABELS[log.action] ?? log.action}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-gray-500">
                              {log.targetUserEmail
                                || (log.targetUserId ? `用户 #${log.targetUserId}` : null)
                                || (log.inviteCodeId ? `邀请码 #${log.inviteCodeId}` : '-')}
                              {log.redemptionId ? ` · 兑换 #${log.redemptionId}` : ''}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-xs leading-5">
                            <div>
                              前：{formatMembershipSnapshot(
                                log.beforeMembershipStatus,
                                log.beforeMembershipSource,
                                log.beforeMembershipExpiresAt,
                              )}
                            </div>
                            <div className="mt-1">
                              后：{formatMembershipSnapshot(
                                log.afterMembershipStatus,
                                log.afterMembershipSource,
                                log.afterMembershipExpiresAt,
                              )}
                            </div>
                          </td>
                          <td className="max-w-md py-3 text-xs leading-5">
                            <div className="font-medium text-gray-700">{log.reason}</div>
                            {log.details ? <div className="mt-1 text-gray-500">{log.details}</div> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AdminTableScroller>
              ) : membershipAuditLogs.length ? (
                <p className="mt-4 text-sm text-gray-500">暂无匹配日志</p>
              ) : (
                <p className="mt-4 text-sm text-gray-500">暂无审计记录</p>
              )}
              </section>
            ) : null}
          </>
        )}
      </div>
    </AdminShell>
  )
}

export default function AdminPage() {
  return (
    <AdminActionDialogProvider>
      <AdminPageContent />
    </AdminActionDialogProvider>
  )
}
