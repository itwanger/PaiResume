import client, { type ApiEnvelope } from './client'

export type ResumeReviewEntitlement = 'WELCOME_FREE' | 'FOLLOW_REWARD' | 'PAID'
export type ResumeReviewNextEntitlement = ResumeReviewEntitlement | 'FOLLOW_REQUIRED'

export type ResumeReviewStatus =
  | 'AWAITING_PAYMENT'
  | 'EMAIL_PENDING'
  | 'EMAILED'
  | 'ACCEPTED'
  | 'COMPLETED'
  | 'REFUND_REQUIRED'
  | 'RETURNED'
  | 'REFUNDED'

export type ResumeReviewPaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'PREPAY_UNKNOWN'
  | 'PAID'
  | 'CANCELED'
  | 'REFUND_REQUIRED'
  | 'REFUNDED'

export interface ResumeReviewEligibility {
  welcomeFreeAvailable: boolean
  followRewardIssued: boolean
  followRewardAvailable: boolean
  paidReviewAvailable: boolean
  nextEntitlement: ResumeReviewNextEntitlement
  priceCents: number
  followOfficialAccountName: string
  followQrCodeUrl: string | null
  notice: string
}

export interface ResumeReviewRequest {
  requestNo: string
  resumeId: number
  contactEmail: string
  contentHash: string
  entitlementType: ResumeReviewEntitlement
  requestStatus: ResumeReviewStatus
  priceCents: number
  orderNo: string | null
  paymentStatus: ResumeReviewPaymentStatus | null
  codeUrl: string | null
  qrCodeDataUrl: string | null
  paymentExpiresAt: string | null
  paidAt: string | null
  createdAt: string
  refundReason: string | null
}

export interface ResumeReviewFollowChallenge {
  challengeCode: string
  officialAccountName: string
  qrCodeUrl: string | null
  instruction: string
  expiresAt: string
}

export interface CreateResumeReviewRequest {
  resumeId: number
  idempotencyKey: string
  contactEmail: string
  verificationCode?: string
  manualReviewConsent: true
  emailDeliveryConsent: true
}

export const resumeReviewApi = {
  eligibility: () =>
    client.get<ApiEnvelope<ResumeReviewEligibility>>('/resume-reviews/eligibility'),

  current: () =>
    client.get<ApiEnvelope<ResumeReviewRequest | null>>('/resume-reviews/current'),

  sendContactEmailCode: (contactEmail: string) =>
    client.post<ApiEnvelope<null>>('/resume-reviews/contact-email/code', { contactEmail }),

  create: (params: CreateResumeReviewRequest) =>
    client.post<ApiEnvelope<ResumeReviewRequest>>('/resume-reviews', params),

  request: (requestNo: string) =>
    client.get<ApiEnvelope<ResumeReviewRequest>>(
      `/resume-reviews/${encodeURIComponent(requestNo)}`,
    ),

  refreshPayment: (requestNo: string) =>
    client.post<ApiEnvelope<ResumeReviewRequest>>(
      `/resume-reviews/${encodeURIComponent(requestNo)}/payment/refresh`,
    ),

  createFollowChallenge: () =>
    client.post<ApiEnvelope<ResumeReviewFollowChallenge>>('/resume-reviews/follow-challenges'),

  redeemFollowFallbackCode: (code: string) =>
    client.post<ApiEnvelope<null>>('/resume-reviews/follow-rewards/redeem-fallback', { code }),
}
