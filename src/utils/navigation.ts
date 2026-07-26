export const EXCELLENT_RESUMES_PATH = '/excellent-resumes'
export const MEMBERSHIP_PATH = '/membership'
export const CREATOR_MARKETPLACE_PATH = '/creator/marketplace'

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

export function buildLoginPath(returnTo?: string): string {
  if (!returnTo) {
    return '/login'
  }

  const searchParams = new URLSearchParams({ redirect: returnTo })
  return `/login?${searchParams.toString()}`
}
