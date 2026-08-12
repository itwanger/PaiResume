export function normalizeInlineText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}
