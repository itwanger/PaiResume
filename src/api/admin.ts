import client, { type ApiEnvelope } from './client'
import type {
  CreatorEarning,
  MarketplaceAccessType,
  MarketplaceAppeal,
  MarketplaceAppealStatus,
  MarketplaceModerationStatus,
  MarketplaceOrderStatus,
  MarketplacePage,
  MarketplacePublicationStatus,
  MarketplaceReport,
  MarketplaceReportStatus,
  MarketplaceReviewStatus,
} from './marketplace'
import type { ResumeReviewRequest } from './resumeReview'

export interface PlatformConfig {
  membershipPriceCents: number
  questionnaireCouponAmountCents: number
  resumeReviewPriceCents: number
}

export interface ResumeAnalysisPromptAdmin {
  scenarioCode: string
  displayName: string
  prompt: string
  updatedAt: string
}

export interface UpdateResumeAnalysisPromptPayload {
  prompt: string
}

export type MembershipPlanEntitlementType = 'FIXED_DAYS' | 'PERMANENT'

export interface MembershipPlanAdmin {
  code: string
  name: string
  entitlementType: MembershipPlanEntitlementType
  membershipDays: number | null
  priceCents: number | null
  enabled: boolean
  recommended: boolean
}

export interface UpdateMembershipPlanPayload {
  priceCents: number | null
  enabled: boolean
}

export interface ResumeReviewAudit {
  id: number
  requestNo: string
  actorUserId: number | null
  actorType: string
  action: string
  fromStatus: string | null
  toStatus: string | null
  reason: string | null
  createdAt: string
}

export type ResumeReviewAdminRequest = Omit<ResumeReviewRequest, 'codeUrl' | 'qrCodeDataUrl'> & {
  userId: number
  provider: string | null
  payChannel: string | null
  providerTransactionId: string | null
  refundReference: string | null
  handledBy: number | null
  acceptedAt: string | null
  completedAt: string | null
  returnedAt: string | null
  mailStatus: 'PENDING' | 'SENDING' | 'FAILED' | 'SENT' | null
  mailAttemptCount: number | null
  mailLastErrorType: string | null
  mailNextAttemptAt: string | null
  mailSentAt: string | null
}

export interface CouponAdmin {
  id: number
  code: string
  recipientEmail: string
  amountCents: number
  status: string
  emailSentAt: string | null
  usedAt: string | null
  expiresAt: string | null
}

export interface VipInviteAdmin {
  id: number
  code: string
  status: 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'INVALID'
  remark: string
  createdBy: number
  maxRedemptions: number
  redeemedCount: number
  membershipDays: number
  expiresAt: string | null
  invalidatedBy: number | null
  invalidatedAt: string | null
  invalidateReason: string | null
  createdAt: string
}

export interface CreateVipInvitePayload {
  remark?: string
  expiresInDays?: number
  maxRedemptions?: number
  membershipDays?: number
}

export interface VipInviteRedemptionAdmin {
  id: number
  inviteCodeId: number
  userId: number
  userEmail: string
  membershipStartedAt: string
  membershipExpiresAt: string
  redemptionStatus: 'ACTIVE' | 'REVOKED'
  revokedBy: number | null
  revokedAt: string | null
  revokeReason: string | null
  redeemedAt: string
}

export interface MembershipAdminAuditLog {
  id: number
  adminUserId: number
  adminEmail: string
  action: string
  targetUserId: number | null
  targetUserEmail: string | null
  inviteCodeId: number | null
  redemptionId: number | null
  reason: string
  beforeMembershipStatus: string | null
  beforeMembershipSource: string | null
  beforeMembershipExpiresAt: string | null
  afterMembershipStatus: string | null
  afterMembershipSource: string | null
  afterMembershipExpiresAt: string | null
  details: string | null
  createdAt: string
}

