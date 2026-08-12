import axios from 'axios'
import { buildLoginPath } from '../utils/navigation'
import { clearAccessToken, getAccessToken, setAccessToken } from './tokenStore'

type RetryableRequestConfig = {
  _retry?: boolean
  headers: Record<string, string>
  url?: string
}

export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

export class ApiError extends Error {
  readonly code: number | null
  readonly status: number | null

  constructor(
    message: string,
    options: {
      code?: number | null
      status?: number | null
    } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = options.code ?? null
    this.status = options.status ?? null
  }
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const LEGAL_CONSENT_REQUIRED_CODE = 1123

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

function isPublicAuthRequest(url?: string) {
  return Boolean(url && (
    url.includes('/auth/login') ||
    url.includes('/auth/wechat/challenges') ||
    url.includes('/auth/register') ||
    url.includes('/auth/send-code') ||
    url.includes('/auth/password-reset/code') ||
    url.includes('/auth/password-reset/confirm') ||
    url.includes('/auth/refresh') ||
    url.includes('/public/vip-invite-claims')
  ))
}

function isLogoutRequest(url?: string) {
  return Boolean(url?.includes('/auth/logout'))
}

// 请求拦截：自动附加 Token
client.interceptors.request.use((config) => {
  if (isPublicAuthRequest(config.url)) {
    return config
  }

  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：401 自动刷新
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token)
    else reject(error)
  })
  failedQueue = []
}

function toApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error
  }

  if (!axios.isAxiosError(error)) {
    return new ApiError(error instanceof Error ? error.message : '请求失败')
  }

  const payload = error.response?.data as {
    code?: number
    message?: string
    error?: { message?: string }
  } | undefined
  const message = typeof payload?.message === 'string' && payload.message.trim()
    ? payload.message
    : typeof payload?.error?.message === 'string' && payload.error.message.trim()
      ? payload.error.message
      : error.message || '请求失败'

  return new ApiError(message, {
    code: typeof payload?.code === 'number' ? payload.code : null,
    status: error.response?.status ?? null,
  })
}

function shouldRefreshToken(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return false
  }

  const status = error.response?.status
  const payload = error.response?.data as { code?: number } | undefined
  const originalRequest = error.config as RetryableRequestConfig | undefined

  if (
    !originalRequest
    || originalRequest._retry
    || isPublicAuthRequest(originalRequest.url)
    || isLogoutRequest(originalRequest.url)
  ) {
    return false
  }

  return status === 401 || payload?.code === 401
}

function redirectToLegalConsentIfRequired(error: unknown) {
  if (!axios.isAxiosError(error) || typeof window === 'undefined') {
    return false
  }
  const payload = error.response?.data as { code?: number } | undefined
  if (payload?.code !== LEGAL_CONSENT_REQUIRED_CODE || window.location.pathname === '/legal-consent') {
    return false
  }

  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
  window.location.assign(`/legal-consent?redirect=${encodeURIComponent(returnTo)}`)
  return true
}

export async function refreshSessionRequest<T>() {
  const execute = () => axios.post<ApiEnvelope<T>>(
    `${API_BASE_URL}/auth/refresh`,
    {},
    { withCredentials: true, timeout: 30000 }
  )

  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('pai-resume-auth-refresh', execute)
  }
  return execute()
}

client.interceptors.response.use(
  (response) => {
    const payload = response.data as { code?: number; message?: string } | undefined
    if (payload && typeof payload.code === 'number' && payload.code !== 200) {
      return Promise.reject(new ApiError(payload.message || '请求失败', {
        code: payload.code,
        status: response.status,
      }))
    }

    return response
  },
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined

    if (redirectToLegalConsentIfRequired(error)) {
      return Promise.reject(toApiError(error))
    }

    if (shouldRefreshToken(error) && originalRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(client(originalRequest))
            },
            reject,
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { data } = await refreshSessionRequest<{ accessToken: string }>()
        if (data?.code !== 200 || !data?.data) {
          throw new ApiError(data?.message || '刷新登录态失败', {
            code: typeof data?.code === 'number' ? data.code : null,
            status: 200,
          })
        }

        const newAccessToken = data.data.accessToken
        setAccessToken(newAccessToken)

        processQueue(null, newAccessToken)
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return client(originalRequest)
      } catch (refreshError) {
        const apiError = toApiError(refreshError)
        processQueue(apiError, null)
        clearAccessToken()
        window.location.href = buildLoginPath()
        return Promise.reject(apiError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(toApiError(error))
  }
)

export default client
