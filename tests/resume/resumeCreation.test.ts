import assert from 'node:assert/strict'
import test from 'node:test'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { ResumeModule } from '../../src/api/resume'
import {
  RESUME_CREATE_PATH,
  buildResumeEditorPath,
} from '../../src/config/site'
import {
  buildEmailLoginPath,
  buildLoginPath,
  buildLoginPathForMode,
  getLoginEntryLabel,
  resolveLoginMethod,
} from '../../src/utils/navigation'
import {
  RESUME_TITLE_MAX_LENGTH,
  getResumeEditorEntryPath,
  getResumeImportTitle,
  getResumeTitleError,
  hasResumeCreateIntent,
  normalizeResumeTitle,
} from '../../src/utils/resumeCreation'
import { downloadResumeMarkdown, generateResumeMarkdown } from '../../src/utils/resumeMarkdown'
import { generateResumePdfBlob, type ResumePdfTemplateId } from '../../src/utils/resumePdf'

test('简历名称会去除首尾空格且不能为空', () => {
  assert.equal(normalizeResumeTitle('  Java 后端求职简历  '), 'Java 后端求职简历')
  assert.equal(getResumeTitleError('   '), '请输入简历名称')
  assert.equal(getResumeTitleError('Java 后端求职简历'), null)
})

test('简历名称最多允许 128 个字符', () => {
  assert.equal(getResumeTitleError('简'.repeat(RESUME_TITLE_MAX_LENGTH)), null)
  assert.equal(
    getResumeTitleError('简'.repeat(RESUME_TITLE_MAX_LENGTH + 1)),
    '简历名称不能超过 128 个字符',
  )
})

test('导入简历优先使用识别标题，否则使用源文件名', () => {
  assert.equal(
    getResumeImportTitle('  Java 后端简历  ', '旧文件名.pdf'),
    'Java 后端简历',
  )
  assert.equal(getResumeImportTitle('', '王小明-产品经理.docx'), '王小明-产品经理')
  assert.equal(getResumeImportTitle('', '.pdf'), '导入的简历')
  assert.equal(
    getResumeImportTitle(`${'a'.repeat(127)}😀`, '旧文件名.pdf'),
    'a'.repeat(127),
  )
})

test('创建意图只识别明确的 create=1', () => {
  assert.equal(hasResumeCreateIntent('?create=1'), true)
  assert.equal(hasResumeCreateIntent('?source=home&create=1'), true)
  assert.equal(hasResumeCreateIntent('?create=0'), false)
  assert.equal(hasResumeCreateIntent(''), false)
})

test('编辑入口有简历时打开最近一份，无简历时进入命名流程', () => {
  assert.equal(
    getResumeEditorEntryPath([{ id: 42 }, { id: 7 }]),
    buildResumeEditorPath(42),
  )
  assert.equal(getResumeEditorEntryPath([]), RESUME_CREATE_PATH)
})

test('未登录用户完成登录后仍能回到命名流程', () => {
  const loginPath = buildLoginPath(RESUME_CREATE_PATH)
  const redirect = new URLSearchParams(loginPath.split('?')[1]).get('redirect')

  assert.equal(redirect, RESUME_CREATE_PATH)
})

test('登录入口会区分本地开发邮箱登录与生产扫码登录', () => {
  assert.equal(buildLoginPathForMode('development'), '/login?method=email')
  assert.equal(
    buildLoginPathForMode('development', RESUME_CREATE_PATH),
    `/login?method=email&redirect=${encodeURIComponent(RESUME_CREATE_PATH)}`,
  )
  assert.equal(buildLoginPathForMode('production'), '/login')
  assert.equal(
    buildLoginPathForMode('production', RESUME_CREATE_PATH),
    `/login?redirect=${encodeURIComponent(RESUME_CREATE_PATH)}`,
  )
  assert.equal(buildLoginPathForMode('staging'), '/login')
  assert.equal(getLoginEntryLabel('development'), '本地邮箱登录')
  assert.equal(getLoginEntryLabel('production'), '扫码登录')
})

test('登录页允许显式选择登录方式，并按环境提供默认方式', () => {
  assert.equal(resolveLoginMethod(null, 'development'), 'email')
  assert.equal(resolveLoginMethod(null, 'production'), 'wechat')
  assert.equal(resolveLoginMethod('wechat', 'development'), 'wechat')
  assert.equal(resolveLoginMethod('email', 'production'), 'email')
})

test('管理员邮箱登录入口保留后台回跳地址', () => {
  assert.equal(
    buildEmailLoginPath('/admin'),
    '/login?method=email&redirect=%2Fadmin',
  )
})

