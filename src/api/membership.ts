import client, { type ApiEnvelope } from './client'

export interface MembershipQuote {
  listPrice: number
  discountAmount: number
  payableAmount: number
  couponStatus: string
  paymentEnabled: boolean
}

export interface VipInviteRedemption {
  membershipStatus: 'ACTIVE'
  membershipGrantedAt: string
  membershipExpiresAt: string
  membershipSource: 'VIP_INVITE'
}

export const membershipApi = {
  quote: (couponCode?: string) =>
    client.post<ApiEnvelope<MembershipQuote>>('/membership/quote', { couponCode }),

  redeemInvite: (code: string) =>
    client.post<ApiEnvelope<VipInviteRedemption>>('/membership/redeem-invite', { code }),
}
