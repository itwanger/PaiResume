import {
  Document,
  Font,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer'
import type { ResumeModule } from '../api/resume'
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
} from './moduleContent'

Font.registerHyphenationCallback((word) => [word])
Font.register({
  family: 'ResumePdfSans',
  fonts: [
    { src: '/fonts/noto-sans-sc-regular.otf', fontWeight: 400 },
    { src: '/fonts/noto-sans-sc-bold.otf', fontWeight: 700 },
  ],
})

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 11.2,
    color: '#0f172a',
    lineHeight: 1.5,
    fontFamily: 'ResumePdfSans',
  },
  header: {
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 12.5,
    color: '#1f2937',
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    color: '#374151',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  item: {
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  strong: {
    fontWeight: 700,
  },
  label: {
    color: '#475569',
    fontWeight: 700,
  },
  muted: {
    color: '#4b5563',
  },
  wrappedTextRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  orderedItem: {
    marginTop: 2,
    marginLeft: 14,
  },
  inlineMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
    columnGap: 12,
  },
  inlineMetaItem: {
    marginRight: 12,
    marginBottom: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    fontSize: 9,
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  paragraph: {
    marginTop: 4,
    whiteSpace: 'pre-wrap',
  },
  listItem: {
    marginTop: 2,
  },
})

function sortModules(modules: ResumeModule[]) {
  return [...modules].sort((a, b) => {
    if (a.sortOrder === b.sortOrder) {
      return a.id - b.id
    }
    return a.sortOrder - b.sortOrder
  })
}

function formatMonth(value: string) {
  if (!value) return ''
  const [year, month] = value.split('-')
  if (!year || !month) return value
  return `${year}年-${Number(month)}月`
}

function formatMonthRange(start: string, end: string) {
  const startText = formatMonth(start)
  const endText = formatMonth(end)
  if (startText && endText) return `${startText}至${endText}`
  return startText || endText
}

function formatAwardDisplayTime(value: string) {
  if (!value) return ''
  const [year] = value.split('-')
  return year ? `${year}年` : value
}

