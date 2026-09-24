import { expect, it } from 'vitest'
import type { ResumeModule } from '../../src/api/resume'
import { normalizeResearchContent } from '../../src/utils/moduleContent'
import { generateResumeMarkdown } from '../../src/utils/resumeMarkdown'
import { parseMarkdownResume } from '../../src/utils/importers/markdown'

it('旧版多行科研内容转为独立条目，保留新版空白编辑项', () => {
  expect(normalizeResearchContent({ workContent: '- 第一条\n• 第二条\n\n第三条' }).workContent)
    .toEqual(['第一条', '第二条', '第三条'])
  expect(normalizeResearchContent({ workContent: ['第一条', ''] }).workContent).toEqual(['第一条', ''])
})

it('多条科研内容导出 Markdown 后仍可逐条导入', () => {
  const module: ResumeModule = {
    id: 1, resumeId: 1, moduleType: 'research', sortOrder: 1, createdAt: '', updatedAt: '',
    content: { projectName: '科研项目', workContent: ['第一条', '第二条'] },
  }
  const markdown = generateResumeMarkdown([module])
  const imported = parseMarkdownResume(markdown)
  const research = imported.modules.find((item) => item.moduleType === 'research')
  expect(normalizeResearchContent(research?.content || {}).workContent).toEqual(['第一条', '第二条'])
})
