import { useRef, useCallback, useEffect, useState } from 'react'
import { useResumeStore } from '../store/resumeStore'

export type ModuleSaveState = 'saved' | 'dirty' | 'saving' | 'error'

const LOCAL_DRAFT_PREFIX = 'pai-resume:draft:'
const activeFlushers = new Map<string, Set<() => Promise<void>>>()

interface LocalDraft {
  content: Record<string, unknown>
  serialized: string
  updatedAt: string
}

function localDraftKey(targetKey: string) {
  return `${LOCAL_DRAFT_PREFIX}${targetKey}`
}

export async function flushResumeAutoSaves(resumeId: number) {
  const prefix = `${resumeId}:`
  const flushers = Array.from(activeFlushers.entries())
    .filter(([targetKey]) => targetKey.startsWith(prefix))
    .flatMap(([, registered]) => Array.from(registered))

  const results = await Promise.allSettled(flushers.map((flush) => flush()))
  const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (failed) {
    throw failed.reason instanceof Error ? failed.reason : new Error('简历仍有内容未保存，请重试')
  }
}

function writeLocalDraft(targetKey: string, content: Record<string, unknown>, serialized: string) {
  if (typeof window === 'undefined') return
  try {
    const draft: LocalDraft = { content, serialized, updatedAt: new Date().toISOString() }
    window.localStorage.setItem(localDraftKey(targetKey), JSON.stringify(draft))
  } catch {
    // Server autosave and the unload warning remain active if browser storage is unavailable.
  }
}

function removeLocalDraftIfMatching(targetKey: string, serialized: string) {
  if (typeof window === 'undefined') return
  try {
    const rawDraft = window.localStorage.getItem(localDraftKey(targetKey))
    if (!rawDraft) return
    const draft = JSON.parse(rawDraft) as Partial<LocalDraft>
    if (draft.serialized === serialized) {
      window.localStorage.removeItem(localDraftKey(targetKey))
    }
  } catch {
    window.localStorage.removeItem(localDraftKey(targetKey))
  }
}

export function readLocalModuleDraft(resumeId: number, moduleId: number) {
  if (typeof window === 'undefined') return null
  const key = localDraftKey(`${resumeId}:${moduleId}`)
  try {
    const rawDraft = window.localStorage.getItem(key)
    if (!rawDraft) return null
    const draft = JSON.parse(rawDraft) as Partial<LocalDraft>
    if (!draft.content || typeof draft.content !== 'object' || Array.isArray(draft.content)) {
      window.localStorage.removeItem(key)
      return null
    }
    return draft.content
  } catch {
    window.localStorage.removeItem(key)
    return null
  }
}

