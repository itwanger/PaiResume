import { useEffect, useMemo, useState } from 'react'
import {
  adminApi,
  type AdminMarketListing,
  type CouponAdmin,
  type FeedbackSubmissionAdmin,
  type MembershipAdminAuditLog,
  type MarketplacePaymentReview,
  type MarketplacePaymentReviewStatus,
  type PlatformConfig,
  type ResumeShowcaseAdmin,
  type UserAdmin,
  type VipInviteAdmin,
  type VipInviteRedemptionAdmin,
} from '../api/admin'
import {
  getMarketplacePageItems,
  getMarketplaceTotalPages,
  type CreatorEarning,
} from '../api/marketplace'
import { resumeApi, type ResumeListItem } from '../api/resume'
import { Header } from '../components/layout/Header'

function formatCents(value: number) {
  return `¥${(value / 100).toFixed(2)}`
}

function getCreatorEarningIncome(earning: CreatorEarning) {
  return earning.walletCreditCents
}

const EMPTY_SHOWCASE_FORM = {
  id: null as number | null,
  resumeId: '',
  slug: '',
  scoreLabel: '',
  summary: '',
  tags: '',
  displayOrder: '0',
  publishStatus: 'DRAFT',
}

const EMPTY_INVITE_FORM = {
  remark: '知识星球专属',
  expiresInDays: '30',
  maxRedemptions: '100',
}

const MEMBERSHIP_AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE_VIP_INVITE: '生成邀请码',
  GRANT_MEMBERSHIP: '手工开通 VIP',
  EXTEND_MEMBERSHIP: '延长 VIP',
  REVOKE_MEMBERSHIP: '手工撤销 VIP',
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

