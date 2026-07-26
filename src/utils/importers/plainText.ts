import { parseMarkdownResume, type ImportedResumeData } from './markdown'

type CanonicalSection =
  | '基本信息'
  | '教育背景'
  | '实习经历'
  | '工作经历'
  | '项目经历'
  | '专业技能'
  | '论文期刊'
  | '科研经历'
  | '获奖情况'

const SECTION_ALIASES: Array<{ section: CanonicalSection; aliases: string[] }> = [
  { section: '基本信息', aliases: ['基本信息', '基础信息', '个人信息', '个人资料', '联系方式', 'profile', 'personalinfo', 'contact'] },
  { section: '教育背景', aliases: ['教育背景', '教育经历', '学历背景', 'education'] },
  { section: '实习经历', aliases: ['实习经历', '实习经验', 'internship', 'internships'] },
  { section: '工作经历', aliases: ['工作经历', '工作经验', '职业经历', 'experience', 'workexperience', 'employment'] },
  { section: '项目经历', aliases: ['项目经历', '项目经验', '个人项目', 'projects', 'projectexperience'] },
  { section: '专业技能', aliases: ['专业技能', '技能清单', '技能特长', '技术能力', '技术栈', 'skills', 'technicalskills'] },
  { section: '论文期刊', aliases: ['论文期刊', '论文发表', '学术论文', 'publications', 'papers'] },
  { section: '科研经历', aliases: ['科研经历', '研究经历', 'research', 'researchexperience'] },
  { section: '获奖情况', aliases: ['获奖情况', '荣誉奖项', '奖项荣誉', '证书荣誉', 'awards', 'honors'] },
]

const LABEL_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: '姓名', aliases: ['姓名', '名字', 'name'] },
  { canonical: '邮箱', aliases: ['邮箱', '电子邮箱', '电子邮件', 'email', 'e-mail'] },
  { canonical: '电话', aliases: ['电话', '手机号', '手机', 'phone', 'mobile', 'tel'] },
  { canonical: '微信', aliases: ['微信', 'wechat'] },
  { canonical: '求职意向', aliases: ['求职意向', '目标岗位', '应聘岗位', 'targetrole', 'position'] },
  { canonical: '意向城市', aliases: ['意向城市', '工作地点', 'targetcity', 'location'] },
  { canonical: '期望薪资', aliases: ['期望薪资', 'expectedsalary', 'salary'] },
  { canonical: '到岗时间', aliases: ['到岗时间', '到岗日期', 'availabledate'] },
  { canonical: '籍贯', aliases: ['籍贯', '所在地', '现居地', 'hometown'] },
  { canonical: '工作年限', aliases: ['工作年限', '工作经验', '经验年限', 'workyears'] },
  { canonical: '政治面貌', aliases: ['政治面貌', 'politicalstatus'] },
  { canonical: '个人总结', aliases: ['个人总结', '自我评价', '个人简介', 'summary'] },
  { canonical: 'GitHub', aliases: ['github'] },
  { canonical: '博客', aliases: ['博客', '个人网站', 'blog', 'website'] },
  { canonical: 'LeetCode', aliases: ['leetcode'] },
  { canonical: '学历', aliases: ['学历', '学位', 'degree'] },
  { canonical: '专业', aliases: ['专业', 'major'] },
  { canonical: '院系', aliases: ['院系', '学院', 'department'] },
  { canonical: '学校', aliases: ['学校', '院校', 'school', 'university'] },
  { canonical: '时间', aliases: ['时间', '日期', 'date', 'period'] },
  { canonical: '项目简介', aliases: ['项目简介', '项目介绍', '项目描述', 'description'] },
  { canonical: '技术栈', aliases: ['技术栈', 'techstack', 'technologies'] },
  { canonical: '核心职责', aliases: ['核心职责', '主要职责', '工作职责', '项目职责', '工作内容', '主要成果', '职责', 'responsibilities', 'achievements'] },
  { canonical: '工作内容', aliases: ['研究内容'] },
]

const DATE_RANGE_PATTERN = /(?:19|20)\d{2}(?:(?:[./-]|年-?)\d{1,2}月?)?\s*(?:-|~|～|至|—|–)\s*(?:(?:19|20)\d{2}(?:(?:[./-]|年-?)\d{1,2}月?)?|至今|现在|present)/i
const LIST_MARKER_PATTERN = /^(?:[-*+•·]|\d+[.、)])\s*/
const DEGREE_PATTERN = /(博士|硕士|本科|大专|专科|学士|研究生|phd|master|bachelor)/i
const COMPANY_AND_POSITION_PATTERN = /^(.+?(?:有限责任公司|股份有限公司|有限公司|集团(?:有限公司)?|公司|研究院|实验室|工作室|company|corporation|corp\.?|inc\.?|ltd\.?|llc))\s+(.+)$/i
const POSITION_PATTERN = /(工程师|开发|实习生|实习|架构师|测试|运维|设计师?|产品|顾问|经理|负责人|研究员|developer|engineer|intern|architect|tester|designer|manager|consultant|researcher)/i
const LABEL_ALIAS_LOOKUP = new Map(
  LABEL_ALIASES.flatMap((entry) => entry.aliases.map((alias) => [alias.toLowerCase(), entry.canonical]))
)
const LABEL_ALIAS_PATTERN = LABEL_ALIASES
  .flatMap((entry) => entry.aliases)
  .sort((left, right) => right.length - left.length)
  .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|')