export interface FeedbackSubmissionAdmin {
  id: number
  contactEmail: string
  displayName: string
  schoolOrCompany: string
  targetRole: string
  rating: number
  testimonialText: string
  desiredFeatures: string | null
  bugFeedback: string | null
  consentToPublish: boolean
  reviewStatus: string
  publishStatus: string
  reviewNote: string | null
  reviewedBy: number | null
  reviewedAt: string | null
  createdAt: string
}

export interface UserAdmin {
  id: number
  email: string | null
  nickname: string | null
  role: string
  membershipStatus: string
  membershipGrantedAt: string | null
  membershipExpiresAt: string | null
  membershipSource: string | null
  createdAt: string
}

/** 用户与会员列表查询：keyword 模糊匹配邮箱或昵称，page 从 1 开始。 */
export interface ListUsersAdminQuery {
  keyword?: string
  membershipStatus?: '' | 'ACTIVE' | 'FREE'
  page?: number
  size?: number
}

export type ResumeShowcaseAccessType = 'FREE' | 'VIP'

export interface ResumeShowcaseAdmin {
  id: number
  resumeId: number
  slug: string
  scoreLabel: string
  summary: string
  tags: string[] | null
  accessType: ResumeShowcaseAccessType
  displayOrder: number
  publishStatus: string
  createdAt: string
  updatedAt: string
}

export interface FeatureShowcasePayload {
  accessType: ResumeShowcaseAccessType
}

export interface AdminMarketListing {
  id: number
  resumeId: number
  sellerUserId: number
  slug: string
  title: string
  summary: string
  tags: string[]
  accessType: MarketplaceAccessType
  priceCents: number
  publicationStatus: MarketplacePublicationStatus
  moderationStatus: MarketplaceModerationStatus
  reviewStatus: MarketplaceReviewStatus
  reviewSubmittedAt: string | null
  moderatedBy: number | null
  moderatedAt: string | null
  moderationReason: string | null
  currentRevisionId: number | null
  pendingRevisionId: number | null
  createdAt: string
  updatedAt: string
}

export interface AdminMarketListingQuery {
  page?: number
  size?: number
  publicationStatus?: 'PUBLISHED' | 'UNPUBLISHED' | ''
  moderationStatus?: MarketplaceModerationStatus | ''
  reviewStatus?: MarketplaceReviewStatus | ''
}

export type MarketplaceListingModerationAction =
  | 'APPROVE'
  | 'REJECT'
  | 'TAKEDOWN'
  | 'RESTORE'

export type MarketplaceReportAction = 'RESOLVE' | 'DISMISS' | 'TAKEDOWN'

export type MarketplaceAppealAction = 'APPROVE' | 'REJECT'

/** 申诉类型与 MarketplaceAppeal.appealType 保持同步的字面量联合 */
export type MarketplaceAppealType = MarketplaceAppeal['appealType']

export interface MarketplaceGovernanceAudit {
  id: number
  listingId: number
  actorUserId: number | null
  actorType: 'PUBLIC' | 'CREATOR' | 'ADMIN'
  action: string
  targetType: string
  targetId: number | null
  fromStatus: string | null
  toStatus: string | null
  reason: string | null
  createdAt: string
}

export interface MarketplaceGovernanceQuery<TStatus extends string> {
  page?: number
  size?: number
  status?: TStatus | ''
}

export interface MarketplacePaymentReview {
  id: number
  orderNo: string
  orderStatus: MarketplaceOrderStatus
  reviewReason: string | null
  buyerUserId: number
  buyerEmail: string | null
  sellerUserId: number
  sellerEmail: string | null
  listingId: number
  listingSlug: string | null
  listingRevisionId: number
  amountCents: number
  currency: string
  provider: string
  providerTransactionId: string | null
  expiresAt: string | null
  lastCheckedAt: string | null
  providerReconciledAt: string | null
  paidAt: string | null
  saleClosedAt: string | null
  saleCloseReason: string | null
  createdAt: string
  refundReference: string | null
  refundNote: string | null
  refundResolvedBy: number | null
  refundedAt: string | null
  refundResolvedAt: string | null
}

