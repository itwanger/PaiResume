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
import { SegmentedControl } from '../ui/SegmentedControl'

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
  const [showOptionalFields, setShowOptionalFields] = useState(() => hasOptionalBasicInfoContent(normalizeBasicInfoContent(initialContent)))
  const [photoError, setPhotoError] = useState('')
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const update = (field: keyof BasicInfoContent, value: string | boolean) => {
    setContent((prev) => ({ ...prev, [field]: value }))
  }

  const hasOptionalFields = hasOptionalBasicInfoContent(content)
  const normalizedPhotoSource = normalizePhotoSource(photoPreviewUrl || content.photo)
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
      {!showOptionalFields ? (
        <button
          type="button"
          onClick={() => setShowOptionalFields(true)}
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          + 添加可选信息
        </button>
      ) : (
        <div className="space-y-4 border-t border-gray-100 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-700">可选信息</p>
            </div>
            <button
              type="button"
              onClick={() => setShowOptionalFields(false)}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              {hasOptionalFields ? '收起' : '取消'}
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_148px] lg:items-start">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">照片</p>
                  <p className="mt-1 text-xs text-gray-500">
                    支持上传 PNG/JPG（不超过 {BASIC_INFO_PHOTO_MAX_SIZE_MB}MB），也可以使用图片链接。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handlePhotoFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={photoUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 transition hover:border-primary-300 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {photoUploading ? '上传并校验中…' : '选择文件'}
                  </button>
                  {normalizedPhotoSource && (
                    <button
                      type="button"
                      onClick={clearPhoto}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:border-red-200 hover:text-red-600"
                    >
                      移除
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="basic-info-photo-url" className="mb-1 block text-sm font-medium text-gray-700">
                  图片链接
                </label>
                <input
                  id="basic-info-photo-url"
                  type="url"
                  inputMode="url"
                  value={photoUrlValue}
                  onChange={(event) => handlePhotoUrlChange(event.target.value)}
                  onBlur={normalizePhotoUrlInput}
                  placeholder="https://example.com/photo.jpg"
                  aria-invalid={Boolean(photoError)}
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 ${
                    photoError
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                      : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                  }`}
                />
              </div>

              <div>
                <span className="mb-1 block text-sm font-medium text-gray-700">照片边框</span>
                <SegmentedControl
                  ariaLabel="照片边框"
                  value={content.photoBorder}
                  options={[
                    { label: '无边框', value: false, disabled: !normalizedPhotoSource },
                    { label: '有边框', value: true, disabled: !normalizedPhotoSource },
                  ]}
                  onChange={(value) => update('photoBorder', value)}
                />
              </div>

              {photoError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {photoError}
                </div>
              ) : null}
            </div>

            <div className="flex items-start justify-center lg:justify-end lg:pl-4">
              <div className={`aspect-[3/4] w-28 overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 shadow-sm ${
                normalizedPhotoSource
                  ? (content.photoBorder ? 'border border-primary-500' : '')
                  : 'border border-dashed border-gray-200'
              }`}>
                {normalizedPhotoSource ? (
                  <img
                    src={normalizedPhotoSource}
                    alt="证件照预览"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 7h6m-6 0a2 2 0 00-2 2v6m2-8a2 2 0 012-2m4 2a2 2 0 00-2-2m2 2v6m0 0a2 2 0 01-2 2m2-2H9m0 0a2 2 0 01-2-2m2 2v-2m3-5a2 2 0 100 4 2 2 0 000-4zm-5 9l2.5-2.5a1.5 1.5 0 012.121 0L15 17" />
                    </svg>
                    <span className="text-xs font-medium">照片预览</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="editor-responsive-grid">
            <Field label="意向城市" value={content.targetCity} onChange={(v) => update('targetCity', v)} />
            <Field label="LeetCode" value={content.leetcode} onChange={(v) => update('leetcode', v)} />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={content.isPartyMember}
              onChange={(e) => update('isPartyMember', e.target.checked)}
              className="rounded border-gray-300"
            />
            党员
          </label>
        </div>
      )}
    </div>
  )
}

function hasOptionalBasicInfoContent(content: BasicInfoContent) {
  return Boolean(
    content.photo
    || content.targetCity
    || content.leetcode
    || content.isPartyMember
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const validationKind: BasicInfoValidationKind | null = label === '邮箱' ? 'email' : label === '手机号' ? 'phone' : label === 'GitHub' || label === '博客' ? 'url' : null
  const inputType = validationKind === 'email' ? 'email' : validationKind === 'phone' ? 'tel' : validationKind === 'url' ? 'url' : 'text'
  const autoComplete = label === '姓名' ? 'name' : label === '邮箱' ? 'email' : label === '手机号' ? 'tel' : 'off'
  const validationError = validationKind ? getBasicInfoFieldError(validationKind, value) : ''
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={inputType}
        autoComplete={autoComplete}
        inputMode={label === '手机号' ? 'tel' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(validationError)}
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${validationError ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'}`}
      />
      {validationError ? <p className="mt-1 text-xs text-red-600" role="alert">{validationError}</p> : null}
    </div>
  )
}
