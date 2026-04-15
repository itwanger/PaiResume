import client, { type ApiEnvelope } from './client'
import type { ResumeModule } from './resume'

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
  showcases: ShowcaseCard[]
  testimonials: PublishedFeedback[]
}

export interface ShowcaseDetail {
  id: number
  slug: string
  title: string
  scoreLabel: string
  summary: string
  tags: string[]
  modules: ResumeModule[]
  updatedAt: string
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

  showcaseDetail: (slug: string) =>
    client.get<ApiEnvelope<ShowcaseDetail>>(`/public/showcases/${slug}`),

  submitFeedback: (payload: FeedbackSubmissionPayload) =>
    client.post('/public/feedback-submissions', payload),
}
