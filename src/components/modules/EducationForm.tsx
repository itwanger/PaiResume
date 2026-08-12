import { useCallback, useEffect, useRef, useState } from 'react'
import { contentLibraryApi } from '../../api/contentLibrary'
import type { EducationContent } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeEducationContent } from '../../utils/moduleContent'
import {
  buildEducationReferenceOptions,
  completeEducationDates,
  inferEducationEndDate,
  inferEducationStartDate,
  type EducationReferenceOption,
} from '../../utils/educationAssist'
import { ModuleSaveBar } from './ModuleSaveBar'
import { MaterialActions } from '../materials/MaterialActions'
import { MonthInput } from '../ui/MonthInput'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
  timelineMessages?: string[]
}

export function EducationForm({ resumeId, moduleId, initialContent, timelineMessages = [] }: Props) {
  const [content, setContent, { saveNow, saveState, errorMessage, hasUnsavedChanges }] = useModuleContentState<EducationContent>({
    resumeId,
    moduleId,
    initialContent,
    normalize: normalizeEducationContent,
  })
  const [referenceOptions, setReferenceOptions] = useState<EducationReferenceOption[]>([])
  const inferredStartDateRef = useRef<string | null>(null)
  const inferredEndDateRef = useRef<string | null>(null)

  const completeMissingTimelineDate = useCallback((value: EducationContent) => {
    const completed = completeEducationDates(value)
    inferredStartDateRef.current = !value.startDate && completed.startDate ? completed.startDate : null
    inferredEndDateRef.current = !value.endDate && completed.endDate ? completed.endDate : null
    return completed
  }, [])

  useEffect(() => {
    setContent((previous) => completeMissingTimelineDate(previous))
  }, [completeMissingTimelineDate, initialContent, moduleId, setContent])

  const update = (field: keyof EducationContent, value: string | boolean) => {
    setContent((prev) => ({ ...prev, [field]: value }))
  }

  const updateEducationTimeline = (field: 'degree' | 'startDate' | 'endDate', value: string) => {
    setContent((previous) => {
      const next = { ...previous, [field]: value }

      if (field === 'startDate') {
        inferredStartDateRef.current = null
        const canUpdateEndDate = !previous.endDate || previous.endDate === inferredEndDateRef.current
        if (!canUpdateEndDate) return next

        const inferredEndDate = inferEducationEndDate(next.degree, next.startDate)
        inferredEndDateRef.current = inferredEndDate || null
        return { ...next, endDate: inferredEndDate }
      }

      if (field === 'endDate') {
        inferredEndDateRef.current = null
      }

      const canUpdateStartDate = !previous.startDate || previous.startDate === inferredStartDateRef.current
      const canUpdateEndDate = !previous.endDate || previous.endDate === inferredEndDateRef.current

      if (field === 'degree' && canUpdateEndDate && next.startDate) {
        const inferredEndDate = inferEducationEndDate(next.degree, next.startDate)
        inferredEndDateRef.current = inferredEndDate || null
        return { ...next, endDate: inferredEndDate }
      }

      if (!canUpdateStartDate) return next

      const inferredStartDate = inferEducationStartDate(next.degree, next.endDate)
      inferredStartDateRef.current = inferredStartDate || null
      return { ...next, startDate: inferredStartDate }
    })
  }

  useEffect(() => {
    const school = content.school.trim()
    if (school.length < 2) {
      setReferenceOptions([])
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      const [mineResult, officialResult] = await Promise.allSettled([
        contentLibraryApi.listHistoryMaterials({ moduleType: 'education', query: school, excludeResumeId: resumeId }),
        contentLibraryApi.listOfficialMaterials({ moduleType: 'education', query: school }),
      ])
      if (cancelled) return

      const mine = mineResult.status === 'fulfilled' ? mineResult.value.data.data : []
      const official = officialResult.status === 'fulfilled' ? officialResult.value.data.data : []
      setReferenceOptions(buildEducationReferenceOptions(school, mine, official))
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [content.school, resumeId])

  const applyReference = (option: EducationReferenceOption) => {
    setContent((previous) => ({
      ...previous,
      department: option.department,
      major: option.major,
    }))
    if (option.officialMaterialId) {
      void contentLibraryApi.useOfficialMaterial(option.officialMaterialId).catch(() => undefined)
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
          moduleType="education"
          content={content}
          onApply={(nextContent) => {
            inferredStartDateRef.current = null
            inferredEndDateRef.current = null
            setContent(completeMissingTimelineDate(nextContent))
          }}
          embedded
        />
      </ModuleSaveBar>

      <div className="editor-responsive-grid">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">学校</label>
          <input type="text" value={content.school} onChange={(e) => update('school', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
          {referenceOptions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="院系专业候选">
              {referenceOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => applyReference(option)}
                  className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-left text-xs text-primary-700 hover:border-primary-300 hover:bg-primary-100"
                >
                  {[option.department, option.major].filter(Boolean).join(' / ')}
                  <span className="ml-1 text-[10px] text-primary-400">{option.source === 'mine' ? '我的资料' : '官方参考'}</span>
                </button>
              ))}
            </div>
          ) : null}
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
          <select value={content.degree} onChange={(e) => updateEducationTimeline('degree', e.target.value)}
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
          <MonthInput
            value={content.startDate}
            onChange={(value) => updateEducationTimeline('startDate', value)}
            ariaLabel="教育开始时间"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
          <MonthInput
            value={content.endDate}
            onChange={(value) => updateEducationTimeline('endDate', value)}
            ariaLabel="教育结束时间"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
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
      {timelineMessages.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {timelineMessages.map((message) => <p key={message}>{message}</p>)}
        </div>
      ) : null}
    </div>
  )
}
