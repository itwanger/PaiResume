import type { ProjectContent } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeProjectContent } from '../../utils/moduleContent'
import { AutoResizeTextarea } from '../ui/AutoResizeTextarea'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
}

export function ProjectForm({ resumeId, moduleId, initialContent }: Props) {
  const [content, setContent] = useModuleContentState<ProjectContent>({
    resumeId,
    moduleId,
    initialContent,
    normalize: normalizeProjectContent,
  })

  const update = (field: keyof ProjectContent, value: string | string[]) => {
    setContent((prev) => ({ ...prev, [field]: value }))
  }

  const addResponsibility = () => update('achievements', [...content.achievements, ''])
  const updateResponsibility = (i: number, v: string) => {
    const next = [...content.achievements]
    next[i] = v
    update('achievements', next)
  }
  const removeResponsibility = (i: number) => {
    update('achievements', content.achievements.filter((_, idx) => idx !== i))
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
          <label className="block text-sm font-medium text-gray-700 mb-1">担任角色</label>
          <input type="text" value={content.role} onChange={(e) => update('role', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
          <input type="month" value={content.startDate} onChange={(e) => update('startDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
          <input type="month" value={content.endDate} onChange={(e) => update('endDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">技术栈</label>
        <AutoResizeTextarea
          value={content.techStack}
          onChange={(e) => update('techStack', e.target.value)}
          minRows={2}
          placeholder="React, TypeScript, Node.js..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm resize-none leading-6"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">项目描述</label>
        <AutoResizeTextarea
          value={content.description}
          onChange={(e) => update('description', e.target.value)}
          minRows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm resize-none leading-6"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">核心职责</label>
          <button type="button" onClick={addResponsibility}
            className="text-sm text-primary-600 hover:text-primary-700">+ 添加</button>
        </div>
        {content.achievements.map((item, index) => (
          <div key={index} className="flex gap-2 mb-2 items-start">
            <AutoResizeTextarea
              value={item}
              onChange={(e) => updateResponsibility(index, e.target.value)}
              minRows={4}
              placeholder={`职责 ${index + 1}`}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm resize-none leading-6"
            />
            <button type="button" onClick={() => removeResponsibility(index)}
              className="text-gray-300 hover:text-red-500 px-2">x</button>
          </div>
        ))}
      </div>
    </div>
  )
}
