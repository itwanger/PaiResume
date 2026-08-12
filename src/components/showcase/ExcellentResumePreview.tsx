import type { ReactNode } from 'react'
import type { ResumeModule } from '../../api/resume'
import type {
  BasicInfoContent,
  JobIntentionContent,
  ModuleType,
} from '../../types'
import {
  hasPaperContent,
  hasResearchContent,
  normalizeAwardContent,
  normalizeBasicInfoContent,
  normalizeEducationContent,
  normalizeInternshipContent,
  normalizeJobIntentionContent,
  normalizePaperContent,
  normalizeProjectContent,
  normalizeResearchContent,
  normalizeSkillContent,
} from '../../utils/moduleContent'
import { parseInlineMarkdownSegments } from '../../utils/inlineMarkdown'
import { normalizePublicPhotoSource } from '../../utils/resumePhoto'
import { normalizeInlineText } from '../../utils/resumeText'
import {
  getModuleDisplayLabel,
  sortResumeModulesForDisplay,
} from '../../utils/resumeDisplay'

interface ExcellentResumePreviewProps {
  modules: ResumeModule[]
}

interface ContactItem {
  label: string
  value: string
  href?: string
}

const SECTION_MODULE_TYPES = new Set<ModuleType>([
  'education',
  'internship',
  'work_experience',
  'project',
  'skill',
  'paper',
  'research',
  'award',
])

export function ExcellentResumePreview({ modules }: ExcellentResumePreviewProps) {
  const sortedModules = sortResumeModulesForDisplay(modules)
  const basicInfoModule = sortedModules.find((module) => module.moduleType === 'basic_info')
  const jobIntentionModule = sortedModules.find((module) => module.moduleType === 'job_intention')
  const basicInfo = basicInfoModule
    ? normalizeBasicInfoContent(basicInfoModule.content)
    : null
  const jobIntention = jobIntentionModule
    ? normalizeJobIntentionContent(jobIntentionModule.content)
    : null
  const sectionTypes = sortedModules.reduce<ModuleType[]>((types, module) => {
    const moduleType = module.moduleType as ModuleType

    if (SECTION_MODULE_TYPES.has(moduleType) && !types.includes(moduleType)) {
      types.push(moduleType)
    }

    return types
  }, [])

  return (
    <article
      aria-label="优质简历预览"
      className="mx-auto w-full max-w-[1120px] overflow-hidden border border-slate-200 bg-white text-[15px] leading-[1.72] text-slate-800 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.38)] print:max-w-none print:border-0 print:shadow-none"
    >
      <div className="px-5 pb-7 pt-6 sm:px-8 sm:pb-9 sm:pt-8 lg:px-11 lg:pt-10">
        <ResumeHeader
          basicInfo={basicInfo}
          jobIntention={jobIntention}
        />

        <div className="mt-7 space-y-6">
          {sectionTypes.map((moduleType) => (
            <ModuleGroup
              key={moduleType}
              moduleType={moduleType}
              modules={sortedModules.filter((module) => module.moduleType === moduleType)}
              basicInfo={basicInfo}
            />
          ))}
        </div>

        {sectionTypes.length === 0 && !basicInfoModule ? (
          <div className="py-16 text-center text-sm text-slate-400">
            暂无可展示的简历内容
          </div>
        ) : null}
      </div>
    </article>
  )
}

