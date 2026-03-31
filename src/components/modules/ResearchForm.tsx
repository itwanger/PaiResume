import { useState, useEffect } from 'react'
import type { ResearchContent } from '../../types'
import { useAutoSave } from '../../hooks/useAutoSave'
import { normalizeResearchContent } from '../../utils/moduleContent'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
}

export function ResearchForm({ resumeId, moduleId, initialContent }: Props) {
  const [content, setContent] = useState<ResearchContent>(() => normalizeResearchContent(initialContent))
  const { save } = useAutoSave(resumeId, moduleId)

  useEffect(() => {
    setContent(normalizeResearchContent(initialContent))
  }, [initialContent])

  useEffect(() => {
    save(content as unknown as Record<string, unknown>)
  }, [content, save])

  const update = (field: keyof ResearchContent, value: string) => {
    setContent((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">项目名称</label>
          <input type="text" value={content.projectName} onChange={(e) => update('projectName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">项目周期</label>
          <input type="text" value={content.projectCycle} onChange={(e) => update('projectCycle', e.target.value)}
            placeholder="如：2024.03 - 2024.12"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">项目背景</label>
        <textarea value={content.background} onChange={(e) => update('background', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm resize-none" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">工作内容</label>
        <textarea value={content.workContent} onChange={(e) => update('workContent', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm resize-none" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">研究成果</label>
        <textarea value={content.achievements} onChange={(e) => update('achievements', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm resize-none" />
      </div>
    </div>
  )
}
