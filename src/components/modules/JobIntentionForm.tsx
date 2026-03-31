import { useState, useEffect } from 'react'
import type { JobIntentionContent } from '../../types'
import { useAutoSave } from '../../hooks/useAutoSave'
import { normalizeJobIntentionContent } from '../../utils/moduleContent'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
}

export function JobIntentionForm({ resumeId, moduleId, initialContent }: Props) {
  const [content, setContent] = useState<JobIntentionContent>(() => normalizeJobIntentionContent(initialContent))
  const { save } = useAutoSave(resumeId, moduleId)

  useEffect(() => {
    setContent(normalizeJobIntentionContent(initialContent))
  }, [initialContent])

  useEffect(() => {
    save(content as unknown as Record<string, unknown>)
  }, [content, save])

  const update = (field: keyof JobIntentionContent, value: string) => {
    setContent((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">意向岗位</label>
        <input type="text" value={content.targetPosition} onChange={(e) => update('targetPosition', e.target.value)}
          placeholder="如：Java后端开发"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">意向城市</label>
        <input type="text" value={content.targetCity} onChange={(e) => update('targetCity', e.target.value)}
          placeholder="如：北京、上海"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">期望薪资</label>
        <input type="text" value={content.salaryRange} onChange={(e) => update('salaryRange', e.target.value)}
          placeholder="如：15K-25K"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">到岗时间</label>
        <input type="text" value={content.expectedEntryDate} onChange={(e) => update('expectedEntryDate', e.target.value)}
          placeholder="如：随时、2025年7月"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
      </div>
    </div>
  )
}
