import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { Font } from '@react-pdf/renderer'
import { expect, it, vi } from 'vitest'
import type { ResumeModule } from '../../src/api/resume'

it('科研名称和周期同排，科研内容按独立条目输出到 PDF', async () => {
  const browserWindow = globalThis.window
  vi.stubGlobal('window', undefined)
  const { generateResumePdfBlob } = await import('../../src/utils/resumePdf')
  vi.stubGlobal('window', browserWindow)
  Font.clear()
  Font.register({ family: 'Helvetica', fonts: [
    { src: 'Helvetica', fontWeight: 400 },
    { src: 'Helvetica-Bold', fontWeight: 700 },
  ] })
  Font.register({ family: 'ResumePdfSans', fonts: [
    { src: `${process.cwd()}/public/fonts/noto-sans-sc-regular.ttf`, fontWeight: 400 },
    { src: `${process.cwd()}/public/fonts/noto-sans-sc-bold.ttf`, fontWeight: 700 },
  ] })
  const research: ResumeModule = {
    id: 21,
    resumeId: 1,
    moduleType: 'research',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
    content: {
      projectName: '海上信息系统体系架构动态演化',
      projectCycle: '2025-3~2025-8',
      workContent: ['参与需求分析', '梳理分层协作方案'],
    },
  }

  const blob = await generateResumePdfBlob([research], { templateId: 'focus' })
  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
  const document = await getDocument({ data: bytes }).promise
  const page = await document.getPage(1)
  const content = await page.getTextContent()
  const items = content.items.filter((item): item is typeof item & { str: string; transform: number[] } => 'str' in item && 'transform' in item)
  const title = items.find((item) => item.str.includes('海上信息系统体系架构动态演化'))
  const cycle = items.find((item) => item.str.includes('2025-3~2025-8'))
  const text = items.map((item) => item.str).join('')
  const rows: Array<{ y: number; text: string }> = []
  for (const item of items) {
    const y = item.transform[5]
    const row = rows.find((candidate) => Math.abs(candidate.y - y) < 0.5)
    if (row) row.text += item.str
    else rows.push({ y, text: item.str })
  }
  expect(title).toBeDefined()
  expect(cycle).toBeDefined()
  expect(Math.abs(title!.transform[5] - cycle!.transform[5])).toBeLessThan(0.5)
  expect(text).toContain('参与需求分析')
  expect(text).toContain('梳理分层协作方案')
  expect(rows.find((row) => row.text.includes('参与需求分析'))?.y)
    .not.toBe(rows.find((row) => row.text.includes('梳理分层协作方案'))?.y)
})
