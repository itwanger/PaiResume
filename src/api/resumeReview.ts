import client, { type ApiEnvelope } from './client'

// FOLLOW_REWARD 仅用于读取下线前的历史申请，不能再创建或领取。
export type ResumeReviewEntitlement = 'WELCOME_FREE' | 'FOLLOW_REWARD' | 'PAID'

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
  enabled: boolean
  welcomeFreeAvailable: boolean
  paidReviewAvailable: boolean
  priceCents: number
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

export interface CreateResumeReviewRequest {
  resumeId: number
  idempotencyKey: string
  uploadNo: string
  contactEmail: string
  verificationCode?: string
  manualReviewConsent: true
  emailDeliveryConsent: true
}

export interface CreateResumeReviewUpload {
  resumeId: number
  fileName: string
  sizeBytes: number
  sha256: string
}

export interface ResumeReviewUploadCredential {
  uploadNo: string
  uploadUrl: string
  method: 'POST'
  headers: Record<string, string>
  fields: Record<string, string>
  expiresAt: string
  maxSizeBytes: number
}

export interface CompletedResumeReviewUpload {
  uploadNo: string
  fileName: string
  sizeBytes: number
  sha256: string
  status: 'READY'
}

async function uploadPdfToOss(credential: ResumeReviewUploadCredential, file: File) {
  if (credential.method !== 'POST') {
    throw new Error('服务端返回了不支持的上传方式')
  }
  const form = new FormData()
  Object.entries(credential.fields).forEach(([name, value]) => {
    form.append(name, value)
  })
  form.append('file', file, file.name)

  const response = await fetch(credential.uploadUrl, {
    method: credential.method,
    headers: credential.headers,
    body: form,
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  })

  if (!response.ok) {
    throw new Error(`PDF 上传失败（HTTP ${response.status}）`)
  }
}

export const resumeReviewApi = {
  eligibility: () =>
    client.get<ApiEnvelope<ResumeReviewEligibility>>('/resume-reviews/eligibility'),

  current: () =>
    client.get<ApiEnvelope<ResumeReviewRequest | null>>('/resume-reviews/current'),

  sendContactEmailCode: (contactEmail: string) =>
    client.post<ApiEnvelope<null>>('/resume-reviews/contact-email/code', { contactEmail }),

  requestUpload: (params: CreateResumeReviewUpload) =>
    client.post<ApiEnvelope<ResumeReviewUploadCredential>>('/resume-reviews/uploads', params),

  uploadPdf: (credential: ResumeReviewUploadCredential, file: File) =>
    uploadPdfToOss(credential, file),

  completeUpload: (uploadNo: string) =>
    client.post<ApiEnvelope<CompletedResumeReviewUpload>>(
      `/resume-reviews/uploads/${encodeURIComponent(uploadNo)}/complete`,
      {},
    ),

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
}
