import { useRef, useCallback, useEffect } from 'react'
import { useResumeStore } from '../store/resumeStore'

export function useAutoSave(resumeId: number, moduleId: number | null) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const committedContentRef = useRef<string | null>(null)
  const pendingContentRef = useRef<string | null>(null)
  const { updateModuleContent } = useResumeStore()

  const markSaved = useCallback((content: Record<string, unknown>) => {
    const serialized = JSON.stringify(content)
    committedContentRef.current = serialized
    if (pendingContentRef.current === serialized) {
      pendingContentRef.current = null
    }
  }, [])

  const save = useCallback(
    (content: Record<string, unknown>) => {
      const serialized = JSON.stringify(content)
      if (serialized === committedContentRef.current || serialized === pendingContentRef.current) {
        return
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      pendingContentRef.current = serialized
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        if (moduleId) {
          void updateModuleContent(resumeId, moduleId, content)
            .then(() => {
              committedContentRef.current = serialized
            })
            .finally(() => {
              if (pendingContentRef.current === serialized) {
                pendingContentRef.current = null
              }
            })
        }
      }, 1500)
    },
    [resumeId, moduleId, updateModuleContent]
  )

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pendingContentRef.current = null
  }, [])

  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
  }, [])

  return { save, flush, markSaved }
}
