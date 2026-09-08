import { useResumePhotoSource } from '../../hooks/useResumePhotoSource'
import { useEffect, useRef, useState } from 'react'
import type { BasicInfoContent } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeBasicInfoContent } from '../../utils/moduleContent'
import {
  BASIC_INFO_PHOTO_MAX_SIZE_MB,
  isLegacyEmbeddedPhoto,
  inspectResumePhotoFile,
  normalizeExternalPhotoUrl,
  normalizePhotoSource,
} from '../../utils/resumePhoto'
import { ModuleSaveBar } from './ModuleSaveBar'
import { MaterialActions } from '../materials/MaterialActions'
import { getBasicInfoFieldError, type BasicInfoValidationKind } from '../../utils/basicInfoValidation'
import { resumePhotoApi } from '../../api/resumePhoto'
import { OptionalInfoSection } from '../ui/OptionalInfoSection'
import './BasicInfoForm.css'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
}

export function BasicInfoForm({ resumeId, moduleId, initialContent }: Props) {
  const [content, setContent, { saveNow, saveState, errorMessage, hasUnsavedChanges }] = useModuleContentState<BasicInfoContent>({
    resumeId,
    moduleId,
    initialContent,
    normalize: normalizeBasicInfoContent,
  })
  const [showOptionalFields, setShowOptionalFields] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const update = (field: keyof BasicInfoContent, value: string | boolean) => {
    setContent((prev) => ({ ...prev, [field]: value }))
  }

  const optionalFieldCount = [Boolean(content.photoId || content.photo), Boolean(content.targetCity.trim()), Boolean(content.leetcode.trim()), content.isPartyMember].filter(Boolean).length
  const privatePhoto = useResumePhotoSource(content.photoId, content.photo)
  const normalizedPhotoSource = normalizePhotoSource(photoPreviewUrl || privatePhoto.source)
  const photoUrlValue = content.photoId || isLegacyEmbeddedPhoto(content.photo) ? '' : content.photo

  useEffect(() => () => {
    if (photoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(photoPreviewUrl)
  }, [photoPreviewUrl])

  const handlePhotoUrlChange = (value: string) => {
    setPhotoError('')
    if (photoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoPreviewUrl('')
    setContent((previous) => ({
      ...previous,
      photo: value,
      photoId: null,
      photoWidth: null,
      photoHeight: null,
    }))
    setShowOptionalFields(true)
  }

  const normalizePhotoUrlInput = () => {
    if (!photoUrlValue.trim()) {
      setPhotoError('')
      return
    }
    const normalized = normalizeExternalPhotoUrl(photoUrlValue)
    if (!normalized) {
      setPhotoError('请输入有效的 http:// 或 https:// 图片链接')
      return
    }
    setPhotoError('')
    if (normalized !== photoUrlValue) {
      setContent((previous) => ({ ...previous, photo: normalized }))
    }
  }

  const handlePhotoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    let localPreviewUrl = ''
    try {
      setPhotoError('')
      setPhotoUploading(true)
      localPreviewUrl = URL.createObjectURL(file)
      setPhotoPreviewUrl(localPreviewUrl)
      const inspected = await inspectResumePhotoFile(file)
      const authorization = await resumePhotoApi.requestUpload({
        fileName: file.name,
        ...inspected,
      })
      await resumePhotoApi.upload(authorization.data.data, file)
      const completed = await resumePhotoApi.completeUpload(authorization.data.data.photoNo)
      const asset = completed.data.data
      setContent((previous) => ({
        ...previous,
        photo: asset.accessUrl,
        photoId: asset.id,
        photoWidth: asset.width,
        photoHeight: asset.height,
      }))
      URL.revokeObjectURL(localPreviewUrl)
      setPhotoPreviewUrl('')
      setShowOptionalFields(true)
    } catch (error: unknown) {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl)
      setPhotoPreviewUrl('')
      setPhotoError(error instanceof Error ? error.message : '读取图片失败，请稍后重试')
    } finally {
      setPhotoUploading(false)
    }
  }

  const clearPhoto = () => {
    setPhotoError('')
    if (photoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoPreviewUrl('')
    setContent((previous) => ({
      ...previous,
      photo: '',
      photoId: null,
      photoWidth: null,
      photoHeight: null,
    }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <ModuleSaveBar
        saveState={saveState}
        errorMessage={errorMessage}
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={saveNow}
      >
        <MaterialActions
          resumeId={resumeId}
          moduleType="basic_info"
          content={content}
          onApply={setContent}
          embedded
        />
      </ModuleSaveBar>

      <div className="editor-responsive-grid">
        <Field label="姓名" value={content.name} onChange={(v) => update('name', v)} />
        <Field label="邮箱" value={content.email} onChange={(v) => update('email', v)} />
        <Field label="求职意向" value={content.jobIntention} onChange={(v) => update('jobIntention', v)} />
        <Field label="手机号" value={content.phone} onChange={(v) => update('phone', v)} />
        <Field label="微信号" value={content.wechat} onChange={(v) => update('wechat', v)} />
        <Field label="籍贯" value={content.hometown} onChange={(v) => update('hometown', v)} />
        <Field label="工作年限" value={content.workYears} onChange={(v) => update('workYears', v)} />
        <Field label="GitHub" value={content.github} onChange={(v) => update('github', v)} />
        <Field label="博客" value={content.blog} onChange={(v) => update('blog', v)} />
      </div>
      <OptionalInfoSection id={`basic-optional-${moduleId}`} open={showOptionalFields}
        onToggle={() => setShowOptionalFields((current) => !current)} filledCount={optionalFieldCount}>
          <div className="basic-optional-layout px-4 pb-5 pt-3">
            <div className="basic-optional-photo">
              <div className={`aspect-[3/4] w-20 overflow-hidden rounded bg-gray-50 ${normalizedPhotoSource ? (content.photoBorder ? 'border border-primary-500' : '') : 'border border-dashed border-gray-200'}`}>
                {normalizedPhotoSource ? (
                  <img src={normalizedPhotoSource} alt="证件照预览" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
                      <circle cx="9" cy="9" r="2" strokeWidth="1.5" />
                      <path d="m3 17 5-5 4 4 4-5 5 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                    </svg>
                    <span className="text-xs">证件照</span>
                  </div>
                )}
              </div>
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" onChange={handlePhotoFileChange} className="hidden" aria-label="上传证件照" />
                  <button type="button" disabled={photoUploading} onClick={() => fileInputRef.current?.click()}
                    className="rounded border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50">
                    {photoUploading ? '上传并校验中…' : normalizedPhotoSource ? '更换照片' : '上传照片'}
                  </button>
                  {normalizedPhotoSource && <button type="button" onClick={clearPhoto}
                    className="rounded border border-gray-200 px-3 py-2 text-xs text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600">移除</button>}
                  <span className="text-xs text-gray-400">PNG/JPG · ≤ {BASIC_INFO_PHOTO_MAX_SIZE_MB}MB</span>
                </div>
                <div>
                  <label htmlFor={`basic-info-photo-url-${moduleId}`} className="mb-1.5 block text-xs font-medium text-gray-500">图片链接</label>
                  <input id={`basic-info-photo-url-${moduleId}`} type="url" inputMode="url" value={photoUrlValue}
                    onChange={(event) => handlePhotoUrlChange(event.target.value)} onBlur={normalizePhotoUrlInput}
                    placeholder="https://" aria-invalid={Boolean(photoError)}
                    className={`w-full rounded border bg-white px-3 py-2 text-sm outline-none transition-colors focus:ring-2 ${photoError ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-gray-200 hover:border-gray-300 focus:border-primary-400 focus:ring-primary-100'}`} />
                </div>
                <label className={`inline-flex items-center gap-2 text-xs ${normalizedPhotoSource ? 'text-gray-600' : 'text-gray-400'}`}>
                  <input type="checkbox" checked={content.photoBorder} disabled={!normalizedPhotoSource} onChange={(event) => update('photoBorder', event.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300 accent-primary-600" />
                  照片边框
                </label>
                {privatePhoto.error && <button type="button" onClick={privatePhoto.retry} className="block text-xs text-red-600">照片加载失败，重试</button>}
                {photoError && <p className="text-xs text-red-600" role="alert">{photoError}</p>}
              </div>
            </div>
            <div className="basic-optional-details space-y-4">
              <Field compact label="意向城市" value={content.targetCity} onChange={(value) => update('targetCity', value)} />
              <Field compact label="LeetCode" value={content.leetcode} onChange={(value) => update('leetcode', value)} />
              <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={content.isPartyMember} onChange={(event) => update('isPartyMember', event.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300 accent-primary-600" />
                党员
              </label>
            </div>
          </div>
      </OptionalInfoSection>
    </div>
  )
}

function Field({ label, value, onChange, compact = false }: { label: string; value: string; onChange: (v: string) => void; compact?: boolean }) {
  const validationKind: BasicInfoValidationKind | null = label === '邮箱' ? 'email' : label === '手机号' ? 'phone' : label === 'GitHub' || label === '博客' ? 'url' : null
  const inputType = validationKind === 'email' ? 'email' : validationKind === 'phone' ? 'tel' : validationKind === 'url' ? 'url' : 'text'
  const autoComplete = label === '姓名' ? 'name' : label === '邮箱' ? 'email' : label === '手机号' ? 'tel' : 'off'
  const validationError = validationKind ? getBasicInfoFieldError(validationKind, value) : ''
  return (
    <div>
      <label htmlFor={`basic-field-${label}`} className={compact ? "mb-1.5 block text-xs font-medium text-gray-500" : "block text-sm font-medium text-gray-700 mb-1"}>{label}</label>
      <input
        id={`basic-field-${label}`}
        type={inputType}
        autoComplete={autoComplete}
        inputMode={label === '手机号' ? 'tel' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(validationError)}
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${validationError ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : compact ? 'border-gray-200 hover:border-gray-300 focus:border-primary-400 focus:ring-primary-100' : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'}`}
      />
      {validationError ? <p className="mt-1 text-xs text-red-600" role="alert">{validationError}</p> : null}
    </div>
  )
}
