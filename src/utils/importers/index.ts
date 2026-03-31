import { parseMarkdownResume, type ImportedResumeData } from './markdown'

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

export const resumeImporters: ResumeImporter[] = [
  {
    type: 'markdown',
    label: 'Markdown',
    accept: '.md,.markdown,.txt,text/markdown,text/plain',
    enabled: true,
    description: '导入结构化 Markdown 简历',
    parse: async (file) => parseMarkdownResume(await file.text(), file.name),
  },
  {
    type: 'word',
    label: 'Word',
    accept: '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    enabled: false,
    description: '即将支持 DOC / DOCX 导入',
  },
  {
    type: 'pdf',
    label: 'PDF',
    accept: '.pdf,application/pdf',
    enabled: false,
    description: '即将支持 PDF 导入',
  },
]

export function getResumeImporter(type: ResumeImportType): ResumeImporter | undefined {
  return resumeImporters.find((importer) => importer.type === type)
}
