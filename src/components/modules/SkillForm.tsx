import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SkillContent } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeSkillContent } from '../../utils/moduleContent'
import { AutoResizeTextarea } from '../ui/AutoResizeTextarea'
import { ModuleSaveBar } from './ModuleSaveBar'
import { MaterialActions } from '../materials/MaterialActions'
import { ContinueAddButton, RepeatableListHeader } from '../ui/RepeatableListControls'
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
              <div className="mb-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => void openOptimizePage(index)}
                  disabled={optimizingSkillIndex !== null || !item.trim()}
                  className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {optimizingSkillIndex === index ? '跳转中...' : 'AI 优化'}
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-xs text-slate-400 hover:text-red-600"
                >
                  删除
                </button>
              </div>
              <AutoResizeTextarea
                value={item}
                onChange={(event) => updateItem(index, event.target.value)}
                minRows={3}
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

        {!sorting && skillItems.length > 0 ? <ContinueAddButton label="技能" onClick={addItem} /> : null}
      </div>
    </div>
  )
}