function ResumeHeader({
  basicInfo,
  jobIntention,
}: {
  basicInfo: BasicInfoContent | null
  jobIntention: JobIntentionContent | null
}) {
  const photoSource = normalizePublicPhotoSource(basicInfo?.photo)
  const targetPosition = jobIntention?.targetPosition || basicInfo?.jobIntention || ''
  const targetCity = jobIntention?.targetCity || basicInfo?.targetCity || ''
  const contactItems: ContactItem[] = [
    {
      label: '电话',
      value: basicInfo?.phone || '',
      href: basicInfo?.phone ? 'tel:' + basicInfo.phone : undefined,
    },
    {
      label: '邮箱',
      value: basicInfo?.email || '',
      href: basicInfo?.email ? 'mailto:' + basicInfo.email : undefined,
    },
    { label: '微信', value: basicInfo?.wechat || '' },
    { label: '求职意向', value: targetPosition },
    { label: '意向城市', value: targetCity },
    { label: '工作年限', value: basicInfo?.workYears || '' },
    { label: '籍贯', value: basicInfo?.hometown || '' },
    {
      label: 'GitHub',
      value: basicInfo?.github || '',
      href: toExternalHref(basicInfo?.github || ''),
    },
    {
      label: '博客',
      value: basicInfo?.blog || '',
      href: toExternalHref(basicInfo?.blog || ''),
    },
    {
      label: 'LeetCode',
      value: basicInfo?.leetcode || '',
      href: toExternalHref(basicInfo?.leetcode || ''),
    },
  ].filter((item) => item.value.trim())

  return (
    <header>
      <div className="grid gap-6 lg:grid-cols-[minmax(230px,0.78fr)_minmax(0,1.8fr)] lg:items-center lg:gap-9">
        <div className="flex min-w-0 items-center gap-5">
          {photoSource ? (
            <div
              className={[
                'aspect-[3/4] w-[104px] shrink-0 overflow-hidden bg-slate-100 sm:w-[116px]',
                basicInfo?.photoBorder ? 'border border-primary-500' : '',
              ].join(' ')}
            >
              <img
                src={photoSource}
                alt={basicInfo?.name ? basicInfo.name + '的简历照片' : '简历照片'}
                className="h-full w-full object-cover object-top"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : null}

          <div className="min-w-0">
            <h1 className="break-words text-3xl font-bold tracking-[0.08em] text-slate-900 sm:text-[38px] sm:leading-tight">
              {basicInfo?.name || '个人简历'}
            </h1>
            {basicInfo?.isPartyMember ? (
              <p className="mt-2 text-sm font-medium text-primary-700">政治面貌：党员</p>
            ) : null}
          </div>
        </div>

        {contactItems.length > 0 ? (
          <dl className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2 sm:gap-y-3">
            {contactItems.map((item) => (
              <div key={item.label} className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] gap-2">
                <dt className="font-semibold text-slate-900">{item.label}：</dt>
                <dd className="min-w-0 break-all text-slate-700">
                  {item.href ? (
                    <a
                      href={item.href}
                      target={item.href.startsWith('http') ? '_blank' : undefined}
                      rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
                      className="transition-colors hover:text-primary-700 hover:underline"
                    >
                      {item.value}
                    </a>
                  ) : item.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

    </header>
  )
}

function ModuleGroup({
  moduleType,
  modules,
  basicInfo,
}: {
  moduleType: ModuleType
  modules: ResumeModule[]
  basicInfo: BasicInfoContent | null
}) {
  const title = getModuleDisplayLabel(moduleType, basicInfo)

  switch (moduleType) {
    case 'education': {
      const entries = modules
        .map((module) => ({
          module,
          content: normalizeEducationContent(module.content),
        }))
        .filter(({ content }) => hasAnyText([
          content.school,
          content.department,
          content.major,
          content.degree,
          content.startDate,
          content.endDate,
        ]))

      if (entries.length === 0) return null

      return (
        <ResumeSection title={title}>
          <div className="space-y-3">
            {entries.map(({ module, content }) => {
              const schoolTags = [
                content.is985 ? '985' : '',
                content.is211 ? '211' : '',
                content.isDoubleFirst ? '双一流' : '',
              ].filter(Boolean)

              return (
                <div
                  key={module.id}
                  className="grid gap-x-5 gap-y-1.5 break-inside-avoid sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] sm:items-start"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <h3 className="font-bold text-slate-900">{content.school}</h3>
                    {schoolTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-sm bg-primary-50 px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-primary-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="min-w-0 text-slate-700">
                    <p>{[content.major, content.degree].filter(Boolean).join(' · ')}</p>
                    {content.department ? (
                      <p className="text-sm text-slate-500">{content.department}</p>
                    ) : null}
                  </div>

                  <p className="text-slate-600 sm:text-right">
                    {formatMonthRange(content.startDate, content.endDate)}
                  </p>
                </div>
              )
            })}
          </div>
        </ResumeSection>
      )
    }

    case 'internship':
    case 'work_experience': {
      const entries = modules
        .map((module) => ({
          module,
          content: normalizeInternshipContent(module.content),
        }))
        .filter(({ content }) => hasAnyText([
          content.company,
          content.position,
          content.startDate,
          content.endDate,
          ...content.projects.flatMap((project) => [
            project.projectName,
            project.role,
            project.startDate,
            project.endDate,
            project.techStack,
            project.projectDescription,
            ...project.responsibilities,
          ]),
        ]))

      if (entries.length === 0) return null

      return (
        <ResumeSection title={title}>
          <div className="space-y-5">
            {entries.map(({ module, content }) => {
              return (
                <div key={module.id} className="break-inside-avoid">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                    <h3 className="font-bold text-slate-900">{[content.company, content.position].filter(Boolean).join(' · ')}</h3>
                    <p className="shrink-0 text-slate-600">{formatMonthRange(content.startDate, content.endDate)}</p>
                  </div>
                  <div className="mt-2 space-y-4">
                    {content.projects.map((project) => (
                      <ExperienceEntry
                        key={project.id}
                        title={project.projectName}
                        meta={project.role}
                        date={formatMonthRange(project.startDate, project.endDate)}
                        description={project.projectDescription}
                        techStack={project.techStack}
                        bullets={project.responsibilities}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </ResumeSection>
      )
    }

    case 'project': {
      const entries = modules
        .map((module) => ({
          module,
          content: normalizeProjectContent(module.content),
        }))
        .filter(({ content }) => hasAnyText([
          content.projectName,
          content.role,
          content.startDate,
          content.endDate,
          content.techStack,
          content.description,
          ...content.achievements,
        ]))

      if (entries.length === 0) return null

      return (
        <ResumeSection title={title}>
          <div className="space-y-5">
            {entries.map(({ module, content }) => (
              <ExperienceEntry
                key={module.id}
                title={content.projectName}
                meta={content.role}
                date={formatMonthRange(content.startDate, content.endDate)}
                description={content.description}
                techStack={content.techStack}
                bullets={content.achievements}
              />
            ))}
          </div>
        </ResumeSection>
      )
    }

    case 'skill': {
      const categories = modules
        .flatMap((module) => normalizeSkillContent(module.content).categories)
        .map((category) => ({
          name: category.name.trim(),
          items: category.items.map((item) => item.trim()).filter(Boolean),
        }))
        .filter((category) => category.items.length > 0)

      if (categories.length === 0) return null

      return (
        <ResumeSection title={title}>
          <div className="space-y-3">
            {categories.map((category, categoryIndex) => {
              const useList = !category.name
                || category.items.some((item) => item.length > 24 || /[，。；]/.test(item))

              if (useList) {
                return (
                  <div key={category.name + '-' + categoryIndex} className="break-inside-avoid">
                    {category.name ? (
                      <h3 className="mb-1 font-bold text-slate-900">{category.name}</h3>
                    ) : null}
                    <BulletList values={category.items} />
                  </div>
                )
              }

              return (
                <p key={category.name + '-' + categoryIndex} className="break-inside-avoid text-slate-700">
                  <span className="font-bold text-slate-900">{category.name}：</span>
                  {category.items.join('、')}
                </p>
              )
            })}
          </div>
        </ResumeSection>
      )
    }

    case 'paper': {
      const entries = modules
        .map((module) => ({
          module,
          content: normalizePaperContent(module.content),
        }))
        .filter(({ content }) => hasPaperContent(content))

      if (entries.length === 0) return null

      return (
        <ResumeSection title={title}>
          <div className="space-y-4">
            {entries.map(({ module, content }) => (
              <div key={module.id} className="break-inside-avoid">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                  <h3 className="font-bold text-slate-900">
                    {content.journalName || '论文成果'}
                    {content.journalType ? (
                      <span className="ml-2 font-normal text-slate-500">（{content.journalType}）</span>
                    ) : null}
                  </h3>
                  {content.publishTime ? (
                    <span className="shrink-0 text-slate-600">{formatMonth(content.publishTime)}</span>
                  ) : null}
                </div>
                {content.content ? (
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">
                    <InlineText value={content.content} />
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </ResumeSection>
      )
    }

    case 'research': {
      const entries = modules
        .map((module) => ({
          module,
          content: normalizeResearchContent(module.content),
        }))
        .filter(({ content }) => hasResearchContent(content))

      if (entries.length === 0) return null

      return (
        <ResumeSection title={title}>
          <div className="space-y-5">
            {entries.map(({ module, content }) => (
              <div key={module.id} className="break-inside-avoid">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                  <h3 className="font-bold text-slate-900">{content.projectName || '科研项目'}</h3>
                  {content.projectCycle ? (
                    <span className="shrink-0 text-slate-600">{content.projectCycle}</span>
                  ) : null}
                </div>
                <div className="mt-1.5 space-y-1 text-slate-700">
                  <LabeledCopy label="项目背景" value={content.background} />
                  <LabeledCopy label="工作内容" value={content.workContent} />
                  <LabeledCopy label="项目成果" value={content.achievements} />
                </div>
              </div>
            ))}
          </div>
        </ResumeSection>
      )
    }

    case 'award': {
      const entries = modules
        .map((module) => ({
          module,
          content: normalizeAwardContent(module.content),
        }))
        .filter(({ content }) => content.awardName.trim() || content.awardTime.trim())

      if (entries.length === 0) return null

      return (
        <ResumeSection title={title}>
          <div className="space-y-2">
            {entries.map(({ module, content }) => (
              <div
                key={module.id}
                className="flex break-inside-avoid flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-5"
              >
                <p className="font-medium text-slate-800">{content.awardName}</p>
                {content.awardTime ? (
                  <p className="shrink-0 text-slate-600">{formatMonth(content.awardTime)}</p>
                ) : null}
              </div>
            ))}
          </div>
        </ResumeSection>
      )
    }

    default:
      return null
  }
}

function ResumeSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section>
      <div className="mb-3 border-l-[3px] border-primary-700 bg-[#e8eef9] px-4 py-1.5 sm:px-5">
        <h2 className="text-lg font-bold tracking-[0.04em] text-primary-800 sm:text-xl">
          {title}
        </h2>
      </div>
      <div>{children}</div>
    </section>
  )
}

function ExperienceEntry({
  title,
  meta,
  date,
  description,
  techStack,
  bullets,
}: {
  title: string
  meta: string
  date: string
  description: string
  techStack: string
  bullets: string[]
}) {
  const visibleBullets = bullets.map((item) => item.trim()).filter(Boolean)

  return (
    <div className="break-inside-avoid">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div className="min-w-0">
          {title ? <h3 className="font-bold text-slate-900">{title}</h3> : null}
          {meta ? <p className="text-sm text-slate-500">{meta}</p> : null}
        </div>
        {date ? <p className="shrink-0 text-slate-600">{date}</p> : null}
      </div>

      <div className="mt-1.5 space-y-1 text-slate-700">
        <LabeledCopy label="项目简介" value={description} />
        <LabeledCopy label="技术栈" value={normalizeInlineText(techStack)} />
      </div>

      {visibleBullets.length > 0 ? (
        <div className="mt-1.5">
          <p className="font-bold text-slate-900">核心职责：</p>
          <BulletList values={visibleBullets} />
        </div>
      ) : null}
    </div>
  )
}

function LabeledCopy({
  label,
  value,
}: {
  label: string
  value: string
}) {
  if (!value.trim()) return null

  return (
    <p className="whitespace-pre-wrap">
      <span className="font-bold text-slate-900">{label}：</span>
      <InlineText value={value} />
    </p>
  )
}

function BulletList({ values }: { values: string[] }) {
  return (
    <ul className="mt-1 space-y-1 pl-5 text-slate-700">
      {values.map((value, index) => (
        <li
          key={index + '-' + value}
          className="relative whitespace-pre-wrap before:absolute before:-left-4 before:top-0 before:content-['•']"
        >
          <InlineText value={value} />
        </li>
      ))}
    </ul>
  )
}

function InlineText({ value }: { value: string }) {
  return (
    <>
      {parseInlineMarkdownSegments(value).map((segment, index) => (
        segment.bold ? (
          <strong key={index + '-' + segment.text} className="font-bold text-slate-900">
            {segment.text}
          </strong>
        ) : (
          <span key={index + '-' + segment.text}>{segment.text}</span>
        )
      ))}
    </>
  )
}

function formatMonth(value: string) {
  const trimmed = value.trim()
  const match = /^(\d{4})[-/.](\d{1,2})$/.exec(trimmed)

  if (!match) return trimmed

  return match[1] + '/' + match[2].padStart(2, '0')
}

function formatMonthRange(start: string, end: string) {
  const startText = formatMonth(start)
  const endText = formatMonth(end)

  if (startText && endText) return startText + ' - ' + endText

  return startText || endText
}

function toExternalHref(value: string) {
  const trimmed = value.trim()

  if (!trimmed) return undefined

  return /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed
}

function hasAnyText(values: string[]) {
  return values.some((value) => value.trim())
}