export default function AdminPage() {
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>({
    membershipPriceCents: 6600,
    questionnaireCouponAmountCents: 1000,
  })
  const [feedbacks, setFeedbacks] = useState<FeedbackSubmissionAdmin[]>([])
  const [coupons, setCoupons] = useState<CouponAdmin[]>([])
  const [vipInvites, setVipInvites] = useState<VipInviteAdmin[]>([])
  const [inviteRedemptions, setInviteRedemptions] = useState<VipInviteRedemptionAdmin[]>([])
  const [selectedInviteId, setSelectedInviteId] = useState<number | null>(null)
  const [membershipAuditLogs, setMembershipAuditLogs] = useState<MembershipAdminAuditLog[]>([])
  const [users, setUsers] = useState<UserAdmin[]>([])
  const [showcases, setShowcases] = useState<ResumeShowcaseAdmin[]>([])
  const [marketListings, setMarketListings] = useState<AdminMarketListing[]>([])
  const [marketListingPage, setMarketListingPage] = useState(1)
  const [marketListingTotalPages, setMarketListingTotalPages] = useState(1)
  const [marketListingTotal, setMarketListingTotal] = useState(0)
  const [marketPublicationFilter, setMarketPublicationFilter] = useState<'' | 'PUBLISHED' | 'UNPUBLISHED'>('')
  const [marketModerationFilter, setMarketModerationFilter] = useState<'' | 'APPROVED' | 'SUSPENDED'>('')
  const [pendingCreatorEarnings, setPendingCreatorEarnings] = useState<CreatorEarning[]>([])
  const [paymentReviews, setPaymentReviews] = useState<MarketplacePaymentReview[]>([])
  const [paymentCloseWork, setPaymentCloseWork] = useState<MarketplacePaymentReview[]>([])
  const [paymentReviewFilter, setPaymentReviewFilter] = useState<'' | MarketplacePaymentReviewStatus>('')
  const [paymentOrderLookup, setPaymentOrderLookup] = useState('')
  const [paymentOrderLookupResult, setPaymentOrderLookupResult] = useState<MarketplacePaymentReview | null>(null)
  const [resumes, setResumes] = useState<ResumeListItem[]>([])
  const [showcaseForm, setShowcaseForm] = useState(EMPTY_SHOWCASE_FORM)
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE_FORM)
  const [loading, setLoading] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [submittingShowcase, setSubmittingShowcase] = useState(false)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [marketListingsLoading, setMarketListingsLoading] = useState(false)
  const [creatorEarningsLoading, setCreatorEarningsLoading] = useState(false)
  const [paymentReviewsLoading, setPaymentReviewsLoading] = useState(false)
  const [paymentCloseWorkLoading, setPaymentCloseWorkLoading] = useState(false)
  const [paymentOrderLookupLoading, setPaymentOrderLookupLoading] = useState(false)
  const [confirmingRefundOrderNo, setConfirmingRefundOrderNo] = useState<string | null>(null)
  const [moderatingListingId, setModeratingListingId] = useState<number | null>(null)
  const [settlingEarningId, setSettlingEarningId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    void loadAll()
  }, [])

  const showcaseOptions = useMemo(() => resumes.map((resume) => ({
    label: resume.title,
    value: String(resume.id),
  })), [resumes])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [
        platformConfigRes,
        feedbackRes,
        couponRes,
        inviteRes,
        userRes,
        membershipAuditRes,
        showcaseRes,
        resumesRes,
        marketplaceListingRes,
        creatorEarningRes,
        paymentReviewRes,
        paymentCloseWorkRes,
      ] = await Promise.all([
        adminApi.getPlatformConfig(),
        adminApi.listFeedbackSubmissions(),
        adminApi.listCoupons(),
        adminApi.listVipInvites(),
        adminApi.listUsers(),
        adminApi.listMembershipAuditLogs(),
        adminApi.listShowcases(),
        resumeApi.list(),
        adminApi.listMarketplaceListings({ page: 1, size: 20 }),
        adminApi.listCreatorEarnings(),
        adminApi.listMarketplacePaymentReviews(),
        adminApi.listMarketplaceCloseWork(),
      ])

      setPlatformConfig(platformConfigRes.data.data)
      setFeedbacks(feedbackRes.data.data)
      setCoupons(couponRes.data.data)
      setVipInvites(inviteRes.data.data)
      setUsers(userRes.data.data)
      setMembershipAuditLogs(membershipAuditRes.data.data)
      setShowcases(showcaseRes.data.data)
      setResumes(resumesRes.data.data)
      setMarketListings(getMarketplacePageItems(marketplaceListingRes.data.data))
      setMarketListingPage(marketplaceListingRes.data.data.page)
      setMarketListingTotal(marketplaceListingRes.data.data.total)
      setMarketListingTotalPages(Math.max(1, getMarketplaceTotalPages(marketplaceListingRes.data.data)))
      setPendingCreatorEarnings(creatorEarningRes.data.data)
      setPaymentReviews(paymentReviewRes.data.data)
      setPaymentCloseWork(paymentCloseWorkRes.data.data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '后台数据加载失败'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function refreshFeedbacks() {
    const { data: res } = await adminApi.listFeedbackSubmissions()
    setFeedbacks(res.data)
  }

  async function refreshUsers() {
    const { data: res } = await adminApi.listUsers()
    setUsers(res.data)
  }

  async function refreshMembershipAuditLogs() {
    const { data: res } = await adminApi.listMembershipAuditLogs()
    setMembershipAuditLogs(res.data)
  }

  async function refreshShowcases() {
    const { data: res } = await adminApi.listShowcases()
    setShowcases(res.data)
  }

  async function refreshCoupons() {
    const { data: res } = await adminApi.listCoupons()
    setCoupons(res.data)
  }

  async function refreshVipInvites() {
    const { data: res } = await adminApi.listVipInvites()
    setVipInvites(res.data)
  }

  async function refreshInviteRedemptions(inviteId: number) {
    const { data: res } = await adminApi.listVipInviteRedemptions(inviteId)
    setInviteRedemptions(res.data)
  }

  async function refreshMarketplaceListings(
    page = marketListingPage,
    publicationStatus = marketPublicationFilter,
    moderationStatus = marketModerationFilter,
  ) {
    setMarketListingsLoading(true)
    try {
      const { data: res } = await adminApi.listMarketplaceListings({
        page,
        size: 20,
        publicationStatus,
        moderationStatus,
      })
      setMarketListings(getMarketplacePageItems(res.data))
      setMarketListingPage(res.data.page)
      setMarketListingTotal(res.data.total)
      setMarketListingTotalPages(Math.max(1, getMarketplaceTotalPages(res.data)))
    } finally {
      setMarketListingsLoading(false)
    }
  }

  async function refreshPendingCreatorEarnings() {
    setCreatorEarningsLoading(true)
    try {
      const { data: res } = await adminApi.listCreatorEarnings()
      setPendingCreatorEarnings(res.data)
    } finally {
      setCreatorEarningsLoading(false)
    }
  }

  async function refreshMarketplacePaymentReviews(
    status = paymentReviewFilter,
  ) {
    setPaymentReviewsLoading(true)
    try {
      const { data: res } = await adminApi.listMarketplacePaymentReviews(status)
      setPaymentReviews(res.data)
    } finally {
      setPaymentReviewsLoading(false)
    }
  }

  async function refreshMarketplaceCloseWork() {
    setPaymentCloseWorkLoading(true)
    try {
      const { data: res } = await adminApi.listMarketplaceCloseWork()
      setPaymentCloseWork(res.data)
    } finally {
      setPaymentCloseWorkLoading(false)
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
      setError(err instanceof Error ? err.message : '订单查询失败')
    } finally {
      setPaymentOrderLookupLoading(false)
    }
  }

  const requestRequiredReason = (message: string) => {
    const rawReason = window.prompt(message, '')
    if (rawReason === null) {
      return null
    }
    const reason = rawReason.trim()
    if (!reason) {
      setError('操作原因不能为空')
      return null
    }
    if (reason.length > 255) {
      setError('操作原因不能超过 255 个字符')
      return null
    }
    return reason
  }

  const handleSaveConfig = async () => {
    setSavingConfig(true)
    setError('')
    setSuccess('')
    try {
      const { data: res } = await adminApi.updatePlatformConfig(platformConfig)
      setPlatformConfig(res.data)
      setSuccess('平台配置已更新')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '平台配置更新失败'
      setError(message)
    } finally {
      setSavingConfig(false)
    }
  }

  const handleApprove = async (feedback: FeedbackSubmissionAdmin) => {
    const reviewNote = window.prompt('审核备注（可选）', feedback.reviewNote ?? '') ?? ''
    try {
      await adminApi.approveFeedback(feedback.id, reviewNote || undefined)
      await Promise.all([refreshFeedbacks(), refreshCoupons()])
      setSuccess('问卷已通过并发放优惠码')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '审核通过失败'
      setError(message)
    }
  }

  const handleReject = async (feedback: FeedbackSubmissionAdmin) => {
    const reviewNote = window.prompt('请输入拒绝原因', feedback.reviewNote ?? '')
    if (!reviewNote) {
      return
    }
    try {
      await adminApi.rejectFeedback(feedback.id, reviewNote)
      await Promise.all([refreshFeedbacks(), refreshCoupons()])
      setSuccess('问卷已拒绝')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '拒绝问卷失败'
      setError(message)
    }
  }

  const handlePublish = async (feedback: FeedbackSubmissionAdmin, nextAction: 'publish' | 'unpublish') => {
    try {
      if (nextAction === 'publish') {
        await adminApi.publishFeedback(feedback.id)
      } else {
        await adminApi.unpublishFeedback(feedback.id)
      }
      await refreshFeedbacks()
      setSuccess(nextAction === 'publish' ? '评价已发布' : '评价已下线')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '操作失败'
      setError(message)
    }
  }

  const handleResendCoupon = async (feedback: FeedbackSubmissionAdmin) => {
    try {
      await adminApi.resendCoupon(feedback.id)
      await Promise.all([refreshFeedbacks(), refreshCoupons()])
      setSuccess('优惠码已重发')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '重发失败'
      setError(message)
    }
  }

  const handleMembership = async (user: UserAdmin, action: 'grant' | 'revoke') => {
    const reason = requestRequiredReason(
      action === 'grant'
        ? `请输入为 ${user.email} 手工开通永久 VIP 的原因（必填）`
        : `请输入撤销 ${user.email} VIP 权益的原因（必填）`,
    )
    if (!reason) {
      return
    }
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
      const message = err instanceof Error ? err.message : '会员操作失败'
      setError(message)
    }
  }

  const handleExtendMembership = async (user: UserAdmin) => {
    const rawDays = window.prompt(`给 ${user.email} 延期多少天？`, '30')
    if (!rawDays) {
      return
    }
    const days = Number(rawDays)
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      setError('延期天数必须是 1-3650 之间的整数')
      return
    }
    const reason = requestRequiredReason(`请输入为 ${user.email} 延期 ${days} 天的原因（必填）`)
    if (!reason) {
      return
    }
    setError('')
    setSuccess('')
    try {
      await adminApi.extendMembership(user.id, days, reason)
      await Promise.all([refreshUsers(), refreshMembershipAuditLogs()])
      setSuccess(`已为 ${user.email} 延期 ${days} 天`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '会员延期失败')
    }
  }

  const handleCreateInvite = async () => {
    const expiresInDays = Number(inviteForm.expiresInDays)
    const maxRedemptions = Number(inviteForm.maxRedemptions)
    if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365) {
      setError('邀请码有效天数必须是 1-365 之间的整数')
      return
    }
    if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 100000) {
      setError('邀请码兑换名额必须是 1-100000 之间的整数')
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
      })
      await Promise.all([refreshVipInvites(), refreshMembershipAuditLogs()])
      setSuccess(`VIP 邀请码 ${res.data.code} 已生成`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '邀请码生成失败')
    } finally {
      setCreatingInvite(false)
    }
  }

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setSuccess(successMessage)
    } catch {
      window.prompt('复制下面的内容', text)
    }
  }

  const buildPlanetPost = (invite: VipInviteAdmin) => {
    const configuredPublicUrl = (import.meta.env.VITE_APP_PUBLIC_URL as string | undefined)?.trim()
    const publicOrigin = (configuredPublicUrl || window.location.origin).replace(/\/+$/, '')
    const remaining = Math.max(0, invite.maxRedemptions - invite.redeemedCount)
    return [
      '【二哥编程星球专属｜派简历 30 天 VIP】',
      '',
      `派简历网站：${publicOrigin}`,
      `新用户注册：${publicOrigin}/register`,
      `已注册用户兑换：${publicOrigin}/membership`,
      `VIP 邀请码：${invite.code}`,
      '',
      '使用方法：',
      '1. 新用户注册时，在“知识星球 VIP 邀请码”中填写上面的邀请码；',
      '2. 已经注册的用户，登录后进入 VIP 页面兑换。',
      '',
      `兑换成功后，从兑换成功的时间开始获得完整 ${invite.membershipDays} 天 VIP。`,
      '免费用户可以编辑、保存和导入简历，但不能使用 AI、PDF 导出或查看完整优质简历。',
      'VIP 用户可使用 AI 优化与分析、PDF 导出、查看完整优质简历等全部会员功能。',
      '',
      `兑换截止：${invite.expiresAt ?? '以后台状态为准'}`,
      `剩余名额：${remaining}/${invite.maxRedemptions}，先到先得。`,
      '',
      '请注意：',
      '- 这是“VIP 邀请码”，不是支付优惠码，兑换时不需要付款；',
      '- 每个账号只能领取一次，不能叠加，也不能用新的邀请码重复续期；',
      `- 兑换截止时间只限制何时领取，不会缩短已经领取的 ${invite.membershipDays} 天权益；`,
      '- VIP 到期后不会自动续期，如需继续使用，由管理员在后台延期；',
      '- 邀请码仅限本知识星球成员本人使用，请勿截图、转发或发布到公开渠道；如发现泄露，邀请码可能立即作废，异常领取的 VIP 权益也可能被撤销。',
      '',
      '若遇到兑换问题，请在星球内联系我，并提供注册邮箱，方便核查。',
    ].join('\n')
  }

  const handleInvalidateInvite = async (invite: VipInviteAdmin) => {
    if (!window.confirm(
      `确认作废邀请码 ${invite.code}？\n\n作废只会阻止新用户继续兑换，不会影响已经领取的 VIP 权益。`,
    )) {
      return
    }
    const reason = requestRequiredReason('请输入作废该邀请码的原因（必填）')
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
      setError(err instanceof Error ? err.message : '邀请码作废失败')
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
      setError(err instanceof Error ? err.message : '兑换记录加载失败')
    }
  }

  const handleRevokeInviteRedemption = async (redemption: VipInviteRedemptionAdmin) => {
    const reason = requestRequiredReason(
      `请输入撤销 ${redemption.userEmail} 这条异常兑换的原因（必填）`,
    )
    if (!reason) {
      return
    }
    if (!window.confirm(
      '确认逐条撤销这次兑换？\n\n如果用户当前 VIP 仍来自这次兑换，权益会立即撤销；如果已由支付或管理员另行开通，则保留当前权益。',
    )) {
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
        refreshUsers(),
        refreshMembershipAuditLogs(),
      ])
      setSuccess(`已撤销 ${redemption.userEmail} 的异常兑换记录`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '异常兑换撤销失败')
    }
  }

  const handleModerateMarketplaceListing = async (
    listing: AdminMarketListing,
    action: 'APPROVE' | 'SUSPEND',
  ) => {
    const reason = requestRequiredReason(
      action === 'APPROVE'
        ? `请输入通过《${listing.title}》审核的原因（必填）`
        : `请输入暂停展示《${listing.title}》的原因（必填）`,
    )
    if (!reason) return
    if (action === 'SUSPEND' && !window.confirm(
      '确认暂停展示这份公开简历？\n\n暂停后，除作者和管理员外的所有访问都会被阻止，包括历史买家；同时会关闭该版本尚未完成的成交。',
    )) {
      return
    }

    setModeratingListingId(listing.id)
    setError('')
    setSuccess('')
    try {
      await adminApi.moderateMarketplaceListing(listing.id, action, reason)
      await refreshMarketplaceListings()
      setSuccess(action === 'APPROVE' ? '公开简历已通过审核' : '公开简历已暂停展示')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '公开简历审核失败')
    } finally {
      setModeratingListingId(null)
    }
  }

  const handleSettleCreatorEarning = async (earning: CreatorEarning) => {
    const seller = earning.sellerEmail || `作者 #${earning.sellerUserId}`
    const settlementNote = requestRequiredReason(
      `请填写向 ${seller} 转账的流水号或结算备注（必填）`,
    )
    if (!settlementNote) return
    if (!window.confirm(
      `确认已向 ${seller} 线下转账 ${formatCents(getCreatorEarningIncome(earning))}？\n\n确认后该笔收益会标记为已结算。`,
    )) {
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
      setError(err instanceof Error ? err.message : '线下结算登记失败')
    } finally {
      setSettlingEarningId(null)
    }
  }

  const handleConfirmMarketplaceRefund = async (review: MarketplacePaymentReview) => {
    const rawReference = window.prompt(
      '请先在支付商户平台核实并完成全额原路退款，再填写真实的商户退款单号或核验流水（必填，不会由本页面自动生成）',
      '',
    )
    if (rawReference === null) return
    const refundReference = rawReference.trim()
    if (!refundReference || refundReference.length > 128) {
      setError('退款单号或核验流水不能为空，且不能超过 128 个字符')
      return
    }

    const rawNote = window.prompt('请输入退款核对备注（必填，例如退款渠道、核对人和用户沟通情况）', '')
    if (rawNote === null) return
    const note = rawNote.trim()
    if (!note || note.length > 255) {
      setError('退款备注不能为空，且不能超过 255 个字符')
      return
    }

    if (!window.confirm(
      `请再次确认：你已经在 ${review.provider} 商户平台为订单 ${review.orderNo} 实际完成 ${formatCents(review.amountCents)} 的原路退款。\n\n本操作只登记退款结果，不会发起退款；确认后订单将标记为已退款。`,
    )) {
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
      await refreshMarketplacePaymentReviews()
      setSuccess(`订单 ${review.orderNo} 的外部退款结果已登记`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '退款结果登记失败')
    } finally {
      setConfirmingRefundOrderNo(null)
    }
  }

  const handleSubmitShowcase = async () => {
    setSubmittingShowcase(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        resumeId: Number(showcaseForm.resumeId),
        slug: showcaseForm.slug.trim(),
        scoreLabel: showcaseForm.scoreLabel.trim(),
        summary: showcaseForm.summary.trim(),
        tags: showcaseForm.tags.split(',').map((item) => item.trim()).filter(Boolean),
        displayOrder: Number(showcaseForm.displayOrder),
        publishStatus: showcaseForm.publishStatus,
      }
      if (showcaseForm.id) {
        await adminApi.updateShowcase(showcaseForm.id, payload)
      } else {
        await adminApi.createShowcase(payload)
      }
      await refreshShowcases()
      setShowcaseForm(EMPTY_SHOWCASE_FORM)
      setSuccess(showcaseForm.id ? '样例已更新' : '样例已创建')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '样例保存失败'
      setError(message)
    } finally {
      setSubmittingShowcase(false)
    }
  }

  const editShowcase = (showcase: ResumeShowcaseAdmin) => {
    setShowcaseForm({
      id: showcase.id,
      resumeId: String(showcase.resumeId),
      slug: showcase.slug,
      scoreLabel: showcase.scoreLabel,
      summary: showcase.summary,
      tags: (showcase.tags ?? []).join(', '),
      displayOrder: String(showcase.displayOrder),
      publishStatus: showcase.publishStatus,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header enableResumeDrop />

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">管理后台</h1>
          <p className="mt-2 text-sm text-gray-500">统一管理会员、优质简历、用户公开简历审核和作者收益结算。</p>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div> : null}

        {loading ? (
          <div className="text-sm text-gray-500">加载中...</div>
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="rounded-lg border border-gray-200 bg-white px-6 py-6">
                <h2 className="text-lg font-semibold text-gray-900">平台配置</h2>
                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">会员价格（分）</span>
                    <input
                      type="number"
                      value={platformConfig.membershipPriceCents}
                      onChange={(event) => setPlatformConfig((current) => ({ ...current, membershipPriceCents: Number(event.target.value) }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">问卷优惠金额（分）</span>
                    <input
                      type="number"
                      value={platformConfig.questionnaireCouponAmountCents}
                      onChange={(event) => setPlatformConfig((current) => ({ ...current, questionnaireCouponAmountCents: Number(event.target.value) }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    />
                  </label>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                    当前会员价 {formatCents(platformConfig.membershipPriceCents)}，问卷默认优惠 {formatCents(platformConfig.questionnaireCouponAmountCents)}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSaveConfig()}
                    disabled={savingConfig}
                    className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                  >
                    {savingConfig ? '保存中...' : '保存配置'}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white px-6 py-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">优质简历管理</h2>
                    <p className="mt-1 text-sm text-gray-500">从管理员自己的脱敏简历中挑选内容，发布到优质简历菜单；完整内容仅 VIP 可见。</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">关联简历</span>
                    <select
                      value={showcaseForm.resumeId}
                      onChange={(event) => setShowcaseForm((current) => ({ ...current, resumeId: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">请选择</option>
                      {showcaseOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">slug</span>
                    <input
                      value={showcaseForm.slug}
                      onChange={(event) => setShowcaseForm((current) => ({ ...current, slug: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">分数标签</span>
                    <input
                      value={showcaseForm.scoreLabel}
                      onChange={(event) => setShowcaseForm((current) => ({ ...current, scoreLabel: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">展示顺序</span>
                    <input
                      type="number"
                      value={showcaseForm.displayOrder}
                      onChange={(event) => setShowcaseForm((current) => ({ ...current, displayOrder: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    />
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">摘要</span>
                  <textarea
                    value={showcaseForm.summary}
                    onChange={(event) => setShowcaseForm((current) => ({ ...current, summary: event.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                </label>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">标签（逗号分隔）</span>
                    <input
                      value={showcaseForm.tags}
                      onChange={(event) => setShowcaseForm((current) => ({ ...current, tags: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">发布状态</span>
                    <select
                      value={showcaseForm.publishStatus}
                      onChange={(event) => setShowcaseForm((current) => ({ ...current, publishStatus: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="PUBLISHED">PUBLISHED</option>
                    </select>
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSubmitShowcase()}
                    disabled={submittingShowcase}
                    className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                  >
                    {submittingShowcase ? '保存中...' : showcaseForm.id ? '更新样例' : '创建样例'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowcaseForm(EMPTY_SHOWCASE_FORM)}
                    className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
                  >
                    清空表单
                  </button>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-3 pr-4 font-medium">slug</th>
                        <th className="py-3 pr-4 font-medium">分数标签</th>
                        <th className="py-3 pr-4 font-medium">状态</th>
                        <th className="py-3 pr-4 font-medium">排序</th>
                        <th className="py-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {showcases.map((showcase) => (
                        <tr key={showcase.id}>
                          <td className="py-3 pr-4">{showcase.slug}</td>
                          <td className="py-3 pr-4">{showcase.scoreLabel}</td>
                          <td className="py-3 pr-4">{showcase.publishStatus}</td>
                          <td className="py-3 pr-4">{showcase.displayOrder}</td>
                          <td className="py-3">
                            <button
                              type="button"
                              onClick={() => editShowcase(showcase)}
                              className="text-primary-700 transition-colors hover:text-primary-800"
                            >
                              编辑
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white px-6 py-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">用户公开简历管理</h2>
                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    审核用户免费或付费公开的简历。暂停展示属于风控措施，会阻止除作者和管理员外的所有访问，包括历史买家。
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <select
                    aria-label="发布状态筛选"
                    value={marketPublicationFilter}
                    onChange={(event) => {
                      const value = event.target.value as '' | 'PUBLISHED' | 'UNPUBLISHED'
                      setMarketPublicationFilter(value)
                      setMarketListingPage(1)
                      void refreshMarketplaceListings(1, value, marketModerationFilter).catch((err: unknown) => {
                        setError(err instanceof Error ? err.message : '公开简历列表加载失败')
                      })
                    }}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="">全部发布状态</option>
                    <option value="PUBLISHED">已发布</option>
                    <option value="UNPUBLISHED">已下架</option>
                  </select>
                  <select
                    aria-label="审核状态筛选"
                    value={marketModerationFilter}
                    onChange={(event) => {
                      const value = event.target.value as '' | 'APPROVED' | 'SUSPENDED'
                      setMarketModerationFilter(value)
                      setMarketListingPage(1)
                      void refreshMarketplaceListings(1, marketPublicationFilter, value).catch((err: unknown) => {
                        setError(err instanceof Error ? err.message : '公开简历列表加载失败')
                      })
                    }}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="">全部审核状态</option>
                    <option value="APPROVED">正常展示</option>
                    <option value="SUSPENDED">已暂停</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void refreshMarketplaceListings().catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : '公开简历列表加载失败')
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
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-[1080px] w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-3 pr-4 font-medium">简历 / 作者</th>
                        <th className="py-3 pr-4 font-medium">浏览方式</th>
                        <th className="py-3 pr-4 font-medium">发布状态</th>
                        <th className="py-3 pr-4 font-medium">审核状态 / 原因</th>
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
                              {listingItem.accessType === 'PAID' ? formatCents(listingItem.priceCents) : '免费公开'}
                            </span>
                          </td>
                          <td className="py-4 pr-4">
                            {listingItem.publicationStatus === 'PUBLISHED' ? '已发布' : '已下架'}
                          </td>
                          <td className="py-4 pr-4">
                            <div className={listingItem.moderationStatus === 'SUSPENDED' ? 'text-red-700' : 'text-emerald-700'}>
                              {listingItem.moderationStatus === 'SUSPENDED' ? '已暂停' : '正常展示'}
                            </div>
                            {listingItem.moderationReason ? (
                              <div className="mt-1 max-w-sm text-xs leading-5 text-gray-500">
                                {listingItem.moderatedAt ?? '已审核'} · {listingItem.moderationReason}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-4 pr-4 text-xs text-gray-500">{listingItem.updatedAt}</td>
                          <td className="py-4">
                            {listingItem.moderationStatus === 'SUSPENDED' ? (
                              <button
                                type="button"
                                onClick={() => void handleModerateMarketplaceListing(listingItem, 'APPROVE')}
                                disabled={moderatingListingId !== null}
                                className="min-w-max text-emerald-700 hover:text-emerald-800 disabled:cursor-wait disabled:opacity-50"
                              >
                                {moderatingListingId === listingItem.id ? '处理中...' : '通过审核'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleModerateMarketplaceListing(listingItem, 'SUSPEND')}
                                disabled={moderatingListingId !== null}
                                className="min-w-max text-red-700 hover:text-red-800 disabled:cursor-wait disabled:opacity-50"
                              >
                                {moderatingListingId === listingItem.id ? '处理中...' : '暂停展示'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-5 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                  当前筛选条件下暂无用户公开简历。
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
                <span>共 {marketListingTotal} 份 · 第 {marketListingPage} / {marketListingTotalPages} 页</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={marketListingPage <= 1 || marketListingsLoading}
                    onClick={() => void refreshMarketplaceListings(marketListingPage - 1).catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : '公开简历列表加载失败')
                    })}
                    className="rounded-lg border border-gray-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    disabled={marketListingPage >= marketListingTotalPages || marketListingsLoading}
                    onClick={() => void refreshMarketplaceListings(marketListingPage + 1).catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : '公开简历列表加载失败')
                    })}
                    className="rounded-lg border border-gray-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-amber-200 bg-white px-6 py-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">作者收益线下结算</h2>
                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    这里只显示作者已主动申请的待结算收益。完成实际转账后，再填写转账流水或备注并确认结算。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshPendingCreatorEarnings().catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : '待结算收益加载失败')
                  })}
                  disabled={creatorEarningsLoading}
                  className="w-fit rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-gray-300 hover:text-gray-900 disabled:cursor-wait disabled:opacity-50"
                >
                  {creatorEarningsLoading ? '刷新中...' : '刷新待结算'}
                </button>
              </div>

              {pendingCreatorEarnings.length ? (
                <div className="mt-5 overflow-x-auto">
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
                            <div>{formatCents(earning.grossAmountCents)}</div>
                            <div className="mt-1 text-xs text-gray-400">手续费 {formatCents(earning.platformFeeCents)}</div>
                          </td>
                          <td className="py-4 pr-4 font-semibold text-emerald-700">{formatCents(getCreatorEarningIncome(earning))}</td>
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
                </div>
              ) : (
                <p className="mt-5 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                  暂无作者申请线下结算。
                </p>
              )}
            </section>

            <section className="rounded-lg border border-red-200 bg-white px-6 py-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">支付异常人工复核</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
                    展示需要人工核对的无效成交付款和重复支付。本页面不会发起退款，只用于在商户平台实际退款完成后登记核验结果。
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
                        setError(err instanceof Error ? err.message : '支付异常列表加载失败')
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
                      setError(err instanceof Error ? err.message : '支付异常列表加载失败')
                    })}
                    disabled={paymentReviewsLoading}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-gray-300 hover:text-gray-900 disabled:cursor-wait disabled:opacity-50"
                  >
                    {paymentReviewsLoading ? '刷新中...' : '刷新复核单'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void refreshMarketplaceCloseWork().catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : '待关单列表加载失败')
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
                  <div className="mt-4 overflow-x-auto rounded-lg bg-white px-3">
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
                              <div className="mt-1">{formatCents(work.amountCents)} · {work.provider}</div>
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
                  </div>
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
                        <strong className="text-sm text-gray-950">{formatCents(paymentOrderLookupResult.amountCents)}</strong>
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
                <div className="mt-5 overflow-x-auto">
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
                            <div className="mt-2 font-semibold text-gray-900">{formatCents(review.amountCents)}</div>
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
                </div>
              ) : (
                <p className="mt-5 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                  {paymentReviewFilter === 'REFUNDED'
                    ? '暂无已登记的退款历史。'
                    : '当前没有需要人工复核的异常支付订单。'}
                </p>
              )}
            </section>

            <section className="rounded-lg border border-emerald-200 bg-white px-6 py-6">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">知识星球 VIP 邀请码</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
                    每个批次码可供多名星球用户兑换。兑换成功时起获得完整 30 天 VIP；每个账号只能领取一次，且邀请码与支付优惠码完全独立。
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  作废批次码只阻止新兑换，不影响已领取用户；泄露后请在兑换记录中逐条撤销异常权益。
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
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
              </div>

              <button
                type="button"
                onClick={() => void handleCreateInvite()}
                disabled={creatingInvite}
                className="mt-4 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {creatingInvite ? '生成中...' : '生成 30 天 VIP 邀请码'}
              </button>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-3 pr-4 font-medium">邀请码</th>
                      <th className="py-3 pr-4 font-medium">备注</th>
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
                        <td className="py-3 pr-4">{invite.redeemedCount} / {invite.maxRedemptions}</td>
                        <td className="py-3 pr-4">{invite.expiresAt ?? '-'}</td>
                        <td className="py-3 pr-4">
                          <div>{displayStatus}</div>
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
              </div>

              {selectedInviteId !== null ? (
                <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-4">
                  <h3 className="text-sm font-semibold text-gray-900">兑换用户</h3>
                  {inviteRedemptions.length ? (
                    <div className="mt-3 overflow-x-auto">
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
                                <div>{redemption.redemptionStatus}</div>
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
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">暂时还没有用户兑换。</p>
                  )}
                </div>
              ) : null}
            </section>

            <section className="rounded-lg border border-gray-200 bg-white px-6 py-6">
              <h2 className="text-lg font-semibold text-gray-900">问卷审核</h2>
              <div className="mt-5 space-y-4">
                {feedbacks.map((feedback) => (
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
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white px-3 py-1 text-gray-600">审核 {feedback.reviewStatus}</span>
                        <span className="rounded-full bg-white px-3 py-1 text-gray-600">发布 {feedback.publishStatus}</span>
                        <span className="rounded-full bg-white px-3 py-1 text-gray-600">优惠码 {feedback.couponStatus}</span>
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-gray-700">{feedback.testimonialText}</p>
                    {feedback.desiredFeatures ? <p className="mt-3 text-sm leading-6 text-gray-600">需求：{feedback.desiredFeatures}</p> : null}
                    {feedback.bugFeedback ? <p className="mt-3 text-sm leading-6 text-gray-600">Bug：{feedback.bugFeedback}</p> : null}
                    {feedback.reviewNote ? <p className="mt-3 text-sm leading-6 text-gray-500">审核备注：{feedback.reviewNote}</p> : null}
                    {feedback.coupon ? (
                      <p className="mt-3 text-sm text-primary-700">
                        优惠码：{feedback.coupon.code} · 面额 {formatCents(feedback.coupon.amountCents)}
                      </p>
                    ) : null}

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void handleApprove(feedback)}
                        className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white transition-colors hover:bg-primary-700"
                      >
                        通过并发码
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReject(feedback)}
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 transition-colors hover:border-red-300"
                      >
                        拒绝
                      </button>
                      {feedback.publishStatus === 'PUBLISHED' ? (
                        <button
                          type="button"
                          onClick={() => void handlePublish(feedback, 'unpublish')}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:border-gray-300"
                        >
                          下线评价
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handlePublish(feedback, 'publish')}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:border-gray-300"
                        >
                          发布评价
                        </button>
                      )}
                      {feedback.coupon ? (
                        <button
                          type="button"
                          onClick={() => void handleResendCoupon(feedback)}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:border-gray-300"
                        >
                          重发优惠码
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-white px-6 py-6">
                <h2 className="text-lg font-semibold text-gray-900">优惠码列表</h2>
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-3 pr-4 font-medium">优惠码</th>
                        <th className="py-3 pr-4 font-medium">邮箱</th>
                        <th className="py-3 pr-4 font-medium">面额</th>
                        <th className="py-3 font-medium">状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {coupons.map((coupon) => (
                        <tr key={coupon.id}>
                          <td className="py-3 pr-4 font-medium text-gray-900">{coupon.code}</td>
                          <td className="py-3 pr-4">{coupon.recipientEmail}</td>
                          <td className="py-3 pr-4">{formatCents(coupon.amountCents)}</td>
                          <td className="py-3">{coupon.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white px-6 py-6">
                <h2 className="text-lg font-semibold text-gray-900">用户会员管理</h2>
                <div className="mt-5 overflow-x-auto">
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
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td className="py-3 pr-4">
                            <div className="font-medium text-gray-900">{user.email}</div>
                            <div className="mt-1 text-xs text-gray-500">{user.createdAt}</div>
                          </td>
                          <td className="py-3 pr-4">{user.role}</td>
                          <td className="py-3 pr-4">
                            <div>{user.membershipStatus}</div>
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
                                  className="text-emerald-700 transition-colors hover:text-emerald-800"
                                >
                                  {user.membershipStatus === 'ACTIVE' ? '延期' : '到期后续期'}
                                </button>
                              ) : null}
                              {user.membershipStatus === 'ACTIVE' ? (
                                <button
                                  type="button"
                                  onClick={() => void handleMembership(user, 'revoke')}
                                  className="text-red-700 transition-colors hover:text-red-800"
                                >
                                  撤销会员
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleMembership(user, 'grant')}
                                  className="text-primary-700 transition-colors hover:text-primary-800"
                                >
                                  开通永久 VIP
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">最近会员管理审计日志</h2>
                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    展示最近 200 条手工开通、延期、撤销、邀请码作废和异常兑换撤销记录。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshMembershipAuditLogs()}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-gray-300 hover:text-gray-900"
                >
                  刷新日志
                </button>
              </div>

              {membershipAuditLogs.length ? (
                <div className="mt-5 overflow-x-auto">
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
                      {membershipAuditLogs.map((log) => (
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
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500">暂无会员管理审计记录。</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
