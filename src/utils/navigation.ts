export const EXCELLENT_RESUMES_PATH = '/excellent-resumes'
export const MEMBERSHIP_PATH = '/membership'
export const CREATOR_MARKETPLACE_PATH = '/creator/marketplace'
const FRONTEND_MODE = import.meta.env?.MODE ?? 'production'

export const IS_LOCAL_DEVELOPMENT = FRONTEND_MODE === 'development'

export function getSafeInternalPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback
  }

  return value
}

export function buildShowcasePath(slug: string): string {
  return `/showcases/${encodeURIComponent(slug)}`
}

export function buildMarketplaceListingPath(slug: string): string {
  return `/marketplace/resumes/${encodeURIComponent(slug)}`
}

export function buildMembershipPath(returnTo?: string): string {
  if (!returnTo) {
    return MEMBERSHIP_PATH
  }

  const searchParams = new URLSearchParams({ redirect: returnTo })
  return `${MEMBERSHIP_PATH}?${searchParams.toString()}`
}

export function buildLoginPathForMode(mode: string, returnTo?: string): string {
  const searchParams = new URLSearchParams()

  if (mode === 'development') {
    searchParams.set('method', 'email')
  }
  if (returnTo) {
    searchParams.set('redirect', returnTo)
  }

  const search = searchParams.toString()
  return search ? `/login?${search}` : '/login'
}

export function buildLoginPath(returnTo?: string): string {
  return buildLoginPathForMode(FRONTEND_MODE, returnTo)
}

export function getLoginEntryLabel(mode = FRONTEND_MODE): string {
  return mode === 'development' ? '本地邮箱登录' : '扫码登录'
}

export function resolveLoginMethod(
  requestedMethod: string | null | undefined,
  mode = FRONTEND_MODE,
): 'email' | 'wechat' {
  if (requestedMethod === 'email' || requestedMethod === 'wechat') {
    return requestedMethod
  }

  return mode === 'development' ? 'email' : 'wechat'
}
