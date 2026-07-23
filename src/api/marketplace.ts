import client, { type ApiEnvelope } from './client'

export type MarketplaceAccessType = 'FREE' | 'PAID'

export type MarketplacePublicationStatus = 'PUBLISHED' | 'UNPUBLISHED'

export type MarketplaceModerationStatus = 'APPROVED' | 'SUSPENDED'

export type MarketplaceReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type MarketplaceReportType =
  | 'PRIVACY'
  | 'COPYRIGHT'
  | 'FRAUD'
  | 'ILLEGAL'
  | 'MISLEADING'
  | 'OTHER'

export type MarketplaceReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED'

export type MarketplaceAppealStatus = 'OPEN' | 'APPROVED' | 'REJECTED'

export type MarketplaceOrderStatus =
  | 'CREATED'
  | 'PREPAYING'
  | 'PREPAY_UNKNOWN'
  | 'PENDING'
  | 'PAID'
  | 'DUPLICATE_PAID'
  | 'REFUND_REQUIRED'
  | 'CLOSED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REFUNDED'

export type CreatorEarningStatus =
  | 'HOLDING'
  | 'AVAILABLE'
  | 'PENDING_SETTLEMENT'
  | 'SETTLED'
  | 'REVERSED'

export interface MarketplaceModule {
  moduleType: string
  content: Record<string, unknown>
  sortOrder: number
}

export interface MarketplaceListingSummary {
  listingId: number
  slug: string
  title: string
  summary: string
  tags: string[]
  accessType: MarketplaceAccessType
  priceCents: number
}

export interface MarketplaceListingCard extends MarketplaceListingSummary {
  publicationStatus: MarketplacePublicationStatus
  moderationStatus: MarketplaceModerationStatus
  updatedAt: string
  paymentEnabled: boolean
  viewCount: number
}

export interface MarketplaceListingOffer extends MarketplaceListingSummary {
  paymentEnabled?: boolean
  viewCount?: number
}

export interface MarketplaceContent extends MarketplaceListingSummary {
  revisionId: number
  templateId: string
  modules: MarketplaceModule[]
}

export interface MarketplaceAccess {
  listingId: number
  slug: string
  accessStatus: 'OWNER' | 'ADMIN' | 'FREE' | 'PURCHASED' | 'PAYMENT_REQUIRED'
  canView: boolean
  accessType: MarketplaceAccessType
  priceCents: number
  revisionId: number
  paymentEnabled: boolean
}

export interface MarketplaceOrder {
  orderNo: string
  listingSlug: string | null
  listingId: number
  listingRevisionId: number
  amountCents: number
  currency: string
  provider: string
  payChannel: string
  orderStatus: MarketplaceOrderStatus
  qrCodeDataUrl: string | null
  codeUrl: string | null
  expiresAt: string | null
  paidAt: string | null
  refundedAt: string | null
  paymentReviewReason: string | null
  unlocked: boolean
}

export interface MarketplacePage<T> {
  records: T[]
  total: number
  page: number
  size: number
  totalPages: number
}

export interface CreatorListing {
  id: number
  resumeId: number
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
  moderationReason: string | null
  currentRevisionId: number | null
  pendingRevisionId: number | null
  snapshotOutdated: boolean
  createdAt: string
  updatedAt: string
}

export interface MarketplaceReport {
  id: number
  listingId: number
  listingSlug: string | null
  reportType: MarketplaceReportType
  description: string
  contact: string | null
  processingStatus: MarketplaceReportStatus
  handledBy: number | null
  handledReason: string | null
  handledAt: string | null
  createdAt: string
  updatedAt: string
}

export interface MarketplaceReportPayload {
  type: MarketplaceReportType
  description: string
  contact?: string
}

