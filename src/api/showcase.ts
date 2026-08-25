import client, { type ApiEnvelope } from './client'
import type { ResumeCardPreview, ResumeModule } from './resume'
import type { MarketplaceOrder } from './marketplace'

export type ShowcaseAccessType = 'PUBLIC' | 'LOGIN' | 'PAID'

export interface ShowcaseDetail {
  id: number
  slug: string
  title: string
  scoreLabel: string
  summary: string
  accessType: ShowcaseAccessType
  priceCents: number
  paymentEnabled: boolean
  locked: boolean
  preview: ResumeCardPreview
  pageMode?: string
  templateId: string
  density?: string
  accentPreset?: string
  headingStyle?: string
  modules: ResumeModule[]
  updatedAt: string
}

export const showcaseApi = {
  detail: (slug: string, purchaseToken?: string) =>
    client.get<ApiEnvelope<ShowcaseDetail>>(
      `/showcases/${encodeURIComponent(slug)}`,
      purchaseToken ? { headers: { 'X-Showcase-Purchase-Token': purchaseToken } } : undefined,
    ),

  createOrder: (slug: string, purchaseToken: string, idempotencyKey: string) =>
    client.post<ApiEnvelope<MarketplaceOrder>>(
      `/public/showcases/${encodeURIComponent(slug)}/orders`,
      { idempotencyKey },
      { headers: { 'X-Showcase-Purchase-Token': purchaseToken } },
    ),

  order: (orderNo: string, purchaseToken: string) =>
    client.get<ApiEnvelope<MarketplaceOrder>>(
      `/public/showcases/orders/${encodeURIComponent(orderNo)}`,
      { headers: { 'X-Showcase-Purchase-Token': purchaseToken } },
    ),

  refreshOrder: (orderNo: string, purchaseToken: string) =>
    client.post<ApiEnvelope<MarketplaceOrder>>(
      `/public/showcases/orders/${encodeURIComponent(orderNo)}/refresh`,
      undefined,
      { headers: { 'X-Showcase-Purchase-Token': purchaseToken } },
    ),
}
