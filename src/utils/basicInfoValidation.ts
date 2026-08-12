export type BasicInfoValidationKind = 'email' | 'phone' | 'url'

export function getBasicInfoFieldError(kind: BasicInfoValidationKind, rawValue: string): string {
  const value = rawValue.trim()
  if (!value) return ''

  if (kind === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' : '邮箱格式不正确，例如 name@example.com'
  }

  if (kind === 'phone') {
    const digits = value.replace(/[\s()-]/g, '').replace(/^\+/, '')
    return /^\d{7,15}$/.test(digits) ? '' : '手机号格式不正确，请输入 7–15 位有效号码'
  }

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? '' : '请输入以 http:// 或 https:// 开头的网址'
  } catch {
    return '网址格式不正确，例如 https://github.com/username'
  }
}

export function getBasicInfoProfileError(content: Record<string, unknown>): string {
  const checks: Array<[string, BasicInfoValidationKind]> = [
    ['email', 'email'],
    ['phone', 'phone'],
    ['github', 'url'],
    ['blog', 'url'],
  ]
  for (const [field, kind] of checks) {
    const value = content[field]
    if (typeof value !== 'string') continue
    const error = getBasicInfoFieldError(kind, value)
    if (error) return error
  }
  return ''
}