export interface MarketplaceAppeal {
  id: number
  listingId: number
  listingRevisionId: number | null
  creatorUserId: number
  appealType: 'REVIEW_REJECTION' | 'TAKEDOWN'
  description: string
  appealStatus: MarketplaceAppealStatus
  handledBy: number | null
  handledReason: string | null
  handledAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreatorListingPayload {
  accessType: MarketplaceAccessType
  priceCents: number
  summary: string
  tags: string[]
  privacyConfirmed: true
}

export interface CreatorEarningsSummary {
  heldBalanceCents: number
  availableBalanceCents: number
  pendingSettlementCents: number
  debtBalanceCents: number
  debtNotice: string | null
  lifetimeEarnedCents: number
  lifetimeRefundedCents: number
  lifetimeNetEarnedCents: number
  paidOutCents: number
  holdingCount: number
  availableCount: number
  pendingSettlementCount: number
  settledCount: number
  reversedCount: number
}

export interface CreatorEarning {
  id: number
  sellerUserId: number
  sellerEmail: string | null
  orderNo: string | null
  sourceOrderStatus: MarketplaceOrderStatus | null
  listingId: number
  listingSlug: string | null
  grossAmountCents: number
  platformFeeCents: number
  netAmountCents: number
  walletCreditCents: number
  debtOffsetCents: number
  earningStatus: CreatorEarningStatus
  availableAt: string | null
  reversedAt: string | null
  reversedFromStatus: CreatorEarningStatus | null
  reversalReason: string | null
  createdAt: string
  settledAt: string | null
  settlementNote: string | null
}

export interface MarketplaceListingQuery {
  page?: number
  size?: number
  q?: string
  accessType?: MarketplaceAccessType | ''
}

export function getMarketplacePageItems<T>(page: MarketplacePage<T>): T[] {
  return page.records
}

export function getMarketplaceTotalPages<T>(page: MarketplacePage<T>): number {
  return page.totalPages
}

export function hasMarketplaceAccess(access: MarketplaceAccess): boolean {
  return access.canView
}

export function hasMarketplaceOrderAccess(order: MarketplaceOrder): boolean {
  // The server-side entitlement is authoritative. REFUND_REQUIRED can mean
  // either an invalid late payment (no entitlement) or a normal purchase whose
  // provider refund state still needs full-amount verification (access stays
  // active until that verification finishes).
  return order.unlocked
}

export function getMarketplaceOrderStatus(order: MarketplaceOrder): MarketplaceOrderStatus {
  return order.orderStatus
}

export const marketplaceApi = {
  publicListings: (params: MarketplaceListingQuery) =>
    client.get<ApiEnvelope<MarketplacePage<MarketplaceListingCard>>>(
      '/public/marketplace/listings',
      { params },
    ),

  publicOffer: (slug: string) =>
    client.get<ApiEnvelope<MarketplaceListingCard>>(
      `/public/marketplace/listings/${encodeURIComponent(slug)}/offer`,
    ),

  recordView: (slug: string) =>
    client.post<ApiEnvelope<void>>(
      `/public/marketplace/listings/${encodeURIComponent(slug)}/views`,
    ),

  publicContent: (slug: string) =>
    client.get<ApiEnvelope<MarketplaceContent>>(
      `/public/marketplace/listings/${encodeURIComponent(slug)}/content`,
    ),

  submitReport: (slug: string, payload: MarketplaceReportPayload) =>
    client.post<ApiEnvelope<MarketplaceReport>>(
      `/public/marketplace/listings/${encodeURIComponent(slug)}/reports`,
      payload,
    ),

  access: (slug: string) =>
    client.get<ApiEnvelope<MarketplaceAccess>>(
      `/marketplace/listings/${encodeURIComponent(slug)}/access`,
    ),

  content: (slug: string) =>
    client.get<ApiEnvelope<MarketplaceContent>>(
      `/marketplace/listings/${encodeURIComponent(slug)}/content`,
    ),

  createOrder: (slug: string, idempotencyKey: string) =>
    client.post<ApiEnvelope<MarketplaceOrder>>(
      `/marketplace/listings/${encodeURIComponent(slug)}/orders`,
      { idempotencyKey },
    ),

  order: (orderNo: string) =>
    client.get<ApiEnvelope<MarketplaceOrder>>(
      `/marketplace/orders/${encodeURIComponent(orderNo)}`,
    ),

  refreshOrder: (orderNo: string) =>
    client.post<ApiEnvelope<MarketplaceOrder>>(
      `/marketplace/orders/${encodeURIComponent(orderNo)}/refresh`,
    ),
}

export const creatorMarketplaceApi = {
  listings: () =>
    client.get<ApiEnvelope<CreatorListing[]>>('/creator/listings'),

  listing: (resumeId: number) =>
    client.get<ApiEnvelope<CreatorListing | null>>(`/creator/resumes/${resumeId}/listing`),

  publishListing: (resumeId: number, payload: CreatorListingPayload) =>
    client.put<ApiEnvelope<CreatorListing>>(`/creator/resumes/${resumeId}/listing`, payload),

  unpublishListing: (resumeId: number) =>
    client.post<ApiEnvelope<CreatorListing>>(`/creator/resumes/${resumeId}/listing/unpublish`),

  refreshRevision: (resumeId: number, privacyConfirmed: true) =>
    client.post<ApiEnvelope<CreatorListing>>(
      `/creator/resumes/${resumeId}/listing/refresh-revision`,
      { privacyConfirmed },
    ),

  appeals: () =>
    client.get<ApiEnvelope<MarketplaceAppeal[]>>('/creator/marketplace/appeals'),

  submitAppeal: (listingId: number, description: string) =>
    client.post<ApiEnvelope<MarketplaceAppeal>>(
      `/creator/listings/${listingId}/appeals`,
      { description },
    ),

  earningsSummary: () =>
    client.get<ApiEnvelope<CreatorEarningsSummary>>('/creator/earnings/summary'),

  earnings: () =>
    client.get<ApiEnvelope<CreatorEarning[]>>('/creator/earnings'),

  requestSettlement: (earningId: number) =>
    client.post<ApiEnvelope<CreatorEarning>>(`/creator/earnings/${earningId}/request-settlement`),
}
