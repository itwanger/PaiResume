import axios from 'axios'
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

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

function isPublicAuthRequest(url?: string) {
  return Boolean(url && (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/send-code') ||
    url.includes('/auth/refresh')
  ))
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

function extractApiErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : '请求失败'
  }

  const payload = error.response?.data as { message?: string; error?: { message?: string } } | undefined
  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message
  }

  if (typeof payload?.error?.message === 'string' && payload.error.message.trim()) {
    return payload.error.message
  }

  return error.message || '请求失败'
}

function shouldRefreshToken(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return false
  }

  const status = error.response?.status
  const payload = error.response?.data as { code?: number } | undefined
  const originalRequest = error.config as RetryableRequestConfig | undefined

  if (!originalRequest || originalRequest._retry || isPublicAuthRequest(originalRequest.url)) {
    return false
  }

  return status === 401 || payload?.code === 401
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
      return Promise.reject(new Error(payload.message || '请求失败'))
    }

    return response
  },
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined

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
          throw new Error(data?.message || '刷新登录态失败')
        }

        const newAccessToken = data.data.accessToken
        setAccessToken(newAccessToken)

        processQueue(null, newAccessToken)
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return client(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearAccessToken()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(new Error(extractApiErrorMessage(error)))
  }
)

export default client