const MARKDOWN_MODULES = [
  {
    id: 1,
    moduleType: 'basic_info',
    sortOrder: 1,
    content: {
      name: '沉默王二',
      jobIntention: 'AI应用开发工程师',
      email: 'qing_gee@163.com',
      github: 'https://github.com/itwanger/',
    },
  },
  {
    id: 2,
    moduleType: 'education',
    sortOrder: 2,
    content: {
      school: '郑州大学',
      degree: '硕士',
      startDate: '2024-09',
      endDate: '2027-06',
      department: '计算机',
      major: '计算机科学与技术',
      is211: true,
    },
  },
  {
    id: 3,
    moduleType: 'internship',
    sortOrder: 3,
    content: {
      company: '淘宝闪购',
      position: 'Agent开发',
      startDate: '2026-03',
      endDate: '至今',
      projects: [{
        id: 'pai-agent',
        projectName: 'PaiAgent/PaiFlow',
        techStack: 'Java 21、Spring Boot 3.4',
        projectDescription: '企业级 AI 工作流平台。',
        responsibilities: ['构建工作流引擎', '支持多厂商 LLM'],
      }],
    },
  },
  {
    id: 4,
    moduleType: 'project',
    sortOrder: 4,
    content: {
      projectName: '派聪明 RAG 知识库',
      role: 'AI应用开发',
      startDate: '2026-01',
      endDate: '2026-02',
      description: '企业级智能对话平台。',
      techStack: 'Spring Boot、Elasticsearch',
      achievements: ['实现混合检索'],
    },
  },
  {
    id: 5,
    moduleType: 'skill',
    sortOrder: 5,
    content: {
      categories: [
        { name: '', items: ['熟悉 RAG 与 Agent 应用开发。'] },
        { name: '工程能力', items: ['Java', 'TypeScript'] },
      ],
    },
  },
] as unknown as ResumeModule[]

test('Markdown 导出采用参考文件的分区、标题和职责格式', () => {
  const markdown = generateResumeMarkdown(MARKDOWN_MODULES)

  assert.match(markdown, /^# 基本信息\n\n姓名：沉默王二/m)
  assert.match(markdown, /## 教育背景\n\n### 郑州大学\n- 学历：硕士\n- 时间：2024年9月 - 2027年6月/)
  assert.match(markdown, /- 标签：211/)
  assert.match(markdown, /## 实习经历\n\n### 淘宝闪购｜Agent开发｜PaiAgent\/PaiFlow 2026-03 ～ 至今/)
  assert.match(markdown, /项目简介：企业级 AI 工作流平台。\n\n技术栈：Java 21、Spring Boot 3.4\n\n1\. 构建工作流引擎\n2\. 支持多厂商 LLM/)
  assert.match(markdown, /## 项目经历\n\n### 派聪明 RAG 知识库 AI应用开发 2026-01 ～ 2026-02/)
  assert.match(markdown, /核心职责：\n\n- 实现混合检索/)
  assert.match(markdown, /## 专业技能\n\n- 熟悉 RAG 与 Agent 应用开发。\n- \*\*工程能力\*\*：Java；TypeScript/)
  assert.ok(markdown.endsWith('\n'))
})

test('Markdown 下载使用安全文件名、UTF-8 内容并释放对象 URL', async () => {
  const clickedLinks: Array<{ href: string; download: string }> = []
  const blobs = new Map<string, Blob>()
  const revokedUrls: string[] = []
  const originalDocument = globalThis.document
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  globalThis.document = {
    createElement: () => ({
      href: '',
      download: '',
      click() {
        clickedLinks.push({ href: this.href, download: this.download })
      },
    }),
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
  } as unknown as Document
  URL.createObjectURL = ((blob: Blob): string => {
    blobs.set('blob:markdown', blob)
    return 'blob:markdown'
  }) as typeof URL.createObjectURL
  URL.revokeObjectURL = ((url: string) => revokedUrls.push(url)) as typeof URL.revokeObjectURL

  try {
    downloadResumeMarkdown(MARKDOWN_MODULES, 43, { documentTitle: '沉默王二/AI 简历.md' })

    assert.deepEqual(clickedLinks, [{ href: 'blob:markdown', download: '沉默王二-AI 简历.md' }])
    assert.equal(blobs.get('blob:markdown')?.type, 'text/markdown;charset=utf-8')
    assert.match(await blobs.get('blob:markdown')!.text(), /姓名：沉默王二/)
    assert.deepEqual(revokedUrls, ['blob:markdown'])
  } finally {
    globalThis.document = originalDocument
    if (originalCreateObjectURL) URL.createObjectURL = originalCreateObjectURL
    else delete URL.createObjectURL
    if (originalRevokeObjectURL) URL.revokeObjectURL = originalRevokeObjectURL
    else delete URL.revokeObjectURL
  }
})

test('高密技术与黑白模板将每条专业技能渲染为独立无序列表项', async () => {
  const modules = [
    {
      id: 1,
      resumeId: 1,
      moduleType: 'basic_info',
      sortOrder: 1,
      createdAt: '',
      updatedAt: '',
      content: { name: '技能列表校验' },
    },
    {
      id: 2,
      resumeId: 1,
      moduleType: 'skill',
      sortOrder: 2,
      createdAt: '',
      updatedAt: '',
      content: {
        categories: [{
          name: '',
          items: ['熟悉 Java 并发编程', '掌握 Agent 工具调用', '熟悉 Redis 高可用架构'],
        }],
      },
    },
  ] as ResumeModule[]
  const templateIds: ResumePdfTemplateId[] = ['vibe-resume', 'campus-black', 'technical-black']

  for (const templateId of templateIds) {
    const blob = await generateResumePdfBlob(modules, { templateId })
    const document = await getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
    const page = await document.getPage(1)
    const content = await page.getTextContent()
    const text = content.items
      .filter((item): item is typeof item & { str: string } => 'str' in item)
      .map((item) => item.str)
      .join('')

    assert.equal(text.match(/•/g)?.length, 3, `${templateId} 应为每条技能输出一个项目符号`)
    assert.match(text, /熟悉 Java 并发编程/)
    assert.match(text, /掌握 Agent 工具调用/)
    assert.match(text, /熟悉 Redis 高可用架构/)
  }
})
