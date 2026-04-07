import { useRef, useCallback, useEffect, useState } from 'react'
import { useResumeStore } from '../store/resumeStore'

export type ModuleSaveState = 'saved' | 'dirty' | 'saving' | 'error'

export function useAutoSave(resumeId: number, moduleId: number | null) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const committedContentRef = useRef<string | null>(null)
  const latestContentRef = useRef<Record<string, unknown> | null>(null)
  const latestSerializedRef = useRef<string | null>(null)
  const queuedSerializedRef = useRef<string | null>(null)
  const saveChainRef = useRef<Promise<void>>(Promise.resolve())
  const { updateModuleContent } = useResumeStore()
  const [saveState, setSaveState] = useState<ModuleSaveState>('saved')
  const [errorMessage, setErrorMessage] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const syncLatestSnapshot = useCallback((content: Record<string, unknown>) => {
    const serialized = JSON.stringify(content)
    latestContentRef.current = content
    latestSerializedRef.current = serialized
    return serialized
  }, [])

  const markSaved = useCallback((content: Record<string, unknown>) => {
    const serialized = syncLatestSnapshot(content)
    committedContentRef.current = serialized
    queuedSerializedRef.current = null
    clearTimer()
    setSaveState('saved')
    setErrorMessage('')
    setHasUnsavedChanges(false)
  }, [clearTimer, syncLatestSnapshot])

  const enqueueSave = useCallback(
    (content: Record<string, unknown>, serialized: string) => {
      if (!moduleId) {
        return Promise.resolve()
      }

      if (serialized === committedContentRef.current) {
        setSaveState('saved')
        setErrorMessage('')
        setHasUnsavedChanges(false)
        return saveChainRef.current
      }

      if (queuedSerializedRef.current === serialized) {
        return saveChainRef.current
      }

      queuedSerializedRef.current = serialized
      saveChainRef.current = saveChainRef.current
        .catch(() => undefined)
        .then(async () => {
          if (serialized === committedContentRef.current) {
            if (latestSerializedRef.current === serialized) {
              setSaveState('saved')
              setErrorMessage('')
              setHasUnsavedChanges(false)
            }
            return
          }

          setSaveState('saving')
          setErrorMessage('')

          try {
            await updateModuleContent(resumeId, moduleId, content)
            committedContentRef.current = serialized

            if (latestSerializedRef.current === serialized) {
              setSaveState('saved')
              setErrorMessage('')
              setHasUnsavedChanges(false)
              return
            }

            setSaveState('dirty')
            setHasUnsavedChanges(true)
          } catch (error: unknown) {
            if (latestSerializedRef.current === serialized) {
              setSaveState('error')
              setErrorMessage(error instanceof Error ? error.message : '保存失败，请稍后重试')
            } else {
              setSaveState('dirty')
            }
            setHasUnsavedChanges(true)
            throw error
          } finally {
            if (queuedSerializedRef.current === serialized) {
              queuedSerializedRef.current = null
            }
          }
        })

      return saveChainRef.current
    },
    [moduleId, resumeId, updateModuleContent]
  )

  const save = useCallback(
    (content: Record<string, unknown>) => {
      const serialized = syncLatestSnapshot(content)

      clearTimer()

      if (serialized === committedContentRef.current) {
        queuedSerializedRef.current = null
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
        void enqueueSave(content, serialized)
      }, 1500)
    },
    [clearTimer, enqueueSave, syncLatestSnapshot]
  )

  const saveNow = useCallback(
    async (content: Record<string, unknown>) => {
      const serialized = syncLatestSnapshot(content)
      clearTimer()
      await enqueueSave(content, serialized)
    },
    [clearTimer, enqueueSave, syncLatestSnapshot]
  )

  const flush = useCallback(() => {
    clearTimer()
    if (latestContentRef.current && latestSerializedRef.current && latestSerializedRef.current !== committedContentRef.current) {
      return enqueueSave(latestContentRef.current, latestSerializedRef.current)
    }
    return Promise.resolve()
  }, [clearTimer, enqueueSave])

  useEffect(() => () => {
    clearTimer()
  }, [clearTimer])

  return { save, saveNow, flush, markSaved, saveState, errorMessage, hasUnsavedChanges }
}
