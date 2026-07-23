import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { readLocalModuleDraft, useAutoSave, type ModuleSaveState } from './useAutoSave'
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
  const [content, setContent] = useState<T>(() => {
    const localDraft = readLocalModuleDraft(resumeId, moduleId)
    return normalize(localDraft ?? initialContent)
  })
  const skipNextSaveRef = useRef(true)
  const targetKey = `${resumeId}:${moduleId}`
  const targetKeyRef = useRef(targetKey)
  const contentRef = useRef(content)
  const { save, saveNow: persistNow, markSaved, saveState, errorMessage, hasUnsavedChanges } = useAutoSave(resumeId, moduleId)

  contentRef.current = content

  useEffect(() => {
    const nextContent = normalize(initialContent)
    const targetChanged = targetKeyRef.current !== targetKey

    if (!targetChanged && hasUnsavedChanges && !areModuleContentsEqual(contentRef.current, nextContent)) {
      return
    }

    targetKeyRef.current = targetKey
    markSaved(nextContent as Record<string, unknown>)

    const localDraft = readLocalModuleDraft(resumeId, moduleId)
    const recoveredContent = localDraft ? normalize(localDraft) : nextContent
    if (localDraft && !areModuleContentsEqual(recoveredContent, nextContent)) {
      void persistNow(recoveredContent as Record<string, unknown>).catch(() => undefined)
    }

    setContent((prev) => {
      if (areModuleContentsEqual(prev, recoveredContent)) {
        return prev
      }

      skipNextSaveRef.current = true
      return recoveredContent
    })
  }, [hasUnsavedChanges, initialContent, markSaved, moduleId, normalize, persistNow, resumeId, targetKey])

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
