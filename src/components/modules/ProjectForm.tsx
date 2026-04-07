import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProjectContent } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeProjectContent } from '../../utils/moduleContent'
import { AutoResizeTextarea } from '../ui/AutoResizeTextarea'
import { ModuleSaveBar } from './ModuleSaveBar'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
}

export function ProjectForm({ resumeId, moduleId, initialContent }: Props) {
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

  const update = (field: keyof ProjectContent, value: string | string[]) => {
    setContent((prev) => ({ ...prev, [field]: value }))
  }

  const addResponsibility = () => update('achievements', [...content.achievements, ''])

  const updateResponsibility = (index: number, value: string) => {
    const next = [...content.achievements]
    next[index] = value
    update('achievements', next)
  }

  const removeResponsibility = (index: number) => {
    update('achievements', content.achievements.filter((_, idx) => idx !== index))
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
    <div className="space-y-4">
      <ModuleSaveBar
        saveState={saveState}
        errorMessage={errorMessage}
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={saveNow}
      />

      {optimizeError && optimizeErrorField === null && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {optimizeError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
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
          <input
            type="month"
            value={content.startDate}
            onChange={(e) => update('startDate', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">结束时间</label>
          <input
            type="month"
            value={content.endDate}
            onChange={(e) => update('endDate', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
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
        <div className="mb-1 flex items-center justify-between gap-3">
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
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">核心职责</label>
          <button type="button" onClick={addResponsibility} className="text-sm text-primary-600 hover:text-primary-700">
            + 添加
          </button>
        </div>
        {content.achievements.map((item, index) => (
          <div key={index} className={index === 0 ? '' : 'mt-3'}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div />
              <div className="flex items-center gap-3">
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
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            />
            {optimizeError && optimizeErrorField === `achievement-${index}` && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {optimizeError}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
