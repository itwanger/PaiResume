import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ResumeCardPreview, ResumeListItem } from '../../api/resume'
import { buildResumeEditorPath } from '../../config/site'
import type { ResumePdfAccentPreset, ResumePdfHeadingStyle, ResumePdfTemplateId } from '../../utils/resumePdf'
import { normalizeResumeStyle } from '../../utils/resumeStyle'

interface ResumeCardProps {
  resume: ResumeListItem
  onDelete: (id: number) => void
  onRename: (resume: ResumeListItem) => void
}

const emptyPreview: ResumeCardPreview = {
  name: '',
  targetRole: '',
  education: '',
  experience: '',
  project: '',
  skills: [],
  moduleCounts: {},
  filledModuleCount: 0,
}

const sectionLabels: Record<string, string> = {
  education: '教育',
  internship: '实习',
  work_experience: '工作',
  project: '项目',
  skill: '技能',
  paper: '论文',
  research: '科研',
  award: '获奖',
}

type ThumbnailAccent = Exclude<ResumePdfAccentPreset, 'auto'>

const templateLabels: Record<ResumePdfTemplateId, string> = {
  default: '正常标准',
  compact: '紧凑模式',
  accent: '蓝调重点',
  'campus-blue': '校园技术蓝',
  minimal: '极简留白',
  executive: '深色抬头',
  warm: '暖灰质感',
  slate: '冷灰技术',
  focus: '重点聚焦',
}

const accentLabels: Record<ThumbnailAccent, string> = {
  blue: '蓝调',
  slate: '石墨',
  warm: '暖棕',
  emerald: '森绿',
}

const templateDefaultAccents: Record<ResumePdfTemplateId, ThumbnailAccent> = {
  default: 'blue',
  compact: 'blue',
  accent: 'blue',
  'campus-blue': 'blue',
  minimal: 'slate',
  executive: 'slate',
  warm: 'warm',
  slate: 'slate',
  focus: 'blue',
}

const accentClasses: Record<ThumbnailAccent, {
  text: string
  strongText: string
  border: string
  bar: string
  dot: string
  soft: string
  chip: string
  ring: string
}> = {
  blue: {
    text: 'text-blue-700', strongText: 'text-blue-900', border: 'border-blue-200', bar: 'border-blue-600', dot: 'bg-blue-600',
    soft: 'bg-blue-50/75', chip: 'bg-blue-50 text-blue-700', ring: 'ring-blue-200',
  },
  slate: {
    text: 'text-slate-600', strongText: 'text-slate-900', border: 'border-slate-300', bar: 'border-slate-600', dot: 'bg-slate-600',
    soft: 'bg-slate-100/80', chip: 'bg-slate-100 text-slate-700', ring: 'ring-slate-300',
  },
  warm: {
    text: 'text-amber-700', strongText: 'text-amber-900', border: 'border-orange-200', bar: 'border-amber-700', dot: 'bg-amber-700',
    soft: 'bg-orange-50/80', chip: 'bg-orange-50 text-amber-800', ring: 'ring-orange-200',
  },
  emerald: {
    text: 'text-emerald-700', strongText: 'text-emerald-900', border: 'border-emerald-200', bar: 'border-emerald-600', dot: 'bg-emerald-600',
    soft: 'bg-emerald-50/75', chip: 'bg-emerald-50 text-emerald-700', ring: 'ring-emerald-200',
  },
}

function resolveThumbnailHeadingStyle(templateId: ResumePdfTemplateId, headingStyle: ResumePdfHeadingStyle) {
  if (headingStyle !== 'auto') return headingStyle
  if (templateId === 'campus-blue' || templateId === 'executive' || templateId === 'slate') return 'filled'
  if (templateId === 'focus') return 'bar'
  return 'underline'
}

