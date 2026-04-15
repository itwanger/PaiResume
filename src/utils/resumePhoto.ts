const BASIC_INFO_PHOTO_MAX_SIZE = 3 * 1024 * 1024

export const BASIC_INFO_PHOTO_MAX_SIZE_MB = Math.round(BASIC_INFO_PHOTO_MAX_SIZE / 1024 / 1024)

export function normalizePhotoSource(value: string | null | undefined) {
  const trimmed = value?.trim() || ''
  if (!trimmed) {
    return ''
  }

  if (/^(data:image\/|blob:|https?:\/\/|\/)/i.test(trimmed)) {
    return trimmed
  }

  return `https://${trimmed}`
}

export function isUploadedPhotoSource(value: string | null | undefined) {
  return /^data:image\//i.test(value?.trim() || '')
}

export async function readPhotoFileAsDataUrl(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择 PNG、JPG 或 WebP 等图片文件')
  }

  if (file.size > BASIC_INFO_PHOTO_MAX_SIZE) {
    throw new Error(`图片请控制在 ${BASIC_INFO_PHOTO_MAX_SIZE_MB}MB 以内`)
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string' && result.startsWith('data:image/')) {
        resolve(result)
        return
      }

      reject(new Error('读取图片失败，请换一张图片重试'))
    }

    reader.onerror = () => {
      reject(new Error('读取图片失败，请换一张图片重试'))
    }

    reader.readAsDataURL(file)
  })
}
