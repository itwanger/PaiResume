import { useEffect, useMemo, useState } from 'react'
import type { ResumeShowcaseAccessType, ResumeShowcaseAdmin } from '../../api/admin'
import type { ResumeListItem } from '../../api/resume'
import {
  EMPTY_RESUME_CARD_PREVIEW,
  ResumeCardStyleSummary,
  ResumeContentThumbnail,
} from '../dashboard/ResumeCard'
import { getResumeStyleFeatureLabels } from '../../utils/resumeStyleLabels'
import { getShowcaseAccessLabel } from '../../utils/showcaseAccess'

interface AdminShowcasePanelProps {
  resumes: ResumeListItem[]
  showcases: ResumeShowcaseAdmin[]
  actionResumeId: number | null
  actionError: { resumeId: number; message: string } | null
  loading: boolean
  onFeature: (resume: ResumeListItem, accessType: ResumeShowcaseAccessType, priceCents: number) => void
  onUnfeature: (resume: ResumeListItem) => void
}

const accessOptions: Array<{
  value: ResumeShowcaseAccessType
  label: string
  badge: string
  description: string
}> = [
  {
    value: 'PUBLIC',
    label: '公开免费',
    badge: '无需登录',
    description: '所有人都能直接查看脱敏后的完整简历内容。',
  },
  {
    value: 'LOGIN',
    label: '登录查看',
    badge: '免费登录',
    description: '所有人都能查看介绍，登录后可查看脱敏后的完整简历。',
  },
  {
    value: 'PAID',
    label: '付费查看',
    badge: '付费解锁',
    description: '所有人都能查看介绍，单独购买这份简历后可查看脱敏后的完整内容。',
  },
]

function formatResumeDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function AdminShowcasePanel({
  resumes,
  showcases,
  actionResumeId,
  actionError,
  loading,
  onFeature,
  onUnfeature,
}: AdminShowcasePanelProps) {
  const [settingsResume, setSettingsResume] = useState<ResumeListItem | null>(null)
  const [accessType, setAccessType] = useState<ResumeShowcaseAccessType>('PUBLIC')
  const [priceYuan, setPriceYuan] = useState('')
  const [settingsError, setSettingsError] = useState('')
  const showcaseByResumeId = useMemo(
    () => new Map(showcases.map((showcase) => [showcase.resumeId, showcase])),
    [showcases],
  )
  const resumeIds = useMemo(() => new Set(resumes.map((resume) => resume.id)), [resumes])
  const featuredCount = showcases.filter(
    (showcase) => resumeIds.has(showcase.resumeId) && showcase.publishStatus === 'PUBLISHED',
  ).length

  useEffect(() => {
    if (!settingsResume) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsResume(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [settingsResume])

  const openSettings = (resume: ResumeListItem, showcase?: ResumeShowcaseAdmin) => {
    setSettingsResume(resume)
    setAccessType(showcase?.accessType ?? 'PUBLIC')
    setPriceYuan(showcase?.priceCents ? (showcase.priceCents / 100).toFixed(2) : '')
    setSettingsError('')
  }

  const submitSettings = () => {
    if (!settingsResume) return
    const priceCents = accessType === 'PAID' ? Math.round(Number(priceYuan) * 100) : 0
    if (accessType === 'PAID' && (!Number.isFinite(priceCents) || priceCents <= 0)) {
      setSettingsError('请设置这份简历的付费价格')
      return
    }
    onFeature(settingsResume, accessType, priceCents)
    setSettingsResume(null)
  }

  return (
    <section aria-busy={loading || actionResumeId !== null}>
      <p className="mb-5 text-sm text-slate-500">
        共 {resumes.length} 份简历 · 已精选 {featuredCount} 份
      </p>

      {resumes.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {resumes.map((resume) => {
            const showcase = showcaseByResumeId.get(resume.id)
            const featured = showcase?.publishStatus === 'PUBLISHED'
            const pending = actionResumeId === resume.id
            const actionsDisabled = loading || actionResumeId !== null
            const actionErrorMessage = actionError?.resumeId === resume.id
              ? actionError.message
              : null
            const styleLabels = getResumeStyleFeatureLabels(resume)

            return (
              <article
                key={resume.id}
                aria-label={resume.title}
                className={`flex h-full flex-col rounded-xl border bg-white p-5 transition ${
                  featured
                    ? 'border-primary-200 shadow-[0_16px_36px_-28px_rgba(29,78,216,0.7)]'
                    : 'border-slate-200'
                }`}
              >
                <h2 className="mb-4 break-words font-semibold leading-6 text-slate-950">
                  {resume.title}
                </h2>

                <ResumeContentThumbnail preview={resume.preview ?? EMPTY_RESUME_CARD_PREVIEW} resume={resume} />

                <div className="mb-4 text-xs leading-5 text-slate-500">
                  {!featured ? <ResumeCardStyleSummary resume={resume} className="block break-words" /> : null}
                  <p>更新于 {formatResumeDate(resume.updatedAt)}</p>
                </div>

                {featured && showcase ? (
                  <div className="mb-4 border-t border-slate-100 pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        showcase.accessType === 'PUBLIC'
                          ? 'bg-emerald-50 text-emerald-700'
                          : showcase.accessType === 'LOGIN'
                            ? 'bg-sky-50 text-sky-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}>
                        {showcase.accessType === 'PAID'
                          ? `付费查看 ¥${(showcase.priceCents / 100).toFixed(2)}`
                          : getShowcaseAccessLabel(showcase.accessType)}
                      </span>
                      <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                        已精选
                      </span>
                      {styleLabels.map((label) => (
                        <span key={label} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                          {label}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                      {showcase.summary}
                    </p>
                  </div>
                ) : null}

                <div className="mt-auto space-y-2">
                  {featured ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openSettings(resume, showcase)}
                        disabled={actionsDisabled}
                        aria-label={`设置 ${resume.title} 的查看方式`}
                        className="rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-wait disabled:opacity-55"
                      >
                        展示设置
                      </button>
                      <button
                        type="button"
                        onClick={() => onUnfeature(resume)}
                        disabled={actionsDisabled}
                        aria-label={`取消精选 ${resume.title}`}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-wait disabled:opacity-55"
                      >
                        {pending ? '取消中…' : '取消精选'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openSettings(resume, showcase)}
                      disabled={actionsDisabled}
                      aria-label={`精选 ${resume.title}`}
                      className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-wait disabled:opacity-55"
                    >
                      {pending ? 'AI 生成中…' : '精选'}
                    </button>
                  )}
                  {actionErrorMessage ? (
                    <p role="alert" className="text-sm text-red-600">
                      {actionErrorMessage}
                    </p>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
          暂无可精选简历
        </p>
      )}

      {settingsResume ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsResume(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="showcase-settings-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="showcase-settings-title" className="text-xl font-semibold text-slate-950">
                  精选设置
                </h2>
                <p className="mt-1 break-words text-sm text-slate-500">{settingsResume.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsResume(null)}
                aria-label="关闭精选设置"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <fieldset className="mt-6">
              <legend className="text-sm font-semibold text-slate-800">查看方式</legend>
              <div className="mt-3 grid gap-3">
                {accessOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                      accessType === option.value
                        ? 'border-primary-500 bg-primary-50/60 ring-1 ring-primary-500'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="showcase-access-type"
                      value={option.value}
                      checked={accessType === option.value}
                      onChange={() => setAccessType(option.value)}
                      className="mt-1 h-4 w-4 border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{option.label}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500 ring-1 ring-slate-200">
                          {option.badge}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-slate-600">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {accessType === 'PAID' ? (
              <label className="mt-5 block">
                <span className="text-sm font-semibold text-slate-800">单份解锁价格（元）</span>
                <input
                  type="number"
                  min="0.01"
                  max="10000"
                  step="0.01"
                  inputMode="decimal"
                  value={priceYuan}
                  onChange={(event) => {
                    setPriceYuan(event.target.value)
                    setSettingsError('')
                  }}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </label>
            ) : null}

            {settingsError ? <p className="mt-3 text-sm text-red-600" role="alert">{settingsError}</p> : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSettingsResume(null)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitSettings}
                className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700"
              >
                {showcaseByResumeId.get(settingsResume.id)?.publishStatus === 'PUBLISHED'
                  ? '保存设置'
                  : '确认精选'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
