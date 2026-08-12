import type { ReactNode } from 'react'
import type { ModuleSaveState } from '../../hooks/useAutoSave'
import { Button } from '../ui/Button'

interface Props {
  saveState: ModuleSaveState
  errorMessage: string
  hasUnsavedChanges: boolean
  onSave: () => Promise<void>
  children?: ReactNode
}

export function ModuleSaveBar({ saveState, errorMessage, hasUnsavedChanges, onSave, children }: Props) {
  const toneClass = saveState === 'error'
    ? 'bg-red-50'
    : 'bg-primary-50/70'

  const textClass = saveState === 'error' ? 'text-red-600' : 'text-gray-500'

  const message = saveState === 'error'
    ? (errorMessage || '保存失败，请重试')
    : saveState === 'saving'
      ? '正在保存…'
      : hasUnsavedChanges
        ? '有未保存修改'
        : '已保存'

  const showAction = saveState === 'error' || saveState === 'saving' || hasUnsavedChanges
  const buttonLabel = saveState === 'error' ? '重试' : '保存'

  return (
    <div className="editor-save-bar rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className={`flex min-h-8 shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 ${toneClass}`}>
          <p className={`min-w-0 text-sm ${textClass}`}>{message}</p>
          {showAction ? (
            <Button
              type="button"
              size="sm"
              onClick={() => void onSave()}
              loading={saveState === 'saving'}
              disabled={saveState === 'saving'}
              className="editor-save-bar__action shrink-0"
            >
              {buttonLabel}
            </Button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  )
}
