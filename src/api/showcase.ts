import client, { type ApiEnvelope } from './client'
import type { ResumeModule } from './resume'

export interface ShowcaseDetail {
  id: number
  slug: string
  title: string
  scoreLabel: string
  summary: string
  tags: string[]
  pageMode?: string
  templateId: string
  density?: string
  accentPreset?: string
  headingStyle?: string
  modules: ResumeModule[]
  updatedAt: string
}

export const showcaseApi = {
  detail: (slug: string) =>
    client.get<ApiEnvelope<ShowcaseDetail>>(`/showcases/${encodeURIComponent(slug)}`),
}
