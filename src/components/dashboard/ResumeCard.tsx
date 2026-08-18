import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ResumeCardPreview, ResumeListItem } from '../../api/resume'
import { buildResumeEditorPath } from '../../config/site'
import type { ResumePdfAccentPreset, ResumePdfHeadingStyle, ResumePdfTemplateId } from '../../utils/resumePdf'
import { normalizeResumeStyle, type ResumeStyleSource } from '../../utils/resumeStyle'

interface ResumeCardProps {
  resume: ResumeListItem
  onDelete: (id: number) => void
  onRename: (resume: ResumeListItem) => void
}

export const EMPTY_RESUME_CARD_PREVIEW: ResumeCardPreview = {
  name: '',
  targetRole: '',
  basicInfo: '',
  education: '',
  experience: '',
  project: '',
  educations: [],
  experiences: [],
  projects: [],
  skills: [],
  moduleCounts: {},
  filledModuleCount: 0,
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

const densityLabels = {
  normal: '标准模式',
  compact: '紧凑模式',
} as const

const pageModeLabels = {
  standard: '标准分页',
  continuous: '智能一页',
} as const

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

export function ResumeContentThumbnail({ preview, resume }: { preview: ResumeCardPreview; resume: ResumeStyleSource }) {
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
    ? 'bg-orange-50/50'
    : style.templateId === 'slate' || style.templateId === 'executive'
      ? 'bg-slate-50'
      : style.templateId === 'campus-blue' || style.templateId === 'focus'
        ? 'bg-blue-50/45'
        : 'bg-white'
  const hasContent = preview.filledModuleCount > 0
  const basicInfo = preview.basicInfo || preview.targetRole
  const experienceLabel = (preview.moduleCounts?.work_experience || 0) > 0 ? '工作经历' : '实习经历'
  const educations = preview.educations?.length ? preview.educations : preview.education ? [preview.education] : []
  const experiences = preview.experiences?.length ? preview.experiences : preview.experience ? [preview.experience] : []
  const projects = preview.projects?.length
    ? preview.projects
    : preview.project
      ? [{ title: preview.project, description: '' }]
      : []
  const mastheadClassName = style.templateId === 'executive'
    ? 'bg-slate-800 text-white'
    : style.templateId === 'campus-blue'
      ? 'bg-blue-700 text-white'
      : headingStyle === 'filled'
        ? palette.soft
        : ''
  const mastheadValueClassName = style.templateId === 'executive' || style.templateId === 'campus-blue'
    ? 'text-white/80'
    : 'text-slate-600'
  const sectionHeadingClassName = headingStyle === 'filled'
    ? `${palette.soft} rounded-sm px-1.5 py-0.5`
    : headingStyle === 'bar'
      ? `border-l-2 ${palette.bar} pl-1.5`
      : `border-b ${palette.border} pb-0.5`

  const renderListSection = (label: string, values: string[]) => (
    <div className="min-w-0">
      <div className={`mb-0.5 text-[8px] font-bold leading-3 ${palette.strongText} ${sectionHeadingClassName}`}>
        {label}
      </div>
      <div className="space-y-0.5">
        {values.length ? values.map((value, index) => (
          <div key={`${value}-${index}`} className="flex min-w-0 items-start gap-1">
            {values.length > 1 ? <span className={`mt-[5px] h-1 w-1 shrink-0 rounded-full ${palette.dot}`} /> : null}
            <p className="min-w-0 truncate text-[7px] leading-3 text-slate-600">{value}</p>
          </div>
        )) : <p className="text-[7px] leading-3 text-slate-400">待完善</p>}
      </div>
    </div>
  )

  return (
    <div
      className={`relative mb-4 w-full shrink-0 overflow-hidden ${hasContent ? '' : 'h-40'} ${surfaceClassName}`}
      data-template-id={style.templateId}
      data-accent-preset={accent}
      data-heading-style={headingStyle}
      data-density={style.density}
      data-page-mode={style.pageMode}
      aria-label={hasContent
        ? `简历内容概览：基本信息、教育背景、专业技能${experiences.length ? `、${experienceLabel}` : ''}${projects.length ? '和项目' : ''}`
        : '空白简历，尚未填写内容'}
    >
      <div className={`flex flex-col overflow-hidden ${hasContent ? '' : 'h-full'}`}>
        {hasContent ? (
          <>
            <div className={`px-3 py-2 ${mastheadClassName || headingClassName}`}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-[9px] font-bold leading-3">基本信息</span>
                <span className={`min-w-0 flex-1 truncate text-[8px] leading-3 ${mastheadValueClassName}`}>
                  {basicInfo || '求职方向待完善'}
                </span>
                <span className={`shrink-0 text-[7px] ${mastheadValueClassName}`}>
                  {preview.filledModuleCount} 个模块
                </span>
              </div>
            </div>

            <div className={`flex min-h-0 flex-col overflow-hidden px-3 py-2 ${style.density === 'compact' ? 'gap-1' : 'gap-1.5'}`}>
              {renderListSection('教育背景', educations.slice(0, 2))}

              <section className="min-w-0">
                <div className={`mb-0.5 text-[8px] font-bold leading-3 ${palette.strongText} ${sectionHeadingClassName}`}>
                  专业技能
                </div>
                <div className="space-y-0.5">
                  {preview.skills.length ? preview.skills.slice(0, 2).map((skill) => (
                    <div key={skill} className="flex min-w-0 items-center gap-1">
                      <span className={`h-1 w-1 shrink-0 rounded-full ${palette.dot}`} />
                      <p className="min-w-0 truncate text-[7px] leading-3 text-slate-600">{skill}</p>
                    </div>
                  )) : <p className="text-[7px] leading-3 text-slate-400">待完善</p>}
                </div>
              </section>

              {experiences.length ? (
                <section className="min-h-0 min-w-0 overflow-hidden">
                  <div className={`mb-0.5 text-[8px] font-bold leading-3 ${palette.strongText} ${sectionHeadingClassName}`}>
                    {experienceLabel}
                  </div>
                  <div className="grid min-w-0 grid-cols-2 gap-x-3">
                    {experiences.slice(0, 2).map((experience, index) => {
                      const project = projects[index]
                      return (
                        <div key={`${experience}-${index}`} className="min-w-0">
                          <p className="truncate text-[7px] font-semibold leading-[10px] text-slate-700">{experience}</p>
                          {project?.title ? <p className="truncate text-[7px] leading-[10px] text-slate-600">{project.title}</p> : null}
                          {project?.description ? <p className="truncate text-[6px] leading-[9px] text-slate-500">{project.description}</p> : null}
                        </div>
                      )
                    })}
                  </div>
                </section>
              ) : projects.length ? (
                <section className="min-h-0 min-w-0 overflow-hidden">
                  <div className={`mb-0.5 text-[8px] font-bold leading-3 ${palette.strongText} ${sectionHeadingClassName}`}>项目经历</div>
                  <div className="grid grid-cols-2 gap-x-3">
                    {projects.slice(0, 2).map((project, index) => (
                      <div key={`${project.title}-${index}`} className="min-w-0">
                        <p className="truncate text-[7px] font-semibold leading-[10px] text-slate-700">{project.title}</p>
                        <p className="truncate text-[6px] leading-[9px] text-slate-500">{project.description}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </>
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

function getResumeCardStyleSummary(resume: ResumeListItem) {
  const style = normalizeResumeStyle(resume)
  const styleLabel = style.accentPreset === 'auto'
    ? templateLabels[style.templateId]
    : `${templateLabels[style.templateId]} · ${accentLabels[style.accentPreset]}`

  return `${densityLabels[style.density]} · ${pageModeLabels[style.pageMode]} · ${styleLabel}`
}

export function ResumeCardStyleSummary({
  resume,
  className = '',
}: {
  resume: ResumeListItem
  className?: string
}) {
  const summary = getResumeCardStyleSummary(resume)
  return <span className={className} title={summary}>{summary}</span>
}

export function ResumeCard({ resume, onDelete, onRename }: ResumeCardProps) {
  const navigate = useNavigate()
  const preview = resume.preview || EMPTY_RESUME_CARD_PREVIEW
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

  const styleSummary = getResumeCardStyleSummary(resume)

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

      <footer className="mt-auto min-w-0 text-xs text-gray-400">
        <span
          className="block whitespace-normal break-words leading-5 text-gray-500"
          title={styleSummary}
        >
          {styleSummary}
        </span>
        <div className="mt-1 flex items-center justify-between gap-3">
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
        </div>
      </footer>
    </article>
  )
}
