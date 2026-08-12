import client, { type ApiEnvelope } from './client'
import type { ResumeListItem } from './resume'
import type { ModuleType } from '../types'

export interface ResumeProfile {
  userId: number
  content: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export interface UserResumeMaterial {
  id: number
  userId: number
  moduleType: ModuleType
  title: string
  content: Record<string, unknown>
  tags: string[]
  status: 'ACTIVE' | 'ARCHIVED'
  createdAt: string
  updatedAt: string
}

export interface ResumeHistoryMaterial {
  key: string
  moduleType: ModuleType
  title: string
  content: Record<string, unknown>
  sourceType: 'HISTORY_RESUME' | 'LEGACY_LIBRARY' | 'LEGACY_PROFILE'
  sourceResumeId?: number
  sourceResumeTitle?: string
  legacyMaterialId?: number
  updatedAt?: string
}

export interface OfficialResumeMaterial {
  id: number
  moduleType: ModuleType
  title: string
  targetRole: string
  careerStage: string
  content: Record<string, unknown>
  tags: string[]
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  sourceType: 'MANUAL' | 'AI'
  version: number
  useCount: number
  createdAt: string
  updatedAt: string
}

export interface ContentTemplateModule {
  moduleType: ModuleType
  content: Record<string, unknown>
}

export interface ResumeContentTemplate {
  id: number
  title: string
  summary: string
  targetRole: string
  careerStage: string
  layoutTemplateId: string
  modules: ContentTemplateModule[]
  tags: string[]
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  sourceType: 'MANUAL' | 'AI'
  version: number
  useCount: number
  createdAt: string
  updatedAt: string
}

export interface MaterialUpsertPayload {
  moduleType: ModuleType
  title: string
  content: Record<string, unknown>
  tags?: string[]
}

export interface OfficialMaterialUpsertPayload extends MaterialUpsertPayload {
  targetRole?: string
  careerStage?: string
  status: OfficialResumeMaterial['status']
  sourceType?: OfficialResumeMaterial['sourceType']
}

export interface ContentTemplateUpsertPayload {
  title: string
  summary?: string
  targetRole?: string
  careerStage?: string
  layoutTemplateId?: string
  modules: ContentTemplateModule[]
  tags?: string[]
  status: ResumeContentTemplate['status']
  sourceType?: ResumeContentTemplate['sourceType']
}

export interface LibraryAiDraftPayload {
  kind: 'MATERIAL' | 'TEMPLATE'
  moduleType: ModuleType
  targetRole?: string
  careerStage?: string
  techStack?: string[]
  facts?: Record<string, unknown>
}

export const contentLibraryApi = {
  getProfile: () => client.get<ApiEnvelope<ResumeProfile>>('/content-library/profile'),
  saveProfile: (content: Record<string, unknown>) =>
    client.put<ApiEnvelope<ResumeProfile>>('/content-library/profile', { content }),

  listMyMaterials: (params?: { moduleType?: ModuleType; query?: string }) =>
    client.get<ApiEnvelope<UserResumeMaterial[]>>('/content-library/my-materials', { params }),
  listHistoryMaterials: (params?: { moduleType?: ModuleType; query?: string; excludeResumeId?: number }) =>
    client.get<ApiEnvelope<ResumeHistoryMaterial[]>>('/content-library/history-materials', { params }),
  createMyMaterial: (payload: MaterialUpsertPayload) =>
    client.post<ApiEnvelope<UserResumeMaterial>>('/content-library/my-materials', payload),
  updateMyMaterial: (id: number, payload: MaterialUpsertPayload) =>
    client.put<ApiEnvelope<UserResumeMaterial>>(`/content-library/my-materials/${id}`, payload),
  deleteMyMaterial: (id: number) => client.delete(`/content-library/my-materials/${id}`),

  listOfficialMaterials: (params?: { moduleType?: ModuleType; query?: string; targetRole?: string }) =>
    client.get<ApiEnvelope<OfficialResumeMaterial[]>>('/content-library/official-materials', { params }),
  useOfficialMaterial: (id: number) =>
    client.post<ApiEnvelope<OfficialResumeMaterial>>(`/content-library/official-materials/${id}/use`),
  listTemplates: (params?: { query?: string; targetRole?: string }) =>
    client.get<ApiEnvelope<ResumeContentTemplate[]>>('/content-library/templates', { params }),
  createResumeFromTemplate: (id: number, title: string) =>
    client.post<ApiEnvelope<ResumeListItem>>(`/content-library/templates/${id}/create-resume`, { title }),
}

export const adminContentLibraryApi = {
  listMaterials: () =>
    client.get<ApiEnvelope<OfficialResumeMaterial[]>>('/admin/content-library/materials'),
  createMaterial: (payload: OfficialMaterialUpsertPayload) =>
    client.post<ApiEnvelope<OfficialResumeMaterial>>('/admin/content-library/materials', payload),
  updateMaterial: (id: number, payload: OfficialMaterialUpsertPayload) =>
    client.put<ApiEnvelope<OfficialResumeMaterial>>(`/admin/content-library/materials/${id}`, payload),
  listTemplates: () =>
    client.get<ApiEnvelope<ResumeContentTemplate[]>>('/admin/content-library/templates'),
  createTemplate: (payload: ContentTemplateUpsertPayload) =>
    client.post<ApiEnvelope<ResumeContentTemplate>>('/admin/content-library/templates', payload),
  updateTemplate: (id: number, payload: ContentTemplateUpsertPayload) =>
    client.put<ApiEnvelope<ResumeContentTemplate>>(`/admin/content-library/templates/${id}`, payload),
  generateAiDraft: (payload: LibraryAiDraftPayload) =>
    client.post<ApiEnvelope<Record<string, unknown>>>('/admin/content-library/ai-drafts', payload),
}
