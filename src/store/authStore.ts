import { create } from 'zustand'
import { authApi, type TokenData } from '../api/auth'

interface AuthState {
  user: TokenData['userInfo'] | null
  isAuthenticated: boolean
  initialized: boolean
  restoring: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, verificationCode: string) => Promise<void>
  logout: () => Promise<void>
  sendCode: (email: string) => Promise<void>
  restoreSession: () => Promise<void>
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
  initialized: false,
  restoring: false,

  login: async (email, password) => {
    const { data: res } = await authApi.login({ email, password })
    const tokenData = res.data
    localStorage.setItem('accessToken', tokenData.accessToken)
    localStorage.setItem('refreshToken', tokenData.refreshToken)
    set({ user: tokenData.userInfo, isAuthenticated: true, initialized: true })
  },

  register: async (email, password, verificationCode) => {
    const { data: res } = await authApi.register({ email, password, verificationCode })
    const tokenData = res.data
    localStorage.setItem('accessToken', tokenData.accessToken)
    localStorage.setItem('refreshToken', tokenData.refreshToken)
    set({ user: tokenData.userInfo, isAuthenticated: true, initialized: true })
  },

  logout: async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    set({ user: null, isAuthenticated: false, initialized: true, restoring: false })
  },

  sendCode: async (email) => {
    await authApi.sendCode(email)
  },

  restoreSession: async () => {
    const token = localStorage.getItem('accessToken')

    if (!token) {
      set({ user: null, isAuthenticated: false, initialized: true, restoring: false })
      return
    }

    set({ restoring: true })
    try {
      const { data: res } = await authApi.me()
      set({
        user: res.data,
        isAuthenticated: true,
        initialized: true,
        restoring: false,
      })
    } catch {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      set({
        user: null,
        isAuthenticated: false,
        initialized: true,
        restoring: false,
      })
    }
  },
}))
