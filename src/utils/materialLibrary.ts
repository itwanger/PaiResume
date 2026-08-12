const UNUSED_BASIC_INFO_FIELDS = new Set(['salaryRange', 'expectedEntryDate', 'summary'])

export function omitUnusedBasicInfoFields(content: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(content).filter(([key]) => !UNUSED_BASIC_INFO_FIELDS.has(key)),
  )
}

export function hasMeaningfulMaterialValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return true
  if (Array.isArray(value)) return value.some(hasMeaningfulMaterialValue)
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'id')
      .some(([, childValue]) => hasMeaningfulMaterialValue(childValue))
  }
  return false
}

export function applyMaterialFields<T extends object>(current: T, source: Record<string, unknown>): T {
  return {
    ...current,
    ...structuredClone(source),
  } as T
}

export function getMaterialPreview(content: Record<string, unknown>): string {
  const values: string[] = []
  const append = (value: unknown, key = '') => {
    if (key === 'id') return
    if (typeof value === 'string' && value.trim()) values.push(value.trim())
    if (Array.isArray(value)) {
      value.forEach((item) => append(item))
    }
    if (value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => append(childValue, childKey))
    }
  }
  for (const [key, value] of Object.entries(content)) {
    append(value, key)
    if (values.join(' · ').length >= 120) break
  }
  const preview = values.join(' · ')
  return preview.length > 140 ? `${preview.slice(0, 137)}…` : preview
}
