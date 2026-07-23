import client, { refreshSessionRequest, type ApiEnvelope } from './client'

export interface LoginParams {
  email: string
  password: string
}

export interface RegisterParams {
  email: string
  password: string
  verificationCode: string
  termsAccepted: boolean
  privacyAccepted: boolean
  inviteCode?: string
}

export interface PasswordResetConfirmParams {
  email: string
  verificationCode: string
  newPassword: string
}

export interface AccountDeletionParams {
  password?: string
  wechatReauthProof?: string
  confirmation: '注销账号'
}

export type WechatChallengeStatus = 'PENDING' | 'CONFIRMED' | 'CONSUMED' | 'EXPIRED'

export interface WechatChallengeCreateData {
  challengeId: string
  pollToken: string
  qrImageDataUrl: string
  expiresIn: number
}

export interface WechatChallengeCreateParams {
  claimToken?: string
}

export interface WechatChallengeStatusData {
  challengeId: string
  status: WechatChallengeStatus
  expiresIn: number
}

export interface WechatReauthProofData {
  reauthProof: string
  expiresIn: number
}

export interface TokenData {
  accessToken: string
  expiresIn: number
  userInfo: {
    id: number
    email: string | null
    nickname: string
    avatar: string
    role: string
    membershipStatus: 'FREE' | 'ACTIVE'
    membershipGrantedAt: string | null
    membershipExpiresAt: string | null
    admin: boolean
    legalConsentRequired: boolean
    marketplaceEnabled: boolean
    emailLoginEnabled: boolean
    paicongmingLinked: boolean
    paicongmingSubscribed: boolean
  }
}

export const authApi = {
  login: (params: LoginParams) =>
    client.post<ApiEnvelope<TokenData>>('/auth/login', params),

  createWechatChallenge: (params?: WechatChallengeCreateParams) =>
    client.post<ApiEnvelope<WechatChallengeCreateData>>('/auth/wechat/challenges', params ?? {}),

  getWechatChallenge: (challengeId: string, pollToken: string) =>
    client.get<ApiEnvelope<WechatChallengeStatusData>>(`/auth/wechat/challenges/${encodeURIComponent(challengeId)}`, {
      headers: { 'X-Wechat-Poll-Token': pollToken },
    }),

  exchangeWechatChallenge: (challengeId: string, pollToken: string) =>
    client.post<ApiEnvelope<TokenData>>(
      `/auth/wechat/challenges/${encodeURIComponent(challengeId)}/exchange`,
      undefined,
      { headers: { 'X-Wechat-Poll-Token': pollToken } },
    ),

  createWechatReauthChallenge: () =>
    client.post<ApiEnvelope<WechatChallengeCreateData>>('/auth/wechat/reauth-challenges'),

  getWechatReauthChallenge: (challengeId: string, pollToken: string) =>
    client.get<ApiEnvelope<WechatChallengeStatusData>>(
      `/auth/wechat/reauth-challenges/${encodeURIComponent(challengeId)}`,
      { headers: { 'X-Wechat-Poll-Token': pollToken } },
    ),

  exchangeWechatReauthChallenge: (challengeId: string, pollToken: string) =>
    client.post<ApiEnvelope<WechatReauthProofData>>(
      `/auth/wechat/reauth-challenges/${encodeURIComponent(challengeId)}/exchange`,
      undefined,
      { headers: { 'X-Wechat-Poll-Token': pollToken } },
    ),

  register: (params: RegisterParams) =>
    client.post<ApiEnvelope<TokenData>>('/auth/register', params),

  refresh: () => refreshSessionRequest<TokenData>(),

  logout: () =>
    client.post('/auth/logout'),

  sendCode: (email: string) =>
    client.post('/auth/send-code', { email }),

  requestPasswordReset: (email: string) =>
    client.post('/auth/password-reset/code', { email }),

  resetPassword: (params: PasswordResetConfirmParams) =>
    client.post('/auth/password-reset/confirm', params),

  deleteAccount: (params: AccountDeletionParams) =>
    client.delete('/auth/account', { data: params }),

  acceptLegalConsent: () =>
    client.post<ApiEnvelope<TokenData['userInfo']>>('/auth/legal-consent', {
      termsAccepted: true,
      privacyAccepted: true,
    }),

  me: () =>
    client.get<ApiEnvelope<TokenData['userInfo']>>('/auth/me'),
}
