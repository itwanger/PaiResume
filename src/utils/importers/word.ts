import { parseExtractedResumeText } from './plainText'
import { hasZipSignature, validateResumeImportFile } from './validation'
import type { ImportedResumeData } from './markdown'

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50
const CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE = 0x02014b50
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50
const MAX_END_RECORD_SEARCH_BYTES = 65_557
const MAX_DOCUMENT_XML_BYTES = 20 * 1024 * 1024
const MAX_ZIP_ENTRY_COUNT = 10_000

interface ZipEntry {
  fileName: string
  compressionMethod: number
  flags: number
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
}

function findEndOfCentralDirectory(view: DataView): number {
  const searchStart = Math.max(0, view.byteLength - MAX_END_RECORD_SEARCH_BYTES)
  for (let offset = view.byteLength - 22; offset >= searchStart; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset
    }
  }
  return -1
}

function listZipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const endOffset = findEndOfCentralDirectory(view)
  if (endOffset < 0 || endOffset + 22 > view.byteLength) {
    return []
  }

  const entryCount = view.getUint16(endOffset + 10, true)
  const centralDirectoryOffset = view.getUint32(endOffset + 16, true)
  if (entryCount === 0xffff || centralDirectoryOffset === 0xffffffff) {
    throw new Error('暂不支持 ZIP64 格式的 DOCX 文件')
  }
  if (entryCount > MAX_ZIP_ENTRY_COUNT) {
    throw new Error('DOCX 内部文件数量异常，请重新另存或精简文件后再试')
  }

  let offset = centralDirectoryOffset
  const decoder = new TextDecoder('utf-8')
  const entries: ZipEntry[] = []
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE) {
      throw new Error('DOCX 文件目录损坏，请重新另存文件后再试')
    }

    const flags = view.getUint16(offset + 8, true)
    const compressionMethod = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const uncompressedSize = view.getUint32(offset + 24, true)
    const fileNameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const fileNameStart = offset + 46
    const nextOffset = fileNameStart + fileNameLength + extraLength + commentLength
    if (nextOffset > view.byteLength) {
      throw new Error('DOCX 文件目录不完整，请重新另存文件后再试')
    }

    const fileName = decoder.decode(bytes.subarray(fileNameStart, fileNameStart + fileNameLength))
    entries.push({
      fileName,
      compressionMethod,
      flags,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    })
    offset = nextOffset
  }

  return entries
}

