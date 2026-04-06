import type { EducationContent } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeEducationContent } from '../../utils/moduleContent'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
}

export function EducationForm({ resumeId, moduleId, initialContent }: Props) {
  const [content, setContent] = useModuleContentState<EducationContent>({
    resumeId,
    moduleId,
    initialContent,
    normalize: normalizeEducationContent,
  })

  const update = (field: keyof EducationContent, value: string | boolean) => {
    setContent((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">学校</label>
          <input type="text" value={content.school} onChange={(e) => update('school', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">院系</label>
          <input type="text" value={content.department} onChange={(e) => update('department', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">专业</label>
          <input type="text" value={content.major} onChange={(e) => update('major', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">学位</label>
          <select value={content.degree} onChange={(e) => update('degree', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm">
            <option value="">请选择</option>
            <option value="博士">博士</option>
            <option value="硕士">硕士</option>
            <option value="本科">本科</option>
            <option value="大专">大专</option>
          </select>
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
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={content.is985} onChange={(e) => update('is985', e.target.checked)}
            className="rounded border-gray-300" /> 985
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={content.is211} onChange={(e) => update('is211', e.target.checked)}
            className="rounded border-gray-300" /> 211
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={content.isDoubleFirst} onChange={(e) => update('isDoubleFirst', e.target.checked)}
            className="rounded border-gray-300" /> 双一流
        </label>
      </div>
    </div>
  )
}
