import type { ResumeImportType } from './index'

const KIBIBYTE = 1024
const MEBIBYTE = 1024 * KIBIBYTE

export const MAX_IMPORT_FILE_BYTES: Record<ResumeImportType, number> = {
  markdown: 2 * MEBIBYTE,
  word: 10 * MEBIBYTE,
  pdf: 10 * MEBIBYTE,
}

const ALLOWED_EXTENSIONS: Record<ResumeImportType, ReadonlySet<string>> = {
  markdown: new Set(['md', 'markdown', 'txt']),
  word: new Set(['docx']),
  pdf: new Set(['pdf']),
}

const ALLOWED_MIME_TYPES: Record<ResumeImportType, ReadonlySet<string>> = {
  markdown: new Set(['text/markdown', 'text/x-markdown', 'application/x-markdown', 'text/plain']),
  word: new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed',
  ]),
  pdf: new Set(['application/pdf']),
}

const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream'])

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  return lastDot >= 0 ? fileName.slice(lastDot + 1).toLowerCase() : ''
}

function formatMegabytes(bytes: number): string {
  return `${Math.floor(bytes / MEBIBYTE)} MB`
}

export function validateResumeImportFile(file: File, type: ResumeImportType): void {
  const extension = getFileExtension(file.name)

  if (type === 'word' && extension === 'doc') {
    throw new Error('暂不支持旧版 .doc 文件，请先用 Word 或 WPS 另存为 .docx 后再导入')
  }

  if (!ALLOWED_EXTENSIONS[type].has(extension)) {
    const expected = Array.from(ALLOWED_EXTENSIONS[type]).map((item) => `.${item}`).join('、')
    throw new Error(`文件扩展名不正确，请选择 ${expected} 文件`)
  }

  if (file.size <= 0) {
    throw new Error('文件内容为空，请选择有效的简历文件')
  }

  const maxBytes = MAX_IMPORT_FILE_BYTES[type]
  if (file.size > maxBytes) {
    throw new Error(`文件过大，${type === 'markdown' ? 'Markdown / TXT' : type === 'word' ? 'DOCX' : 'PDF'} 文件不能超过 ${formatMegabytes(maxBytes)}`)
  }

  const normalizedMimeType = file.type.toLowerCase().trim()
  if (!GENERIC_MIME_TYPES.has(normalizedMimeType) && !ALLOWED_MIME_TYPES[type].has(normalizedMimeType)) {
    throw new Error('文件类型与扩展名不一致，请重新选择原始文件')
  }
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d
}

export function hasZipSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    return false
  }

  const third = bytes[2]
  const fourth = bytes[3]
  return (
    (third === 0x03 && fourth === 0x04)
    || (third === 0x05 && fourth === 0x06)
    || (third === 0x07 && fourth === 0x08)
  )
}