async function decompressDeflateRaw(data: Uint8Array, maxOutputBytes = MAX_DOCUMENT_XML_BYTES): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器版本过旧，无法解压 DOCX；请升级 Chrome、Edge 或 Safari 后重试')
  }

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      totalBytes += value.byteLength
      if (totalBytes > maxOutputBytes) {
        await reader.cancel().catch(() => undefined)
        throw new Error('DOCX 正文解压后过大，请精简文件内容后重试')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const result = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  if ((entry.flags & 0x1) !== 0) {
    throw new Error('DOCX 文件已加密，暂不支持导入带密码的文件')
  }
  if (entry.uncompressedSize > MAX_DOCUMENT_XML_BYTES) {
    throw new Error('DOCX 正文解压后过大，请精简文件内容后重试')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const localOffset = entry.localHeaderOffset
  if (localOffset + 30 > view.byteLength || view.getUint32(localOffset, true) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error('DOCX 正文索引损坏，请重新另存文件后再试')
  }

  const fileNameLength = view.getUint16(localOffset + 26, true)
  const extraLength = view.getUint16(localOffset + 28, true)
  const dataOffset = localOffset + 30 + fileNameLength + extraLength
  const dataEnd = dataOffset + entry.compressedSize
  if (dataEnd > bytes.length) {
    throw new Error('DOCX 正文数据不完整，请重新下载或另存文件后再试')
  }

  const compressedData = bytes.subarray(dataOffset, dataEnd)
  let result: Uint8Array
  if (entry.compressionMethod === 0) {
    result = compressedData.slice()
  } else if (entry.compressionMethod === 8) {
    result = await decompressDeflateRaw(compressedData)
  } else {
    throw new Error('DOCX 使用了暂不支持的压缩方式，请用 Word 或 WPS 重新另存为 .docx')
  }

  if (result.length > MAX_DOCUMENT_XML_BYTES || (entry.uncompressedSize > 0 && result.length !== entry.uncompressedSize)) {
    throw new Error('DOCX 正文校验失败，请重新另存文件后再试')
  }
  return result
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function removeExcludedRevisionContent(xml: string): string {
  return xml
    .replace(
      /<(?:[A-Za-z_][\w.-]*:)?(?:del|moveFrom)\b[^>]*>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?(?:del|moveFrom)\s*>/gi,
      ''
    )
    .replace(
      /<(?:[A-Za-z_][\w.-]*:)?(?:delText|moveFromText)\b[^>]*>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?(?:delText|moveFromText)\s*>/gi,
      ''
    )
    .replace(
      /<(?:[A-Za-z_][\w.-]*:)?r\b[^>]*>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?r\s*>/gi,
      (runXml) => (
        /<(?:[A-Za-z_][\w.-]*:)?(?:vanish|webHidden)\b/i.test(runXml)
          ? ''
          : runXml
      )
    )
}

function extractWordCellText(xml: string): string {
  return xml
    .replace(/<[^>]*:tab\b[^>]*\/>/gi, '\t')
    .replace(/<[^>]*:(?:br|cr)\b[^>]*\/>/gi, '\n')
    .replace(/<\/[^>]*:p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
}

function preserveWordTableRows(xml: string): string {
  return xml.replace(
    /<(?:[A-Za-z_][\w.-]*:)?tr\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?tr\s*>/gi,
    (_, rowXml: string) => {
      const cells = Array.from(
        rowXml.matchAll(
          /<(?:[A-Za-z_][\w.-]*:)?tc\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?tc\s*>/gi
        )
      )
        .map((match) => extractWordCellText(match[1]))
        .filter(Boolean)

      return cells.length > 0 ? `${cells.join('\t')}\n` : '\n'
    }
  )
}

export function extractTextFromWordDocumentXml(xml: string): string {
  const visibleXml = preserveWordTableRows(removeExcludedRevisionContent(xml))
  const extractedText = decodeXmlEntities(
    visibleXml
      .replace(/<[^>]*:tab\b[^>]*\/>/gi, '\t')
      .replace(/<[^>]*:(?:br|cr)\b[^>]*\/>/gi, '\n')
      .replace(/<\/[^>]*:tc\s*>/gi, '\t')
      .replace(/<\/[^>]*:(?:p|tr)\s*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\r\n?/g, '\n')
  return extractedText
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

export async function parseWordResume(file: File): Promise<ImportedResumeData> {
  validateResumeImportFile(file, 'word')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!hasZipSignature(bytes)) {
    throw new Error('文件内容不是有效的 DOCX，请不要只修改文件扩展名')
  }

  const entries = listZipEntries(bytes)
  const documentEntry = entries.find((entry) => entry.fileName === 'word/document.xml')
  if (!documentEntry) {
    throw new Error('DOCX 中缺少正文内容，请用 Word 或 WPS 重新另存后再试')
  }

  const auxiliaryEntries = entries
    .filter((entry) => /^word\/(?:header|footer)\d+\.xml$/i.test(entry.fileName))
    .sort((left, right) => left.fileName.localeCompare(right.fileName, undefined, { numeric: true }))
  const selectedEntries = [...auxiliaryEntries, documentEntry]
  if (selectedEntries.reduce((total, entry) => total + entry.uncompressedSize, 0) > MAX_DOCUMENT_XML_BYTES) {
    throw new Error('DOCX 正文解压后过大，请精简文件内容后重试')
  }

  const decoder = new TextDecoder('utf-8', { fatal: true })
  const extractedParts: string[] = []
  let totalXmlBytes = 0
  for (const entry of selectedEntries) {
    const xmlBytes = await readZipEntry(bytes, entry)
    totalXmlBytes += xmlBytes.length
    if (totalXmlBytes > MAX_DOCUMENT_XML_BYTES) {
      throw new Error('DOCX 正文解压后过大，请精简文件内容后重试')
    }
    const extractedPart = extractTextFromWordDocumentXml(decoder.decode(xmlBytes))
    if (extractedPart) {
      extractedParts.push(extractedPart)
    }
  }

  const text = extractedParts.join('\n')
  return parseExtractedResumeText(text, file.name)
}

export const wordImportTestUtils = {
  decompressDeflateRaw,
}
