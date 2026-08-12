const BASIC_INFO_PHOTO_MAX_SIZE = 3 * 1024 * 1024

export const BASIC_INFO_PHOTO_MAX_SIZE_MB = Math.round(BASIC_INFO_PHOTO_MAX_SIZE / 1024 / 1024)

const MAX_EXTERNAL_PHOTO_URL_LENGTH = 2048

export function normalizeExternalPhotoUrl(value: string | null | undefined) {
  const trimmed = value?.trim() || ''
  if (!trimmed || trimmed.length > MAX_EXTERNAL_PHOTO_URL_LENGTH) {
    return ''
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return ''
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(candidate)
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname || url.username || url.password) {
      return ''
    }
    return url.toString()
  } catch {
    return ''
  }
}

export function normalizePhotoSource(value: string | null | undefined) {
  const trimmed = value?.trim() || ''
  if (!trimmed) {
    return ''
  }

  if (/^(data:image\/|blob:|https?:\/\/|\/)/i.test(trimmed)) {
    if (/^(data:image\/|blob:|\/)/i.test(trimmed)) {
      return trimmed
    }
    return normalizeExternalPhotoUrl(trimmed)
  }

  return normalizeExternalPhotoUrl(trimmed)
}

/**
 * Public resume pages must not fetch seller-controlled remote images: doing so
 * would reveal a visitor's IP address and view time before they interact with
 * the resume. Uploaded raster images are embedded as data URLs, so they remain
 * safe to render in a public snapshot.
 */
export function normalizePublicPhotoSource(value: string | null | undefined) {
  const trimmed = value?.trim() || ''

  if (/^data:image\/(?:png|jpe?g);base64,/i.test(trimmed)) {
    return trimmed
  }

  return ''
}

export function isUploadedPhotoSource(value: string | null | undefined) {
  return /^(data:image\/|https:\/\/)/i.test(value?.trim() || '')
}

export function isLegacyEmbeddedPhoto(value: string | null | undefined) {
  return /^data:image\//i.test(value?.trim() || '')
}

export interface InspectedResumePhoto {
  contentType: 'image/png' | 'image/jpeg'
  sizeBytes: number
  sha256: string
  width: number
  height: number
}

export function detectRasterPhotoType(bytes: Uint8Array): InspectedResumePhoto['contentType'] | null {
  if (bytes.length >= 24
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return 'image/png'
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  return null
}

export async function inspectResumePhotoFile(file: File): Promise<InspectedResumePhoto> {
  if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
    throw new Error('请选择 PNG 或 JPG 图片文件')
  }
  if (file.size <= 0 || file.size > BASIC_INFO_PHOTO_MAX_SIZE) {
    throw new Error(`图片请控制在 ${BASIC_INFO_PHOTO_MAX_SIZE_MB}MB 以内`)
  }
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const detectedType = detectRasterPhotoType(bytes)
  if (!detectedType || detectedType !== file.type) {
    throw new Error('图片扩展名、类型或文件内容不一致')
  }
  const bitmap = await createImageBitmap(new Blob([buffer], { type: detectedType }))
  const { width, height } = bitmap
  bitmap.close()
  if (width <= 0 || height <= 0 || width > 4096 || height > 4096 || width * height > 16_000_000) {
    throw new Error('图片尺寸不能超过 4096×4096，且总像素不能超过 1600 万')
  }
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const sha256 = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
  return { contentType: detectedType, sizeBytes: file.size, sha256, width, height }
}
