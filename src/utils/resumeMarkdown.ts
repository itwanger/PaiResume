import type { ResumeModule } from '../api/resume'
import {
  normalizeAwardContent,
  normalizeBasicInfoContent,
  normalizeEducationContent,
  normalizeInternshipContent,
  normalizeJobIntentionContent,
  normalizePaperContent,
  normalizeProjectContent,
  normalizeResearchContent,
  normalizeSkillContent,
} from './moduleContent'
import { sortResumeModulesForDisplay } from './resumeDisplay'
import { formatAwardDisplayText } from './yearInput'

export interface ResumeMarkdownOptions {
  documentTitle?: string
}

function compactLine(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim()
}

function hasText(values: string[]): boolean {
  return values.some((value) => compactLine(value).length > 0)
}

function formatEducationMonth(value: string): string {
  const normalized = compactLine(value)
  if (!normalized) return ''
  if (/^(至今|现在)$/u.test(normalized)) return '至今'

  const match = normalized.match(/^(\d{4})-(\d{1,2})$/)
  return match ? `${match[1]}年${Number(match[2])}月` : normalized
}

function formatCompactMonth(value: string): string {
  const normalized = compactLine(value)
  if (!normalized) return ''
  if (/^(至今|现在)$/u.test(normalized)) return '至今'

  const match = normalized.match(/^(\d{4})-(\d{1,2})$/)
  return match ? `${match[1]}-${match[2].padStart(2, '0')}` : normalized
}

function formatDateRange(startDate: string, endDate: string, education = false): string {
  const formatter = education ? formatEducationMonth : formatCompactMonth
  const start = formatter(startDate)
  const end = formatter(endDate)
  if (start && end) return `${start} ${education ? '-' : '～'} ${end}`
  return start || end
}

function uniqueParts(values: string[]): string[] {
  const seen = new Set<string>()
  return values.flatMap((value) => {
    const normalized = compactLine(value)
    if (!normalized || seen.has(normalized)) return []
    seen.add(normalized)
    return [normalized]
  })
}

function labeledLine(label: string, value: string): string | null {
  const normalized = compactLine(value)
  return normalized ? `${label}：${normalized}` : null
}

function listItem(value: string, marker: string): string | null {
  const normalized = value.replace(/\r\n/g, '\n').trim()
  if (!normalized) return null

  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) return null
  return `${marker} ${lines[0]}${lines.slice(1).map((line) => `\n   ${line}`).join('')}`
}

function buildBasicInfoSection(modules: ResumeModule[]): string | null {
  const basicInfoModule = modules.find((module) => module.moduleType === 'basic_info')
  const jobIntentionModule = modules.find((module) => module.moduleType === 'job_intention')
  if (!basicInfoModule && !jobIntentionModule) return null

  const basicInfo = basicInfoModule ? normalizeBasicInfoContent(basicInfoModule.content) : null
  const jobIntention = jobIntentionModule ? normalizeJobIntentionContent(jobIntentionModule.content) : null
  const lines = [
    labeledLine('姓名', basicInfo?.name ?? ''),
    labeledLine('求职意向', basicInfo?.jobIntention || jobIntention?.targetPosition || ''),
    labeledLine('邮箱', basicInfo?.email ?? ''),
    labeledLine('手机号', basicInfo?.phone ?? ''),
    labeledLine('微信', basicInfo?.wechat ?? ''),
    labeledLine('GitHub', basicInfo?.github ?? ''),
    labeledLine('博客', basicInfo?.blog ?? ''),
    labeledLine('LeetCode', basicInfo?.leetcode ?? ''),
    labeledLine('籍贯', basicInfo?.hometown ?? ''),
    labeledLine('意向城市', basicInfo?.targetCity || jobIntention?.targetCity || ''),
    labeledLine('期望薪资', basicInfo?.salaryRange || jobIntention?.salaryRange || ''),
    labeledLine('到岗时间', basicInfo?.expectedEntryDate || jobIntention?.expectedEntryDate || ''),
    labeledLine('工作年限', basicInfo?.workYears ?? ''),
    basicInfo?.politicalStatusMasked
      ? '政治面貌：xx'
      : basicInfo?.isPartyMember
        ? '政治面貌：党员'
        : null,
    labeledLine('个人总结', basicInfo?.summary ?? ''),
  ].filter((line): line is string => Boolean(line))

  return lines.length > 0 ? ['# 基本信息', '', ...lines].join('\n') : null
}

