import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { ModuleSaveState } from '../../hooks/useAutoSave'
import { Button } from '../ui/Button'
import {
  ModuleSaveFeedbackContext,
  type ModuleFeedbackTone,
} from './moduleSaveFeedback'

interface ModuleFeedback {
  message: string
  tone: ModuleFeedbackTone
}

interface Props {
  saveState: ModuleSaveState
  errorMessage: string
  hasUnsavedChanges: boolean
  onSave: () => Promise<void>
  children?: ReactNode
}

export function ModuleSaveBar({ saveState, errorMessage, hasUnsavedChanges, onSave, children }: Props) {
  const [feedback, setFeedback] = useState<ModuleFeedback | null>(null)
  const clearFeedback = useCallback(() => setFeedback(null), [])
  const showFeedback = useCallback((message: string, tone: ModuleFeedbackTone = 'success') => {
    setFeedback({ message, tone })
  }, [])
  const feedbackContext = useMemo(
    () => ({ clearFeedback, showFeedback }),
    [clearFeedback, showFeedback],
  )

  const saveIsBusy = saveState === 'error' || saveState === 'saving' || hasUnsavedChanges
  const activeFeedback = saveIsBusy ? null : feedback

  const toneClass = saveState === 'error' || activeFeedback?.tone === 'error'
    ? 'bg-red-50'
    : activeFeedback?.tone === 'success'
      ? 'bg-emerald-50'
      : 'bg-primary-50/70'

  const textClass = saveState === 'error' || activeFeedback?.tone === 'error'
    ? 'text-red-600'
    : activeFeedback?.tone === 'success'
      ? 'text-emerald-700'
      : 'text-gray-500'

  const message = saveState === 'error'
    ? (errorMessage || '保存失败，请重试')
    : saveState === 'saving'
      ? '正在保存…'
      : hasUnsavedChanges
        ? '等待自动保存…'
        : activeFeedback?.message || '已自动保存'

  const showRetry = saveState === 'error'

  return (
    <ModuleSaveFeedbackContext.Provider value={feedbackContext}>
      <div className="editor-save-bar border-b border-slate-100 pb-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className={`flex min-h-8 shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 ${toneClass}`}>
            <p className={`min-w-0 text-sm ${textClass}`} role={activeFeedback ? 'status' : undefined}>{message}</p>
            {showRetry ? (
              <Button
                type="button"
                size="sm"
                onClick={() => void onSave()}
                className="editor-save-bar__action shrink-0"
              >
                重试
              </Button>
            ) : null}
          </div>
          {children}
        </div>
      </div>
    </ModuleSaveFeedbackContext.Provider>
  )
}