export type MarketplacePaymentReviewStatus = 'REFUND_REQUIRED' | 'DUPLICATE_PAID' | 'REFUNDED'

export type MembershipPaymentOrderStatus =
  | 'CREATED'
  | 'PREPAYING'
  | 'PREPAY_UNKNOWN'
  | 'PENDING'
  | 'EXPIRED'
  | 'CANCELED'
  | 'PAID'
  | 'REFUND_REQUIRED'

export type MembershipPaymentReviewStatus =
  | 'NONE'
  | 'PENDING'
  | 'REFUND_PROCESSING'
  | 'REFUNDED'
  | 'REJECTED'
  | 'CLOSED'

export interface MembershipPaymentAuditLog {
  id: number
  adminUserId: number
  adminEmail: string | null
  action: string
  fromStatus: MembershipPaymentReviewStatus
  toStatus: MembershipPaymentReviewStatus
  reason: string
  refundReference: string | null
  createdAt: string
}

export interface MembershipPaymentAdminOrder {
  id: number
  orderNo: string
  userId: number
  userEmail: string | null
  planCode: string
  planName: string
  entitlementType: MembershipPlanEntitlementType
  membershipDays: number | null
  listPriceCents: number
  discountAmountCents: number
  payableAmountCents: number
  currency: string
  provider: string
  payChannel: string
  orderStatus: MembershipPaymentOrderStatus
  providerTransactionId: string | null
  paymentReviewReason: string | null
  reviewStatus: MembershipPaymentReviewStatus
  lastAdminAction: string | null
  adminActionReason: string | null
  handledBy: number | null
  handlerEmail: string | null
  refundReference: string | null
  expiresAt: string | null
  paidAt: string | null
  closedAt: string | null
  membershipStartedAt: string | null
  membershipExpiresAt: string | null
  reviewStartedAt: string | null
  reviewResolvedAt: string | null
  reviewUpdatedAt: string | null
  createdAt: string
  updatedAt: string
  auditLogs: MembershipPaymentAuditLog[]
}

export interface MembershipPaymentAdminSummary {
  totalOrders: number
  refundRequiredOrders: number
  pendingReviews: number
  refundProcessingReviews: number
  refundedReviews: number
  rejectedReviews: number
  closedReviews: number
  duplicatePaymentReviews: number
  reconciliationFailuresSinceStart: number
  lastReconciliationFailureAt: string | null
  observabilityStartedAt: string
}

export interface MembershipPaymentAdminQuery {
  page?: number
  size?: number
  orderStatus?: MembershipPaymentOrderStatus | ''
  reviewStatus?: MembershipPaymentReviewStatus | ''
}

