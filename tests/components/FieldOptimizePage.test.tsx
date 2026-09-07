import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiOptimizeStreamModal } from '../../src/components/modules/AiOptimizeStreamModal'
import FieldOptimizePage from '../../src/pages/FieldOptimizePage'
import { FieldOptimizePromptAdminPanel } from '../../src/components/admin/FieldOptimizePromptAdminPanel'

const api = vi.hoisted(() => ({ getFieldOptimizeMethods: vi.fn(), getLatestFieldOptimizeRecord: vi.fn(), aiOptimizeFieldStream: vi.fn() }))
const admin = vi.hoisted(() => ({ listFieldOptimizePrompts: vi.fn(), updateFieldOptimizePrompt: vi.fn() }))
vi.mock('../../src/api/resume', () => ({ resumeApi: api }))
vi.mock('../../src/api/admin', () => ({ adminApi: admin }))
const store = vi.hoisted(() => ({ currentResumeId: 1, loading: false, modules: [{ id: 2, moduleType: 'project', content: { description: '原始项目简介', achievements: [] } }], fetchModules: vi.fn(), updateModuleContent: vi.fn() }))
vi.mock('../../src/store/resumeStore', () => ({ useResumeStore: () => store }))
const envelope = (data: unknown) => ({ data: { code: 200, data } })
const methods = [{ id: 'standard', name: '标准优化', description: '精简表达，突出重点。' }, { id: 'asu', name: '阿酥式表达', description: '突出个人贡献与成果依据。' }]
function mount() {
  return render(<MemoryRouter initialEntries={['/editor/1/modules/2/field-optimize?fieldType=project_description']}><Routes><Route path="/editor/:id/modules/:moduleId/field-optimize" element={<FieldOptimizePage />} /></Routes></MemoryRouter>)
}
describe('field optimization ownership', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    api.getFieldOptimizeMethods.mockResolvedValue(envelope(methods))
    api.getLatestFieldOptimizeRecord.mockResolvedValue(envelope(null))
    api.aiOptimizeFieldStream.mockResolvedValue({ original: '原始项目简介', candidates: ['优化后的项目简介'] })
  })
  it('用户只选择方式，特色随选择变化，请求不携带提示词', async () => {
    localStorage.setItem('pai-resume.field-optimize-system-prompt', '历史自定义提示词')
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('button', { name: '阿酥式表达' }))
    expect(screen.getByText('突出个人贡献与成果依据。')).toBeInTheDocument()
    expect(screen.queryByText('系统提示词')).not.toBeInTheDocument()
    expect(screen.queryByText('用户提示词')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '开始优化' }))
    await waitFor(() => expect(api.aiOptimizeFieldStream).toHaveBeenCalled())
    expect(api.aiOptimizeFieldStream.mock.calls[0][2]).toEqual({ fieldType: 'project_description', presetId: 'asu' })
    localStorage.removeItem('pai-resume.field-optimize-system-prompt')
  })
  it('方式加载失败不能发起优化', async () => {
    api.getFieldOptimizeMethods.mockRejectedValue(new Error('offline'))
    mount()
    expect(await screen.findByRole('alert')).toHaveTextContent('优化方式加载失败')
    expect(screen.getByRole('button', { name: '开始优化' })).toBeDisabled()
  })
  it('收起生成详情，只在完成后展示整理好的结果', async () => {
    let complete!: (result: unknown) => void
    api.aiOptimizeFieldStream.mockImplementation(() => new Promise((resolve) => { complete = resolve }))
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('button', { name: '标准优化' }))
    await user.click(screen.getByRole('button', { name: '开始优化' }))
    const onEvent = api.aiOptimizeFieldStream.mock.calls[0][3].onEvent
    await act(async () => {
      onEvent({ event: 'reasoning_delta', data: { text: '详细生成过程，仅按需显示' } })
      onEvent({ event: 'content_delta', data: { text: '{"candidates":["流式中间候选"]}' } })
    })
    expect(screen.getByText('正在整理优化版本…')).toBeInTheDocument()
    expect(screen.queryByText('详细生成过程，仅按需显示')).not.toBeInTheDocument()
    expect(screen.queryByText(/流式中间候选/)).not.toBeInTheDocument()
    expect(screen.queryByText('流式结果')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '采纳这个版本' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '查看详情' }))
    expect(screen.getByText('详细生成过程，仅按需显示')).toBeInTheDocument()
    await act(async () => { complete({ original: '原始项目简介', candidates: ['整理完成的最终版本'] }) })
    expect(screen.getByText('优化完成')).toBeInTheDocument()
    expect(screen.queryByText('详细生成过程，仅按需显示')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('整理完成的最终版本')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('流式中间候选')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '采纳这个版本' })).toBeEnabled()
  })
  it('历史记录不展示原始流，过程默认收起', async () => {
    api.getLatestFieldOptimizeRecord.mockResolvedValue(envelope({ status: 'completed', original: '原始项目简介', reasoning: '历史详细过程', streamedContent: '{"candidates":["原始流"]}', candidates: ['历史最终版本'] }))
    mount()
    expect(await screen.findByDisplayValue('历史最终版本')).toBeInTheDocument()
    expect(screen.queryByText('历史详细过程')).not.toBeInTheDocument()
    expect(screen.queryByText(/原始流/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '查看详情' }))
    expect(screen.getByText('历史详细过程')).toBeInTheDocument()
  })
  it('弹窗不展示未完成结果和原始流', () => {
    render(<AiOptimizeStreamModal title="优化" original="原文" reasoning="详细过程" streamedContent="原始 JSON" candidates={['未完成版本']} status="streaming" multiCandidate onClose={() => {}} />)
    expect(screen.queryByText('原始 JSON')).not.toBeInTheDocument()
    expect(screen.queryByText('详细过程')).not.toBeInTheDocument()
    expect(screen.queryByText('未完成版本')).not.toBeInTheDocument()
  })
  it('Admin 编辑特色和提示词后保存对应方式', async () => {
    const configs = methods.map((method) => ({ presetId: method.id, name: method.name, description: method.description, systemPrompt: '系统约束', descriptionPrompt: '简介 {{original}}', responsibilityPrompt: '职责 {{original}}', skillPrompt: '技能 {{original}}' }))
    admin.listFieldOptimizePrompts.mockResolvedValue(envelope(configs))
    admin.updateFieldOptimizePrompt.mockImplementation(async (_id, data) => envelope(data))
    const user = userEvent.setup()
    render(<FieldOptimizePromptAdminPanel />)
    await user.click(await screen.findByRole('tab', { name: '阿酥式表达' }))
    await user.clear(screen.getByLabelText('特色说明'))
    await user.type(screen.getByLabelText('特色说明'), '面试可展开')
    await user.type(screen.getByLabelText('系统提示词'), '，保持事实')
    await user.click(screen.getByRole('button', { name: '保存优化方式' }))
    expect(await screen.findByText('已保存')).toBeInTheDocument()
    expect(admin.updateFieldOptimizePrompt).toHaveBeenCalledWith('asu', expect.objectContaining({ description: '面试可展开', systemPrompt: '系统约束，保持事实' }))
  })
})
