import client, { type ApiEnvelope } from './client'

export interface MembershipQuote {
  listPrice: number
  discountAmount: number
  payableAmount: number
  couponStatus: string
  paymentEnabled: boolean
}

export const membershipApi = {
  quote: (couponCode?: string) =>
    client.post<ApiEnvelope<MembershipQuote>>('/membership/quote', { couponCode }),
}
