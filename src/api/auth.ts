import client, { refreshSessionRequest, type ApiEnvelope } from './client'

export interface LoginParams {
  email: string
  password: string
}

export interface RegisterParams {
  email: string
  password: string
  verificationCode: string
  inviteCode?: string
}

export interface TokenData {
  accessToken: string
  expiresIn: number
  userInfo: {
    id: number
    email: string
    nickname: string
    avatar: string
    role: string
    membershipStatus: 'FREE' | 'ACTIVE'
    membershipGrantedAt: string | null
    membershipExpiresAt: string | null
    admin: boolean
  }
}

export const authApi = {
  login: (params: LoginParams) =>
    client.post<ApiEnvelope<TokenData>>('/auth/login', params),

  register: (params: RegisterParams) =>
    client.post<ApiEnvelope<TokenData>>('/auth/register', params),

  refresh: () => refreshSessionRequest<TokenData>(),

  logout: () =>
    client.post('/auth/logout'),

  sendCode: (email: string) =>
    client.post('/auth/send-code', { email }),

  me: () =>
    client.get<ApiEnvelope<TokenData['userInfo']>>('/auth/me'),
}
