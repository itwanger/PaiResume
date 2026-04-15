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

export interface AiFieldOptimizeRequest {
  fieldType: 'project_description' | 'responsibility'
  index?: number
  prompt?: string
  systemPrompt?: string
}

export interface AiFieldOptimizeResponse {
  original: string
  optimized: string
  candidates?: string[]
}

export interface AiFieldOptimizeRecord {
  id: number
  status: 'completed' | 'error'
  original: string
  reasoning: string
  streamedContent: string
  optimized?: string
  candidates?: string[]
  error?: string
  prompt?: string
  systemPrompt?: string
  createdAt: string
  updatedAt: string
}

export interface FieldOptimizePromptConfig {
  systemPrompt: string
  descriptionPrompt: string
  responsibilityPrompt: string
}

export type AiFieldOptimizeStreamEventName =
  | 'connected'
  | 'meta'
  | 'status'
  | 'reasoning_delta'
  | 'content_delta'
  | 'result'
  | 'error'
  | 'done'

export interface AiFieldOptimizeStreamEvent {
  event: AiFieldOptimizeStreamEventName
  data: Record<string, unknown>
}

export type ResumeAnalysisStreamEventName =
  | 'connected'
  | 'status'
  | 'reasoning_delta'
  | 'content_delta'
  | 'result'
  | 'error'
  | 'done'

export interface ResumeAnalysisStreamEvent {
  event: ResumeAnalysisStreamEventName
  data: Record<string, unknown>
}

interface AiFieldOptimizeStreamOptions {
  signal?: AbortSignal
  onEvent?: (event: AiFieldOptimizeStreamEvent) => void
}

interface ResumeAnalysisStreamOptions {
  signal?: AbortSignal
  onEvent?: (event: ResumeAnalysisStreamEvent) => void
}

export interface ResumeOptimizationSkill {
  id: string
  name: string
  description: string
  systemPrompt: string
  moduleRules: string[]
  targetAudience: string
  densityGoal: string
}

export interface ResumeReferenceTemplate {
  id: string
  name: string
  description: string
  markdownBody: string
  intendedUse: string
}

export interface SmartOnePagePreviewRequest {
  mode: 'layout_only' | 'optimize_and_layout'
  promptMode: 'skill' | 'custom'
  skillId?: string
  customPrompt?: string
  templateId: string
  adoptionPolicy: 'only_if_better'
  outputFormat: 'continuous_pdf'
}

export interface ModuleDecision {
  moduleId: number
  action: 'keep_original' | 'suggest_optimized'
  reason: string
}

export interface SmartOnePagePreviewMeta {
  estimatedOriginalPages: number
  estimatedContinuousHeight: number
  estimatedCompressedPages: number
}

export interface SmartOnePagePreviewResponse {
  originalModules: ResumeModule[]
  optimizedModules: ResumeModule[]
  moduleDecisions: ModuleDecision[]
  effectiveModules: ResumeModule[]
  previewMeta: SmartOnePagePreviewMeta
  summary: string
}

export type ModuleOverrideState = Record<number, 'original' | 'optimized'>

export interface ResumeExportResponse {
  blob: Blob
  fileName: string
}

const AI_LOG_PREFIX = '[PaiResume AI]'
const STREAM_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

function logAiRequest(action: string, details: Record<string, unknown>) {
  console.info(`${AI_LOG_PREFIX} ${action}:request`, {
    timestamp: new Date().toISOString(),
    ...details,
  })
}

function logAiResponse(action: string, details: Record<string, unknown>) {
  console.info(`${AI_LOG_PREFIX} ${action}:response`, {
    timestamp: new Date().toISOString(),
    ...details,
  })
}

function logAiError(action: string, details: Record<string, unknown>) {
  console.error(`${AI_LOG_PREFIX} ${action}:error`, {
    timestamp: new Date().toISOString(),
    ...details,
  })
}

function buildStreamApiUrl(path: string) {
  if (/^https?:\/\//.test(STREAM_API_BASE_URL)) {
    return `${STREAM_API_BASE_URL}${path}`
  }
  return `${window.location.origin}${STREAM_API_BASE_URL}${path}`
}

async function extractStreamErrorMessage(response: Response) {
  const text = await response.text()
  if (!text.trim()) {
    return `请求失败（HTTP ${response.status}）`
  }

  try {
    const payload = JSON.parse(text) as { message?: string; error?: { message?: string } }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message
    }
    if (typeof payload.error?.message === 'string' && payload.error.message.trim()) {
      return payload.error.message
    }
  } catch {
    return text
  }

  return text
}