function buildEducationSection(modules: ResumeModule[]): string | null {
  const entries = modules.flatMap((module) => {
    if (module.moduleType !== 'education') return []
    const content = normalizeEducationContent(module.content)
    if (!hasText([
      content.school,
      content.department,
      content.major,
      content.degree,
      content.startDate,
      content.endDate,
      content.academicPerformance,
      content.majorCourses,
      content.languageProficiency,
    ]) && !content.is985 && !content.is211 && !content.isDoubleFirst) return []

    const tags = [
      content.is985 ? '985' : '',
      content.is211 ? '211' : '',
      content.isDoubleFirst ? '双一流' : '',
    ].filter(Boolean)
    const details = [
      labeledLine('- 学历', content.degree),
      labeledLine('- 时间', formatDateRange(content.startDate, content.endDate, true)),
      labeledLine('- 院系', content.department),
      labeledLine('- 专业', content.major),
      labeledLine('- 标签', tags.join('、')),
      labeledLine('- 学业表现', content.academicPerformance),
      labeledLine('- 主修课程', content.majorCourses),
      labeledLine('- 英语能力', content.languageProficiency),
    ].filter((line): line is string => Boolean(line))
    const heading = compactLine(content.school) || '教育经历'
    return [[`### ${heading}`, ...details].join('\n')]
  })

  return entries.length > 0 ? ['## 教育背景', ...entries].join('\n\n') : null
}

function buildExperienceSection(
  modules: ResumeModule[],
  moduleType: 'internship' | 'work_experience',
  sectionTitle: string,
): string | null {
  const entries = modules.flatMap((module) => {
    if (module.moduleType !== moduleType) return []
    const content = normalizeInternshipContent(module.content)
    const visibleProjects = content.projects.filter((project) => hasText([
      project.projectName,
      project.role,
      project.startDate,
      project.endDate,
      project.techStack,
      project.projectDescription,
      ...project.responsibilities,
    ]))
    const projects = visibleProjects.length > 0 ? visibleProjects : [{
      id: 'company-only',
      projectName: '',
      role: '',
      startDate: '',
      endDate: '',
      techStack: '',
      projectDescription: '',
      responsibilities: [],
    }]

    return projects.flatMap((project) => {
      if (!hasText([
        content.company,
        content.position,
        content.startDate,
        content.endDate,
        project.projectName,
        project.role,
        project.startDate,
        project.endDate,
        project.techStack,
        project.projectDescription,
        ...project.responsibilities,
      ])) return []

      const hasProjectDate = Boolean(project.startDate.trim() || project.endDate.trim())
      const dateRange = formatDateRange(
        hasProjectDate ? project.startDate : content.startDate,
        hasProjectDate ? project.endDate : content.endDate,
      )
      const title = uniqueParts([
        content.company,
        content.position,
        project.projectName,
        project.role,
      ]).join('｜')
      const heading = [title || '经历', dateRange].filter(Boolean).join(' ')
      const responsibilities = project.responsibilities.flatMap((responsibility, index) => {
        const item = listItem(responsibility, `${index + 1}.`)
        return item ? [item] : []
      })
      const blocks = [
        labeledLine('项目简介', project.projectDescription),
        labeledLine('技术栈', project.techStack),
        responsibilities.length > 0 ? responsibilities.join('\n') : null,
      ].filter((block): block is string => Boolean(block))
      return [[`### ${heading}`, ...blocks].join('\n\n')]
    })
  })

  return entries.length > 0 ? [`## ${sectionTitle}`, ...entries].join('\n\n') : null
}

function buildProjectSection(modules: ResumeModule[]): string | null {
  const entries = modules.flatMap((module) => {
    if (module.moduleType !== 'project') return []
    const content = normalizeProjectContent(module.content)
    if (!hasText([
      content.projectName,
      content.role,
      content.startDate,
      content.endDate,
      content.techStack,
      content.description,
      ...content.achievements,
    ])) return []

    const title = uniqueParts([content.projectName, content.role]).join(' ')
    const dateRange = formatDateRange(content.startDate, content.endDate)
    const heading = [title || '项目经历', dateRange].filter(Boolean).join(' ')
    const responsibilities = content.achievements.flatMap((achievement) => {
      const item = listItem(achievement, '-')
      return item ? [item] : []
    })
    const blocks = [
      labeledLine('项目描述', content.description),
      labeledLine('技术栈', content.techStack),
      responsibilities.length > 0 ? `核心职责：\n\n${responsibilities.join('\n')}` : null,
    ].filter((block): block is string => Boolean(block))
    return [[`### ${heading}`, ...blocks].join('\n\n')]
  })

  return entries.length > 0 ? ['## 项目经历', ...entries].join('\n\n') : null
}

