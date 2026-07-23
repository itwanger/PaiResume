import client, { type ApiEnvelope } from './client'

export interface ShowcaseCard {
  id: number
  slug: string
  title: string
  scoreLabel: string
  summary: string
  tags: string[]
  updatedAt: string
}

export interface PublishedFeedback {
  id: number
  displayName: string
  schoolOrCompany: string
  targetRole: string
  rating: number
  testimonialText: string
  createdAt: string
}

export interface HomeData {
  membershipPriceCents: number
  questionnaireCouponAmountCents: number
  marketplaceEnabled: boolean
  showcases: ShowcaseCard[]
  testimonials: PublishedFeedback[]
}

export interface FeedbackSubmissionPayload {
  contactEmail: string
  displayName: string
  schoolOrCompany: string
  targetRole: string
  rating: number
  testimonialText: string
  desiredFeatures?: string
  bugFeedback?: string
  consentToPublish: boolean
}

export const publicApi = {
  home: () =>
    client.get<ApiEnvelope<HomeData>>('/public/home'),

  showcases: () =>
    client.get<ApiEnvelope<ShowcaseCard[]>>('/public/showcases'),

  submitFeedback: (payload: FeedbackSubmissionPayload) =>
    client.post('/public/feedback-submissions', payload),
}
