import { useState, useEffect } from 'react'
import type { PaperContent } from '../../types'
import { useAutoSave } from '../../hooks/useAutoSave'
import { normalizePaperContent } from '../../utils/moduleContent'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
}

export function PaperForm({ resumeId, moduleId, initialContent }: Props) {
  const [content, setContent] = useState<PaperContent>(() => normalizePaperContent(initialContent))
  const { save } = useAutoSave(resumeId, moduleId)

  useEffect(() => {
    setContent(normalizePaperContent(initialContent))
  }, [initialContent])

  useEffect(() => {
    save(content as unknown as Record<string, unknown>)
  }, [content, save])

  const update = (field: keyof PaperContent, value: string) => {
    setContent((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">期刊类型</label>
          <select value={content.journalType} onChange={(e) => update('journalType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm">
            <option value="">请选择</option>
            <option value="SCI">SCI</option>
            <option value="EI">EI</option>
            <option value="CCF-A">CCF-A</option>
            <option value="CCF-B">CCF-B</option>
            <option value="CCF-C">CCF-C</option>
            <option value="中文核心">中文核心</option>
            <option value="其他">其他</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">期刊名称</label>
          <input type="text" value={content.journalName} onChange={(e) => update('journalName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">发表时间</label>
          <input type="month" value={content.publishTime} onChange={(e) => update('publishTime', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">论文描述</label>
        <textarea value={content.content} onChange={(e) => update('content', e.target.value)}
          rows={4} placeholder="简述论文主题和贡献"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm resize-none" />
      </div>
    </div>
  )
}
