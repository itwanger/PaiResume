import assert from 'node:assert/strict'
import test from 'node:test'
import { parseExtractedResumeText } from '../../src/utils/importers/plainText'

test('Word/PDF 提取出的普通文本可以映射为现有简历模块', () => {
  const result = parseExtractedResumeText([
    '张三',
    '手机：13800138000',
    '邮箱：zhang@example.com',
    '求职意向：Java 开发工程师',
    '教育经历',
    '郑州大学',
    '计算机科学与技术 本科',
    '2020.09 - 2024.06',
    '项目经历',
    '派简历',
    '后端开发 2023.09 - 2024.06',
    '项目描述：在线简历编辑器',
    '技术栈：Java、React',
    '- 负责核心模块开发',
    '技能清单',
    'Java、Spring Boot、MySQL',
  ].join('\n'), '张三.docx')

  assert.equal(result.title, '张三-Java 开发工程师')
  assert.deepEqual(result.modules.map((module) => module.moduleType), [
    'basic_info',
    'education',
    'project',
    'skill',
  ])
  assert.deepEqual(result.modules[0].content, {
    name: '张三',
    email: 'zhang@example.com',
    jobIntention: 'Java 开发工程师',
    targetCity: '',
    salaryRange: '',
    expectedEntryDate: '',
    phone: '13800138000',
    wechat: '',
    isPartyMember: false,
    photo: '',
    photoBorder: false,
    hometown: '',
    blog: '',
    github: '',
    leetcode: '',
    workYears: '',
    summary: '',
  })
  assert.equal(result.modules[1].content.school, '郑州大学')
  assert.equal(result.modules[1].content.startDate, '2020-09')
  assert.equal(result.modules[2].content.projectName, '派简历')
  assert.equal(result.modules[2].content.role, '后端开发')
  assert.deepEqual(result.modules[2].content.achievements, ['负责核心模块开发'])
})

test('英文栏目和常见英文标签可以归一化', () => {
  const result = parseExtractedResumeText([
    'PROFILE',
    'Name: Zhang San',
    'Email: zhang@example.com',
    'Phone: 13800138000',
    'PROJECTS',
    'PaiResume',
    'Backend Developer 2023.09 - 2024.06',
    'Description: Online resume editor',
    'Technologies: TypeScript, React',
    'SKILLS',
    'TypeScript, React, Java',
  ].join('\n'), 'resume.pdf')

  assert.equal(result.title, 'Zhang San')
  assert.equal(result.modules[0].content.email, 'zhang@example.com')
  assert.equal(result.modules.find((module) => module.moduleType === 'project')?.content.projectName, 'PaiResume')
})

test('summary 按所在栏目归类，正文中的“技术”不会被误识别成技术栈标签', () => {
  const result = parseExtractedResumeText([
    'PROFILE',
    'Name: Zhang San',
    'Email: zhang@example.com',
    'Summary: 熟悉 Java 技术架构与微服务',
    'PROJECTS',
    'PaiResume',
    'Backend Developer 2023.09 - 2024.06',
    'Summary: Online resume editor',
    'Technologies: TypeScript, React',
  ].join('\n'), 'resume.pdf')

  const basicInfo = result.modules.find((module) => module.moduleType === 'basic_info')?.content
  const project = result.modules.find((module) => module.moduleType === 'project')?.content
  assert.equal(basicInfo?.summary, '熟悉 Java 技术架构与微服务')
  assert.equal(project?.description, 'Online resume editor')
  assert.equal(project?.techStack, 'TypeScript, React')
})

test('同一行出现手机号和邮箱时不会把后续字段混入手机号', () => {
  const result = parseExtractedResumeText([
    '基本信息',
    '姓名：陈同学',
    '手机号：13800000000 邮箱：student@example.com',
    '专业技能',
    'Java、Spring Boot',
  ].join('\n'), '校园简历.pdf')

  assert.equal(result.modules[0].content.phone, '13800000000')
  assert.equal(result.modules[0].content.email, 'student@example.com')
})