export const adminApi = {
  listResumeAnalysisPrompts: () =>
    client.get<ApiEnvelope<ResumeAnalysisPromptAdmin[]>>('/admin/resume-analysis-prompts'),

  updateResumeAnalysisPrompt: (
    scenarioCode: string,
    payload: UpdateResumeAnalysisPromptPayload,
  ) => client.put<ApiEnvelope<ResumeAnalysisPromptAdmin>>(
    `/admin/resume-analysis-prompts/${encodeURIComponent(scenarioCode)}`,
    payload,
  ),

  getPlatformConfig: () =>
    client.get<ApiEnvelope<PlatformConfig>>('/admin/platform-config'),

  updatePlatformConfig: (payload: PlatformConfig) =>
    client.put<ApiEnvelope<PlatformConfig>>('/admin/platform-config', payload),

  listMembershipPlans: () =>
    client.get<ApiEnvelope<MembershipPlanAdmin[]>>('/admin/membership-plans'),

  updateMembershipPlan: (code: string, payload: UpdateMembershipPlanPayload) =>
    client.put<ApiEnvelope<MembershipPlanAdmin>>(
      `/admin/membership-plans/${encodeURIComponent(code)}`,
      payload,
    ),

  listResumeReviews: () =>
    client.get<ApiEnvelope<ResumeReviewAdminRequest[]>>('/admin/resume-reviews'),

  getResumeReviewActionCount: () =>
    client.get<ApiEnvelope<number>>('/admin/resume-reviews/count'),

  getResumeReview: (requestNo: string) =>
    client.get<ApiEnvelope<ResumeReviewAdminRequest>>(
      `/admin/resume-reviews/${encodeURIComponent(requestNo)}`,
    ),

  listResumeReviewAudits: (requestNo: string) =>
    client.get<ApiEnvelope<ResumeReviewAudit[]>>(
      `/admin/resume-reviews/${encodeURIComponent(requestNo)}/audits`,
    ),

  acceptResumeReview: (requestNo: string, reason: string) =>
    client.post<ApiEnvelope<ResumeReviewRequest>>(
      `/admin/resume-reviews/${encodeURIComponent(requestNo)}/accept`,
      { reason },
    ),

  completeResumeReview: (requestNo: string, reason: string) =>
    client.post<ApiEnvelope<ResumeReviewRequest>>(
      `/admin/resume-reviews/${encodeURIComponent(requestNo)}/complete`,
      { reason },
    ),

  returnResumeReview: (requestNo: string, reason: string) =>
    client.post<ApiEnvelope<ResumeReviewRequest>>(
      `/admin/resume-reviews/${encodeURIComponent(requestNo)}/return`,
      { reason },
    ),

  retryResumeReviewMail: (requestNo: string, reason: string) =>
    client.post<ApiEnvelope<ResumeReviewRequest>>(
      `/admin/resume-reviews/${encodeURIComponent(requestNo)}/mail/retry`,
      { reason },
    ),

  confirmResumeReviewRefund: (
    requestNo: string,
    refundReference: string,
    reason: string,
  ) => client.post<ApiEnvelope<ResumeReviewRequest>>(
    `/admin/resume-reviews/${encodeURIComponent(requestNo)}/refund/confirm`,
    { refundReference, reason },
  ),

  listFeedbackSubmissions: () =>
    client.get<ApiEnvelope<FeedbackSubmissionAdmin[]>>('/admin/feedback-submissions'),

  approveFeedback: (id: number, reviewNote?: string) =>
    client.post<ApiEnvelope<FeedbackSubmissionAdmin>>(`/admin/feedback-submissions/${id}/approve`, { reviewNote }),

  rejectFeedback: (id: number, reviewNote: string) =>
    client.post<ApiEnvelope<FeedbackSubmissionAdmin>>(`/admin/feedback-submissions/${id}/reject`, { reviewNote }),

  publishFeedback: (id: number) =>
    client.post<ApiEnvelope<FeedbackSubmissionAdmin>>(`/admin/feedback-submissions/${id}/publish`),

  unpublishFeedback: (id: number) =>
    client.post<ApiEnvelope<FeedbackSubmissionAdmin>>(`/admin/feedback-submissions/${id}/unpublish`),

  resendCoupon: (id: number) =>
    client.post<ApiEnvelope<CouponAdmin>>(`/admin/coupons/${id}/resend`),

  listCoupons: () =>
    client.get<ApiEnvelope<CouponAdmin[]>>('/admin/coupons'),

  listVipInvites: () =>
    client.get<ApiEnvelope<VipInviteAdmin[]>>('/admin/vip-invites'),

  createVipInvite: (payload: CreateVipInvitePayload) =>
    client.post<ApiEnvelope<VipInviteAdmin>>('/admin/vip-invites', payload),

  invalidateVipInvite: (id: number, reason: string) =>
    client.post<ApiEnvelope<VipInviteAdmin>>(`/admin/vip-invites/${id}/invalidate`, { reason }),

  listVipInviteRedemptions: (id: number) =>
    client.get<ApiEnvelope<VipInviteRedemptionAdmin[]>>(`/admin/vip-invites/${id}/redemptions`),

  revokeVipInviteRedemption: (inviteId: number, redemptionId: number, reason: string) =>
    client.post<ApiEnvelope<VipInviteRedemptionAdmin>>(
      `/admin/vip-invites/${inviteId}/redemptions/${redemptionId}/revoke`,
      { reason },
    ),

  listMembershipAuditLogs: () =>
    client.get<ApiEnvelope<MembershipAdminAuditLog[]>>('/admin/membership-audit-logs'),

  listUsers: (params: ListUsersAdminQuery = {}) =>
    client.get<ApiEnvelope<MarketplacePage<UserAdmin>>>('/admin/users', { params }),

  grantMembership: (id: number, reason: string) =>
    client.post<ApiEnvelope<UserAdmin>>(`/admin/users/${id}/membership/grant`, { reason }),

  extendMembership: (id: number, days: number, reason: string) =>
    client.post<ApiEnvelope<UserAdmin>>(`/admin/users/${id}/membership/extend`, { days, reason }),

  revokeMembership: (id: number, reason: string) =>
    client.post<ApiEnvelope<UserAdmin>>(`/admin/users/${id}/membership/revoke`, { reason }),

  listShowcases: () =>
    client.get<ApiEnvelope<ResumeShowcaseAdmin[]>>('/admin/showcases'),

  featureShowcaseResume: (resumeId: number, payload: FeatureShowcasePayload) =>
    client.post<ApiEnvelope<ResumeShowcaseAdmin>>(
      `/admin/showcases/resumes/${resumeId}/feature`,
      payload,
    ),

  unfeatureShowcaseResume: (resumeId: number) =>
    client.delete<ApiEnvelope<ResumeShowcaseAdmin>>(
      `/admin/showcases/resumes/${resumeId}/feature`,
    ),

  listMarketplaceListings: (params: AdminMarketListingQuery) =>
    client.get<ApiEnvelope<MarketplacePage<AdminMarketListing>>>(
      '/admin/marketplace/listings',
      { params },
    ),

  moderateMarketplaceListing: (
    listingId: number,
    action: MarketplaceListingModerationAction,
    reason: string,
  ) => client.patch<ApiEnvelope<AdminMarketListing>>(
    `/admin/marketplace/listings/${listingId}/moderation`,
    { action, reason },
  ),

  listMarketplaceReports: (
    params: MarketplaceGovernanceQuery<MarketplaceReportStatus>,
  ) => client.get<ApiEnvelope<MarketplacePage<MarketplaceReport>>>(
    '/admin/marketplace/reports',
    { params },
  ),

  handleMarketplaceReport: (
    reportId: number,
    action: MarketplaceReportAction,
    reason: string,
  ) => client.patch<ApiEnvelope<MarketplaceReport>>(
    `/admin/marketplace/reports/${reportId}`,
    { action, reason },
  ),

  listMarketplaceAppeals: (
    params: MarketplaceGovernanceQuery<MarketplaceAppealStatus>,
  ) => client.get<ApiEnvelope<MarketplacePage<MarketplaceAppeal>>>(
    '/admin/marketplace/appeals',
    { params },
  ),

  handleMarketplaceAppeal: (
    appealId: number,
    action: MarketplaceAppealAction,
    reason: string,
  ) => client.patch<ApiEnvelope<MarketplaceAppeal>>(
    `/admin/marketplace/appeals/${appealId}`,
    { action, reason },
  ),

  listMarketplaceGovernanceAudits: (params: {
    page?: number
    size?: number
    listingId?: number
  }) => client.get<ApiEnvelope<MarketplacePage<MarketplaceGovernanceAudit>>>(
    '/admin/marketplace/audits',
    { params },
  ),

  listCreatorEarnings: (status = 'PENDING_SETTLEMENT') =>
    client.get<ApiEnvelope<CreatorEarning[]>>('/admin/creator-earnings', {
      params: { status },
    }),

  getCreatorEarningCount: (status = 'PENDING_SETTLEMENT') =>
    client.get<ApiEnvelope<number>>('/admin/creator-earnings/count', {
      params: { status },
    }),

  settleCreatorEarning: (earningId: number, settlementNote: string) =>
    client.post<ApiEnvelope<CreatorEarning>>(
      `/admin/creator-earnings/${earningId}/settle`,
      { settlementNote },
    ),

  listMarketplacePaymentReviews: (status?: '' | MarketplacePaymentReviewStatus) =>
    client.get<ApiEnvelope<MarketplacePaymentReview[]>>(
      '/admin/marketplace/payment-reviews',
      { params: status ? { status } : undefined },
    ),

  getMarketplacePaymentReviewCount: (status?: '' | MarketplacePaymentReviewStatus) =>
    client.get<ApiEnvelope<number>>(
      '/admin/marketplace/payment-reviews/count',
      { params: status ? { status } : undefined },
    ),

  listMarketplaceCloseWork: () =>
    client.get<ApiEnvelope<MarketplacePaymentReview[]>>(
      '/admin/marketplace/payment-reviews/close-work',
    ),

  getMarketplacePaymentReview: (orderNo: string) =>
    client.get<ApiEnvelope<MarketplacePaymentReview>>(
      `/admin/marketplace/payment-reviews/${encodeURIComponent(orderNo)}`,
    ),

  confirmMarketplaceRefund: (
    orderNo: string,
    refundReference: string,
    note: string,
  ) => client.post<ApiEnvelope<MarketplacePaymentReview>>(
    `/admin/marketplace/payment-reviews/${encodeURIComponent(orderNo)}/confirm-refunded`,
    { refundReference, note },
  ),

  listMembershipPaymentOrders: (params: MembershipPaymentAdminQuery) =>
    client.get<ApiEnvelope<MarketplacePage<MembershipPaymentAdminOrder>>>(
      '/admin/membership/payment-orders',
      { params },
    ),

  getMembershipPaymentOrder: (orderNo: string) =>
    client.get<ApiEnvelope<MembershipPaymentAdminOrder>>(
      `/admin/membership/payment-orders/${encodeURIComponent(orderNo)}`,
    ),

  getMembershipPaymentSummary: () =>
    client.get<ApiEnvelope<MembershipPaymentAdminSummary>>(
      '/admin/membership/payment-orders/summary',
    ),

  startMembershipRefund: (orderNo: string, reason: string, refundReference?: string) =>
    client.post<ApiEnvelope<MembershipPaymentAdminOrder>>(
      `/admin/membership/payment-orders/${encodeURIComponent(orderNo)}/refund-processing`,
      { reason, refundReference: refundReference || undefined },
    ),

  confirmMembershipRefund: (orderNo: string, reason: string, refundReference: string) =>
    client.post<ApiEnvelope<MembershipPaymentAdminOrder>>(
      `/admin/membership/payment-orders/${encodeURIComponent(orderNo)}/confirm-refunded`,
      { reason, refundReference },
    ),

  rejectMembershipRefund: (orderNo: string, reason: string) =>
    client.post<ApiEnvelope<MembershipPaymentAdminOrder>>(
      `/admin/membership/payment-orders/${encodeURIComponent(orderNo)}/reject`,
      { reason },
    ),

  closeMembershipPaymentReview: (orderNo: string, reason: string) =>
    client.post<ApiEnvelope<MembershipPaymentAdminOrder>>(
      `/admin/membership/payment-orders/${encodeURIComponent(orderNo)}/close`,
      { reason },
    ),
}
