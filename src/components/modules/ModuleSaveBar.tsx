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

  const titleClass = saveState === 'error' ? 'text-red-700' : 'text-gray-900'
  const textClass = saveState === 'error' ? 'text-red-600' : 'text-gray-500'

  const message = saveState === 'error'
    ? (errorMessage || '保存失败，请重试后再继续下一步。')
    : hasUnsavedChanges
      ? '当前模块有未保存修改。你可以主动保存后再继续，系统也会自动保存。'
      : '当前模块内容已保存，可以放心继续下一步。'

  const buttonLabel = saveState === 'error'
    ? '重新保存'
    : hasUnsavedChanges
      ? '保存本模块'
      : '已保存'

  return (
    <div className={`mb-4 flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${toneClass}`}>
      <div className="min-w-0">
        <p className={`text-sm font-medium ${titleClass}`}>
          {saveState === 'saving' ? '正在保存模块内容...' : '保存状态'}
        </p>
        <p className={`mt-1 text-xs ${textClass}`}>{message}</p>
      </div>

      <Button
        type="button"
        size="sm"
        onClick={() => void onSave()}
        loading={saveState === 'saving'}
        disabled={saveState !== 'error' && !hasUnsavedChanges}
        className="shrink-0"
      >
        {buttonLabel}
      </Button>
    </div>
  )
}
