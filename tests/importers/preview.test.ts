import assert from 'node:assert/strict'
import test from 'node:test'
import { buildResumeImportPreview } from '../../src/utils/importers/preview'

test('buildResumeImportPreview 提取确认弹窗所需的基本信息和模块名称', () => {
  const preview = buildResumeImportPreview({
    title: ' 张三的简历 ',
    modules: [
      {
        moduleType: 'basic_info',
        content: {
          name: '张三',
          phone: '13800138000',
          email: 'zhangsan@example.com',
        },
      },
      {
        moduleType: 'project',
        content: { projects: [] },
      },
    ],
  })

  assert.deepEqual(preview, {
    title: '张三的简历',
    moduleLabels: ['基本信息', '项目经历'],
    moduleOutline: [
      {
        label: '基本信息',
        summary: '张三 · 13800138000 · zhangsan@example.com',
      },
      {
        label: '项目经历',
        summary: '',
      },
    ],
    name: '张三',
    phone: '13800138000',
    email: 'zhangsan@example.com',
  })
})

test('buildResumeImportPreview 对缺失基本信息的技能模块保持可读', () => {
  const preview = buildResumeImportPreview({
    title: '',
    modules: [
      {
        moduleType: 'skill',
        content: {},
      },
    ],
  })

  assert.equal(preview.title, '导入的简历')
  assert.deepEqual(preview.moduleLabels, ['专业技能'])
  assert.deepEqual(preview.moduleOutline, [{ label: '专业技能', summary: '' }])
  assert.equal(preview.name, '')
  assert.equal(preview.phone, '')
  assert.equal(preview.email, '')
})
