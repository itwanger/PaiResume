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
    return Object.values(value as Record<string, unknown>).some(hasMeaningfulMaterialValue)
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
  for (const value of Object.values(content)) {
    if (typeof value === 'string' && value.trim()) values.push(value.trim())
    if (Array.isArray(value)) {
      value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
        .forEach((item) => values.push(item.trim()))
    }
    if (values.join(' · ').length >= 120) break
  }
  const preview = values.join(' · ')
  return preview.length > 140 ? `${preview.slice(0, 137)}…` : preview
}