function tokenizeMixedText(value: string) {
  const rawTokens = value.match(/[\u3400-\u9fff\uf900-\ufaff，。；：？！、】【（）]|[A-Za-z0-9+#./:_-]+|\s+|./g) || []
  const attachToPrevious = new Set(['，', '。', '；', '：', '？', '！', '、', ',', '.', ';', ':', '?', '!', '）', '】', ')', ']'])
  const attachToNext = new Set(['（', '【', '(', '['])
  const mergedTokens: string[] = []
  let pendingPrefix = ''

  for (const token of rawTokens) {
    if (attachToNext.has(token)) {
      pendingPrefix += token
      continue
    }

    if (attachToPrevious.has(token)) {
      let targetIndex = mergedTokens.length - 1
      while (targetIndex >= 0 && /^\s+$/.test(mergedTokens[targetIndex])) {
        targetIndex -= 1
      }

      if (targetIndex >= 0) {
        mergedTokens[targetIndex] += token
      } else {
        pendingPrefix += token
      }
      continue
    }

    if (/^\s+$/.test(token)) {
      if (pendingPrefix) {
        mergedTokens.push(pendingPrefix)
        pendingPrefix = ''
      }
      mergedTokens.push(token)
      continue
    }

    mergedTokens.push(`${pendingPrefix}${token}`)
    pendingPrefix = ''
  }

  if (pendingPrefix) {
    mergedTokens.push(pendingPrefix)
  }

  return mergedTokens
}

function renderWrappedLabeledText(label: string, value: string, keyPrefix: string) {
  return (
    <View style={styles.wrappedTextRow}>
      <Text style={styles.label}>{label}</Text>
      {tokenizeMixedText(value).map((token, index) => (
        <Text key={`${keyPrefix}-${index}`}>{token}</Text>
      ))}
    </View>
  )
}

function renderOrderedItem(value: string, index: number, keyPrefix: string) {
  return (
    <View style={styles.orderedItem}>
      <View style={styles.wrappedTextRow}>
        <Text>{`${index + 1}、`}</Text>
        {tokenizeMixedText(value).map((token, tokenIndex) => (
          <Text key={`${keyPrefix}-${tokenIndex}`}>{token}</Text>
        ))}
      </View>
    </View>
  )
}

function renderBulletItem(value: string, keyPrefix: string) {
  return (
    <View style={styles.orderedItem}>
      <View style={styles.wrappedTextRow}>
        <Text>• </Text>
        {tokenizeMixedText(value).map((token, tokenIndex) => (
          <Text key={`${keyPrefix}-${tokenIndex}`}>{token}</Text>
        ))}
      </View>
    </View>
  )
}

function normalizeExternalUrl(value: string) {
  if (!value) return ''
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function buildFileName(modules: ResumeModule[], resumeId: number) {
  const basicInfoModule = modules.find((module) => module.moduleType === 'basic_info')
  const educationModule = modules.find((module) => module.moduleType === 'education')
  const jobIntentionModule = modules.find((module) => module.moduleType === 'job_intention')
  const basicInfo = basicInfoModule ? normalizeBasicInfoContent(basicInfoModule.content) : null
  const education = educationModule ? normalizeEducationContent(educationModule.content) : null
  const jobIntention = jobIntentionModule ? normalizeJobIntentionContent(jobIntentionModule.content) : null

  const segments = [
    basicInfo?.name.trim() || '',
    education?.school.trim() || '',
    basicInfo?.jobIntention.trim() || jobIntention?.targetPosition.trim() || '',
  ]
    .filter(Boolean)
    .map((part) => part.replace(/[\\/:*?"<>|]/g, '-').trim())

  const baseName = segments.join('-') || `resume-${resumeId}`
  return `${baseName}.pdf`
}

function ResumePdfDocument({ modules }: { modules: ResumeModule[] }) {
  const sortedModules = sortModules(modules)
  const basicInfoModule = sortedModules.find((module) => module.moduleType === 'basic_info')
  const basicInfo = basicInfoModule ? normalizeBasicInfoContent(basicInfoModule.content) : null
  const jobIntentionModule = sortedModules.find((module) => module.moduleType === 'job_intention')
  const jobIntention = jobIntentionModule ? normalizeJobIntentionContent(jobIntentionModule.content) : null
  const displayJobIntention = basicInfo?.jobIntention || jobIntention?.targetPosition || ''
  const hasEducationModule = sortedModules.some((module) => module.moduleType === 'education')
  const awardModules = sortedModules
    .filter((module) => module.moduleType === 'award')
    .map((module) => normalizeAwardContent(module.content))
    .filter((award) => award.awardName || award.awardTime)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {basicInfo && (
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>
                <Text style={styles.label}>姓名：</Text>
                {basicInfo.name || '未填写'}
              </Text>
              {displayJobIntention ? (
                <Text style={styles.subtitle}>
                  <Text style={styles.label}>求职意向：</Text>
                  {displayJobIntention}
                </Text>
              ) : null}
            </View>
            <View style={styles.contactRow}>
              {basicInfo.email ? <Text><Text style={styles.label}>邮箱：</Text>{basicInfo.email}</Text> : null}
              {basicInfo.phone ? <Text><Text style={styles.label}>手机号：</Text>{basicInfo.phone}</Text> : null}
              {basicInfo.wechat ? <Text><Text style={styles.label}>微信：</Text>{basicInfo.wechat}</Text> : null}
              {basicInfo.targetCity ? <Text><Text style={styles.label}>意向城市：</Text>{basicInfo.targetCity}</Text> : null}
              {basicInfo.salaryRange ? <Text><Text style={styles.label}>期望薪资：</Text>{basicInfo.salaryRange}</Text> : null}
              {basicInfo.expectedEntryDate ? <Text><Text style={styles.label}>到岗时间：</Text>{basicInfo.expectedEntryDate}</Text> : null}
              {basicInfo.github ? (
                <Text>
                  <Text style={styles.label}>GitHub：</Text>
                  <Link src={normalizeExternalUrl(basicInfo.github)}>{basicInfo.github}</Link>
                </Text>
              ) : null}
              {basicInfo.blog ? (
                <Text>
                  <Text style={styles.label}>博客：</Text>
                  <Link src={normalizeExternalUrl(basicInfo.blog)}>{basicInfo.blog}</Link>
                </Text>
              ) : null}
              {basicInfo.hometown ? <Text><Text style={styles.label}>籍贯：</Text>{basicInfo.hometown}</Text> : null}
              {basicInfo.workYears ? <Text><Text style={styles.label}>工作年限：</Text>{basicInfo.workYears}</Text> : null}
              {basicInfo.leetcode ? <Text><Text style={styles.label}>LeetCode：</Text>{basicInfo.leetcode}</Text> : null}
            </View>
            {basicInfo.summary ? (
              <Text style={styles.paragraph}>
                <Text style={styles.label}>个人总结：</Text>
                {basicInfo.summary}
              </Text>
            ) : null}
          </View>
        )}

        {sortedModules.map((module) => {
          switch (module.moduleType) {
            case 'basic_info':
              return null
            case 'education': {
              const content = normalizeEducationContent(module.content)
              const awards = awardModules
              const schoolTags = [
                content.is985 ? '985' : '',
                content.is211 ? '211' : '',
                content.isDoubleFirst ? '双一流' : '',
              ].filter(Boolean)
              const firstRowItems = [
                content.degree ? `学历：${content.degree}` : '',
                formatMonthRange(content.startDate, content.endDate),
              ].filter(Boolean)
              const secondRowItems = [
                content.department ? `院系：${content.department}` : '',
                content.major ? `专业：${content.major}` : '',
              ].filter(Boolean)
              return (
                <View key={module.id} style={styles.section}>
                  <Text style={styles.sectionTitle}>教育背景</Text>
                  <View style={styles.item}>
                    <View style={styles.rowBetween}>
                      <View style={styles.inlineMeta}>
                        <Text style={styles.inlineMetaItem}>
                          <Text style={styles.label}>学校：</Text>
                          <Text style={styles.strong}>{content.school || '未填写'}</Text>
                        </Text>
                        {schoolTags.map((tag) => (
                          <Text key={tag} style={styles.chip}>{tag}</Text>
                        ))}
                      </View>
                      <View style={styles.inlineMeta}>
                        {firstRowItems.map((item) => (
                          <Text key={item} style={[styles.inlineMetaItem, styles.muted]}>{item}</Text>
                        ))}
                      </View>
                    </View>
                    <View style={styles.inlineMeta}>
                      {secondRowItems.map((item) => (
                        <Text key={item} style={styles.inlineMetaItem}>{item}</Text>
                      ))}
                    </View>
                    {awards.length > 0 ? (
                      <View style={{ marginTop: 4 }}>
                        {awards.map((award, index) => (
                          <Text key={`${award.awardName}-${index}`} style={styles.paragraph}>
                            <Text style={styles.label}>奖项：</Text>
                            {award.awardName}
                            {award.awardTime ? `（${formatAwardDisplayTime(award.awardTime)}）` : ''}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              )
            }
            case 'internship': {
              const content = normalizeInternshipContent(module.content)
              const titleLine = [content.company, content.position, content.projectName].filter(Boolean).join(' - ')
              return (
                <View key={module.id} style={styles.section}>
                  <Text style={styles.sectionTitle}>实习经历</Text>
                  <View style={styles.item}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.strong}>{titleLine || '公司 - 职位 - 项目名'}</Text>
                      <Text style={styles.muted}>{formatMonthRange(content.startDate, content.endDate)}</Text>
                    </View>
                    {content.projectDescription ? (
                      <View style={styles.paragraph}>
                        {renderWrappedLabeledText('项目简介：', content.projectDescription, `summary-${module.id}`)}
                      </View>
                    ) : null}
                    {content.techStack ? <Text style={styles.paragraph}><Text style={styles.label}>技术栈：</Text>{content.techStack}</Text> : null}
                    {content.responsibilities.length > 0 ? (
                      <View style={styles.paragraph}>
                        <Text><Text style={styles.label}>核心职责：</Text></Text>
                        {content.responsibilities.map((line, index) => (
                          <View key={`${index}-${line}`} style={styles.listItem}>
                            {renderOrderedItem(line, index, `duty-${module.id}-${index}`)}
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              )
            }
            case 'project': {
              const content = normalizeProjectContent(module.content)
              const titleLine = [content.projectName, content.role].filter(Boolean).join(' - ')
              return (
                <View key={module.id} style={styles.section}>
                  <Text style={styles.sectionTitle}>项目经历</Text>
                  <View style={styles.item}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.strong}>{titleLine || '项目 - 角色'}</Text>
                      <Text style={styles.muted}>{formatMonthRange(content.startDate, content.endDate)}</Text>
                    </View>
                    {content.techStack ? <Text style={styles.paragraph}>技术栈：{content.techStack}</Text> : null}
                    {content.description ? (
                      <View style={styles.paragraph}>
                        {renderWrappedLabeledText('项目简介：', content.description, `project-summary-${module.id}`)}
                      </View>
                    ) : null}
                    {content.achievements.length > 0 ? (
                      <View style={styles.paragraph}>
                        <Text><Text style={styles.label}>核心职责：</Text></Text>
                        {content.achievements.map((item, index) => (
                          <View key={`${index}-${item}`} style={styles.listItem}>
                            {renderOrderedItem(item, index, `project-${module.id}-${index}`)}
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              )
            }
            case 'skill': {
              const content = normalizeSkillContent(module.content)
              return (
                <View key={module.id} style={styles.section}>
                  <Text style={styles.sectionTitle}>专业技能</Text>
                  {content.categories
                    .filter((category) => category.items.length > 0)
                    .map((category, index) => {
                      const hasTitle = Boolean(category.name.trim())
                      const shouldRenderAsList = !hasTitle || category.items.some((item) => item.length > 20 || /[，。；]/.test(item))

                      if (shouldRenderAsList) {
                        return (
                          <View key={index} style={styles.item}>
                            {hasTitle ? <Text style={styles.strong}>{category.name}</Text> : null}
                            {category.items.map((item, itemIndex) => (
                              <View key={itemIndex} style={styles.listItem}>
                                {renderBulletItem(item, `skill-${index}-${itemIndex}`)}
                              </View>
                            ))}
                          </View>
                        )
                      }

                      return (
                        <Text key={index} style={styles.item}>
                          <Text style={styles.strong}>{category.name}：</Text>
                          {category.items.join('、')}
                        </Text>
                      )
                    })}
                </View>
              )
            }
            case 'paper': {
              const content = normalizePaperContent(module.content)
              if (!hasPaperContent(content)) {
                return null
              }
              return (
                <View key={module.id} style={styles.section}>
                  <Text style={styles.sectionTitle}>论文发表</Text>
                  <Text style={styles.strong}>{content.journalName || '论文'}</Text>
                  <Text>{[content.journalType, content.publishTime].filter(Boolean).join(' / ')}</Text>
                  {content.content ? <Text style={styles.paragraph}>{content.content}</Text> : null}
                </View>
              )
            }
            case 'research': {
              const content = normalizeResearchContent(module.content)
              if (!hasResearchContent(content)) {
                return null
              }
              return (
                <View key={module.id} style={styles.section}>
                  <Text style={styles.sectionTitle}>科研经历</Text>
                  <Text style={styles.strong}>{content.projectName || '科研项目'}</Text>
                  {content.projectCycle ? <Text>{content.projectCycle}</Text> : null}
                  {content.background ? <Text style={styles.paragraph}>背景：{content.background}</Text> : null}
                  {content.workContent ? <Text style={styles.paragraph}>工作：{content.workContent}</Text> : null}
                  {content.achievements ? <Text style={styles.paragraph}>成果：{content.achievements}</Text> : null}
                </View>
              )
            }
            case 'award': {
              if (hasEducationModule) {
                return null
              }
              const content = normalizeAwardContent(module.content)
              return (
                <View key={module.id} style={styles.section}>
                  <Text style={styles.sectionTitle}>获奖情况</Text>
                  <Text>
                    {content.awardName || '奖项'}
                    {content.awardTime ? `（${formatAwardDisplayTime(content.awardTime)}）` : ''}
                  </Text>
                </View>
              )
            }
            case 'job_intention':
              return null
            default:
              return null
          }
        })}
      </Page>
    </Document>
  )
}

export async function downloadResumePdf(modules: ResumeModule[], resumeId: number) {
  const blob = await generateResumePdfBlob(modules)
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = buildFileName(modules, resumeId)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}

export async function generateResumePdfBlob(modules: ResumeModule[]) {
  return pdf(<ResumePdfDocument modules={modules} />).toBlob()
}
