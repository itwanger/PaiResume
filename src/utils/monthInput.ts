const PRESENT_VALUES = new Set(['至今', '现在', '当前', 'present', 'current'])

export function normalizeMonthInput(value: string, allowPresent = false): string | null {
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (allowPresent && PRESENT_VALUES.has(trimmed.toLocaleLowerCase())) {
    return '至今'
  }

  const separated = /^(\d{4})\s*(?:[-./]|年)\s*(\d{1,2})\s*月?$/.exec(trimmed)
  const compact = /^(\d{4})(\d{2})$/.exec(trimmed)
  const match = separated ?? compact
  if (!match) return null

  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return `${match[1]}-${String(month).padStart(2, '0')}`
}

export function formatMonthInput(value: string): string {
  if (!value) return ''
  if (value === '至今') return value

  const normalized = normalizeMonthInput(value)
  if (!normalized) return value

  const [year, month] = normalized.split('-')
  return `${year}年${Number(month)}月`
}
