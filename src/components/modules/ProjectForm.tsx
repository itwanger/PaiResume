import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProjectContent } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeProjectContent } from '../../utils/moduleContent'
import { AutoResizeTextarea } from '../ui/AutoResizeTextarea'
import { ModuleSaveBar } from './ModuleSaveBar'
import { MaterialActions } from '../materials/MaterialActions'
import { MonthInput } from '../ui/MonthInput'
import { ContinueAddButton, RepeatableListHeader } from '../ui/RepeatableListControls'
import { CollapsibleItemHeader } from '../ui/CollapsibleItemHeader'
import { TextItemSorter } from '../ui/TextItemSorter'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
  itemIndex: number
  collapsed: boolean
  onToggleCollapsed: () => void
  onDelete: () => void
}

export function ProjectForm({ resumeId, moduleId, initialContent, itemIndex, collapsed, onToggleCollapsed, onDelete }: Props) {
  const navigate = useNavigate()
  const [content, setContent, { saveNow, saveState, errorMessage, hasUnsavedChanges }] = useModuleContentState<ProjectContent>({
    resumeId,
    moduleId,
    initialContent,
    normalize: normalizeProjectContent,
  })
  const [optimizingField, setOptimizingField] = useState<string | null>(null)
  const [optimizeError, setOptimizeError] = useState('')
  const [optimizeErrorField, setOptimizeErrorField] = useState<string | null>(null)
  const [pendingResponsibilityFocus, setPendingResponsibilityFocus] = useState<number | null>(null)
  const [responsibilitySorting, setResponsibilitySorting] = useState(false)

  const update = (field: keyof ProjectContent, value: string | string[]) => {
    setContent((prev) => ({ ...prev, [field]: value }))
  }

  const addResponsibility = () => {
    setPendingResponsibilityFocus(content.achievements.length)
    update('achievements', [...content.achievements, ''])
  }

  const updateResponsibility = (index: number, value: string) => {
    const next = [...content.achievements]
    next[index] = value
    update('achievements', next)
  }

  const removeResponsibility = (index: number) => {
    update('achievements', content.achievements.filter((_, idx) => idx !== index))
  }

  const reorderResponsibility = (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return
    const responsibilities = [...content.achievements]
    const [moved] = responsibilities.splice(sourceIndex, 1)
    responsibilities.splice(targetIndex, 0, moved)
    update('achievements', responsibilities)
  }

  const openOptimizePage = async (field: 'description' | 'achievement', index?: number) => {
    const fieldKey = field === 'description' ? 'description' : `achievement-${index}`
    setOptimizingField(fieldKey)
    setOptimizeError('')
    setOptimizeErrorField(null)

    try {
      await saveNow()
      const searchParams = new URLSearchParams()
      searchParams.set('fieldType', field === 'description' ? 'project_description' : 'responsibility')
      searchParams.set('returnModuleType', 'project')
      if (typeof index === 'number') {
        searchParams.set('index', String(index))
      }
      navigate(`/editor/${resumeId}/modules/${moduleId}/field-optimize?${searchParams.toString()}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '进入 AI 优化页失败，请稍后重试'
      setOptimizeError(message)
      setOptimizeErrorField(fieldKey)
    } finally {
      setOptimizingField(null)
    }
  }

  return (
    <>
      <CollapsibleItemHeader
        title={content.projectName.trim() || `第 ${itemIndex + 1} 条项目经历`}
        collapsed={collapsed}
        controlsId={`project-fields-${moduleId}`}
        onToggle={onToggleCollapsed}
      >
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onDelete} className="shrink-0 text-xs text-gray-400 hover:text-red-500">
          删除
        </button>
      </CollapsibleItemHeader>
      {/* Keep drafts and in-flight autosaves mounted while the fields are collapsed. */}
      <div id={`project-fields-${moduleId}`} hidden={collapsed} className="space-y-4">
        <ModuleSaveBar
          saveState={saveState}
          errorMessage={errorMessage}
          hasUnsavedChanges={hasUnsavedChanges}
          onSave={saveNow}
        >
          <MaterialActions
            resumeId={resumeId}
            moduleType="project"
            content={content}
            onApply={setContent}
            embedded
          />
        </ModuleSaveBar>

        {optimizeError && optimizeErrorField === null && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {optimizeError}
          </div>
        )}

        <div className="editor-responsive-grid">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">项目名称</label>
            <input
              type="text"
              value={content.projectName}
              onChange={(e) => update('projectName', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">担任角色</label>
            <input
              type="text"
              value={content.role}
              onChange={(e) => update('role', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">开始时间</label>
            <MonthInput
              value={content.startDate}
              onChange={(value) => update('startDate', value)}
              ariaLabel="项目开始时间"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">结束时间</label>
            <MonthInput
              value={content.endDate}
              onChange={(value) => update('endDate', value)}
              ariaLabel="项目结束时间"
              allowPresent
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">技术栈</label>
          <AutoResizeTextarea
            value={content.techStack}
            onChange={(e) => update('techStack', e.target.value)}
            minRows={2}
            placeholder="React, TypeScript, Node.js..."
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <label className="block text-sm font-medium text-gray-700">项目描述</label>
            <button
              type="button"
              onClick={() => void openOptimizePage('description')}
              disabled={optimizingField !== null || !content.description.trim()}
              className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {optimizingField === 'description' ? '跳转中...' : 'AI 优化'}
            </button>
          </div>
          <AutoResizeTextarea
            value={content.description}
            onChange={(e) => update('description', e.target.value)}
            minRows={4}
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
          />
          {optimizeError && optimizeErrorField === 'description' && (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {optimizeError}
            </div>
          )}
        </div>

        <div>
          <RepeatableListHeader
            label="核心职责"
            itemCount={content.achievements.length}
            sorting={responsibilitySorting}
            addLabel="添加职责"
            sortLabel="调整职责顺序"
            onAdd={addResponsibility}
            onToggleSorting={() => setResponsibilitySorting((current) => !current)}
          />
          {responsibilitySorting ? (
            <TextItemSorter
              items={content.achievements}
              itemLabel="职责"
              ariaLabel="核心职责排序"
              onReorder={reorderResponsibility}
            />
          ) : content.achievements.map((item, index) => (
            <div key={index} className={index === 0 ? '' : 'mt-3'}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <div />
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => void openOptimizePage('achievement', index)}
                    disabled={optimizingField !== null || !item.trim()}
                    className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {optimizingField === `achievement-${index}` ? '跳转中...' : `AI 优化职责 ${index + 1}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeResponsibility(index)}
                    className="text-xs text-gray-300 hover:text-red-500"
                  >
                    删除
                  </button>
                </div>
              </div>
              <AutoResizeTextarea
                value={item}
                onChange={(e) => updateResponsibility(index, e.target.value)}
                minRows={4}
                placeholder={`职责 ${index + 1}`}
                aria-label={`核心职责 ${index + 1}`}
                autoFocus={pendingResponsibilityFocus === index}
                onFocus={(event) => {
                  if (pendingResponsibilityFocus === index) {
                    event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    setPendingResponsibilityFocus(null)
                  }
                }}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && index === content.achievements.length - 1) {
                    event.preventDefault()
                    addResponsibility()
                  }
                }}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              />
              {optimizeError && optimizeErrorField === `achievement-${index}` && (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {optimizeError}
                </div>
              )}
            </div>
          ))}
          {!responsibilitySorting && content.achievements.length > 0 ? (
            <ContinueAddButton label="职责" onClick={addResponsibility} />
          ) : null}
        </div>
      </div>
    </>
  )
}
