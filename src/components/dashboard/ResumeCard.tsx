import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ResumeCardPreview, ResumeListItem } from '../../api/resume'
import { buildResumeEditorPath } from '../../config/site'
import type { ResumePdfAccentPreset, ResumePdfHeadingStyle, ResumePdfTemplateId } from '../../utils/resumePdf'
import { normalizeResumeStyle, type ResumeStyleSource } from '../../utils/resumeStyle'
import { getResumeStyleSummary } from '../../utils/resumeStyleLabels'

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
  workExperiences: [],
  internships: [],
  projects: [],
  skills: [],
  moduleCounts: {},
  moduleOrder: [],
  filledModuleCount: 0,
}

type ThumbnailAccent = Exclude<ResumePdfAccentPreset, 'auto'>
type ThumbnailSectionKey = 'education' | 'skill' | 'internship' | 'work_experience' | 'project'
type ThumbnailHeadingVariant = Exclude<ResumePdfHeadingStyle, 'auto'> | 'plain'

const templateDefaultAccents: Record<ResumePdfTemplateId, ThumbnailAccent> = {
  default: 'blue',
  compact: 'blue',
  accent: 'blue',
  'campus-blue': 'blue',
  'technical-black': 'slate',
  'vibe-resume': 'blue',
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
  solid: string
}> = {
  blue: {
    text: 'text-blue-700', strongText: 'text-blue-900', border: 'border-blue-200', bar: 'border-blue-600', dot: 'bg-blue-600',
    soft: 'bg-blue-50/75', chip: 'bg-blue-50 text-blue-700', ring: 'ring-blue-200', solid: 'bg-blue-700',
  },
  slate: {
    text: 'text-slate-600', strongText: 'text-slate-900', border: 'border-slate-300', bar: 'border-slate-600', dot: 'bg-slate-600',
    soft: 'bg-slate-100/80', chip: 'bg-slate-100 text-slate-700', ring: 'ring-slate-300', solid: 'bg-slate-800',
  },
  warm: {
    text: 'text-amber-700', strongText: 'text-amber-900', border: 'border-orange-200', bar: 'border-amber-700', dot: 'bg-amber-700',
    soft: 'bg-orange-50/80', chip: 'bg-orange-50 text-amber-800', ring: 'ring-orange-200', solid: 'bg-amber-800',
  },
  emerald: {
    text: 'text-emerald-700', strongText: 'text-emerald-900', border: 'border-emerald-200', bar: 'border-emerald-600', dot: 'bg-emerald-600',
    soft: 'bg-emerald-50/75', chip: 'bg-emerald-50 text-emerald-700', ring: 'ring-emerald-200', solid: 'bg-emerald-700',
  },
}

function resolveThumbnailHeadingStyle(templateId: ResumePdfTemplateId, headingStyle: ResumePdfHeadingStyle): ThumbnailHeadingVariant {
  if (headingStyle !== 'auto') return headingStyle
  if (templateId === 'minimal') return 'plain'
  if (templateId === 'campus-blue' || templateId === 'executive' || templateId === 'slate') return 'filled'
  if (templateId === 'focus') return 'bar'
  return 'underline'
}

function skillVisualWidth(value: string) {
  return Array.from(value).reduce((width, character) => width + (character.charCodeAt(0) <= 0x7f ? 1 : 2), 0)
}

function packSkillPreviewRows(skills: string[]) {
  const values = Array.from(new Set(skills.map((skill) => skill.trim()).filter(Boolean)))
  if (values.length <= 2) return values

  let bestSplit = 1
  let bestDistance = Number.POSITIVE_INFINITY
  for (let split = 1; split < values.length; split += 1) {
    const left = values.slice(0, split).join('；')
    const right = values.slice(split).join('；')
    const distance = Math.abs(skillVisualWidth(left) - skillVisualWidth(right))
    if (distance < bestDistance) {
      bestDistance = distance
      bestSplit = split
    }
  }
  return [values.slice(0, bestSplit).join('；'), values.slice(bestSplit).join('；')]
}

