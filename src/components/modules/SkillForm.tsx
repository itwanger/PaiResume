import type { SkillContent } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeSkillContent } from '../../utils/moduleContent'
import { AutoResizeTextarea } from '../ui/AutoResizeTextarea'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
}

function toFlatSkillContent(content: SkillContent): SkillContent {
  const items = content.categories.flatMap((category) => category.items).filter(Boolean)
  return {
    categories: [{ name: '', items }],
  }
}

export function SkillForm({ resumeId, moduleId, initialContent }: Props) {
  const [content, setContent] = useModuleContentState<SkillContent>({
    resumeId,
    moduleId,
    initialContent,
    normalize: (content) => toFlatSkillContent(normalizeSkillContent(content)),
  })

  const skillItems = content.categories[0]?.items ?? []

  const addItem = () => {
    setContent((prev) => ({
      categories: [{ name: '', items: [...(prev.categories[0]?.items ?? []), ''] }],
    }))
  }

  const removeItem = (index: number) => {
    setContent((prev) => ({
      categories: [{
        name: '',
        items: (prev.categories[0]?.items ?? []).filter((_, i) => i !== index),
      }],
    }))
  }

  const updateItem = (index: number, value: string) => {
    setContent((prev) => ({
      categories: [{
        name: '',
        items: (prev.categories[0]?.items ?? []).map((item, i) => (i === index ? value : item)),
      }],
    }))
  }

  return (
      <div className="space-y-4">
      {skillItems.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <AutoResizeTextarea
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            minRows={3}
            placeholder={`技能 ${index + 1}`}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm resize-none leading-6"
          />
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="text-gray-300 hover:text-red-500 px-2 text-sm"
          >
            删除
          </button>
        </div>
      ))}
      <button type="button" onClick={addItem}
        className="text-sm text-primary-600 hover:text-primary-700">+ 添加</button>
    </div>
  )
}
