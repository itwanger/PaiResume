import { create } from 'zustand'
import { authApi, type TokenData } from '../api/auth'

interface AuthState {
  user: TokenData['userInfo'] | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, verificationCode: string) => Promise<void>
  logout: () => Promise<void>
  sendCode: (email: string) => Promise<void>
  restoreSession: () => void
}

function hasStoredSession() {
  if (typeof window === 'undefined') {
    return false
  }
  return Boolean(window.localStorage.getItem('accessToken'))
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: hasStoredSession(),

  login: async (email, password) => {
    const { data: res } = await authApi.login({ email, password })
    const tokenData = res.data
    localStorage.setItem('accessToken', tokenData.accessToken)
    localStorage.setItem('refreshToken', tokenData.refreshToken)
    set({ user: tokenData.userInfo, isAuthenticated: true })
  },

  register: async (email, password, verificationCode) => {
    const { data: res } = await authApi.register({ email, password, verificationCode })
    const tokenData = res.data
    localStorage.setItem('accessToken', tokenData.accessToken)
    localStorage.setItem('refreshToken', tokenData.refreshToken)
    set({ user: tokenData.userInfo, isAuthenticated: true })
  },

  logout: async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    set({ user: null, isAuthenticated: false })
  },

  sendCode: async (email) => {
    await authApi.sendCode(email)
  },

  restoreSession: () => {
    const token = localStorage.getItem('accessToken')
    // 简单检查 token 存在即可，详细校验由后端拦截器处理
    if (token) {
      set({ isAuthenticated: true })
      return
    }
    set({ user: null, isAuthenticated: false })
  },
}))