function cleanLine(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function normalizeSectionCandidate(value: string): string {
  return cleanLine(value)
    .replace(/^#{1,6}\s*/, '')
    .replace(/^(?:第?[一二三四五六七八九十\d]+)[、.．)）]\s*/, '')
    .replace(/^[【[\s]+|[】\]\s:：]+$/g, '')
    .replace(/[：:·•|｜_\-\s]/g, '')
    .toLowerCase()
}

function identifySection(value: string): CanonicalSection | null {
  const normalized = normalizeSectionCandidate(value)
  if (!normalized) {
    return null
  }

  for (const entry of SECTION_ALIASES) {
    if (entry.aliases.some((alias) => normalizeSectionCandidate(alias) === normalized)) {
      return entry.section
    }
  }

  return null
}

function resolveCanonicalLabel(alias: string, section: CanonicalSection | null): string | null {
  const normalizedAlias = alias.toLowerCase()
  if (normalizedAlias === 'summary') {
    if (section === '项目经历') {
      return '项目简介'
    }
    return section === null || section === '基本信息' ? '个人总结' : null
  }
  if ((normalizedAlias === '工作内容' || normalizedAlias === '研究内容') && section === '科研经历') {
    return '工作内容'
  }
  return LABEL_ALIAS_LOOKUP.get(normalizedAlias) ?? null
}

function extractLabeledLines(value: string, section: CanonicalSection | null = null): string[] {
  const cleaned = cleanLine(value).replace(/^[-*+]\s*/, '')
  const matches: Array<{ canonical: string; match: RegExpExecArray }> = Array.from(
    cleaned.matchAll(
      new RegExp(
        `(^|[\\s|｜,，;；])(${LABEL_ALIAS_PATTERN})(?:\\s*[:：]\\s*|\\s*[-—]\\s+|\\s+)`,
        'giu'
      )
    )
  ).flatMap((match) => {
    const canonical = resolveCanonicalLabel(match[2] ?? '', section)
    return canonical ? [{ canonical, match }] : []
  })
  const result: string[] = []

  for (const [index, entry] of matches.entries()) {
    const { canonical, match } = entry
    if (match.index === undefined) {
      continue
    }
    const valueStart = match.index + match[0].length
    const valueEnd = matches[index + 1]?.match.index ?? cleaned.length
    const fieldValue = cleanLine(cleaned.slice(valueStart, valueEnd))
      .replace(/^[|｜,，;；·•\s]+|[|｜,，;；·•\s]+$/g, '')
    result.push(`${canonical}：${fieldValue}`)
  }

  return result
}

function normalizeLabeledLine(value: string, section: CanonicalSection | null = null): string | null {
  return extractLabeledLines(value, section)[0] ?? null
}

function inferBasicInfo(lines: string[]): string[] {
  const result: string[] = []
  const joinedText = lines.join(' ')
  const labeledKeys = new Set<string>()

  for (const line of lines) {
    const labeledLines = extractLabeledLines(line, '基本信息')
    for (const labeledLine of labeledLines) {
      const key = labeledLine.split('：', 1)[0]
      if (!labeledKeys.has(key)) {
        result.push(labeledLine)
        labeledKeys.add(key)
      }
    }
  }

  const inferredFields: Array<{ key: string; match: RegExpMatchArray | null }> = [
    { key: '邮箱', match: joinedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) },
    { key: '电话', match: joinedText.match(/(?:\+?86[-\s]?)?1[3-9]\d{9}/) },
    { key: 'GitHub', match: joinedText.match(/https?:\/\/(?:www\.)?github\.com\/[A-Z0-9_.-]+/i) },
  ]

  for (const field of inferredFields) {
    if (field.match?.[0] && !labeledKeys.has(field.key)) {
      result.push(`${field.key}：${field.match[0]}`)
      labeledKeys.add(field.key)
    }
  }

  if (!labeledKeys.has('姓名') && labeledKeys.size > 0) {
    const nameCandidate = lines.find((line) => {
      const cleaned = cleanLine(line)
      const looksLikeChineseName = /^[\p{Script=Han}·]{2,6}$/u.test(cleaned)
      const looksLikeEnglishName = /^[A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,3}$/.test(cleaned)
      return (
        (looksLikeChineseName || looksLikeEnglishName)
        && !/简历|resume|@|https?:|1[3-9]\d{9}|[:：|｜]/i.test(cleaned)
        && !DATE_RANGE_PATTERN.test(cleaned)
      )
    })
    if (nameCandidate) {
      result.unshift(`姓名：${cleanLine(nameCandidate)}`)
    }
  }

  return result
}

