import type { AwardContent } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeAwardContent } from '../../utils/moduleContent'
import { ModuleSaveBar } from './ModuleSaveBar'
import { MaterialActions } from '../materials/MaterialActions'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
}

export function AwardForm({ resumeId, moduleId, initialContent }: Props) {
  const [content, setContent, { saveNow, saveState, errorMessage, hasUnsavedChanges }] = useModuleContentState<AwardContent>({
    resumeId,
    moduleId,
    initialContent,
    normalize: normalizeAwardContent,
  })

  return (
    <div className="space-y-4">
      <ModuleSaveBar
        saveState={saveState}
        errorMessage={errorMessage}
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={saveNow}
      >
        <MaterialActions
          moduleType="award"
          content={content}
          defaultTitle={content.awardName || '获奖情况'}
          instanceKey={moduleId}
          onApply={setContent}
          embedded
        />
      </ModuleSaveBar>

      <div className="editor-responsive-grid">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">奖项名称</label>
          <input type="text" value={content.awardName}
            onChange={(e) => setContent((p) => ({ ...p, awardName: e.target.value }))}
            placeholder="如：全国大学生数学建模竞赛一等奖"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">获奖时间</label>
          <input type="month" value={content.awardTime}
            onChange={(e) => setContent((p) => ({ ...p, awardTime: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm" />
        </div>
      </div>
    </div>
  )
}
