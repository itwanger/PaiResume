import { AiOptimizeTextarea } from '../ui/AiOptimizeTextarea'
import { fieldOptimizeInputId } from '../../hooks/useFieldOptimizeReturn'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProjectContent } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeProjectContent } from '../../utils/moduleContent'
import { AutoResizeTextarea } from '../ui/AutoResizeTextarea'
import { ModuleSaveBar } from './ModuleSaveBar'
import { MonthInput } from '../ui/MonthInput'
import { TextItemSorter } from '../ui/TextItemSorter'
import { CollapsibleItemHeader } from '../ui/CollapsibleItemHeader'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
  itemIndex: number
  collapsed: boolean
  onToggleCollapsed: () => void
  onDelete: () => void
}

import { LABEL, INPUT, TEXTAREA } from '../ui/experienceFormStyles'
import { ResponsibilityAddButton } from '../ui/ResponsibilityAddButton'

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
        outlinedActions
        titleAfter={(
          <ModuleSaveBar
            compact
            saveState={saveState}
            errorMessage={errorMessage}
            hasUnsavedChanges={hasUnsavedChanges}
            onSave={saveNow}
          />
        )}
      >
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onDelete}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          删除
        </button>
      </CollapsibleItemHeader>

      <div id={`project-fields-${moduleId}`} hidden={collapsed} className="pt-1">

        {optimizeError && optimizeErrorField === null && (
          <div className="mb-6 rounded border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
            {optimizeError}
          </div>
        )}

        {/* ═══════════════ 基本信息 ═══════════════ */}
        <div className="mb-8">
          <div className="mb-5">
            <label className={LABEL}>项目名称</label>
            <input
              type="text"
              value={content.projectName}
              onChange={(e) => update('projectName', e.target.value)}
              className={`${INPUT} font-medium`}
            />
          </div>

          <div className="editor-responsive-grid">
            <div>
              <label className={LABEL}>担任角色</label>
              <input
                type="text"
                value={content.role}
                onChange={(e) => update('role', e.target.value)}
                className={INPUT}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>开始时间</label>
                <MonthInput
                  value={content.startDate}
                  onChange={(value) => update('startDate', value)}
                  ariaLabel="项目开始时间"
                />
              </div>
              <div>
                <label className={LABEL}>结束时间</label>
                <MonthInput
                  value={content.endDate}
                  onChange={(value) => update('endDate', value)}
                  ariaLabel="项目结束时间"
                  allowPresent
                />
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════ 技术栈 ═══════════════ */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <label className={LABEL}>技术栈</label>
            <span className="text-[11px] text-gray-300">逗号或换行分隔</span>
          </div>
          <AutoResizeTextarea
            value={content.techStack}
            onChange={(e) => update('techStack', e.target.value)}
            placeholder="React, TypeScript, Node.js, PostgreSQL, Docker…"
            className={TEXTAREA}
          />
        </div>

        {/* ═══════════════ 项目描述 ═══════════════ */}
        <div className="mb-8">
          <label className={LABEL}>项目描述</label>
          <AiOptimizeTextarea
            onOptimize={() => void openOptimizePage('description')}
            optimizing={optimizingField === 'description'}
            optimizeDisabled={optimizingField !== null || !content.description.trim()}
            aria-label="项目描述"
            id={fieldOptimizeInputId(moduleId, 0, 'project_description')}
            value={content.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="简要描述项目背景、目标以及你在其中的定位…"
            className={TEXTAREA}
          />
          {optimizeError && optimizeErrorField === 'description' && (
            <div className="mt-2 rounded border border-red-200 bg-red-50/80 px-3 py-2 text-xs text-red-700">
              {optimizeError}
            </div>
          )}
        </div>
        {/* ═══════════════ 核心职责 ═══════════════ */}
        <div>
          {/* 列表头部 */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <label className={LABEL}>核心职责</label>
              {content.achievements.length > 0 && (
                <span className="inline-flex h-5 items-center rounded-full bg-gray-100 px-2 text-[11px] font-semibold text-gray-400">
                  {content.achievements.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {content.achievements.length > 1 && (
                <button
                  type="button"
                  onClick={() => setResponsibilitySorting((current) => !current)}
                  className="rounded border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all duration-150"
                >
                  {responsibilitySorting ? '完成排序' : '调整顺序'}
                </button>
              )}

            </div>
          </div>

          {responsibilitySorting ? (
            <TextItemSorter
              items={content.achievements}
              itemLabel="职责"
              ariaLabel="核心职责排序"
              onReorder={reorderResponsibility}
            />
          ) : content.achievements.length === 0 ? (
            <ResponsibilityAddButton empty onClick={addResponsibility} />
          ) : (
            <div className="space-y-1">
              {content.achievements.map((item, index) => (
                <div key={index} className="group relative">
                  <div className="flex items-start gap-3">
                    {/* 编号 */}
                    <div className="flex h-9 w-5 shrink-0 items-start justify-center pt-2">
                      <span className="text-[11px] font-bold text-gray-200 group-hover:text-gray-300 transition-colors duration-150">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>

                    {/* 输入区 — 相对定位，承载内部工具条 */}
                    <div className="min-w-0 flex-1 relative">
                      <AiOptimizeTextarea
                        onOptimize={() => void openOptimizePage('achievement', index)}
                        optimizing={optimizingField === `achievement-${index}`}
                        optimizeDisabled={optimizingField !== null || !item.trim()}
                        onDelete={() => removeResponsibility(index)}
                        deleteLabel={`删除职责 ${index + 1}`}
                        id={fieldOptimizeInputId(moduleId, 0, 'responsibility', index)}
                        value={item}
                        onChange={(e) => updateResponsibility(index, e.target.value)}
                        placeholder={`职责 ${index + 1}：用 STAR 法则描述具体做了什么、用了什么方法、取得了什么结果…`}
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
                        className={TEXTAREA}
                      />
                      {optimizeError && optimizeErrorField === `achievement-${index}` && (
                        <div className="mt-2 rounded border border-red-200 bg-red-50/80 px-3 py-2 text-xs text-red-700">
                          {optimizeError}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* 与职责输入框对齐，留出编号和间距 */}
              <div className="pl-8 pt-3">
                <ResponsibilityAddButton onClick={addResponsibility} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
