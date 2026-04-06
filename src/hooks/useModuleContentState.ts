import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useAutoSave } from './useAutoSave'
import { areModuleContentsEqual } from '../utils/moduleContent'

interface Options<T extends object> {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
  normalize: (content: Record<string, unknown>) => T
}

export function useModuleContentState<T extends object>({
  resumeId,
  moduleId,
  initialContent,
  normalize,
}: Options<T>): [T, Dispatch<SetStateAction<T>>] {
  const [content, setContent] = useState<T>(() => normalize(initialContent))
  const skipNextSaveRef = useRef(true)
  const { save, markSaved } = useAutoSave(resumeId, moduleId)

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

  return [content, setContent]
}
