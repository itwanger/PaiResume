import client, { type ApiEnvelope } from './client'
import type { AnalysisResult } from '../types'

export interface ResumeListItem {
  id: number
  title: string
  templateId: string
  createdAt: string
  updatedAt: string
}

export interface ResumeModule {
  id: number
  resumeId: number
  moduleType: string
  content: Record<string, unknown>
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export const resumeApi = {
  list: () =>
    client.get<ApiEnvelope<ResumeListItem[]>>('/resumes'),

  create: (data?: { title?: string; templateId?: string }) =>
    client.post<ApiEnvelope<ResumeListItem>>('/resumes', data || {}),

  update: (id: number, data: { title: string }) =>
    client.put<ApiEnvelope<ResumeListItem>>(`/resumes/${id}`, data),

  delete: (id: number) =>
    client.delete(`/resumes/${id}`),

  getModules: (resumeId: number) =>
    client.get<ApiEnvelope<ResumeModule[]>>(`/resumes/${resumeId}/modules`),

  addModule: (resumeId: number, data: { moduleType: string; content: Record<string, unknown>; sortOrder?: number }) =>
    client.post<ApiEnvelope<ResumeModule>>(`/resumes/${resumeId}/modules`, data),

  updateModule: (resumeId: number, moduleId: number, content: Record<string, unknown>) =>
    client.post<ApiEnvelope<ResumeModule>>(`/resumes/${resumeId}/modules/${moduleId}/update`, { content }),

  deleteModule: (resumeId: number, moduleId: number) =>
    client.delete(`/resumes/${resumeId}/modules/${moduleId}`),

  aiOptimize: (resumeId: number, moduleId: number) =>
    client.post<ApiEnvelope<{ original: Record<string, unknown>; optimized: Record<string, unknown> }>>(
      `/resumes/${resumeId}/modules/${moduleId}/ai-optimize`
    ),

  analyze: (resumeId: number, data?: { prompt?: string }) =>
    client.post<ApiEnvelope<AnalysisResult>>(`/resumes/${resumeId}/analysis`, data || {}, {
      timeout: 70000,
    }),
}
