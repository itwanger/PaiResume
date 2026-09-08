export const researchOptimizeFields = {
  research_background: { key: 'background', title: '科研背景', optional: true },
  research_work_content: { key: 'workContent', title: '科研内容', optional: true },
  research_achievements: { key: 'achievements', title: '研究成果', optional: false },
} as const

export function isResearchOptimizeField(fieldType: string): fieldType is keyof typeof researchOptimizeFields {
  return Object.prototype.hasOwnProperty.call(researchOptimizeFields, fieldType)
}
