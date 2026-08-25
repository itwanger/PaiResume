import client, { type ApiEnvelope } from './client'

// FOLLOW_REWARD 仅用于读取下线前的历史申请，不能再创建或领取。
export type ResumeReviewEntitlement = 'WELCOME_FREE' | 'FOLLOW_REWARD' | 'MEMBERSHIP' | 'PAID'

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
  memberEligible: boolean
  paidReviewAvailable: boolean
  priceCents: number
  maxPriorityFeeCents: number
  notice: string
}

export interface ResumeReviewRequest {
  requestNo: string
  resumeId: number | null
  contactEmail: string
  contentHash: string
  pdfFileName: string
  pdfSizeBytes: number
  entitlementType: ResumeReviewEntitlement
  requestStatus: ResumeReviewStatus
  priceCents: number
  basePriceCents: number
  priorityFeeCents: number
  orderNo: string | null
  paymentStatus: ResumeReviewPaymentStatus | null
  codeUrl: string | null
  qrCodeDataUrl: string | null
  paymentExpiresAt: string | null
  paidAt: string | null
  dispatchedAt: string | null
  queuedAt: string | null
  createdAt: string
  refundReason: string | null
}

export interface CreateResumeReviewRequest {
  resumeId?: number | null
  idempotencyKey: string
  fileName: string
  sizeBytes: number
  sha256: string
  priorityFeeCents: number
  contactEmail: string
  verificationCode?: string
}

export interface ResumeReviewQueueItem {
  position: number
  publicCode: string
  queueStatus: 'WAITING' | 'IN_PROGRESS'
  priority: boolean
  priorityFeeCents: number
  paidAmountCents: number
  queuedAt: string | null
}

export const resumeReviewApi = {
  publicQueue: () =>
    client.get<ApiEnvelope<ResumeReviewQueueItem[]>>('/public/resume-reviews/queue'),

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

  updateContactEmail: (requestNo: string, contactEmail: string, verificationCode?: string) =>
    client.patch<ApiEnvelope<ResumeReviewRequest>>(
      `/resume-reviews/${encodeURIComponent(requestNo)}/contact-email`,
      { contactEmail, verificationCode },
    ),

  upgradePriority: (requestNo: string, priorityFeeCents: number) =>
    client.post<ApiEnvelope<ResumeReviewRequest>>(
      `/resume-reviews/${encodeURIComponent(requestNo)}/priority`,
      { priorityFeeCents },
    ),

  refreshPayment: (requestNo: string) =>
    client.post<ApiEnvelope<ResumeReviewRequest>>(
      `/resume-reviews/${encodeURIComponent(requestNo)}/payment/refresh`,
    ),

  dispatch: (requestNo: string, file: File) => {
    const form = new FormData()
    form.append('file', file, file.name)
    return client.post<ApiEnvelope<ResumeReviewRequest>>(
      `/resume-reviews/${encodeURIComponent(requestNo)}/dispatch`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
  },
}
