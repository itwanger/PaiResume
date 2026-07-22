import { create } from 'zustand'
import { authApi, type TokenData } from '../api/auth'
import { clearAccessToken, setAccessToken } from '../api/tokenStore'

interface AuthState {
  user: TokenData['userInfo'] | null
  isAuthenticated: boolean
  initialized: boolean
  restoring: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, verificationCode: string, inviteCode?: string) => Promise<void>
  logout: () => Promise<void>
  sendCode: (email: string) => Promise<void>
  restoreSession: () => Promise<void>
  refreshUser: () => Promise<void>
}

function clearLegacyTokenStorage() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('accessToken')
    window.localStorage.removeItem('refreshToken')
  }
}

clearLegacyTokenStorage()
let restoreSessionPromise: Promise<void> | null = null

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  initialized: false,
  restoring: false,

  login: async (email, password) => {
    const { data: res } = await authApi.login({ email, password })
    const tokenData = res.data
    setAccessToken(tokenData.accessToken)
    set({ user: tokenData.userInfo, isAuthenticated: true, initialized: true })
  },

  register: async (email, password, verificationCode, inviteCode) => {
    const { data: res } = await authApi.register({ email, password, verificationCode, inviteCode })
    const tokenData = res.data
    setAccessToken(tokenData.accessToken)
    set({ user: tokenData.userInfo, isAuthenticated: true, initialized: true })
  },

  logout: async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    clearAccessToken()
    set({ user: null, isAuthenticated: false, initialized: true, restoring: false })
  },

  sendCode: async (email) => {
    await authApi.sendCode(email)
  },

  refreshUser: async () => {
    const { data: res } = await authApi.me()
    set({ user: res.data, isAuthenticated: true, initialized: true })
  },

  restoreSession: () => {
    if (restoreSessionPromise) {
      return restoreSessionPromise
    }

    restoreSessionPromise = (async () => {
      set({ restoring: true })
      try {
        const { data: res } = await authApi.refresh()
        setAccessToken(res.data.accessToken)
        set({
          user: res.data.userInfo,
          isAuthenticated: true,
          initialized: true,
          restoring: false,
        })
      } catch {
        clearAccessToken()
        set({
          user: null,
          isAuthenticated: false,
          initialized: true,
          restoring: false,
        })
      }
    })().finally(() => {
      restoreSessionPromise = null
    })

    return restoreSessionPromise
  },
}))
