import client, { type ApiEnvelope } from './client'
import type { ResumeCardPreview } from './resume'
import type { ShowcaseDetail } from './showcase'

export interface ShowcaseCard {
  id: number
  slug: string
  title: string
  scoreLabel: string
  summary: string
  tags: string[]
  pageMode?: string
  templateId?: string
  density?: string
  accentPreset?: string
  headingStyle?: string
  preview?: ResumeCardPreview
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
  membershipPriceCents: number | null
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

  showcaseDetail: (slug: string) =>
    client.get<ApiEnvelope<ShowcaseDetail>>(`/public/showcases/${encodeURIComponent(slug)}`),

  aiDisclosure: () =>
    client.get<ApiEnvelope<{ aiProviderName: string; aiProviderPrivacyUrl: string }>>('/public/ai-disclosure'),

  submitFeedback: (payload: FeedbackSubmissionPayload) =>
    client.post('/public/feedback-submissions', payload),
}