function ResumeContentThumbnail({ preview, resume }: { preview: ResumeCardPreview; resume: ResumeListItem }) {
  const style = normalizeResumeStyle(resume)
  const accent = style.accentPreset === 'auto' ? templateDefaultAccents[style.templateId] : style.accentPreset
  const palette = accentClasses[accent]
  const headingStyle = resolveThumbnailHeadingStyle(style.templateId, style.headingStyle)
  const headingClassName = headingStyle === 'filled'
    ? palette.soft
    : headingStyle === 'bar'
      ? `border-l-4 ${palette.bar}`
      : `border-b ${palette.border}`
  const surfaceClassName = style.templateId === 'warm'
    ? 'bg-stone-50/55'
    : style.templateId === 'slate' || style.templateId === 'executive'
      ? 'bg-slate-50/70'
      : ''
  const summaryRows = [
    { label: '教育背景', value: preview.education },
    { label: '工作/实习', value: preview.experience },
    { label: '项目经历', value: preview.project },
  ].filter((item) => item.value)
  const moduleSummary = Object.entries(preview.moduleCounts || {})
    .filter(([type]) => type !== 'basic_info' && type !== 'job_intention')
    .map(([type, count]) => `${sectionLabels[type] || type}${count > 1 ? ` ${count}` : ''}`)
    .slice(0, 5)
  const hasContent = preview.filledModuleCount > 0

  return (
    <div
      className={`relative mb-4 h-40 w-full shrink-0 overflow-hidden ${surfaceClassName}`}
      data-template-id={style.templateId}
      data-accent-preset={accent}
      data-heading-style={headingStyle}
      data-density={style.density}
      aria-label={hasContent
        ? `简历内容概览：${preview.name || '姓名待填写'}，${preview.targetRole || '求职方向待填写'}，已填写 ${preview.filledModuleCount} 个模块`
        : '空白简历，尚未填写内容'}
    >
      <div className="flex h-full flex-col overflow-hidden">
        <div className={`${headingClassName} px-3 ${style.density === 'compact' ? 'py-1.5' : 'py-2'}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={`truncate text-[11px] font-bold leading-4 ${headingStyle === 'underline' ? 'text-slate-900' : palette.strongText}`}>
                {preview.name || '姓名待填写'}
              </p>
              <p className={`truncate text-[9px] leading-3.5 ${palette.text}`}>
                {preview.targetRole || '求职方向待填写'}
              </p>
            </div>
            <span className={`shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[8px] font-medium text-slate-500 ring-1 ${palette.ring}`}>
              {preview.filledModuleCount} 个模块
            </span>
          </div>
        </div>

        {hasContent ? (
          <div className="grid min-h-0 flex-1 grid-cols-[74px_minmax(0,1fr)]">
            <aside className="border-r border-slate-100 px-2 py-2">
              <p className="text-[8px] font-semibold tracking-wide text-slate-500">技能概览</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {preview.skills.length ? preview.skills.slice(0, style.density === 'compact' ? 6 : 5).map((skill) => (
                  <span key={skill} className={`max-w-full truncate rounded px-1 py-0.5 text-[7px] leading-3 ${palette.chip}`}>
                    {skill}
                  </span>
                )) : (
                  <span className="text-[7px] leading-3 text-slate-400">暂未填写技能</span>
                )}
              </div>
              {moduleSummary.length ? (
                <p className="mt-2 text-[7px] leading-3 text-slate-400">{moduleSummary.join(' · ')}</p>
              ) : null}
            </aside>

            <div className={`min-w-0 px-2.5 py-2 ${style.density === 'compact' ? 'space-y-1.5' : 'space-y-2'}`}>
              {summaryRows.length ? summaryRows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <div className="mb-0.5 flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${palette.dot}`} />
                    <span className="text-[8px] font-semibold leading-3 text-slate-600">{row.label}</span>
                  </div>
                  <p className="truncate pl-2.5 text-[8px] leading-3 text-slate-500">{row.value}</p>
                </div>
              )) : (
                <div className="h-full rounded bg-slate-50" aria-hidden="true" />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
            <div className="mb-2 grid w-full grid-cols-2 gap-1.5 opacity-70">
              <span className="h-1.5 rounded-full bg-slate-100" />
              <span className="h-1.5 rounded-full bg-slate-100" />
              <span className="h-1.5 rounded-full bg-slate-100" />
              <span className="h-1.5 rounded-full bg-slate-100" />
            </div>
            <p className="text-[9px] font-medium text-slate-500">尚未填写简历内容</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function ResumeCard({ resume, onDelete, onRename }: ResumeCardProps) {
  const navigate = useNavigate()
  const preview = resume.preview || emptyPreview
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const style = normalizeResumeStyle(resume)
  const styleLabel = style.accentPreset === 'auto'
    ? templateLabels[style.templateId]
    : `${templateLabels[style.templateId]} · ${accentLabels[style.accentPreset]}`

  return (
    <article
      onClick={() => navigate(buildResumeEditorPath(resume.id))}
      className={`group relative flex h-full min-h-72 cursor-pointer flex-col rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-primary-300 hover:shadow-md ${menuOpen ? 'z-20' : ''}`}
    >
      <h2
        className="mb-4 whitespace-normal break-words text-base font-semibold leading-6 text-gray-900 transition-colors group-hover:text-primary-600"
        title={resume.title}
      >
        {resume.title}
      </h2>

      <ResumeContentThumbnail preview={preview} resume={resume} />

      <footer className="mt-auto flex min-w-0 items-center gap-3 text-xs text-gray-400">
        <span className="min-w-0 flex-1 truncate">样式：{styleLabel}</span>
        <span className="shrink-0">更新于 {formatDate(resume.updatedAt)}</span>
        <div
          ref={menuRef}
          className="relative shrink-0"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            title="更多操作"
            aria-label={`“${resume.title}”的更多操作`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="19" cy="12" r="1.7" />
            </svg>
          </button>

          {menuOpen ? (
            <div
              role="menu"
              aria-label={`“${resume.title}”的简历操作`}
              className="absolute bottom-full right-0 z-30 mb-2 w-36 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onRename(resume)
                }}
                className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-700"
              >
                修改简历名
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onDelete(resume.id)
                }}
                className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                删除简历
              </button>
            </div>
          ) : null}
        </div>
      </footer>
    </article>
  )
}
