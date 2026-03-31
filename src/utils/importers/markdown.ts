import type { ModuleType } from '../../types'

export interface ImportedResumeModule {
  moduleType: ModuleType
  content: Record<string, unknown>
}

export interface ImportedResumeData {
  title: string
  modules: ImportedResumeModule[]
}

interface ParsedAward {
  awardName: string
  awardTime: string
}

interface SectionEntry {
  heading: string
  lines: string[]
}

const MAIN_SECTION_TITLES = [
  '基本信息',
  '教育背景',
  '实习经历',
  '项目经历',
  '专业技能',
  '论文发表',
  '科研经历',
  '获奖情况',
] as const

const SECTION_TITLE_SET = new Set<string>(MAIN_SECTION_TITLES)
const DESCRIPTION_LABELS = ['项目简介', '项目介绍', '项目描述']
const TECH_STACK_LABELS = ['技术栈']
const RESPONSIBILITY_LABELS = ['核心职责', '主要成果', '职责']
const ROLE_KEYWORD_PATTERN = /(工程师|开发|实习生|实习|架构师|测试|运维|设计|产品|顾问|经理|负责人|研究员)/
const ROLE_MODIFIER_PATTERN = /(Java|Go|Golang|Python|前端|后端|全栈|客户端|服务端|算法|测试|运维|数据|产品|设计|开发|工程|AI|大模型|Android|iOS|Web|Node|C\+\+)/

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ')
}

function cleanInlineText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function removeFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

function getHeadingTitle(line: string): string | null {
  const match = line.trim().match(/^#{1,6}\s+(.+?)\s*$/)
  return match ? match[1].trim() : null
}

function splitIntoSections(markdown: string): Map<string, string[]> {
  const sections = new Map<string, string[]>()
  let currentSection: string | null = null

  for (const line of normalizeMarkdown(markdown).split('\n')) {
    const heading = getHeadingTitle(line)
    if (heading && SECTION_TITLE_SET.has(heading)) {
      currentSection = heading
      if (!sections.has(heading)) {
        sections.set(heading, [])
      }
      continue
    }

    if (currentSection) {
      sections.get(currentSection)?.push(line)
    }
  }

  return sections
}

function splitSectionEntries(lines: string[]): SectionEntry[] {
  const entries: SectionEntry[] = []
  let currentEntry: SectionEntry | null = null

  for (const rawLine of lines) {
    const heading = getHeadingTitle(rawLine)
    if (heading) {
      if (currentEntry) {
        entries.push(currentEntry)
      }
      currentEntry = { heading, lines: [] }
      continue
    }

    if (!currentEntry) {
      if (!rawLine.trim()) {
        continue
      }
      currentEntry = { heading: '', lines: [] }
    }

    currentEntry.lines.push(rawLine)
  }

  if (currentEntry) {
    entries.push(currentEntry)
  }

  return entries.filter((entry) => entry.heading || entry.lines.some((line) => line.trim()))
}

function stripListMarker(line: string): string {
  return line.replace(/^[-*+]\s+/, '').replace(/^\d+[.、)]\s+/, '').trim()
}

