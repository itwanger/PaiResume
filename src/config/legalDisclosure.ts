function normalize(value: string | undefined): string {
  return (value || '').trim()
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}

const configuredSupportEmail = normalize(import.meta.env.VITE_SUPPORT_EMAIL)
const configuredOperatorName = normalize(import.meta.env.VITE_OPERATOR_NAME)
const configuredAiProviderName = normalize(import.meta.env.VITE_AI_PROVIDER_NAME)
const configuredAiProviderPrivacyUrl = normalize(import.meta.env.VITE_AI_PROVIDER_PRIVACY_URL)

export const SUPPORT_EMAIL = isValidEmail(configuredSupportEmail) ? configuredSupportEmail : ''
export const OPERATOR_NAME = configuredOperatorName
export const AI_PROVIDER_NAME = configuredAiProviderName
export const AI_PROVIDER_PRIVACY_URL = isValidHttpsUrl(configuredAiProviderPrivacyUrl)
  ? configuredAiProviderPrivacyUrl
  : ''

export const LEGAL_DISCLOSURE_READY = Boolean(
  SUPPORT_EMAIL
  && OPERATOR_NAME
  && AI_PROVIDER_NAME
  && AI_PROVIDER_PRIVACY_URL,
)