function isBodyLabel(value: string): boolean {
  return extractLabeledLines(value).length > 0
}

function splitCompactEducationLine(line: string): string[] | null {
  const schoolMatch = line.match(/^(.+?(?:大学|学院|university|college))(?:\s+|$)/i)
  if (!schoolMatch) {
    return null
  }

  const dateMatch = line.match(DATE_RANGE_PATTERN)
  const degreeMatch = line.match(DEGREE_PATTERN)
  if (!dateMatch && !degreeMatch) {
    return null
  }

  const detailsEnd = Math.min(
    degreeMatch?.index ?? line.length,
    dateMatch?.index ?? line.length
  )
  const major = cleanLine(line.slice(schoolMatch[0].length, detailsEnd))
    .replace(/^[·|｜\s-]+|[·|｜\s-]+$/g, '')
  const result = [`### ${cleanLine(schoolMatch[1])}`]
  if (major) {
    result.push(`- 专业：${major}`)
  }
  if (degreeMatch?.[0]) {
    result.push(`- 学历：${degreeMatch[0]}`)
  }
  if (dateMatch?.[0]) {
    result.push(`- 时间：${dateMatch[0]}`)
  }
  return result
}

function normalizeEducationLines(lines: string[]): string[] {
  const result: string[] = []
  let hasHeading = false
  let hasBodyAfterHeading = false

  for (const rawLine of lines) {
    const line = cleanLine(rawLine)
    if (!line) {
      continue
    }

    const labeledLines = extractLabeledLines(line, '教育背景')
    if (labeledLines.length > 0) {
      result.push(...labeledLines.map((labeledLine) => `- ${labeledLine}`))
      hasBodyAfterHeading = true
      continue
    }

    const looksLikeSchool = /(?:大学|学院|university|college)/i.test(line)
    const compactEducation = looksLikeSchool ? splitCompactEducationLine(line) : null
    if (compactEducation) {
      result.push(...compactEducation)
      hasHeading = true
      hasBodyAfterHeading = true
      continue
    }
    if (!hasHeading || (looksLikeSchool && hasBodyAfterHeading)) {
      result.push(`### ${line}`)
      hasHeading = true
      hasBodyAfterHeading = false
      continue
    }

    if (looksLikeSchool) {
      if (result[result.length - 1]?.startsWith('### ')) {
        result[result.length - 1] = `${result[result.length - 1]} ${line}`
      } else {
        result.push(`### ${line}`)
      }
      continue
    }

    if (DATE_RANGE_PATTERN.test(line)) {
      result.push(`- 时间：${line}`)
      hasBodyAfterHeading = true
      continue
    }

    const degreeMatch = line.match(DEGREE_PATTERN)
    if (degreeMatch) {
      const major = cleanLine(line.replace(degreeMatch[0], ''))
      if (major) {
        result.push(`- 专业：${major}`)
      }
      result.push(`- 学历：${degreeMatch[0]}`)
      hasBodyAfterHeading = true
      continue
    }

    result.push(`- ${line}`)
    hasBodyAfterHeading = true
  }

  return result
}

function splitCompactExperienceHeading(
  line: string,
  section: CanonicalSection
): string | null {
  if (section !== '工作经历' && section !== '实习经历') {
    return null
  }

  const dateMatch = line.match(DATE_RANGE_PATTERN)
  if (!dateMatch?.[0] || line.includes('|') || line.includes('｜')) {
    return null
  }

  const title = cleanLine(line.replace(dateMatch[0], ''))
  const companyAndPosition = title.match(COMPANY_AND_POSITION_PATTERN)
  const company = cleanLine(companyAndPosition?.[1] ?? '')
  const position = cleanLine(companyAndPosition?.[2] ?? '')
  if (!company || !position || !POSITION_PATTERN.test(position)) {
    return null
  }

  return `${company}｜${position} ${dateMatch[0]}`
}

