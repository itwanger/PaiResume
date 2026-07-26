import { parseMarkdownResume, type ImportedResumeData } from './markdown'
import { parsePdfResume } from './pdf'
import { validateResumeImportFile } from './validation'
import { parseWordResume } from './word'

export type ResumeImportType = 'markdown' | 'word' | 'pdf'

export interface ResumeImporter {
  type: ResumeImportType
  label: string
  accept: string
  enabled: boolean
  description: string
  parse?: (file: File) => Promise<ImportedResumeData>
}

export type { ImportedResumeData, ImportedResumeModule } from './markdown'

const MARKDOWN_FILE_PATTERN = /\.(md|markdown|txt)$/i
const WORD_FILE_PATTERN = /\.(doc|docx)$/i
const PDF_FILE_PATTERN = /\.pdf$/i

export const resumeImporters: ResumeImporter[] = [
  {
    type: 'markdown',
    label: 'Markdown',
    accept: '.md,.markdown,.txt,text/markdown,text/plain',
    enabled: true,
    description: '导入结构化 Markdown 简历',
    parse: async (file) => {
      validateResumeImportFile(file, 'markdown')
      return parseMarkdownResume(await file.text(), file.name)
    },
  },
  {
    type: 'word',
    label: 'Word',
    accept: '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    enabled: true,
    description: '导入 DOCX 简历（旧版 DOC 请先另存）',
    parse: parseWordResume,
  },
  {
    type: 'pdf',
    label: 'PDF',
    accept: '.pdf,application/pdf',
    enabled: true,
    description: '导入可复制文字的 PDF 简历',
    parse: parsePdfResume,
  },
]

export function getResumeImporter(type: ResumeImportType): ResumeImporter | undefined {
  return resumeImporters.find((importer) => importer.type === type)
}

export function detectResumeImportType(file: File): ResumeImportType | null {
  if (
    MARKDOWN_FILE_PATTERN.test(file.name)
    || file.type === 'text/markdown'
    || file.type === 'text/plain'
  ) {
    return 'markdown'
  }
  if (
    WORD_FILE_PATTERN.test(file.name)
    || file.type === 'application/msword'
    || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'word'
  }
  if (PDF_FILE_PATTERN.test(file.name) || file.type === 'application/pdf') {
    return 'pdf'
  }
  return null
}
