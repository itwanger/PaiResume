import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useAutoSave, type ModuleSaveState } from './useAutoSave'
import { areModuleContentsEqual } from '../utils/moduleContent'

interface Options<T extends object> {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
  normalize: (content: Record<string, unknown>) => T
}

interface ModuleContentStateControls {
  saveNow: () => Promise<void>
  saveState: ModuleSaveState
  errorMessage: string
  hasUnsavedChanges: boolean
}

export function useModuleContentState<T extends object>({
  resumeId,
  moduleId,
  initialContent,
  normalize,
}: Options<T>): [T, Dispatch<SetStateAction<T>>, ModuleContentStateControls] {
  const [content, setContent] = useState<T>(() => normalize(initialContent))
  const skipNextSaveRef = useRef(true)
  const { save, saveNow: persistNow, markSaved, saveState, errorMessage, hasUnsavedChanges } = useAutoSave(resumeId, moduleId)

  useEffect(() => {
    const nextContent = normalize(initialContent)
    markSaved(nextContent as Record<string, unknown>)

    setContent((prev) => {
      if (areModuleContentsEqual(prev, nextContent)) {
        return prev
      }

      skipNextSaveRef.current = true
      return nextContent
    })
  }, [initialContent, markSaved, normalize])

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }

    save(content as Record<string, unknown>)
  }, [content, save])

  const saveNow = useCallback(() => persistNow(content as Record<string, unknown>), [content, persistNow])

  return [content, setContent, { saveNow, saveState, errorMessage, hasUnsavedChanges }]
}
