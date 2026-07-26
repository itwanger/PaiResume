import assert from 'node:assert/strict'
import test from 'node:test'
import { detectResumeImportType } from '../../src/utils/importers/index'
import { MAX_IMPORT_FILE_BYTES, validateResumeImportFile } from '../../src/utils/importers/validation'

test('detectResumeImportType 同时识别扩展名和浏览器 MIME', () => {
  assert.equal(detectResumeImportType(new File(['x'], 'resume.DOCX')), 'word')
  assert.equal(detectResumeImportType(new File(['x'], 'resume', { type: 'application/pdf' })), 'pdf')
  assert.equal(detectResumeImportType(new File(['x'], 'resume.md', { type: 'text/plain' })), 'markdown')
  assert.equal(detectResumeImportType(new File(['x'], 'resume.pages')), null)
})

test('旧版 DOC 给出可执行的拒绝提示', () => {
  const file = new File(['legacy'], 'resume.doc', { type: 'application/msword' })
  assert.throws(
    () => validateResumeImportFile(file, 'word'),
    /旧版 \.doc.*另存为 \.docx/
  )
})

test('文件扩展名、MIME、空文件和体积都经过校验', () => {
  assert.throws(
    () => validateResumeImportFile(new File(['%PDF'], 'resume.docx', { type: 'application/pdf' }), 'word'),
    /文件类型与扩展名不一致/
  )
  assert.throws(
    () => validateResumeImportFile(new File([], 'resume.pdf', { type: 'application/pdf' }), 'pdf'),
    /文件内容为空/
  )

  const oversized = new File(
    [new Uint8Array(MAX_IMPORT_FILE_BYTES.markdown + 1)],
    'resume.md',
    { type: 'text/markdown' }
  )
  assert.throws(() => validateResumeImportFile(oversized, 'markdown'), /不能超过 2 MB/)
})

test('DOCX 浏览器报告为 ZIP MIME 时仍由内容签名继续校验', () => {
  assert.doesNotThrow(() => validateResumeImportFile(
    new File(['PK\u0003\u0004'], 'resume.docx', { type: 'application/zip' }),
    'word'
  ))
})
