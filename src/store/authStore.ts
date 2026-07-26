import { create } from 'zustand'
import { authApi, type TokenData } from '../api/auth'
import { clearAccessToken, setAccessToken } from '../api/tokenStore'
import { useResumeStore } from './resumeStore'

interface AuthState {
  user: TokenData['userInfo'] | null
  isAuthenticated: boolean
  initialized: boolean
  restoring: boolean
  login: (email: string, password: string) => Promise<void>
  completeWechatLogin: (
    challengeId: string,
    pollToken: string,
    agreementsAccepted: boolean,
  ) => Promise<void>
  register: (
    email: string,
    password: string,
    verificationCode: string,
    termsAccepted: boolean,
    privacyAccepted: boolean,
    inviteCode?: string,
  ) => Promise<void>
  logout: () => Promise<void>
  clearSession: () => void
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

function clearUserScopedBrowserData() {
  if (typeof window === 'undefined') {
    return
  }

  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keysToRemove: string[] = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key?.startsWith('pai-resume')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => storage.removeItem(key))
  }
}

function clearClientSessionData() {
  clearAccessToken()
  clearLegacyTokenStorage()
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('rememberedPassword')
  }
  clearUserScopedBrowserData()
  useResumeStore.getState().clearUserData()
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

  completeWechatLogin: async (challengeId, pollToken, agreementsAccepted) => {
    if (!agreementsAccepted) {
      throw new Error('请先阅读并同意服务条款与隐私政策')
    }
    const { data: res } = await authApi.exchangeWechatChallenge(challengeId, pollToken, {
      termsAccepted: true,
      privacyAccepted: true,
    })
    const tokenData = res.data
    setAccessToken(tokenData.accessToken)
    set({ user: tokenData.userInfo, isAuthenticated: true, initialized: true })
  },

  register: async (email, password, verificationCode, termsAccepted, privacyAccepted, inviteCode) => {
    const { data: res } = await authApi.register({
      email,
      password,
      verificationCode,
      termsAccepted,
      privacyAccepted,
      inviteCode,
    })
    const tokenData = res.data
    setAccessToken(tokenData.accessToken)
    set({ user: tokenData.userInfo, isAuthenticated: true, initialized: true })
  },

  logout: async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    clearClientSessionData()
    set({ user: null, isAuthenticated: false, initialized: true, restoring: false })
  },

  clearSession: () => {
    clearClientSessionData()
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