function buildLabelPattern(label: string): RegExp {
  return new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:：]\\s*(.*)$`)
}

function matchLabel(line: string, labels: string[]): { label: string; value: string } | null {
  for (const label of labels) {
    const match = line.match(buildLabelPattern(label))
    if (match) {
      return { label, value: match[1].trim() }
    }
  }

  return null
}

function extractLabeledText(lines: string[], labels: string[], stopLabels: string[]): string {
  const parts: string[] = []
  let collecting = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      if (collecting && parts.length > 0) {
        break
      }
      continue
    }

    const labeledValue = matchLabel(line, labels)
    if (labeledValue) {
      collecting = true
      if (labeledValue.value) {
        parts.push(labeledValue.value)
      }
      continue
    }

    if (!collecting) {
      continue
    }

    if (getHeadingTitle(line) || matchLabel(line, stopLabels) || /^[-*+]\s+/.test(line) || /^\d+[.、)]\s+/.test(line)) {
      break
    }

    parts.push(line)
  }

  return cleanInlineText(parts.join(' '))
}

function collectListItems(
  lines: string[],
  labels: string[] = [],
  stopLabels: string[] = [],
  options: { requireMarkerStart?: boolean } = {}
): string[] {
  const items: string[] = []
  let collecting = labels.length === 0 && !options.requireMarkerStart

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    const labeledValue = labels.length > 0 ? matchLabel(line, labels) : null
    if (labeledValue) {
      collecting = true
      if (labeledValue.value) {
        items.push(cleanInlineText(stripListMarker(labeledValue.value)))
      }
      continue
    }

    if (/^[-*+]\s+/.test(line) || /^\d+[.、)]\s+/.test(line)) {
      collecting = true
      items.push(cleanInlineText(stripListMarker(line)))
      continue
    }

    if (!collecting) {
      continue
    }

    if (stopLabels.length > 0 && matchLabel(line, stopLabels)) {
      break
    }

    if (items.length === 0) {
      if (options.requireMarkerStart) {
        continue
      }
      items.push(cleanInlineText(line))
      continue
    }

    items[items.length - 1] = cleanInlineText(`${items[items.length - 1]} ${line}`)
  }

  return items.filter(Boolean)
}

function parseKeyValueList(lines: string[]): Record<string, string> {
  const values: Record<string, string> = {}

  for (const rawLine of lines) {
    const line = stripListMarker(rawLine.trim())
    if (!line) {
      continue
    }

    const match = line.match(/^([^:：]+)\s*[:：]\s*(.+)$/)
    if (!match) {
      continue
    }

    values[match[1].trim()] = cleanInlineText(match[2].trim())
  }

  return values
}

function normalizeMonthValue(value: string): string {
  if (!value) {
    return ''
  }

  const trimmed = cleanInlineText(value)
  if (/^(至今|现在)$/u.test(trimmed)) {
    return ''
  }

  const yearMonthMatch = trimmed.match(/(\d{4})[./年-]\s*(\d{1,2})/)
  if (yearMonthMatch) {
    return `${yearMonthMatch[1]}-${yearMonthMatch[2].padStart(2, '0')}`
  }

  const yearMatch = trimmed.match(/(\d{4})年?/)
  if (yearMatch) {
    return `${yearMatch[1]}-01`
  }

  return ''
}

function extractDateRange(value: string): { startDate: string; endDate: string; matchedText: string } {
  const dateToken = '(?:\\d{4}[./-]\\d{1,2}|\\d{4}年\\d{1,2}月?|\\d{4}年|\\d{4}|至今|现在)'
  const match = value.match(new RegExp(`(${dateToken})\\s*(?:-|~|～|至|—|–)\\s*(${dateToken})`))
  if (!match) {
    return { startDate: '', endDate: '', matchedText: '' }
  }

  return {
    startDate: normalizeMonthValue(match[1]),
    endDate: normalizeMonthValue(match[2]),
    matchedText: match[0],
  }
}

function splitProjectTitleAndRole(value: string): { projectName: string; role: string } {
  const tokens = cleanInlineText(value).split(/\s+/).filter(Boolean)
  if (tokens.length < 2) {
    return { projectName: cleanInlineText(value), role: '' }
  }

  const lastToken = tokens[tokens.length - 1]
  if (!ROLE_KEYWORD_PATTERN.test(lastToken)) {
    return { projectName: cleanInlineText(value), role: '' }
  }

  let roleStart = tokens.length - 1
  while (roleStart > 0 && ROLE_MODIFIER_PATTERN.test(tokens[roleStart - 1])) {
    roleStart -= 1
  }

  return {
    projectName: tokens.slice(0, roleStart).join(' ').trim(),
    role: tokens.slice(roleStart).join(' ').trim(),
  }
}

function parseBasicInfoSection(lines: string[]): Record<string, unknown> | null {
  const values = parseKeyValueList(lines)
  if (Object.keys(values).length === 0) {
    return null
  }

  return {
    name: values['姓名'] || '',
    email: values['邮箱'] || '',
    jobIntention: values['求职意向'] || '',
    targetCity: values['意向城市'] || '',
    salaryRange: values['期望薪资'] || '',
    expectedEntryDate: values['到岗时间'] || values['到岗日期'] || '',
    phone: values['电话'] || values['手机号'] || '',
    wechat: values['微信'] || '',
    isPartyMember: /党员/u.test(values['政治面貌'] || ''),
    photo: '',
    hometown: values['籍贯'] || values['所在地'] || '',
    blog: values['博客'] || values['个人博客'] || '',
    github: values['GitHub'] || values['Github'] || '',
    leetcode: values['LeetCode'] || values['leetcode'] || '',
    workYears: values['工作年限'] || '',
    summary: values['个人总结'] || values['自我评价'] || '',
  }
}

function parseAwardsFromText(value: string): ParsedAward[] {
  return cleanInlineText(value)
    .split(/[；;、]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.+?)[（(]([^)）]+)[)）]$/)
      if (!match) {
        return { awardName: item, awardTime: '' }
      }

      return {
        awardName: cleanInlineText(match[1]),
        awardTime: normalizeMonthValue(match[2]),
      }
    })
}

function parseEducationSection(lines: string[]): { modules: ImportedResumeModule[]; awards: ParsedAward[] } {
  const modules: ImportedResumeModule[] = []
  const awards: ParsedAward[] = []

  for (const entry of splitSectionEntries(lines)) {
    const values = parseKeyValueList(entry.lines)
    if (!entry.heading && Object.keys(values).length === 0) {
      continue
    }

    const timeRange = extractDateRange(values['时间'] || '')
    const tags = `${values['标签'] || ''} ${values['院校标签'] || ''}`

    modules.push({
      moduleType: 'education',
      content: {
        school: entry.heading || values['学校'] || '',
        schoolLogo: '',
        department: values['院系'] || values['学院'] || '',
        major: values['专业'] || '',
        degree: values['学历'] || '',
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
        is985: /985/.test(tags),
        is211: /211/.test(tags),
        isDoubleFirst: /双一流/.test(tags),
      },
    })

    if (values['奖项']) {
      awards.push(...parseAwardsFromText(values['奖项']))
    }
  }

  return { modules, awards }
}

function parseInternshipHeading(value: string): Record<string, string> {
  const dateRange = extractDateRange(value)
  const title = cleanInlineText(value.replace(dateRange.matchedText, '').replace(/^写法\d+\s+/, '').trim())
  const segments = title.split(/[|｜]/).map((segment) => segment.trim()).filter(Boolean)

  return {
    company: segments[0] || '',
    position: segments[1] || '',
    projectName: segments[2] || segments[1] || '',
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  }
}

function parseInternshipSection(lines: string[]): ImportedResumeModule[] {
  return splitSectionEntries(lines)
    .filter((entry) => entry.heading)
    .map((entry) => {
      const heading = parseInternshipHeading(entry.heading)
      const stopLabels = [...DESCRIPTION_LABELS, ...TECH_STACK_LABELS, ...RESPONSIBILITY_LABELS]
      const responsibilities = collectListItems(
        entry.lines,
        RESPONSIBILITY_LABELS,
        [...DESCRIPTION_LABELS, ...TECH_STACK_LABELS]
      )
      const fallbackResponsibilities = responsibilities.length > 0
        ? responsibilities
        : collectListItems(entry.lines, [], [], { requireMarkerStart: true })

      return {
        moduleType: 'internship',
        content: {
          company: heading.company,
          projectName: heading.projectName,
          position: heading.position,
          startDate: heading.startDate,
          endDate: heading.endDate,
          techStack: extractLabeledText(entry.lines, TECH_STACK_LABELS, stopLabels),
          projectDescription: extractLabeledText(entry.lines, DESCRIPTION_LABELS, stopLabels),
          responsibilities: fallbackResponsibilities,
        },
      }
    })
}

function parseProjectSection(lines: string[]): ImportedResumeModule[] {
  return splitSectionEntries(lines)
    .filter((entry) => entry.heading)
    .map((entry) => {
      const dateRange = extractDateRange(entry.heading)
      const title = cleanInlineText(entry.heading.replace(dateRange.matchedText, '').replace(/^写法\d+\s+/, '').trim())
      const { projectName, role } = splitProjectTitleAndRole(title)
      const stopLabels = [...DESCRIPTION_LABELS, ...TECH_STACK_LABELS, ...RESPONSIBILITY_LABELS]

      return {
        moduleType: 'project',
        content: {
          projectName,
          role,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          techStack: extractLabeledText(entry.lines, TECH_STACK_LABELS, stopLabels),
          description: extractLabeledText(entry.lines, DESCRIPTION_LABELS, stopLabels),
          achievements: collectListItems(entry.lines, RESPONSIBILITY_LABELS),
        },
      }
    })
}

function parseSkillSection(lines: string[]): ImportedResumeModule[] {
  const items = collectListItems(lines)
  if (items.length === 0) {
    return []
  }

  return [{
    moduleType: 'skill',
    content: {
      categories: [{ name: '', items }],
    },
  }]
}

export function parseMarkdownResume(markdown: string, fileName = '导入简历.md'): ImportedResumeData {
  const sections = splitIntoSections(markdown)
  const modules: ImportedResumeModule[] = []
  const basicInfo = parseBasicInfoSection(sections.get('基本信息') || [])
  const education = parseEducationSection(sections.get('教育背景') || [])
  const internships = parseInternshipSection(sections.get('实习经历') || [])
  const projects = parseProjectSection(sections.get('项目经历') || [])
  const skills = parseSkillSection(sections.get('专业技能') || [])

  if (basicInfo) {
    modules.push({ moduleType: 'basic_info', content: basicInfo })
  }

  modules.push(...education.modules)
  modules.push(...internships)
  modules.push(...projects)
  modules.push(...skills)

  for (const award of education.awards) {
    modules.push({
      moduleType: 'award',
      content: {
        awardName: award.awardName,
        awardTime: award.awardTime,
      },
    })
  }

  if (modules.length === 0) {
    throw new Error('没有识别到可导入的简历内容，请检查 Markdown 结构是否完整')
  }

  const basicInfoContent = basicInfo as { name?: string; jobIntention?: string } | null
  const title = [basicInfoContent?.name, basicInfoContent?.jobIntention]
    .filter(Boolean)
    .join('-') || removeFileExtension(fileName) || '导入简历'

  return { title, modules }
}
