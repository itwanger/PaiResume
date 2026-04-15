import client, { type ApiEnvelope } from './client'

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

  listUsers: () =>
    client.get<ApiEnvelope<UserAdmin[]>>('/admin/users'),

  grantMembership: (id: number) =>
    client.post<ApiEnvelope<UserAdmin>>(`/admin/users/${id}/membership/grant`),

  revokeMembership: (id: number) =>
    client.post<ApiEnvelope<UserAdmin>>(`/admin/users/${id}/membership/revoke`),

  listShowcases: () =>
    client.get<ApiEnvelope<ResumeShowcaseAdmin[]>>('/admin/showcases'),

  createShowcase: (payload: ResumeShowcasePayload) =>
    client.post<ApiEnvelope<ResumeShowcaseAdmin>>('/admin/showcases', payload),

  updateShowcase: (id: number, payload: ResumeShowcasePayload) =>
    client.put<ApiEnvelope<ResumeShowcaseAdmin>>(`/admin/showcases/${id}`, payload),
}