export function ResumeContentThumbnail({ preview, resume }: { preview: ResumeCardPreview; resume: ResumeStyleSource }) {
  const style = normalizeResumeStyle(resume)
  const isCompact = style.density === 'compact'
  const accent = style.accentPreset === 'auto' ? templateDefaultAccents[style.templateId] : style.accentPreset
  const palette = accentClasses[accent]
  const headingStyle = resolveThumbnailHeadingStyle(style.templateId, style.headingStyle)
  const surfaceClassName = 'bg-white'
  const hasContent = preview.filledModuleCount > 0
  const basicInfo = preview.basicInfo || preview.targetRole
  const workExperienceCount = preview.moduleCounts?.work_experience || 0
  const internshipCount = preview.moduleCounts?.internship || 0
  const educations = preview.educations?.length ? preview.educations : preview.education ? [preview.education] : []
  const legacyExperiences = preview.experiences?.length ? preview.experiences : preview.experience ? [preview.experience] : []
  const workExperiences = preview.workExperiences?.length
    ? preview.workExperiences
    : workExperienceCount > 0 && internshipCount === 0
      ? legacyExperiences
      : []
  const internships = preview.internships?.length
    ? preview.internships
    : internshipCount > 0 && workExperienceCount === 0
      ? legacyExperiences
      : []
  const projects = preview.projects?.length
    ? preview.projects
    : preview.project
      ? [{ title: preview.project, description: '' }]
      : []
  const projectResponsibilities = projects
    .map((project) => [project.title, project.description].filter(Boolean).join('：'))
    .filter(Boolean)
  const skillRows = packSkillPreviewRows(preview.skills)
  const sectionLabels: Record<ThumbnailSectionKey, string> = {
    education: '教育背景',
    skill: '专业技能',
    internship: '实习经历',
    work_experience: '工作经历',
    project: '项目经历',
  }
  const availableSections = new Set<ThumbnailSectionKey>([
    ...(educations.length ? ['education' as const] : []),
    ...(skillRows.length ? ['skill' as const] : []),
    ...(internships.length ? ['internship' as const] : []),
    ...(workExperiences.length ? ['work_experience' as const] : []),
    ...(projectResponsibilities.length ? ['project' as const] : []),
  ])
  const defaultSectionOrder: ThumbnailSectionKey[] = ['education', 'skill', 'internship', 'work_experience', 'project']
  const orderedSections = Array.from(new Set([
    ...(preview.moduleOrder ?? []).filter((moduleType): moduleType is ThumbnailSectionKey => (
      defaultSectionOrder.includes(moduleType as ThumbnailSectionKey)
    )),
    ...defaultSectionOrder,
  ])).filter((moduleType) => availableSections.has(moduleType))
  const visibleSections = ['基本信息', ...orderedSections.map((moduleType) => sectionLabels[moduleType])]
  const mastheadClassName = style.templateId === 'executive'
    ? `${palette.solid} text-white`
    : style.templateId === 'campus-blue'
      ? 'bg-blue-700 text-white'
      : style.templateId === 'technical-black'
        ? 'border-b border-slate-800 bg-white text-slate-900'
      : style.templateId === 'vibe-resume'
        ? 'border-b-2 border-blue-500 bg-white text-slate-900'
        : ''
  const mastheadVariantClassName = style.templateId === 'executive'
    ? 'resume-content-thumbnail__masthead--dark'
    : style.templateId === 'campus-blue'
      ? 'resume-content-thumbnail__masthead--brand'
      : style.templateId === 'technical-black'
        ? 'resume-content-thumbnail__masthead--monochrome'
        : style.templateId === 'warm'
          ? 'resume-content-thumbnail__masthead--warm'
          : 'resume-content-thumbnail__masthead--plain'
  const mastheadValueClassName = style.templateId === 'executive' || style.templateId === 'campus-blue'
    ? 'text-white/80'
    : 'text-slate-600'
  const usesSoftFilledHeading = headingStyle === 'filled'
    && style.headingStyle === 'auto'
    && (style.templateId === 'campus-blue' || style.templateId === 'slate')
  const sectionHeadingClassName = headingStyle === 'filled'
    ? `${usesSoftFilledHeading ? palette.soft : `${palette.solid} text-white`} rounded-sm px-1.5 ${isCompact ? 'py-px' : 'py-0.5'}`
    : headingStyle === 'underline'
      ? `${style.templateId === 'vibe-resume' ? 'border-b-2' : 'border-b'} ${palette.border} pb-0.5`
      : ''
  const sectionHeadingTextClassName = headingStyle === 'filled' && !usesSoftFilledHeading
    ? 'text-white'
    : palette.strongText
  const sectionContainerClassName = headingStyle === 'bar'
    ? `border-l-2 ${palette.bar} pl-1.5`
    : style.templateId === 'slate' && style.headingStyle === 'auto'
      ? 'bg-slate-50 px-1.5 py-1'
      : ''
  const mastheadPaddingClassName = isCompact ? 'px-2.5 py-1.5' : 'px-3 py-2'
  const bodyPaddingClassName = isCompact ? 'px-2.5 py-1.5' : 'px-3 py-2'
  const sectionGapClassName = isCompact ? 'gap-0.5' : 'gap-1.5'
  const titleSizeClassName = isCompact ? 'text-[9px] leading-3' : 'text-[10px] leading-4'
  const metaSizeClassName = isCompact ? 'text-[6.5px] leading-[10px]' : 'text-[7.5px] leading-3'
  const sectionTitleSizeClassName = isCompact ? 'text-[7px] leading-[10px]' : 'text-[8px] leading-3'
  const bodySizeClassName = isCompact ? 'text-[6.5px] leading-[10px]' : 'text-[7px] leading-3'
  const bulletMarginClassName = isCompact ? 'mt-[3px]' : 'mt-[5px]'
  const displayName = preview.name || preview.targetRole || '基本信息'
  const displayRole = preview.name ? preview.targetRole : ''

  const renderListSection = (label: string, values: string[]) => (
    <section className={`resume-content-thumbnail__section min-w-0 ${sectionContainerClassName}`} data-section-label={label}>
      <h3 className={`resume-content-thumbnail__section-heading resume-content-thumbnail__section-heading--${headingStyle} ${isCompact ? 'mb-px' : 'mb-0.5'} font-bold ${sectionTitleSizeClassName} ${sectionHeadingTextClassName} ${sectionHeadingClassName}`}>
        {label}
      </h3>
      <div className={isCompact ? 'space-y-px' : 'space-y-0.5'}>
        {values.length ? values.map((value, index) => (
          <div key={`${value}-${index}`} className="flex min-w-0 items-start gap-1">
            {values.length > 1 ? <span className={`resume-content-thumbnail__bullet ${bulletMarginClassName} h-1 w-1 shrink-0 rounded-full ${palette.dot}`} /> : null}
            <p className={`resume-content-thumbnail__body min-w-0 break-words text-slate-600 ${bodySizeClassName}`}>{value}</p>
          </div>
        )) : <p className={`text-slate-400 ${bodySizeClassName}`}>待完善</p>}
      </div>
    </section>
  )

  const renderResponsibilitySection = (label: string, values: string[]) => values.length ? (
    <section className={`resume-content-thumbnail__section min-h-0 min-w-0 overflow-hidden ${sectionContainerClassName}`} data-section-label={label}>
      <h3 className={`resume-content-thumbnail__section-heading resume-content-thumbnail__section-heading--${headingStyle} ${isCompact ? 'mb-px' : 'mb-0.5'} font-bold ${sectionTitleSizeClassName} ${sectionHeadingTextClassName} ${sectionHeadingClassName}`}>
        {label}
      </h3>
      <ul className={isCompact ? 'space-y-px' : 'space-y-0.5'}>
        {values.slice(0, 2).map((value, index) => (
          <li key={`${label}-${value}-${index}`} className="flex min-w-0 items-start gap-1">
            <span className={`resume-content-thumbnail__bullet ${bulletMarginClassName} h-1 w-1 shrink-0 rounded-full ${palette.dot}`} aria-hidden="true" />
            <p className={`resume-content-thumbnail__body resume-content-thumbnail__responsibility min-w-0 break-words text-slate-600 ${bodySizeClassName}`}>{value}</p>
          </li>
        ))}
      </ul>
    </section>
  ) : null

  const renderSection = (moduleType: ThumbnailSectionKey) => {
    switch (moduleType) {
      case 'education':
        return renderListSection(sectionLabels.education, educations.slice(0, 2))
      case 'skill':
        return (
          <section className={`resume-content-thumbnail__section min-w-0 ${sectionContainerClassName}`} data-section-label={sectionLabels.skill}>
            <h3 className={`resume-content-thumbnail__section-heading resume-content-thumbnail__section-heading--${headingStyle} ${isCompact ? 'mb-px' : 'mb-0.5'} font-bold ${sectionTitleSizeClassName} ${sectionHeadingTextClassName} ${sectionHeadingClassName}`}>
              {sectionLabels.skill}
            </h3>
            <div className={isCompact ? 'space-y-px' : 'space-y-0.5'}>
              {skillRows.slice(0, 2).map((skill, index) => (
                <div key={`${skill}-${index}`} className="flex min-w-0 items-start gap-1">
                  <span className={`resume-content-thumbnail__bullet ${bulletMarginClassName} h-1 w-1 shrink-0 rounded-full ${palette.dot}`} />
                  <p className={`resume-content-thumbnail__body min-w-0 truncate whitespace-nowrap text-slate-600 ${bodySizeClassName}`}>{skill}</p>
                </div>
              ))}
            </div>
          </section>
        )
      case 'internship':
        return renderResponsibilitySection(sectionLabels.internship, internships)
      case 'work_experience':
        return renderResponsibilitySection(sectionLabels.work_experience, workExperiences)
      case 'project':
        return renderResponsibilitySection(sectionLabels.project, projectResponsibilities)
    }
  }

  return (
    <div
      className={`resume-content-thumbnail relative mb-4 w-full shrink-0 overflow-hidden ${hasContent ? '' : 'h-40'} ${surfaceClassName}`}
      data-thumbnail-renderer="lightweight-template"
      data-template-id={style.templateId}
      data-accent-preset={accent}
      data-heading-style={headingStyle}
      data-density={style.density}
      data-page-mode={style.pageMode}
      aria-label={hasContent
        ? `简历内容概览：${visibleSections.join('、')}`
        : '空白简历，尚未填写内容'}
    >
      <div className={`flex flex-col overflow-hidden ${hasContent ? '' : 'h-full'}`}>
        {hasContent ? (
          <>
            <div
              className={`resume-content-thumbnail__masthead ${mastheadVariantClassName} ${mastheadPaddingClassName} ${mastheadClassName}`}
              aria-label="简历缩略图抬头"
            >
              <div className={`flex min-w-0 items-baseline ${isCompact ? 'gap-1.5' : 'gap-2'}`}>
                <span className={`resume-content-thumbnail__masthead-label min-w-0 truncate font-bold ${titleSizeClassName}`}>{displayName}</span>
                {displayRole ? (
                  <span className={`resume-content-thumbnail__masthead-role min-w-0 flex-1 truncate ${mastheadValueClassName} ${metaSizeClassName}`}>
                    {displayRole}
                  </span>
                ) : null}
              </div>
              {basicInfo && basicInfo !== displayRole ? (
                <p className={`resume-content-thumbnail__masthead-value mt-0.5 truncate ${mastheadValueClassName} ${metaSizeClassName}`}>
                  {basicInfo}
                </p>
              ) : null}
            </div>

            <div
              className={`resume-content-thumbnail__sections resume-content-thumbnail__sections--${style.density} flex min-h-0 flex-col overflow-hidden ${bodyPaddingClassName} ${sectionGapClassName}`}
              data-section-order={orderedSections.join(',')}
              aria-label="简历缩略图内容区"
            >
              {orderedSections.map((moduleType) => (
                <div key={moduleType}>{renderSection(moduleType)}</div>
              ))}
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

function getResumeCardStyleSummary(resume: ResumeStyleSource) {
  return getResumeStyleSummary(resume)
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
      className={`group relative flex cursor-pointer flex-col rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-primary-300 hover:shadow-md ${menuOpen ? 'z-20' : ''}`}
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
