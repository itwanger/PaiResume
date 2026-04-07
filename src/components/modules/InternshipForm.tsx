import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { InternshipContent } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeInternshipContent } from '../../utils/moduleContent'
import { AutoResizeTextarea } from '../ui/AutoResizeTextarea'
import { ModuleSaveBar } from './ModuleSaveBar'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
}

export function InternshipForm({ resumeId, moduleId, initialContent }: Props) {
  const navigate = useNavigate()
  const [content, setContent, { saveNow, saveState, errorMessage, hasUnsavedChanges }] = useModuleContentState<InternshipContent>({
    resumeId,
    moduleId,
    initialContent,
    normalize: normalizeInternshipContent,
  })
  const [optimizingField, setOptimizingField] = useState<string | null>(null)
  const [optimizeError, setOptimizeError] = useState('')
  const [optimizeErrorField, setOptimizeErrorField] = useState<string | null>(null)

  const update = (field: keyof InternshipContent, value: string | string[]) => {
    setContent((prev) => ({ ...prev, [field]: value }))
  }

  const addResponsibility = () => {
    update('responsibilities', [...content.responsibilities, ''])
  }

  const updateResponsibility = (index: number, value: string) => {
    const next = [...content.responsibilities]
    next[index] = value
    update('responsibilities', next)
  }

  const removeResponsibility = (index: number) => {
    update('responsibilities', content.responsibilities.filter((_, i) => i !== index))
  }

  const openOptimizePage = async (field: 'projectDescription' | 'responsibility', index?: number) => {
    const fieldKey = field === 'projectDescription' ? 'projectDescription' : `responsibility-${index}`
    setOptimizingField(fieldKey)
    setOptimizeError('')
    setOptimizeErrorField(null)

    try {
      await saveNow()
      const searchParams = new URLSearchParams()
      searchParams.set('fieldType', field === 'projectDescription' ? 'project_description' : 'responsibility')
      searchParams.set('returnModuleType', 'internship')
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
          <label className="mb-1 block text-sm font-medium text-gray-700">公司</label>
          <input
            type="text"
            value={content.company}
            onChange={(e) => update('company', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
          />
        </div>
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
          <label className="mb-1 block text-sm font-medium text-gray-700">职位</label>
          <input
            type="text"
            value={content.position}
            onChange={(e) => update('position', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">开始</label>
            <input
              type="month"
              value={content.startDate}
              onChange={(e) => update('startDate', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">结束</label>
            <input
              type="month"
              value={content.endDate}
              onChange={(e) => update('endDate', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">技术栈</label>
        <AutoResizeTextarea
          value={content.techStack}
          onChange={(e) => update('techStack', e.target.value)}
          minRows={2}
          placeholder="Java, Spring Boot, MySQL..."
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-gray-700">项目简介</label>
          <button
            type="button"
            onClick={() => void openOptimizePage('projectDescription')}
            disabled={optimizingField !== null || !content.projectDescription.trim()}
            className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {optimizingField === 'projectDescription' ? '跳转中...' : 'AI 优化'}
          </button>
        </div>
        <textarea
          value={content.projectDescription}
          onChange={(e) => update('projectDescription', e.target.value)}
          rows={3}
          placeholder="填写这段实习项目的背景、目标和整体内容"
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
        />
        {optimizeError && optimizeErrorField === 'projectDescription' && (
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
        {content.responsibilities.map((item, index) => (
          <div key={index} className={index === 0 ? '' : 'mt-3'}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void openOptimizePage('responsibility', index)}
                  disabled={optimizingField !== null || !item.trim()}
                  className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {optimizingField === `responsibility-${index}` ? '跳转中...' : `AI 优化职责 ${index + 1}`}
                </button>
                <button type="button" onClick={() => removeResponsibility(index)} className="text-xs text-gray-300 hover:text-red-500">
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
            {optimizeError && optimizeErrorField === `responsibility-${index}` && (
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
