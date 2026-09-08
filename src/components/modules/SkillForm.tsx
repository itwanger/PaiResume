import { fieldOptimizeInputId } from '../../hooks/useFieldOptimizeReturn'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SkillContent } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeSkillContent } from '../../utils/moduleContent'
import { AiOptimizeTextarea } from '../ui/AiOptimizeTextarea'
import { ModuleSaveBar } from './ModuleSaveBar'
import { MaterialActions } from '../materials/MaterialActions'
import { RepeatableListHeader } from '../ui/RepeatableListControls'
import { ResponsibilityAddButton } from '../ui/ResponsibilityAddButton'
import { TextItemSorter } from '../ui/TextItemSorter'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
}

function toFlatSkillContent(content: SkillContent): SkillContent {
  const items = content.categories.flatMap((category) => category.items)
  return {
    categories: [{ name: '', items }],
  }
}

function normalizeFlatSkillContent(content: Record<string, unknown>): SkillContent {
  return toFlatSkillContent(normalizeSkillContent(content))
}

export function SkillForm({ resumeId, moduleId, initialContent }: Props) {
  const navigate = useNavigate()
  const [content, setContent, { saveNow, saveState, errorMessage, hasUnsavedChanges }] = useModuleContentState<SkillContent>({
    resumeId,
    moduleId,
    initialContent,
    normalize: normalizeFlatSkillContent,
  })
  const [sorting, setSorting] = useState(false)
  const [pendingSkillFocus, setPendingSkillFocus] = useState<number | null>(null)
  const [optimizingSkillIndex, setOptimizingSkillIndex] = useState<number | null>(null)
  const [optimizeError, setOptimizeError] = useState('')

  const skillItems = content.categories[0]?.items ?? []

  const addItem = () => {
    setPendingSkillFocus(skillItems.length)
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

  const reorderItem = (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return
    setContent((previous) => {
      const items = [...(previous.categories[0]?.items ?? [])]
      const [moved] = items.splice(sourceIndex, 1)
      items.splice(targetIndex, 0, moved)
      return { categories: [{ name: '', items }] }
    })
  }

  const openOptimizePage = async (index: number) => {
    setOptimizingSkillIndex(index)
    setOptimizeError('')
    try {
      await saveNow()
      const searchParams = new URLSearchParams({
        fieldType: 'skill',
        returnModuleType: 'skill',
        index: String(index),
      })
      navigate(`/editor/${resumeId}/modules/${moduleId}/field-optimize?${searchParams.toString()}`)
    } catch (error: unknown) {
      setOptimizeError(error instanceof Error ? error.message : '进入 AI 优化页失败，请稍后重试')
    } finally {
      setOptimizingSkillIndex(null)
    }
  }

  return (
    <div className="space-y-4">
      <ModuleSaveBar
        saveState={saveState}
        errorMessage={errorMessage}
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={saveNow}
      >
        <MaterialActions
          resumeId={resumeId}
          moduleType="skill"
          content={content}
          onApply={(next) => setContent(toFlatSkillContent(next))}
          embedded
        />
      </ModuleSaveBar>

      {optimizeError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {optimizeError}
        </div>
      ) : null}

      <div>
        <RepeatableListHeader
          label="专业技能"
          itemCount={skillItems.length}
          sorting={sorting}
          showAdd={false}
          addLabel="添加技能"
          sortLabel="调整技能顺序"
          onAdd={addItem}
          onToggleSorting={() => setSorting((current) => !current)}
        />

        {sorting ? (
          <TextItemSorter
            items={skillItems}
            itemLabel="技能"
            ariaLabel="专业技能排序"
            onReorder={reorderItem}
          />
        ) : (
          skillItems.map((item, index) => (
            <div key={index} className={index === 0 ? '' : 'mt-3'}>
              <AiOptimizeTextarea
                onOptimize={() => void openOptimizePage(index)}
                optimizing={optimizingSkillIndex === index}
                optimizeDisabled={optimizingSkillIndex !== null || !item.trim()}
                onDelete={() => removeItem(index)}
                deleteLabel={`删除技能 ${index + 1}`}
                id={fieldOptimizeInputId(moduleId, 0, 'skill', index)}
                value={item}
                onChange={(event) => updateItem(index, event.target.value)}
                placeholder={`技能 ${index + 1}`}
                aria-label={`专业技能 ${index + 1}`}
                autoFocus={pendingSkillFocus === index}
                onFocus={(event) => {
                  if (pendingSkillFocus === index) {
                    event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    setPendingSkillFocus(null)
                  }
                }}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && index === skillItems.length - 1) {
                    event.preventDefault()
                    addItem()
                  }
                }}
                className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              />
            </div>
          ))
        )}

        {!sorting && (
          <div className={skillItems.length > 0 ? 'pt-3' : ''}>
            <ResponsibilityAddButton icon="skill" empty={skillItems.length === 0} onClick={addItem}
              emptyLabel="添加第一条专业技能" continueLabel="继续添加技能" emptyHint={null} />
          </div>
        )}
      </div>
    </div>
  )
}
