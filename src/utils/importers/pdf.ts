import { parseExtractedResumeText } from './plainText'
import { hasPdfSignature, validateResumeImportFile } from './validation'
import type { ImportedResumeData } from './markdown'

const MAX_PDF_PAGES = 20
const MIN_EXTRACTED_TEXT_LENGTH = 20
export const MAX_PDF_TEXT_CHARACTERS = 500_000

interface PdfTextItemLike {
  str: string
  transform?: number[]
  width?: number
  hasEOL?: boolean
}

function isPdfTextItem(value: unknown): value is PdfTextItemLike {
  return Boolean(
    value
    && typeof value === 'object'
    && 'str' in value
    && typeof (value as { str?: unknown }).str === 'string'
  )
}

function shouldInsertSpace(previous: PdfTextItemLike | null, current: PdfTextItemLike): boolean {
  if (!previous?.transform || !current.transform || typeof previous.width !== 'number') {
    return true
  }

  const previousEndX = previous.transform[4] + previous.width
  const currentX = current.transform[4]
  const fontSize = Math.max(Math.abs(current.transform[0] || 0), Math.abs(current.transform[3] || 0), 8)
  return currentX - previousEndX > fontSize * 0.2
}

export function pdfTextItemsToLines(items: unknown[]): string[] {
  const lines: string[] = []
  let currentLine = ''
  let previousItem: PdfTextItemLike | null = null
  let previousY: number | null = null

  const flushLine = () => {
    const normalized = currentLine.replace(/\s+/g, ' ').trim()
    if (normalized) {
      lines.push(normalized)
    }
    currentLine = ''
    previousItem = null
  }

  for (const candidate of items) {
    if (!isPdfTextItem(candidate) || !candidate.str) {
      continue
    }

    const currentY = candidate.transform?.[5]
    if (
      previousY !== null
      && typeof currentY === 'number'
      && Math.abs(previousY - currentY) > 2
    ) {
      flushLine()
    }

    if (currentLine && shouldInsertSpace(previousItem, candidate)) {
      currentLine += ' '
    }
    currentLine += candidate.str
    previousItem = candidate
    if (typeof currentY === 'number') {
      previousY = currentY
    }

    if (candidate.hasEOL) {
      flushLine()
      previousY = null
    }
  }

  flushLine()
  return lines
}

export function assertPdfHasExtractableText(text: string): void {
  const meaningfulText = text.replace(/\s+/g, '')
  if (meaningfulText.length < MIN_EXTRACTED_TEXT_LENGTH) {
    throw new Error('未检测到可复制的文字，这可能是扫描版 PDF；当前暂不支持 OCR，请先转换为可搜索 PDF 或 DOCX 后再导入')
  }
}

export function assertPdfTextWithinLimit(characterCount: number): void {
  if (characterCount > MAX_PDF_TEXT_CHARACTERS) {
    throw new Error('PDF 提取出的文字过多，请精简到正常简历篇幅后再导入')
  }
}

async function loadPdfJs() {
  const pdfJs = await import('pdfjs-dist')
  if (typeof window !== 'undefined') {
    const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfJs.GlobalWorkerOptions.workerSrc = workerModule.default
  }
  return pdfJs
}

function mapPdfError(error: unknown): Error {
  const name = error && typeof error === 'object' && 'name' in error
    ? String((error as { name?: unknown }).name)
    : ''
  if (name === 'PasswordException') {
    return new Error('PDF 已加密或需要密码，请先移除密码后再导入')
  }
  if (name === 'InvalidPDFException' || name === 'MissingPDFException' || name === 'UnexpectedResponseException') {
    return new Error('PDF 文件损坏或格式无效，请重新导出后再试')
  }
  return error instanceof Error ? error : new Error('PDF 解析失败，请重新导出后再试')
}

export async function parsePdfResume(file: File): Promise<ImportedResumeData> {
  validateResumeImportFile(file, 'pdf')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!hasPdfSignature(bytes)) {
    throw new Error('文件内容不是有效的 PDF，请不要只修改文件扩展名')
  }

  try {
    const pdfJs = await loadPdfJs()
    const loadingTask = pdfJs.getDocument({
      data: bytes,
      isEvalSupported: false,
      useWorkerFetch: false,
    })
    const document = await loadingTask.promise
    const pages: string[] = []
    try {
      if (document.numPages > MAX_PDF_PAGES) {
        throw new Error(`PDF 页数过多，当前最多支持 ${MAX_PDF_PAGES} 页`)
      }

      let extractedCharacterCount = 0
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber)
        try {
          const content = await page.getTextContent()
          const pageText = pdfTextItemsToLines(content.items).join('\n')
          extractedCharacterCount += pageText.length
          assertPdfTextWithinLimit(extractedCharacterCount)
          pages.push(pageText)
        } finally {
          page.cleanup()
        }
      }
    } finally {
      await document.destroy()
    }

    const text = pages.join('\n\n').trim()
    assertPdfHasExtractableText(text)
    return parseExtractedResumeText(text, file.name)
  } catch (error: unknown) {
    throw mapPdfError(error)
  }
}