export function useAutoSave(resumeId: number, moduleId: number | null) {
  const targetKey = `${resumeId}:${moduleId ?? 'none'}`
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const committedContentRef = useRef(new Map<string, string>())
  const latestSnapshotRef = useRef<{
    targetKey: string
    content: Record<string, unknown>
    serialized: string
  } | null>(null)
  const pendingSavesRef = useRef(new Map<string, Promise<void>>())
  const saveChainRef = useRef<Promise<void>>(Promise.resolve())
  const activeTargetKeyRef = useRef(targetKey)
  const { updateModuleContent } = useResumeStore()
  const [saveState, setSaveState] = useState<ModuleSaveState>('saved')
  const [errorMessage, setErrorMessage] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  activeTargetKeyRef.current = targetKey

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const syncLatestSnapshot = useCallback((content: Record<string, unknown>) => {
    const serialized = JSON.stringify(content)
    latestSnapshotRef.current = { targetKey, content, serialized }
    return serialized
  }, [targetKey])

  const updateSaveState = useCallback((snapshotTargetKey: string, nextState: ModuleSaveState, message = '') => {
    if (activeTargetKeyRef.current !== snapshotTargetKey) {
      return
    }

    const latestSnapshot = latestSnapshotRef.current
    const committedContent = committedContentRef.current.get(snapshotTargetKey)
    const isDirty = Boolean(
      latestSnapshot
      && latestSnapshot.targetKey === snapshotTargetKey
      && latestSnapshot.serialized !== committedContent
    )

    setSaveState(nextState)
    setErrorMessage(message)
    setHasUnsavedChanges(isDirty)
  }, [])

  const markSaved = useCallback((content: Record<string, unknown>) => {
    const serialized = syncLatestSnapshot(content)
    committedContentRef.current.set(targetKey, serialized)
    clearTimer()
    setSaveState('saved')
    setErrorMessage('')
    setHasUnsavedChanges(false)
  }, [clearTimer, syncLatestSnapshot, targetKey])

  const enqueueSave = useCallback(
    (content: Record<string, unknown>, serialized: string) => {
      if (!moduleId) {
        return Promise.resolve()
      }

      if (serialized === committedContentRef.current.get(targetKey)) {
        updateSaveState(targetKey, 'saved')
        return saveChainRef.current
      }

      const pendingSaveKey = `${targetKey}:${serialized}`
      const existingSave = pendingSavesRef.current.get(pendingSaveKey)
      if (existingSave) {
        return existingSave
      }

      const saveOperation = saveChainRef.current
        .catch(() => undefined)
        .then(async () => {
          if (serialized === committedContentRef.current.get(targetKey)) {
            const latestSnapshot = latestSnapshotRef.current
            if (latestSnapshot?.targetKey === targetKey && latestSnapshot.serialized === serialized) {
              updateSaveState(targetKey, 'saved')
            }
            return
          }

          updateSaveState(targetKey, 'saving')

          try {
            await updateModuleContent(resumeId, moduleId, content)
            committedContentRef.current.set(targetKey, serialized)
            removeLocalDraftIfMatching(targetKey, serialized)

            const latestSnapshot = latestSnapshotRef.current
            if (latestSnapshot?.targetKey === targetKey && latestSnapshot.serialized === serialized) {
              updateSaveState(targetKey, 'saved')
              return
            }

            updateSaveState(targetKey, 'dirty')
          } catch (error: unknown) {
            const latestSnapshot = latestSnapshotRef.current
            if (latestSnapshot?.targetKey === targetKey && latestSnapshot.serialized === serialized) {
              updateSaveState(
                targetKey,
                'error',
                error instanceof Error ? error.message : '保存失败，请稍后重试',
              )
            } else {
              updateSaveState(targetKey, 'dirty')
            }
            throw error
          }
        })

      saveChainRef.current = saveOperation
      pendingSavesRef.current.set(pendingSaveKey, saveOperation)
      void saveOperation.then(
        () => pendingSavesRef.current.delete(pendingSaveKey),
        () => pendingSavesRef.current.delete(pendingSaveKey),
      )

      return saveOperation
    },
    [moduleId, resumeId, targetKey, updateModuleContent, updateSaveState]
  )

  const save = useCallback(
    (content: Record<string, unknown>) => {
      const serialized = syncLatestSnapshot(content)
      writeLocalDraft(targetKey, content, serialized)

      clearTimer()

      if (serialized === committedContentRef.current.get(targetKey)) {
        removeLocalDraftIfMatching(targetKey, serialized)
        setSaveState('saved')
        setErrorMessage('')
        setHasUnsavedChanges(false)
        return
      }

      setSaveState('dirty')
      setErrorMessage('')
      setHasUnsavedChanges(true)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        void enqueueSave(content, serialized).catch(() => undefined)
      }, 1500)
    },
    [clearTimer, enqueueSave, syncLatestSnapshot, targetKey]
  )

  const saveNow = useCallback(
    async (content: Record<string, unknown>) => {
      const serialized = syncLatestSnapshot(content)
      writeLocalDraft(targetKey, content, serialized)
      clearTimer()
      await enqueueSave(content, serialized)
    },
    [clearTimer, enqueueSave, syncLatestSnapshot, targetKey]
  )

  const flush = useCallback(() => {
    clearTimer()
    const latestSnapshot = latestSnapshotRef.current
    if (
      latestSnapshot
      && latestSnapshot.targetKey === targetKey
      && latestSnapshot.serialized !== committedContentRef.current.get(targetKey)
    ) {
      return enqueueSave(latestSnapshot.content, latestSnapshot.serialized)
    }
    return Promise.resolve()
  }, [clearTimer, enqueueSave, targetKey])

  useEffect(() => {
    const registered = activeFlushers.get(targetKey) ?? new Set<() => Promise<void>>()
    registered.add(flush)
    activeFlushers.set(targetKey, registered)

    return () => {
      const current = activeFlushers.get(targetKey)
      current?.delete(flush)
      if (current?.size === 0) {
        activeFlushers.delete(targetKey)
      }
    }
  }, [flush, targetKey])

  useEffect(() => {
    const flushPendingChanges = () => {
      void flush().catch(() => undefined)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingChanges()
      }
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const latestSnapshot = latestSnapshotRef.current
      const hasPendingChanges = Boolean(
        latestSnapshot
        && latestSnapshot.targetKey === targetKey
        && latestSnapshot.serialized !== committedContentRef.current.get(targetKey)
      )

      if (!hasPendingChanges) {
        return
      }

      flushPendingChanges()
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('pagehide', flushPendingChanges)
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', flushPendingChanges)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      flushPendingChanges()
    }
  }, [flush, targetKey])

  return { save, saveNow, flush, markSaved, saveState, errorMessage, hasUnsavedChanges }
}
