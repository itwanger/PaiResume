import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertPdfHasExtractableText,
  assertPdfTextWithinLimit,
  MAX_PDF_TEXT_CHARACTERS,
  parsePdfResume,
  pdfTextItemsToLines,
} from '../../src/utils/importers/pdf'

function createTextPdf(lines: string[]): Uint8Array {
  const escapeText = (value: string) => value.replace(/([\\()])/g, '\\$1')
  const content = [
    'BT',
    '/F1 12 Tf',
    '50 780 Td',
    ...lines.flatMap((line, index) => [
      ...(index === 0 ? [] : ['0 -18 Td']),
      `(${escapeText(line)}) Tj`,
    ]),
    'ET',
  ].join('\n')

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  let source = '%PDF-1.4\n'
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(new TextEncoder().encode(source).length)
    source += `${index + 1} 0 obj\n${object}\nendobj\n`
  }
  const xrefOffset = new TextEncoder().encode(source).length
  source += `xref\n0 ${objects.length + 1}\n`
  source += '0000000000 65535 f \n'
  for (const offset of offsets.slice(1)) {
    source += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return new TextEncoder().encode(source)
}

test('PDF 文本项按坐标恢复为多行文字', () => {
  assert.deepEqual(pdfTextItemsToLines([
    { str: '张', transform: [12, 0, 0, 12, 50, 700], width: 12 },
    { str: '三', transform: [12, 0, 0, 12, 62, 700], width: 12, hasEOL: true },
    { str: 'Java', transform: [12, 0, 0, 12, 50, 680], width: 24 },
    { str: 'Developer', transform: [12, 0, 0, 12, 80, 680], width: 54 },
  ]), ['张三', 'Java Developer'])
})

test('扫描版或几乎无文字的 PDF 给出 OCR 提示', () => {
  assert.throws(() => assertPdfHasExtractableText('  \n  '), /扫描版 PDF.*不支持 OCR/)
})

test('PDF 提取文字设置总字符上限', () => {
  assert.doesNotThrow(() => assertPdfTextWithinLimit(MAX_PDF_TEXT_CHARACTERS))
  assert.throws(
    () => assertPdfTextWithinLimit(MAX_PDF_TEXT_CHARACTERS + 1),
    /文字过多/
  )
})

test('真实文本型 PDF 可以导入', async () => {
  const file = new File([createTextPdf([
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
  ])], 'resume.pdf', { type: 'application/pdf' })

  const result = await parsePdfResume(file)
  assert.equal(result.title, 'Zhang San')
  assert.deepEqual(result.modules.map((module) => module.moduleType), [
    'basic_info',
    'project',
    'skill',
  ])
})

test('伪装成 PDF 的文件会在解析前被拒绝', async () => {
  await assert.rejects(
    parsePdfResume(new File(['plain text'], 'resume.pdf', { type: 'application/pdf' })),
    /不是有效的 PDF/
  )
})