test('紧凑 PDF 行可以拆分多个基本字段、教育字段和职责列表', () => {
  const result = parseExtractedResumeText([
    '陈同学',
    '电话：13800000000 邮箱：student@example.com',
    '工作年限：应届生 微信：campus_dev',
    '籍贯：广东 求职意向：后端开发 / AI 应用开发',
    '个人总结：专注 Java 后端与 AI 应用工程。',
    '教育背景',
    '某工业大学 计算机科学与技术 · 本科 2023年-9月至2027年-6月',
    '项目经历',
    '企业级 AI 知识库管理系统 - 后端开发',
    '技术栈：Spring Boot / Redis / Kafka / Elasticsearch',
    '项目简介：基于 RAG 架构的企业知识库平台。',
    '核心职责：',
    '• 基于 WebSocket 实现流式问答。',
    '• 使用 Kafka 构建异步文档处理。',
  ].join('\n'), '校园简历.pdf')

  const basicInfo = result.modules[0].content
  assert.equal(basicInfo.wechat, 'campus_dev')
  assert.equal(basicInfo.workYears, '应届生')
  assert.equal(basicInfo.hometown, '广东')
  assert.equal(basicInfo.jobIntention, '后端开发 / AI 应用开发')
  assert.equal(basicInfo.summary, '专注 Java 后端与 AI 应用工程。')

  const education = result.modules.find((module) => module.moduleType === 'education')?.content
  assert.equal(education?.school, '某工业大学')
  assert.equal(education?.major, '计算机科学与技术')
  assert.equal(education?.degree, '本科')
  assert.equal(education?.startDate, '2023-09')
  assert.equal(education?.endDate, '2027-06')

  const project = result.modules.find((module) => module.moduleType === 'project')?.content
  assert.equal(project?.projectName, '企业级 AI 知识库管理系统')
  assert.equal(project?.role, '后端开发')
  assert.deepEqual(project?.achievements, [
    '基于 WebSocket 实现流式问答。',
    '使用 Kafka 构建异步文档处理。',
  ])
})

test('缺少可识别栏目时不给出伪成功结果', () => {
  assert.throws(
    () => parseExtractedResumeText('随意内容\n这里没有任何可识别的简历栏目，也没有姓名等可靠字段。', 'bad.pdf'),
    /没有识别到基本信息、教育、经历、项目或技能等简历栏目/
  )
})

test('同一栏目中的多段经历不会被合并成一段', () => {
  const result = parseExtractedResumeText([
    '基本信息',
    '姓名：李雷',
    '工作经历',
    '甲公司',
    'Java 工程师 2021.01 - 2022.06',
    '- 负责订单服务',
    '乙公司',
    '后端工程师 2022.07 - 至今',
    '- 负责支付服务',
  ].join('\n'), '李雷.pdf')

  const experiences = result.modules.filter((module) => module.moduleType === 'work_experience')
  assert.equal(experiences.length, 2)
  assert.equal(experiences[0].content.company, '甲公司')
  assert.equal(experiences[1].content.company, '乙公司')
})

test('科研经历保留工作内容，不会被改写为无法读取的职责标签', () => {
  const result = parseExtractedResumeText([
    '基本信息',
    '姓名：王同学',
    '科研经历',
    '大模型推理优化 2023.09 - 2024.06',
    '工作内容：实现量化算法原型并完成消融实验',
    '研究成果：论文被录用',
  ].join('\n'), '科研简历.docx')

  const research = result.modules.find((module) => module.moduleType === 'research')?.content
  assert.equal(research?.projectName, '大模型推理优化')
  assert.equal(research?.workContent, '实现量化算法原型并完成消融实验')
  assert.equal(research?.achievements, '论文被录用')
})

test('单行公司、职位和日期在有明确公司后缀与职位词时保守拆分', () => {
  const result = parseExtractedResumeText([
    '基本信息',
    '姓名：李雷',
    '工作经历',
    '某科技有限公司 Java 开发工程师 2021.01 - 2023.06',
    '- 负责订单服务',
    '实习经历',
    'Acme Inc. Backend Engineer 2020.01 - 2020.06',
    '- 负责内部平台',
  ].join('\n'), '李雷.pdf')

  const work = result.modules.find((module) => module.moduleType === 'work_experience')?.content
  const internship = result.modules.find((module) => module.moduleType === 'internship')?.content
  assert.equal(work?.company, '某科技有限公司')
  assert.equal(work?.position, 'Java 开发工程师')
  assert.equal(work?.startDate, '2021-01')
  assert.equal(work?.endDate, '2023-06')
  assert.equal(internship?.company, 'Acme Inc.')
  assert.equal(internship?.position, 'Backend Engineer')
})
