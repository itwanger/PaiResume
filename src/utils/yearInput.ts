export function normalizeYearInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const match = /^(\d{4})(?:\s*(?:年|[-./])(?:.*)?)?$/.exec(trimmed)
  if (!match) return null

  const year = Number(match[1])
  if (year < 1000 || year > 9999) return null
  return match[1]
}

export function formatYearDisplay(value: string): string {
  if (!value) return ''
  const normalized = normalizeYearInput(value)
  return normalized ?? value
}

export function formatAwardDisplayText(awardName: string, awardTime: string): string {
  const year = formatYearDisplay(awardTime)
  return `${awardName}${year ? `（${year}）` : ''}`
}
