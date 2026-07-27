import type { ModuleSaveState } from '../../hooks/useAutoSave'
import { Button } from '../ui/Button'

interface Props {
  saveState: ModuleSaveState
  errorMessage: string
  hasUnsavedChanges: boolean
  onSave: () => Promise<void>
}

export function ModuleSaveBar({ saveState, errorMessage, hasUnsavedChanges, onSave }: Props) {
  const toneClass = saveState === 'error'
    ? 'border-red-200 bg-red-50'
    : 'border-primary-100 bg-primary-50/60'

  const textClass = saveState === 'error' ? 'text-red-600' : 'text-gray-500'

  const message = saveState === 'error'
    ? (errorMessage || '保存失败，请重试')
    : saveState === 'saving'
      ? '正在保存…'
      : hasUnsavedChanges
        ? '有未保存修改'
        : '已保存'

  const buttonLabel = saveState === 'error'
    ? '重试'
    : hasUnsavedChanges
      ? '保存'
      : '已保存'

  return (
    <div className={`editor-save-bar mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${toneClass}`}>
      <p className={`min-w-0 text-sm ${textClass}`}>{message}</p>

      <Button
        type="button"
        size="sm"
        onClick={() => void onSave()}
        loading={saveState === 'saving'}
        disabled={saveState !== 'error' && !hasUnsavedChanges}
        className="editor-save-bar__action shrink-0"
      >
        {buttonLabel}
      </Button>
    </div>
  )
}
