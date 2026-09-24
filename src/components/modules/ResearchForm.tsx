import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fieldOptimizeInputId } from '../../hooks/useFieldOptimizeReturn'
import { researchOptimizeFields } from '../../utils/researchOptimizeFields'
import type { ResearchContent } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeResearchContent } from '../../utils/moduleContent'
import { ExperienceFormHeader, type ExperienceItemControls } from './ExperienceFormHeader'
import { AiOptimizeTextarea } from '../ui/AiOptimizeTextarea'
import { OptionalInfoSection } from '../ui/OptionalInfoSection'
import { ResponsibilityAddButton } from '../ui/ResponsibilityAddButton'
import { TextItemSorter } from '../ui/TextItemSorter'
import { LABEL, INPUT, TEXTAREA } from '../ui/experienceFormStyles'

interface Props extends ExperienceItemControls {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
}

export function ResearchForm({ resumeId, moduleId, initialContent, itemIndex, collapsed, onToggleCollapsed, onDelete }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [showOptionalFields, setShowOptionalFields] = useState(() => {
    const target = location.state?.fieldOptimizeReturn
    return target?.moduleId === moduleId && ['research_background', 'research_work_content'].includes(target.fieldType)
  })
  const [optimizingField, setOptimizingField] = useState<string | null>(null)
  const [optimizeError, setOptimizeError] = useState('')
  const [errorField, setErrorField] = useState<string | null>(null)
  const [pendingWorkItemFocus, setPendingWorkItemFocus] = useState<number | null>(null)
  const [workItemSorting, setWorkItemSorting] = useState(false)
  const [content, setContent, { saveNow, saveState, errorMessage, hasUnsavedChanges }] = useModuleContentState<ResearchContent>({
    resumeId,
    moduleId,
    initialContent,
    normalize: normalizeResearchContent,
  })

  const update = (field: Exclude<keyof ResearchContent, 'workContent'>, value: string) => {
    setContent((prev) => ({ ...prev, [field]: value }))
  }

  const addWorkItem = () => {
    setPendingWorkItemFocus(content.workContent.length)
    setContent((prev) => ({ ...prev, workContent: [...prev.workContent, ''] }))
  }

  const updateWorkItem = (index: number, value: string) => {
    setContent((prev) => ({ ...prev, workContent: prev.workContent.map((item, itemIndex) => itemIndex === index ? value : item) }))
  }

  const removeWorkItem = (index: number) => {
    setContent((prev) => ({ ...prev, workContent: prev.workContent.filter((_, itemIndex) => itemIndex !== index) }))
  }

  const reorderWorkItem = (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return
    setContent((prev) => {
      const workContent = [...prev.workContent]
      const [moved] = workContent.splice(sourceIndex, 1)
      workContent.splice(targetIndex, 0, moved)
      return { ...prev, workContent }
    })
  }

  const openOptimize = async (fieldType: keyof typeof researchOptimizeFields, index?: number) => {
    const fieldKey = typeof index === 'number' ? `${fieldType}-${index}` : fieldType
    setOptimizingField(fieldKey)
    setOptimizeError('')
    setErrorField(null)
    try {
      await saveNow()
      const params = new URLSearchParams({ fieldType, returnModuleType: 'research' })
      if (typeof index === 'number') params.set('index', String(index))
      navigate(`/editor/${resumeId}/modules/${moduleId}/field-optimize?${params}`)
    } catch (error: unknown) {
      setErrorField(fieldKey)
      setOptimizeError(error instanceof Error ? error.message : '进入 AI 优化页失败，请稍后重试')
    } finally {
      setOptimizingField(null)
    }
  }

  const renderField = (fieldType: 'research_background' | 'research_achievements') => {
    const { key, title } = researchOptimizeFields[fieldType]
        return (
          <div key={fieldType}>
            <label className={LABEL} htmlFor={fieldOptimizeInputId(moduleId, 0, fieldType)}>{title}</label>
            <AiOptimizeTextarea id={fieldOptimizeInputId(moduleId, 0, fieldType)} aria-label={title}
              value={content[key]} onChange={(event) => update(key, event.target.value)}
              onOptimize={() => void openOptimize(fieldType)} optimizing={optimizingField === fieldType}
              optimizeDisabled={optimizingField !== null || !content[key].trim()} className={TEXTAREA} />
            {errorField === fieldType && optimizeError && <p className="mt-2 text-xs text-red-600" role="alert">{optimizeError}</p>}
          </div>
        )
  }

  return (
    <div className="space-y-4">
      <ExperienceFormHeader title={content.projectName.trim() || `第 ${itemIndex + 1} 条科研经历`}
        collapsed={collapsed} controlsId={`research-fields-${moduleId}`} onToggle={onToggleCollapsed} onDelete={onDelete}
        save={{ saveState, errorMessage, hasUnsavedChanges, onSave: saveNow }} />
      <div id={`research-fields-${moduleId}`} hidden={collapsed} className="space-y-4">

      <div className="editor-responsive-grid">
        <div>
          <label className={LABEL}>科研名称</label>
          <input type="text" value={content.projectName} onChange={(e) => update('projectName', e.target.value)}
            className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>科研周期</label>
          <input type="text" value={content.projectCycle} onChange={(e) => update('projectCycle', e.target.value)}
            placeholder="如：2024.03 - 2024.12"
            className={INPUT} />
        </div>
      </div>
      {renderField('research_achievements')}
      <OptionalInfoSection id={`research-optional-${moduleId}`} open={showOptionalFields}
        onToggle={() => setShowOptionalFields((current) => !current)}
        filledCount={Number(Boolean(content.background.trim())) + Number(content.workContent.some((item) => item.trim()))}>
        <div className="space-y-4 px-4 pb-5 pt-3">
          {renderField('research_background')}
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <label className={LABEL}>科研内容</label>
                {content.workContent.length > 0 && (
                  <span className="inline-flex h-5 items-center rounded-full bg-gray-100 px-2 text-[11px] font-semibold text-gray-400">{content.workContent.length}</span>
                )}
              </div>
              {content.workContent.length > 1 && (
                <button type="button" onClick={() => setWorkItemSorting((current) => !current)}
                  className="rounded border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all duration-150">
                  {workItemSorting ? '完成排序' : '调整顺序'}
                </button>
              )}
            </div>
            {workItemSorting ? (
              <TextItemSorter items={content.workContent} itemLabel="科研内容" ariaLabel="科研内容排序" onReorder={reorderWorkItem} />
            ) : content.workContent.length === 0 ? (
              <ResponsibilityAddButton empty onClick={addWorkItem} emptyLabel="添加第一条科研内容" emptyHint={null} />
            ) : (
              <div className="space-y-1">
                {content.workContent.map((item, index) => (
                  <div key={index} className="group relative">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-5 shrink-0 items-start justify-center pt-2">
                        <span className="text-[11px] font-bold text-gray-200 group-hover:text-gray-300 transition-colors duration-150">{String(index + 1).padStart(2, '0')}</span>
                      </div>
                      <div className="min-w-0 flex-1 relative">
                        <AiOptimizeTextarea
                          onOptimize={() => void openOptimize('research_work_content', index)}
                          optimizing={optimizingField === `research_work_content-${index}`}
                          optimizeDisabled={optimizingField !== null || !item.trim()}
                          onDelete={() => removeWorkItem(index)}
                          deleteLabel={`删除科研内容 ${index + 1}`}
                          id={fieldOptimizeInputId(moduleId, 0, 'research_work_content', index)}
                          value={item}
                          onChange={(event) => updateWorkItem(index, event.target.value)}
                          aria-label={`科研内容 ${index + 1}`}
                          autoFocus={pendingWorkItemFocus === index}
                          onFocus={(event) => {
                            if (pendingWorkItemFocus === index) {
                              event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              setPendingWorkItemFocus(null)
                            }
                          }}
                          onKeyDown={(event) => {
                            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && index === content.workContent.length - 1) {
                              event.preventDefault()
                              addWorkItem()
                            }
                          }}
                          className={TEXTAREA}
                        />
                        {errorField === `research_work_content-${index}` && optimizeError && <p className="mt-2 text-xs text-red-600" role="alert">{optimizeError}</p>}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="pl-8 pt-3">
                  <ResponsibilityAddButton onClick={addWorkItem} continueLabel="继续添加科研内容" />
                </div>
              </div>
            )}
          </div>
        </div>
      </OptionalInfoSection>
      </div>
    </div>
  )
}