function buildSkillSection(modules: ResumeModule[]): string | null {
  const items = modules.flatMap((module) => {
    if (module.moduleType !== 'skill') return []
    const content = normalizeSkillContent(module.content)
    return content.categories.flatMap((category) => {
      const skills = category.items.map(compactLine).filter(Boolean)
      if (skills.length === 0) return []
      const categoryName = compactLine(category.name)
      if (!categoryName) {
        return skills.map((skill) => `- ${skill}`)
      }
      return [`- **${categoryName}**：${skills.join('；')}`]
    })
  })

  return items.length > 0 ? ['## 专业技能', '', ...items].join('\n') : null
}

function buildPaperSection(modules: ResumeModule[]): string | null {
  const entries = modules.flatMap((module) => {
    if (module.moduleType !== 'paper') return []
    const content = normalizePaperContent(module.content)
    if (!hasText([content.journalType, content.journalName, content.publishTime, content.content])) return []

    const heading = compactLine(content.journalName) || '论文期刊'
    const details = [
      labeledLine('- 期刊类型', content.journalType),
      labeledLine('- 发表时间', formatCompactMonth(content.publishTime)),
      labeledLine('- 论文内容', content.content),
    ].filter((line): line is string => Boolean(line))
    return [[`### ${heading}`, ...details].join('\n')]
  })

  return entries.length > 0 ? ['## 论文期刊', ...entries].join('\n\n') : null
}

function buildResearchSection(modules: ResumeModule[]): string | null {
  const entries = modules.flatMap((module) => {
    if (module.moduleType !== 'research') return []
    const content = normalizeResearchContent(module.content)
    if (!hasText([
      content.projectName,
      content.projectCycle,
      content.background,
      content.workContent,
      content.achievements,
    ])) return []

    const details = [
      labeledLine('- 项目周期', content.projectCycle),
      labeledLine('- 项目背景', content.background),
      labeledLine('- 工作内容', content.workContent),
      labeledLine('- 研究成果', content.achievements),
    ].filter((line): line is string => Boolean(line))
    return [[`### ${compactLine(content.projectName) || '科研经历'}`, ...details].join('\n')]
  })

  return entries.length > 0 ? ['## 科研经历', ...entries].join('\n\n') : null
}

function buildAwardSection(modules: ResumeModule[]): string | null {
  const items = modules.flatMap((module) => {
    if (module.moduleType !== 'award') return []
    const content = normalizeAwardContent(module.content)
    if (!compactLine(content.awardName)) return []
    return [`- ${formatAwardDisplayText(compactLine(content.awardName), content.awardTime)}`]
  })

  return items.length > 0 ? ['## 获奖情况', '', ...items].join('\n') : null
}

export function generateResumeMarkdown(modules: ResumeModule[]): string {
  const sortedModules = sortResumeModulesForDisplay(modules)
  const sections = [
    buildBasicInfoSection(sortedModules),
    buildEducationSection(sortedModules),
    buildExperienceSection(sortedModules, 'internship', '实习经历'),
    buildExperienceSection(sortedModules, 'work_experience', '工作经历'),
    buildProjectSection(sortedModules),
    buildSkillSection(sortedModules),
    buildPaperSection(sortedModules),
    buildResearchSection(sortedModules),
    buildAwardSection(sortedModules),
  ].filter((section): section is string => Boolean(section))

  return sections.length > 0 ? `${sections.join('\n\n')}\n` : ''
}

function sanitizeMarkdownFileNamePart(value: string): string {
  return value
    .trim()
    .replace(/\.md$/i, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim()
}

function buildMarkdownFileName(
  modules: ResumeModule[],
  resumeId: number,
  options?: ResumeMarkdownOptions,
): string {
  const basicInfoModule = modules.find((module) => module.moduleType === 'basic_info')
  const educationModule = modules.find((module) => module.moduleType === 'education')
  const jobIntentionModule = modules.find((module) => module.moduleType === 'job_intention')
  const basicInfo = basicInfoModule ? normalizeBasicInfoContent(basicInfoModule.content) : null
  const education = educationModule ? normalizeEducationContent(educationModule.content) : null
  const jobIntention = jobIntentionModule ? normalizeJobIntentionContent(jobIntentionModule.content) : null
  const fallbackName = [
    basicInfo?.name ?? '',
    education?.school ?? '',
    basicInfo?.jobIntention || jobIntention?.targetPosition || '',
  ].map(sanitizeMarkdownFileNamePart).filter(Boolean).join('-')
  const documentTitle = sanitizeMarkdownFileNamePart(options?.documentTitle ?? '')

  return `${documentTitle || fallbackName || `resume-${resumeId}`}.md`
}

export function downloadResumeMarkdown(
  modules: ResumeModule[],
  resumeId: number,
  options?: ResumeMarkdownOptions,
): void {
  const markdown = generateResumeMarkdown(modules)
  if (!markdown) {
    throw new Error('请先完善简历内容后再导出 Markdown')
  }

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = buildMarkdownFileName(modules, resumeId, options)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}
