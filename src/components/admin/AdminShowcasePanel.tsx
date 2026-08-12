import { useMemo } from 'react'
import type { ResumeShowcaseAdmin } from '../../api/admin'
import type { ResumeListItem } from '../../api/resume'

interface AdminShowcasePanelProps {
  resumes: ResumeListItem[]
  showcases: ResumeShowcaseAdmin[]
  actionResumeId: number | null
  actionError: { resumeId: number; message: string } | null
  loading: boolean
  onFeature: (resume: ResumeListItem) => void
  onUnfeature: (resume: ResumeListItem) => void
}

function formatResumeDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function templateLabel(templateId: string) {
  return templateId && templateId !== 'default' ? templateId : '标准版'
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
  const showcaseByResumeId = useMemo(
    () => new Map(showcases.map((showcase) => [showcase.resumeId, showcase])),
    [showcases],
  )
  const resumeIds = useMemo(() => new Set(resumes.map((resume) => resume.id)), [resumes])
  const featuredCount = showcases.filter(
    (showcase) => resumeIds.has(showcase.resumeId) && showcase.publishStatus === 'PUBLISHED',
  ).length

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

            return (
              <article
                key={resume.id}
                aria-label={resume.title}
                className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-white transition ${
                  featured
                    ? 'border-primary-200 shadow-[0_16px_36px_-28px_rgba(29,78,216,0.7)]'
                    : 'border-slate-200'
                }`}
              >
                <div className="relative h-40 overflow-hidden bg-gradient-to-br from-primary-50 via-white to-sky-50 p-5">
                  <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary-200/50 blur-3xl" />
                  <div className="relative mx-auto flex h-full max-w-[210px] -rotate-1 flex-col rounded-xl border border-white bg-white/95 p-4 shadow-[0_16px_34px_rgba(15,23,42,0.12)]">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary-100" />
                      <div className="min-w-0 flex-1 space-y-2 pt-1">
                        <div className="h-2.5 w-3/4 rounded-full bg-slate-700" />
                        <div className="h-2 w-1/2 rounded-full bg-primary-200" />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="h-1.5 w-12 rounded-full bg-primary-500" />
                      <div className="h-2 rounded-full bg-slate-100" />
                      <div className="h-2 w-11/12 rounded-full bg-slate-100" />
                      <div className="h-2 w-4/5 rounded-full bg-slate-100" />
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="h-5 rounded-md bg-primary-50" />
                      <div className="h-5 rounded-md bg-primary-50" />
                      <div className="h-5 rounded-md bg-primary-50" />
                    </div>
                  </div>
                  <span className="absolute right-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
                    {templateLabel(resume.templateId)}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-slate-950" title={resume.title}>
                        {resume.title}
                      </h2>
                      <p className="mt-1 text-xs text-slate-400">
                        更新于 {formatResumeDate(resume.updatedAt)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      featured
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {featured ? '已精选' : '未精选'}
                    </span>
                  </div>

                  {featured && showcase ? (
                    <div className="mb-4 mt-4 rounded-xl bg-slate-50 p-4">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                          {showcase.scoreLabel}
                        </span>
                        {(showcase.tags ?? []).map((tag) => (
                          <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                        {showcase.summary}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-auto space-y-2">
                    <button
                      type="button"
                      onClick={() => featured ? onUnfeature(resume) : onFeature(resume)}
                      disabled={actionsDisabled}
                      aria-label={pending
                        ? `${featured ? '正在取消精选' : '正在使用 AI 生成精选信息'} ${resume.title}`
                        : `${featured ? '取消精选' : '精选'} ${resume.title}`}
                      aria-describedby={actionErrorMessage ? `showcase-action-error-${resume.id}` : undefined}
                      className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-wait disabled:opacity-55 ${
                        featured
                          ? 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                      }`}
                    >
                      {pending ? (featured ? '取消中…' : 'AI 生成中…') : (featured ? '取消精选' : '精选')}
                    </button>
                    {actionErrorMessage ? (
                      <p
                        id={`showcase-action-error-${resume.id}`}
                        role="alert"
                        className="text-sm text-red-600"
                      >
                        {actionErrorMessage}
                      </p>
                    ) : null}
                  </div>
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
    </section>
  )
}
