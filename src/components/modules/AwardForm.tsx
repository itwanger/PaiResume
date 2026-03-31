import { useState, useEffect } from 'react'
import type { AwardContent } from '../../types'
import { useAutoSave } from '../../hooks/useAutoSave'
import { normalizeAwardContent } from '../../utils/moduleContent'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
}

export function AwardForm({ resumeId, moduleId, initialContent }: Props) {
  const [content, setContent] = useState<AwardContent>(() => normalizeAwardContent(initialContent))
  const { save } = useAutoSave(resumeId, moduleId)

  useEffect(() => {
    setContent(normalizeAwardContent(initialContent))
  }, [initialContent])

  useEffect(() => {
    save(content as unknown as Record<string, unknown>)
  }, [content, save])

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">奖项名称</label>
        <input type="text" value={content.awardName}
          onChange={(e) => setContent((p) => ({ ...p, awardName: e.target.value }))}
          placeholder="如：全国大学生数学建模竞赛一等奖"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">获奖时间</label>
        <input type="month" value={content.awardTime}
          onChange={(e) => setContent((p) => ({ ...p, awardTime: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
      </div>
    </div>
  )
}
