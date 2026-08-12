import assert from 'node:assert/strict'
import test from 'node:test'
import {
  RESUME_CREATE_PATH,
  buildResumeEditorPath,
} from '../../src/config/site'
import {
  buildLoginPath,
  buildLoginPathForMode,
  getLoginEntryLabel,
  resolveLoginMethod,
} from '../../src/utils/navigation'
import {
  RESUME_TITLE_MAX_LENGTH,
  getResumeEditorEntryPath,
  getResumeImportTitle,
  getResumeTitleError,
  hasResumeCreateIntent,
  normalizeResumeTitle,
} from '../../src/utils/resumeCreation'

test('简历名称会去除首尾空格且不能为空', () => {
  assert.equal(normalizeResumeTitle('  Java 后端求职简历  '), 'Java 后端求职简历')
  assert.equal(getResumeTitleError('   '), '请输入简历名称')
  assert.equal(getResumeTitleError('Java 后端求职简历'), null)
})

test('简历名称最多允许 128 个字符', () => {
  assert.equal(getResumeTitleError('简'.repeat(RESUME_TITLE_MAX_LENGTH)), null)
  assert.equal(
    getResumeTitleError('简'.repeat(RESUME_TITLE_MAX_LENGTH + 1)),
    '简历名称不能超过 128 个字符',
  )
})

test('导入简历优先使用识别标题，否则使用源文件名', () => {
  assert.equal(
    getResumeImportTitle('  Java 后端简历  ', '旧文件名.pdf'),
    'Java 后端简历',
  )
  assert.equal(getResumeImportTitle('', '王小明-产品经理.docx'), '王小明-产品经理')
  assert.equal(getResumeImportTitle('', '.pdf'), '导入的简历')
  assert.equal(
    getResumeImportTitle(`${'a'.repeat(127)}😀`, '旧文件名.pdf'),
    'a'.repeat(127),
  )
})

test('创建意图只识别明确的 create=1', () => {
  assert.equal(hasResumeCreateIntent('?create=1'), true)
  assert.equal(hasResumeCreateIntent('?source=home&create=1'), true)
  assert.equal(hasResumeCreateIntent('?create=0'), false)
  assert.equal(hasResumeCreateIntent(''), false)
})

test('编辑入口有简历时打开最近一份，无简历时进入命名流程', () => {
  assert.equal(
    getResumeEditorEntryPath([{ id: 42 }, { id: 7 }]),
    buildResumeEditorPath(42),
  )
  assert.equal(getResumeEditorEntryPath([]), RESUME_CREATE_PATH)
})

test('未登录用户完成登录后仍能回到命名流程', () => {
  const loginPath = buildLoginPath(RESUME_CREATE_PATH)
  const redirect = new URLSearchParams(loginPath.split('?')[1]).get('redirect')

  assert.equal(redirect, RESUME_CREATE_PATH)
})

test('登录入口会区分本地开发邮箱登录与生产扫码登录', () => {
  assert.equal(buildLoginPathForMode('development'), '/login?method=email')
  assert.equal(
    buildLoginPathForMode('development', RESUME_CREATE_PATH),
    `/login?method=email&redirect=${encodeURIComponent(RESUME_CREATE_PATH)}`,
  )
  assert.equal(buildLoginPathForMode('production'), '/login')
  assert.equal(
    buildLoginPathForMode('production', RESUME_CREATE_PATH),
    `/login?redirect=${encodeURIComponent(RESUME_CREATE_PATH)}`,
  )
  assert.equal(buildLoginPathForMode('staging'), '/login')
  assert.equal(getLoginEntryLabel('development'), '本地邮箱登录')
  assert.equal(getLoginEntryLabel('production'), '扫码登录')
})

test('登录页允许显式选择登录方式，并按环境提供默认方式', () => {
  assert.equal(resolveLoginMethod(null, 'development'), 'email')
  assert.equal(resolveLoginMethod(null, 'production'), 'wechat')
  assert.equal(resolveLoginMethod('wechat', 'development'), 'wechat')
  assert.equal(resolveLoginMethod('email', 'production'), 'email')
})
