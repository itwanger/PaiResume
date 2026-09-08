export type CandidateTag = 'concise' | 'technical' | 'quantified'
export const candidateFilters: { id: CandidateTag | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'concise', label: '简洁优先' },
  { id: 'technical', label: '技术深度' },
  { id: 'quantified', label: '数据量化' },
]
export const candidateTagLabels: Record<CandidateTag, string> = {
  concise: '简洁', technical: '技术深度', quantified: '数据量化',
}

/** Only validate server-returned labels; never infer labels from resume text. */
export function readCandidateTags(value: unknown, count: number): CandidateTag[][] {
  const allowed = new Set(['concise', 'technical', 'quantified'])
  return Array.from({ length: count }, (_, index) => {
    const tags = Array.isArray(value) ? value[index] : null
    return Array.isArray(tags) ? [...new Set(tags.filter((tag): tag is CandidateTag => typeof tag === 'string' && allowed.has(tag)))] : []
  })
}
