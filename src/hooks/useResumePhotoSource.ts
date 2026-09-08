import { useEffect, useState } from 'react'
import { loadPrivatePhoto } from '../utils/privateResumePhoto'
import { normalizePhotoSource } from '../utils/resumePhoto'

export function useResumePhotoSource(photoId: number | null | undefined, fallback?: string | null) {
  const [loaded, setLoaded] = useState<{ id: number; source: string } | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setError('')
    if (photoId) {
      void loadPrivatePhoto(photoId).then((source) => {
        if (active) setLoaded({ id: photoId, source })
      }).catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : '照片加载失败')
      })
    }
    return () => { active = false }
  }, [photoId, attempt])
  return {
    source: photoId ? (loaded?.id === photoId ? loaded.source : '') : normalizePhotoSource(fallback),
    error,
    retry: () => setAttempt((value) => value + 1),
  }
}
