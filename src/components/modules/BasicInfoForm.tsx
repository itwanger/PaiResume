import { useRef, useState } from 'react'
import type { BasicInfoContent } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeBasicInfoContent } from '../../utils/moduleContent'
import {
  BASIC_INFO_PHOTO_MAX_SIZE_MB,
  isUploadedPhotoSource,
  normalizePhotoSource,
  readPhotoFileAsDataUrl,
} from '../../utils/resumePhoto'
import { ModuleSaveBar } from './ModuleSaveBar'

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
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const update = (field: keyof BasicInfoContent, value: string | boolean) => {
    setContent((prev) => ({ ...prev, [field]: value }))
  }

  const hasOptionalFields = hasOptionalBasicInfoContent(content)
  const normalizedPhotoSource = normalizePhotoSource(content.photo)
  const usingUploadedPhoto = isUploadedPhotoSource(content.photo)

  const handlePhotoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    try {
      setPhotoError('')
      const dataUrl = await readPhotoFileAsDataUrl(file)
      update('photo', dataUrl)
      setShowOptionalFields(true)
    } catch (error: unknown) {
      setPhotoError(error instanceof Error ? error.message : '读取图片失败，请稍后重试')
    }
  }

  const handlePhotoUrlChange = (value: string) => {
    setPhotoError('')
    update('photo', value)
    if (value.trim()) {
      setShowOptionalFields(true)
    }
  }

  const clearPhoto = () => {
    setPhotoError('')
    update('photo', '')
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
      />

      <div className="grid grid-cols-2 gap-4">
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
        <div className="space-y-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">可选信息</p>
              <p className="mt-1 text-xs text-gray-500">填写这些内容可以补充求职偏好、照片和个人标签。</p>
            </div>
            <button
              type="button"
              onClick={() => setShowOptionalFields(false)}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              {hasOptionalFields ? '收起' : '取消'}
            </button>
          </div>

          <div className="grid gap-4 rounded-xl border border-gray-200 bg-white/90 p-4 lg:grid-cols-[minmax(0,1fr)_128px]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">照片</p>
                  <p className="mt-1 text-xs text-gray-500">
                    支持本地上传或直接填写图片 URL，建议使用 3:4 证件照比例，大小不超过 {BASIC_INFO_PHOTO_MAX_SIZE_MB}MB。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handlePhotoFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 transition hover:border-primary-300 hover:bg-primary-100"
                  >
                    选择文件
                  </button>
                  {content.photo && (
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
                <label className="mb-1 block text-sm font-medium text-gray-700">图片 URL</label>
                <input
                  type="text"
                  value={usingUploadedPhoto ? '' : content.photo}
                  onChange={(e) => handlePhotoUrlChange(e.target.value)}
                  placeholder={usingUploadedPhoto ? '当前使用的是已上传照片，可在这里改成 URL' : 'https://example.com/avatar.jpg'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />
                {usingUploadedPhoto ? (
                  <p className="mt-1 text-xs text-gray-500">当前使用的是本地上传照片。</p>
                ) : null}
              </div>

              {photoError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {photoError}
                </div>
              ) : null}
            </div>

            <div className="flex items-start justify-center lg:justify-end">
              <div className="aspect-[3/4] w-28 overflow-hidden border border-gray-200 bg-gradient-to-b from-slate-50 to-slate-100 shadow-sm">
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

          <div className="grid grid-cols-2 gap-4">
            <Field label="意向城市" value={content.targetCity} onChange={(v) => update('targetCity', v)} />
            <Field label="期望薪资" value={content.salaryRange} onChange={(v) => update('salaryRange', v)} />
            <Field label="到岗时间" value={content.expectedEntryDate} onChange={(v) => update('expectedEntryDate', v)} />
            <Field label="LeetCode" value={content.leetcode} onChange={(v) => update('leetcode', v)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">个人总结</label>
            <textarea
              value={content.summary}
              onChange={(e) => update('summary', e.target.value)}
              rows={4}
              placeholder="用 50-200 字概括你的核心优势、岗位方向和代表性成果"
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            />
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
    || content.salaryRange
    || content.expectedEntryDate
    || content.leetcode
    || content.summary
    || content.isPartyMember
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
      />
    </div>
  )
}