function normalizeEntryLines(lines: string[], section: CanonicalSection): string[] {
  const result: string[] = []
  let hasHeading = false
  let hasBodyAfterHeading = false

  for (const [index, rawLine] of lines.entries()) {
    const line = cleanLine(rawLine)
    if (!line) {
      continue
    }

    const labeledLines = extractLabeledLines(line, section)
    if (labeledLines.length > 0) {
      result.push(...labeledLines)
      hasBodyAfterHeading = true
      continue
    }

    if (LIST_MARKER_PATTERN.test(line)) {
      result.push(line)
      hasBodyAfterHeading = true
      continue
    }

    const nextLine = cleanLine(lines[index + 1] ?? '')
    const nextLineStartsBody = Boolean(normalizeLabeledLine(nextLine, section)) || LIST_MARKER_PATTERN.test(nextLine)
    const looksLikeNamedEntry = (
      /(?:公司|集团|工作室|研究院|实验室|company|corp|inc|ltd)$/i.test(line)
      || (line.length <= 80 && (DATE_RANGE_PATTERN.test(nextLine) || nextLineStartsBody))
    )
    const looksLikeHeading = (
      !hasHeading
      || (DATE_RANGE_PATTERN.test(line) && hasBodyAfterHeading)
      || (hasBodyAfterHeading && looksLikeNamedEntry)
    )
    if (looksLikeHeading) {
      result.push(`### ${splitCompactExperienceHeading(line, section) ?? line}`)
      hasHeading = true
      hasBodyAfterHeading = false
      continue
    }

    if (!hasBodyAfterHeading && DATE_RANGE_PATTERN.test(line) && result[result.length - 1]?.startsWith('### ')) {
      result[result.length - 1] = `${result[result.length - 1]}｜${line}`
      continue
    }

    result.push(`- ${line}`)
    hasBodyAfterHeading = true
  }

  return result
}

function normalizeSimpleList(lines: string[]): string[] {
  return lines
    .map(cleanLine)
    .filter(Boolean)
    .map((line) => LIST_MARKER_PATTERN.test(line) ? line : `- ${line}`)
}

function buildStructuredMarkdown(text: string): string {
  const sourceLines = text
    .replace(/\r\n?/g, '\n')
    .replace(/\f/g, '\n')
    .split('\n')
    .map(cleanLine)

  const sections = new Map<CanonicalSection, string[]>()
  const preamble: string[] = []
  let currentSection: CanonicalSection | null = null

  for (const line of sourceLines) {
    if (!line) {
      continue
    }

    const identifiedSection = identifySection(line)
    if (identifiedSection) {
      currentSection = identifiedSection
      if (!sections.has(currentSection)) {
        sections.set(currentSection, [])
      }
      continue
    }

    if (currentSection) {
      sections.get(currentSection)?.push(line)
    } else {
      preamble.push(line)
    }
  }

  const basicLines = [...preamble, ...(sections.get('基本信息') ?? [])]
  if (basicLines.length > 0) {
    sections.set('基本信息', basicLines)
  }

  const markdownParts: string[] = []
  for (const entry of SECTION_ALIASES) {
    const section = entry.section
    const lines = sections.get(section)
    if (!lines?.length) {
      continue
    }

    let normalizedLines: string[]
    if (section === '基本信息') {
      normalizedLines = inferBasicInfo(lines)
    } else if (section === '教育背景') {
      normalizedLines = normalizeEducationLines(lines)
    } else if (section === '专业技能' || section === '获奖情况') {
      normalizedLines = normalizeSimpleList(lines)
    } else {
      normalizedLines = normalizeEntryLines(lines, section)
    }

    if (normalizedLines.length > 0) {
      markdownParts.push(`## ${section}`, ...normalizedLines, '')
    }
  }

  return markdownParts.join('\n').trim()
}

export function parseExtractedResumeText(text: string, fileName: string): ImportedResumeData {
  const normalizedText = text.split(String.fromCharCode(0)).join('').trim()
  if (normalizedText.length < 10) {
    throw new Error('没有识别到足够的简历文字，请确认文件内容完整')
  }

  if (/^#{1,6}\s+\S/m.test(normalizedText)) {
    try {
      return parseMarkdownResume(normalizedText, fileName)
    } catch {
      // Word/PDF 中的井号可能只是正文，继续走纯文本归一化。
    }
  }

  const structuredMarkdown = buildStructuredMarkdown(normalizedText)
  if (!structuredMarkdown) {
    throw new Error('没有识别到基本信息、教育、经历、项目或技能等简历栏目，请检查文件结构')
  }

  try {
    return parseMarkdownResume(structuredMarkdown, fileName)
  } catch {
    throw new Error('识别到了文字，但无法映射为简历模块；请补充“基本信息、教育背景、工作经历、项目经历、专业技能”等栏目标题后重试')
  }
}

export const plainTextTestUtils = {
  buildStructuredMarkdown,
  identifySection,
  isBodyLabel,
}
