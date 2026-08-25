const STORAGE_KEY = 'pairesume.showcasePurchaseToken'

function createToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export function getShowcasePurchaseToken(): string {
  const existing = localStorage.getItem(STORAGE_KEY)
  if (existing && /^[A-Za-z0-9_-]{32,128}$/.test(existing)) return existing

  const token = createToken()
  localStorage.setItem(STORAGE_KEY, token)
  return token
}

export function createShowcaseIdempotencyKey(): string {
  return crypto.randomUUID().replace(/-/g, '')
}
