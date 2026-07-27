import client, { type ApiEnvelope } from './client'

export type MembershipEntitlementType = 'FIXED_DAYS' | 'PERMANENT'

export interface MembershipPlan {
  code: string
  name: string
  entitlementType: MembershipEntitlementType
  membershipDays: number | null
  priceCents: number | null
  enabled: boolean
  recommended: boolean
}

export interface MembershipQuote {
  planCode: string
  planName: string
  entitlementType: MembershipEntitlementType
  listPrice: number
  discountAmount: number
  payableAmount: number
  couponStatus: string
  paymentEnabled: boolean
  membershipDays: number | null
}

export type MembershipOrderStatus =
  | 'CREATED'
  | 'PREPAYING'
  | 'PREPAY_UNKNOWN'
  | 'PENDING'
  | 'PAID'
  | 'EXPIRED'
  | 'CANCELED'
  | 'REFUND_REQUIRED'

export interface MembershipOrder {
  orderNo: string
  userId: number
  planCode: string
  planName: string
  entitlementType: MembershipEntitlementType
  membershipDays: number | null
  listPriceCents: number
  discountAmountCents: number
  payableAmountCents: number
  currency: string
  provider: string
  payChannel: string
  orderStatus: MembershipOrderStatus
  codeUrl: string | null
  qrCodeDataUrl: string | null
  expiresAt: string | null
  paidAt: string | null
  membershipExpiresAt: string | null
  paymentReviewReason: string | null
}

export interface VipInviteRedemption {
  membershipStatus: 'ACTIVE'
  membershipGrantedAt: string
  membershipExpiresAt: string
  membershipSource: 'VIP_INVITE'
}

export interface VipInviteClaim {
  claimToken: string
  status: 'AWAITING_IDENTITY'
  expiresIn: number
  expiresAt: string
}

export interface VipInviteClaimResult {
  status: 'REDEEMED' | 'EXPIRED' | 'FAILED'
  message: string
  redemption: VipInviteRedemption | null
}

export const membershipApi = {
  plans: () =>
    client.get<ApiEnvelope<MembershipPlan[]>>('/membership/plans'),

  quote: (planCode: string, couponCode?: string) =>
    client.post<ApiEnvelope<MembershipQuote>>('/membership/quote', {
      planCode,
      couponCode,
    }),

  redeemInvite: (code: string) =>
    client.post<ApiEnvelope<VipInviteRedemption>>('/membership/redeem-invite', { code }),

  createInviteClaim: (code: string) =>
    client.post<ApiEnvelope<VipInviteClaim>>('/public/vip-invite-claims', { code }),

  completeInviteClaim: (claimToken: string) =>
    client.post<ApiEnvelope<VipInviteClaimResult>>(
      '/membership/vip-invite-claims/complete',
      { claimToken },
    ),

  createOrder: (planCode: string, idempotencyKey: string, couponCode?: string) =>
    client.post<ApiEnvelope<MembershipOrder>>('/membership/orders', {
      planCode,
      idempotencyKey,
      couponCode,
    }),

  activeOrder: () =>
    client.get<ApiEnvelope<MembershipOrder | null>>('/membership/orders/active'),

  order: (orderNo: string) =>
    client.get<ApiEnvelope<MembershipOrder>>(
      `/membership/orders/${encodeURIComponent(orderNo)}`,
    ),

  refreshOrder: (orderNo: string) =>
    client.post<ApiEnvelope<MembershipOrder>>(
      `/membership/orders/${encodeURIComponent(orderNo)}/refresh`,
    ),
}
