import client, { type ApiEnvelope } from './client'
import type {
  CreatorEarning,
  MarketplaceAccessType,
  MarketplaceModerationStatus,
  MarketplaceOrderStatus,
  MarketplacePage,
  MarketplacePublicationStatus,
} from './marketplace'

export interface PlatformConfig {
  membershipPriceCents: number
  questionnaireCouponAmountCents: number
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
  couponStatus: string
  reviewNote: string | null
  reviewedBy: number | null
  reviewedAt: string | null
  createdAt: string
  coupon?: CouponAdmin
}

export interface UserAdmin {
  id: number
  email: string
  nickname: string
  role: string
  membershipStatus: string
  membershipGrantedAt: string | null
  membershipExpiresAt: string | null
  membershipSource: string | null
  createdAt: string
}

export interface ResumeShowcaseAdmin {
  id: number
  resumeId: number
  slug: string
  scoreLabel: string
  summary: string
  tags: string[] | null
  displayOrder: number
  publishStatus: string
  createdAt: string
  updatedAt: string
}

export interface ResumeShowcasePayload {
  resumeId: number
  slug: string
  scoreLabel: string
  summary: string
  tags: string[]
  displayOrder: number
  publishStatus: string
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
  moderatedBy: number | null
  moderatedAt: string | null
  moderationReason: string | null
  currentRevisionId: number | null
  createdAt: string
  updatedAt: string
}

export interface AdminMarketListingQuery {
  page?: number
  size?: number
  publicationStatus?: 'PUBLISHED' | 'UNPUBLISHED' | ''
  moderationStatus?: MarketplaceModerationStatus | ''
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

export const adminApi = {
  getPlatformConfig: () =>
    client.get<ApiEnvelope<PlatformConfig>>('/admin/platform-config'),

  updatePlatformConfig: (payload: PlatformConfig) =>
    client.put<ApiEnvelope<PlatformConfig>>('/admin/platform-config', payload),

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
    client.post<ApiEnvelope<FeedbackSubmissionAdmin>>(`/admin/feedback-submissions/${id}/resend-coupon`),

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

  listUsers: () =>
    client.get<ApiEnvelope<UserAdmin[]>>('/admin/users'),

  grantMembership: (id: number, reason: string) =>
    client.post<ApiEnvelope<UserAdmin>>(`/admin/users/${id}/membership/grant`, { reason }),

  extendMembership: (id: number, days: number, reason: string) =>
    client.post<ApiEnvelope<UserAdmin>>(`/admin/users/${id}/membership/extend`, { days, reason }),

  revokeMembership: (id: number, reason: string) =>
    client.post<ApiEnvelope<UserAdmin>>(`/admin/users/${id}/membership/revoke`, { reason }),

  listShowcases: () =>
    client.get<ApiEnvelope<ResumeShowcaseAdmin[]>>('/admin/showcases'),

  createShowcase: (payload: ResumeShowcasePayload) =>
    client.post<ApiEnvelope<ResumeShowcaseAdmin>>('/admin/showcases', payload),

  updateShowcase: (id: number, payload: ResumeShowcasePayload) =>
    client.put<ApiEnvelope<ResumeShowcaseAdmin>>(`/admin/showcases/${id}`, payload),

  listMarketplaceListings: (params: AdminMarketListingQuery) =>
    client.get<ApiEnvelope<MarketplacePage<AdminMarketListing>>>(
      '/admin/marketplace/listings',
      { params },
    ),

  moderateMarketplaceListing: (
    listingId: number,
    action: 'APPROVE' | 'SUSPEND',
    reason: string,
  ) => client.patch<ApiEnvelope<AdminMarketListing>>(
    `/admin/marketplace/listings/${listingId}/moderation`,
    { action, reason },
  ),

  listCreatorEarnings: (status = 'PENDING_SETTLEMENT') =>
    client.get<ApiEnvelope<CreatorEarning[]>>('/admin/creator-earnings', {
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
}