function parseSseChunk(chunk: string): AiFieldOptimizeStreamEvent | null {
  const normalized = chunk.replace(/\r/g, '').trim()
  if (!normalized) {
    return null
  }

  let eventName: AiFieldOptimizeStreamEventName = 'status'
  const dataLines: string[] = []

  for (const line of normalized.split('\n')) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim() as AiFieldOptimizeStreamEventName
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }

  const rawData = dataLines.join('\n').trim()
  if (!rawData) {
    return { event: eventName, data: {} }
  }

  try {
    return {
      event: eventName,
      data: JSON.parse(rawData) as Record<string, unknown>,
    }
  } catch {
    return {
      event: eventName,
      data: { message: rawData },
    }
  }
}

async function withAiLogging<T>(
  action: string,
  request: Record<string, unknown>,
  runner: () => Promise<{ data: ApiEnvelope<T> }>
) {
  logAiRequest(action, request)

  try {
    const response = await runner()
    logAiResponse(action, {
      request,
      response: response.data,
    })
    return response
  } catch (error: unknown) {
    logAiError(action, {
      request,
      error: error instanceof Error
        ? {
            name: error.name,
            message: error.message,
          }
        : error,
    })
    throw error
  }
}

function parseFileName(disposition: string | undefined) {
  if (!disposition) {
    return 'resume.pdf'
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const standardMatch = disposition.match(/filename="([^"]+)"/i)
  if (standardMatch?.[1]) {
    return standardMatch[1]
  }

  return 'resume.pdf'
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

  exportPdf: (
    resumeId: number,
    data?: {
      pageMode?: string
      templateId?: string
      density?: string
      accentPreset?: string
      headingStyle?: string
    }
  ) =>
    client.post<Blob>(`/resumes/${resumeId}/export-pdf`, data || {}, { responseType: 'blob' }).then(async (response) => {
      const contentType = String(response.headers['content-type'] ?? '')
      if (contentType.includes('application/json')) {
        const text = await response.data.text()
        try {
          const payload = JSON.parse(text) as { message?: string }
          throw new Error(payload.message || '导出 PDF 失败')
        } catch (error) {
          throw error instanceof Error ? error : new Error(text || '导出 PDF 失败')
        }
      }

      return {
        blob: response.data,
        fileName: parseFileName(response.headers['content-disposition']),
      } satisfies ResumeExportResponse
    }),

  aiOptimize: (resumeId: number, moduleId: number) =>
    withAiLogging(
      'module-optimize',
      {
        resumeId,
        moduleId,
        url: `/resumes/${resumeId}/modules/${moduleId}/ai-optimize`,
      },
      () => client.post<ApiEnvelope<{ original: Record<string, unknown>; optimized: Record<string, unknown> }>>(
        `/resumes/${resumeId}/modules/${moduleId}/ai-optimize`
      )
    ),

  aiOptimizeField: (resumeId: number, moduleId: number, data: AiFieldOptimizeRequest) =>
    withAiLogging(
      'field-optimize',
      {
        resumeId,
        moduleId,
        url: `/resumes/${resumeId}/modules/${moduleId}/ai-optimize-field`,
        payload: data,
      },
      () => client.post<ApiEnvelope<AiFieldOptimizeResponse>>(
        `/resumes/${resumeId}/modules/${moduleId}/ai-optimize-field`,
        data,
        { timeout: 70000 }
      )
    ),

  getFieldOptimizePromptConfig: () =>
    client.get<ApiEnvelope<FieldOptimizePromptConfig>>('/resumes/field-optimize-prompts'),

  getLatestFieldOptimizeRecord: (resumeId: number, moduleId: number, params: { fieldType: string; index?: number | null }) =>
    client.get<ApiEnvelope<AiFieldOptimizeRecord | null>>(
      `/resumes/${resumeId}/modules/${moduleId}/ai-optimize-field/latest`,
      {
        params: {
          fieldType: params.fieldType,
          ...(params.index === null || params.index === undefined ? {} : { index: params.index }),
        },
      }
    ),

  aiOptimizeFieldStream: async (
    resumeId: number,
    moduleId: number,
    data: AiFieldOptimizeRequest,
    options: AiFieldOptimizeStreamOptions = {}
  ) => {
    const request = {
      resumeId,
      moduleId,
      url: `/resumes/${resumeId}/modules/${moduleId}/ai-optimize-field/stream`,
      payload: data,
    }
    logAiRequest('field-optimize-stream', request)

    const token = localStorage.getItem('accessToken')
    const response = await fetch(buildStreamApiUrl(request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
      signal: options.signal,
    })

    if (!response.ok) {
      const message = await extractStreamErrorMessage(response)
      logAiError('field-optimize-stream', {
        request,
        error: message,
      })
      throw new Error(message)
    }

    if (!response.body) {
      const message = '浏览器未返回可读取的 AI 流式响应'
      logAiError('field-optimize-stream', { request, error: message })
      throw new Error(message)
    }

    let finalResult: AiFieldOptimizeResponse | null = null
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const normalizedBuffer = buffer.replace(/\r\n/g, '\n')
        const chunks = normalizedBuffer.split('\n\n')
        buffer = chunks.pop() ?? ''

        for (const chunk of chunks) {
          const event = parseSseChunk(chunk)
          if (!event) {
            continue
          }
          options.onEvent?.(event)

          if (event.event === 'result') {
            finalResult = event.data as unknown as AiFieldOptimizeResponse
            logAiResponse('field-optimize-stream', {
              request,
              response: finalResult,
            })
            await reader.cancel()
            return finalResult
          }

          if (event.event === 'error') {
            const message = typeof event.data.message === 'string' && event.data.message.trim()
              ? event.data.message
              : 'AI 流式优化失败，请稍后重试'
            throw new Error(message)
          }
        }
      }
    } catch (error) {
      logAiError('field-optimize-stream', {
        request,
        error: error instanceof Error ? error.message : error,
      })
      throw error
    } finally {
      reader.releaseLock()
    }

    if (!finalResult) {
      const message = 'AI 流式优化未返回最终结果'
      logAiError('field-optimize-stream', { request, error: message })
      throw new Error(message)
    }
    return finalResult
  },

  analyze: (resumeId: number, data?: { prompt?: string }) =>
    withAiLogging(
      'resume-analysis',
      {
        resumeId,
        url: `/resumes/${resumeId}/analysis`,
        payload: data || {},
      },
      () => client.post<ApiEnvelope<AnalysisResult>>(`/resumes/${resumeId}/analysis`, data || {}, {
        timeout: 70000,
      })
    ),

  analyzeStream: async (
    resumeId: number,
    data?: { prompt?: string },
    options: ResumeAnalysisStreamOptions = {}
  ) => {
    const request = {
      resumeId,
      url: `/resumes/${resumeId}/analysis/stream`,
      payload: data || {},
    }
    logAiRequest('resume-analysis-stream', request)

    const token = localStorage.getItem('accessToken')
    const response = await fetch(buildStreamApiUrl(request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data || {}),
      signal: options.signal,
    })

    if (!response.ok) {
      const message = await extractStreamErrorMessage(response)
      logAiError('resume-analysis-stream', {
        request,
        error: message,
      })
      throw new Error(message)
    }

    if (!response.body) {
      const message = '浏览器未返回可读取的简历分析流式响应'
      logAiError('resume-analysis-stream', { request, error: message })
      throw new Error(message)
    }

    let finalResult: AnalysisResult | null = null
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const normalizedBuffer = buffer.replace(/\r\n/g, '\n')
        const chunks = normalizedBuffer.split('\n\n')
        buffer = chunks.pop() ?? ''

        for (const chunk of chunks) {
          const event = parseSseChunk(chunk) as ResumeAnalysisStreamEvent | null
          if (!event) {
            continue
          }
          options.onEvent?.(event)

          if (event.event === 'result') {
            finalResult = event.data as unknown as AnalysisResult
            logAiResponse('resume-analysis-stream', {
              request,
              response: finalResult,
            })
            await reader.cancel()
            return finalResult
          }

          if (event.event === 'error') {
            const message = typeof event.data.message === 'string' && event.data.message.trim()
              ? event.data.message
              : 'AI 简历分析失败，请稍后重试'
            throw new Error(message)
          }
        }
      }
    } catch (error) {
      logAiError('resume-analysis-stream', {
        request,
        error: error instanceof Error ? error.message : error,
      })
      throw error
    } finally {
      reader.releaseLock()
    }

    if (!finalResult) {
      const message = 'AI 简历分析未返回最终结果'
      logAiError('resume-analysis-stream', { request, error: message })
      throw new Error(message)
    }
    return finalResult
  },

  getLatestAnalysis: (resumeId: number) =>
    withAiLogging(
      'resume-analysis-latest',
      {
        resumeId,
        url: `/resumes/${resumeId}/analysis/latest`,
      },
      () => client.get<ApiEnvelope<AnalysisResult | null>>(`/resumes/${resumeId}/analysis/latest`)
    ),

  smartOnePagePreview: (resumeId: number, data: SmartOnePagePreviewRequest) =>
    withAiLogging(
      'smart-onepage-preview',
      {
        resumeId,
        url: `/resumes/${resumeId}/smart-onepage/preview`,
        payload: data,
      },
      () => client.post<ApiEnvelope<SmartOnePagePreviewResponse>>(`/resumes/${resumeId}/smart-onepage/preview`, data, {
        timeout: 120000,
      })
    ),
}
