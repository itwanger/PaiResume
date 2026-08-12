import type { JobIntentionContent } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeJobIntentionContent } from '../../utils/moduleContent'
import { ModuleSaveBar } from './ModuleSaveBar'
import { MaterialActions } from '../materials/MaterialActions'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
}

export function JobIntentionForm({ resumeId, moduleId, initialContent }: Props) {
  const [content, setContent, { saveNow, saveState, errorMessage, hasUnsavedChanges }] = useModuleContentState<JobIntentionContent>({
    resumeId,
    moduleId,
    initialContent,
    normalize: normalizeJobIntentionContent,
  })

  const update = (field: keyof JobIntentionContent, value: string) => {
    setContent((prev) => ({ ...prev, [field]: value }))
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
          moduleType="job_intention"
          content={content}
          onApply={setContent}
          embedded
        />
      </ModuleSaveBar>

      <div className="editor-responsive-grid">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">意向岗位</label>
          <input type="text" value={content.targetPosition} onChange={(e) => update('targetPosition', e.target.value)}
            placeholder="如：Java后端开发"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">意向城市</label>
          <input type="text" value={content.targetCity} onChange={(e) => update('targetCity', e.target.value)}
            placeholder="如：北京、上海"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
        </div>
      </div>
    </div>
  )
}
