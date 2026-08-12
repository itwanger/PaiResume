import client, { type ApiEnvelope } from './client'

export interface ResumePhotoUploadRequest {
  fileName: string
  sizeBytes: number
  sha256: string
  contentType: 'image/png' | 'image/jpeg'
  width: number
  height: number
}

export interface ResumePhotoUploadCredential {
  photoNo: string
  uploadUrl: string
  method: 'POST'
  headers: Record<string, string>
  fields: Record<string, string>
  expiresAt: string
  maxSizeBytes: number
}

export interface ResumePhotoAsset {
  id: number
  photoNo: string
  contentType: 'image/png' | 'image/jpeg'
  sizeBytes: number
  width: number
  height: number
  accessUrl: string
  accessUrlExpiresAt: string
}

async function uploadToPrivateOss(credential: ResumePhotoUploadCredential, file: File) {
  if (credential.method !== 'POST') throw new Error('服务端返回了不支持的上传方式')
  const form = new FormData()
  Object.entries(credential.fields).forEach(([name, value]) => form.append(name, value))
  form.append('file', file, file.name)
  const response = await fetch(credential.uploadUrl, {
    method: credential.method,
    headers: credential.headers,
    body: form,
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  })
  if (!response.ok) throw new Error(`照片上传失败（HTTP ${response.status}）`)
}

export const resumePhotoApi = {
  requestUpload: (payload: ResumePhotoUploadRequest) =>
    client.post<ApiEnvelope<ResumePhotoUploadCredential>>('/resume-photos/uploads', payload),
  upload: uploadToPrivateOss,
  completeUpload: (photoNo: string) =>
    client.post<ApiEnvelope<ResumePhotoAsset>>(
      `/resume-photos/uploads/${encodeURIComponent(photoNo)}/complete`, {},
    ),
  access: (photoId: number) =>
    client.get<ApiEnvelope<ResumePhotoAsset>>(`/resume-photos/${photoId}/access`),
}
