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
  const [content, setContent, { saveNow, saveState, errorMessage, hasUnsavedChanges }] = useModuleContentState<ResearchContent>({
    resumeId,
    moduleId,
    initialContent,
    normalize: normalizeResearchContent,
  })

  const update = (field: keyof ResearchContent, value: string) => {
    setContent((prev) => ({ ...prev, [field]: value }))
  }

  const openOptimize = async (fieldType: keyof typeof researchOptimizeFields) => {
    setOptimizingField(fieldType)
    setOptimizeError('')
    setErrorField(null)
    try {
      await saveNow()
      navigate(`/editor/${resumeId}/modules/${moduleId}/field-optimize?fieldType=${fieldType}&returnModuleType=research`)
    } catch (error: unknown) {
      setErrorField(fieldType)
      setOptimizeError(error instanceof Error ? error.message : '进入 AI 优化页失败，请稍后重试')
    } finally {
      setOptimizingField(null)
    }
  }

  const renderField = (fieldType: keyof typeof researchOptimizeFields) => {
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
        filledCount={[content.background, content.workContent].filter((value) => value.trim()).length}>
        <div className="space-y-4 px-4 pb-5 pt-3">
          {renderField('research_background')}
          {renderField('research_work_content')}
        </div>
      </OptionalInfoSection>
      </div>
    </div>
  )
}
