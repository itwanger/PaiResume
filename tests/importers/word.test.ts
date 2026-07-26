import assert from 'node:assert/strict'
import test from 'node:test'
import { deflateRawSync } from 'node:zlib'
import {
  extractTextFromWordDocumentXml,
  parseWordResume,
  wordImportTestUtils,
} from '../../src/utils/importers/word'

function uint16(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff)
}

function uint32(value: number): Uint8Array {
  return Uint8Array.of(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  )
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function createDocx(entries: Array<{ name: string; xml: string }>, compressed: boolean): Uint8Array {
  const encoder = new TextEncoder()
  const method = compressed ? 8 : 0
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let localOffset = 0

  for (const entry of entries) {
    const fileName = encoder.encode(entry.name)
    const rawData = encoder.encode(entry.xml)
    const compressedData = compressed ? new Uint8Array(deflateRawSync(rawData)) : rawData
    const localHeader = concat(
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(method),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(compressedData.length),
      uint32(rawData.length),
      uint16(fileName.length),
      uint16(0),
      fileName,
      compressedData
    )
    localParts.push(localHeader)
    centralParts.push(concat(
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0),
      uint16(method),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(compressedData.length),
      uint32(rawData.length),
      uint16(fileName.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(localOffset),
      fileName
    ))
    localOffset += localHeader.length
  }

  const localData = concat(...localParts)
  const centralDirectory = concat(...centralParts)
  const endRecord = concat(
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entries.length),
    uint16(entries.length),
    uint32(centralDirectory.length),
    uint32(localData.length),
    uint16(0)
  )
  return concat(localData, centralDirectory, endRecord)
}

function createSingleEntryDocx(xml: string, compressed: boolean): Uint8Array {
  return createDocx([{ name: 'word/document.xml', xml }], compressed)
}

const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>基本信息</w:t></w:r></w:p>
    <w:p><w:r><w:t>姓名：张三</w:t></w:r></w:p>
    <w:p><w:r><w:t>邮箱：zhang@example.com</w:t></w:r></w:p>
    <w:p><w:r><w:t>专业技能</w:t></w:r></w:p>
    <w:p><w:r><w:t>Java &amp; Spring Boot</w:t></w:r></w:p>
  </w:body>
</w:document>`

test('Word XML 文本抽取保留段落并解码实体', () => {
  assert.equal(
    extractTextFromWordDocumentXml(DOCUMENT_XML),
    '基本信息\n姓名：张三\n邮箱：zhang@example.com\n专业技能\nJava & Spring Boot'
  )
})

test('Word 表格按行保留标签和值，不会把“姓名”误当姓名值', () => {
  const tableXml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
      <w:tbl>
        <w:tr>
          <w:tc><w:p><w:r><w:t>姓名</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>张三</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>邮箱</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>zhang@example.com</w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>
      <w:p><w:r><w:t>专业技能</w:t></w:r></w:p>
      <w:p><w:r><w:t>Java</w:t></w:r></w:p>
    </w:body>
  </w:document>`

  assert.equal(
    extractTextFromWordDocumentXml(tableXml),
    '姓名 张三 邮箱 zhang@example.com\n专业技能\nJava'
  )
})

test('Word 文本抽取忽略删除和 moveFrom 修订，只保留当前可见文字', () => {
  const revisionXml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
      <w:p><w:r><w:t>基本信息</w:t></w:r></w:p>
      <w:p><w:r><w:t>姓名：张三</w:t></w:r></w:p>
      <w:del><w:r><w:delText>电话：13900000000</w:delText></w:r></w:del>
      <w:moveFrom><w:r><w:t>邮箱：old@example.com</w:t></w:r></w:moveFrom>
      <w:p><w:r><w:rPr><w:vanish/></w:rPr><w:t>微信：hidden-secret</w:t></w:r></w:p>
      <w:p><w:r><w:t>邮箱：new@example.com</w:t></w:r></w:p>
      <w:p><w:r><w:t>专业技能</w:t></w:r></w:p>
      <w:p><w:r><w:t>Java</w:t></w:r></w:p>
    </w:body>
  </w:document>`

  assert.equal(
    extractTextFromWordDocumentXml(revisionXml),
    '基本信息\n姓名：张三\n邮箱：new@example.com\n专业技能\nJava'
  )
})

for (const compressed of [false, true]) {
  test(`导入${compressed ? '压缩' : '未压缩'} DOCX`, async () => {
    const file = new File(
      [createSingleEntryDocx(DOCUMENT_XML, compressed)],
      'resume.docx',
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    )
    const result = await parseWordResume(file)

    assert.equal(result.title, '张三')
    assert.deepEqual(result.modules.map((module) => module.moduleType), ['basic_info', 'skill'])
    assert.deepEqual(result.modules[1].content.categories, [{
      name: '',
      items: ['Java & Spring Boot'],
    }])
  })
}

test('导入 DOCX 时读取页眉和页脚中的联系方式', async () => {
  const headerXml = `<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:tbl><w:tr>
      <w:tc><w:p><w:r><w:t>姓名</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>李雷</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>邮箱</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>lilei@example.com</w:t></w:r></w:p></w:tc>
    </w:tr></w:tbl>
  </w:hdr>`
  const footerXml = `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:p><w:r><w:t>电话：13800138000</w:t></w:r></w:p>
  </w:ftr>`
  const bodyXml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
      <w:p><w:r><w:t>专业技能</w:t></w:r></w:p>
      <w:p><w:r><w:t>Java</w:t></w:r></w:p>
    </w:body>
  </w:document>`
  const file = new File(
    [createDocx([
      { name: 'word/header1.xml', xml: headerXml },
      { name: 'word/document.xml', xml: bodyXml },
      { name: 'word/footer1.xml', xml: footerXml },
    ], true)],
    'resume.docx',
    { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
  )

  const result = await parseWordResume(file)
  assert.equal(result.modules[0].content.name, '李雷')
  assert.equal(result.modules[0].content.email, 'lilei@example.com')
  assert.equal(result.modules[0].content.phone, '13800138000')
})

test('伪装成 DOCX 的普通文件会被拒绝', async () => {
  await assert.rejects(
    parseWordResume(new File(['not a zip'], 'resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })),
    /不是有效的 DOCX/
  )
})

test('DOCX 解压采用分块上限，中央目录低报体积也不能无限扩张', async () => {
  const compressed = new Uint8Array(deflateRawSync(new Uint8Array(8 * 1024).fill(65)))
  await assert.rejects(
    wordImportTestUtils.decompressDeflateRaw(compressed, 1024),
    /解压后过大/
  )
})
