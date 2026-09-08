import { resumePhotoApi } from '../api/resumePhoto'
import type { ResumeModule } from '../api/resume'

// Keep image bytes in session memory, never signed URLs or localStorage. Eviction only
// drops our reference; a displayed image remains valid until its component is removed.
const sources = new Map<number, Promise<string>>()
let session = 0
const MAX_CACHED_PHOTOS = 24

export function clearPrivatePhotoCache() {
  session += 1
  sources.clear()
}

export function loadPrivatePhoto(photoId: number): Promise<string> {
  const existing = sources.get(photoId)
  if (existing) return existing
  const expectedSession = session
  const request = (async () => {
    const { data: blob } = await resumePhotoApi.content(photoId)
    if (expectedSession !== session) throw new Error('登录状态已变更')
    if (blob.size > 3 * 1024 * 1024 || !['image/png', 'image/jpeg'].includes(blob.type)) {
      throw new Error('照片格式不正确')
    }
    const source = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('照片读取失败，请重试'))
      reader.readAsDataURL(blob)
    })
    if (expectedSession !== session) throw new Error('登录状态已变更')
    return source
  })()
  sources.set(photoId, request)
  while (sources.size > MAX_CACHED_PHOTOS) sources.delete(sources.keys().next().value!)
  void request.catch(() => {
    if (sources.get(photoId) === request) sources.delete(photoId)
  })
  return request
}

export async function resolvePrivateModulePhotos(modules: ResumeModule[]) {
  return Promise.all(modules.map(async (module) => {
    // Masked/public previews must keep their placeholder, never fetch the private original.
    if (module.moduleType !== 'basic_info' || !module.content.photoId || module.content.privacyMasked) return module
    const photo = await loadPrivatePhoto(Number(module.content.photoId))
    return { ...module, content: { ...module.content, photo } }
  }))
}
