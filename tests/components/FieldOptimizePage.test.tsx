import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiOptimizeStreamModal } from '../../src/components/modules/AiOptimizeStreamModal'
import FieldOptimizePage from '../../src/pages/FieldOptimizePage'
import { FieldOptimizePromptAdminPanel } from '../../src/components/admin/FieldOptimizePromptAdminPanel'

const api = vi.hoisted(() => ({ getFieldOptimizeMethods: vi.fn(), getLatestFieldOptimizeRecord: vi.fn(), aiOptimizeFieldStream: vi.fn() }))
const admin = vi.hoisted(() => ({ listFieldOptimizePrompts: vi.fn(), updateFieldOptimizePrompt: vi.fn() }))
vi.mock('../../src/api/resume', () => ({ resumeApi: api }))
vi.mock('../../src/api/admin', () => ({ adminApi: admin }))
vi.mock('../../src/components/layout/Header', () => ({ Header: () => <nav aria-label="主导航" /> }))
const store = vi.hoisted(() => ({ currentResumeId: 1, loading: false, modules: [{ id: 2, moduleType: 'project', content: { description: '原始项目简介', achievements: [] } }], fetchModules: vi.fn(), updateModuleContent: vi.fn() }))
vi.mock('../../src/store/resumeStore', () => ({ useResumeStore: () => store }))
const envelope = (data: unknown) => ({ data: { code: 200, data } })
const methods = [{ id: 'standard', name: '标准优化', description: '精简表达，突出重点。' }, { id: 'asu', name: '阿酥式表达', description: '突出个人贡献与成果依据。' }]
function mount() {
  return render(<MemoryRouter initialEntries={['/editor/1/modules/2/field-optimize?fieldType=project_description']}><Routes><Route path="/editor/:id/modules/:moduleId/field-optimize" element={<FieldOptimizePage />} /></Routes></MemoryRouter>)
}
describe('field optimization ownership', () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem('pai-resume:draft:1:2') })
  beforeEach(() => {
    vi.resetAllMocks()
    api.getFieldOptimizeMethods.mockResolvedValue(envelope(methods))
    api.getLatestFieldOptimizeRecord.mockResolvedValue(envelope(null))
    api.aiOptimizeFieldStream.mockResolvedValue({ original: '原始项目简介', candidates: ['优化后的项目简介'] })
  })
  it.each([
    ['research_background', 'background', '科研背景'],
    ['research_work_content', 'workContent', '科研内容'],
    ['research_achievements', 'achievements', '研究成果'],
  ])('科研字段 %s 单独生成并回填，保留其余草稿', async (fieldType, key, title) => {
    const previousModules = store.modules
    const content = { projectName: '科研项目', projectCycle: '2024', background: '原始背景', workContent: '原始工作', achievements: '原始成果' }
    store.modules = [{ id: 2, moduleType: 'research', content }] as unknown as typeof store.modules
    api.aiOptimizeFieldStream.mockResolvedValue({ original: content[key as keyof typeof content], candidates: ['字段优化结果'] })
    try {
      render(<MemoryRouter initialEntries={[`/editor/1/modules/2/field-optimize?fieldType=${fieldType}&returnModuleType=research`]}>
        <Routes>
          <Route path="/editor/:id/modules/:moduleId/field-optimize" element={<FieldOptimizePage />} />
          <Route path="/editor/:id" element={<p>科研编辑器</p>} />
        </Routes>
      </MemoryRouter>)
      await screen.findByRole('button', { name: '标准优化' })
      expect(screen.getByRole('button', { name: `返回${title}编辑` })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: '开始优化' }))
      await screen.findByText('字段优化结果')
      expect(api.aiOptimizeFieldStream.mock.calls[0][2]).toEqual({ fieldType, presetId: 'standard' })
      const draft = { ...content, projectName: '尚未同步的科研名称' }
      localStorage.setItem('pai-resume:draft:1:2', JSON.stringify({ content: draft, serialized: JSON.stringify(draft) }))
      await userEvent.click(screen.getByRole('button', { name: '采纳这个版本' }))
      await screen.findByText('科研编辑器')
      expect(store.updateModuleContent).toHaveBeenCalledWith(1, 2, { ...draft, [key]: '字段优化结果' })
      expect(localStorage.getItem('pai-resume:draft:1:2')).toBeNull()
    } finally {
      store.modules = previousModules
    }
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
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000)
    let complete!: (result: unknown) => void
    api.aiOptimizeFieldStream.mockImplementation(() => new Promise((resolve) => { complete = resolve }))
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('button', { name: '标准优化' }))
    await user.click(screen.getByRole('button', { name: '开始优化' }))
    const onEvent = api.aiOptimizeFieldStream.mock.calls[0][3].onEvent
    await act(async () => {
      onEvent({ event: 'reasoning_delta', data: { text: '详细生成过程，仅按需显示' } })
      onEvent({ event: 'status', data: { message: '上游已结束输出，等待最终整理。' } })
      onEvent({ event: 'content_delta', data: { text: '{"candidates":["流式中间候选"]}' } })
    })
    expect(screen.getByText('正在整理优化版本…')).toBeInTheDocument()
    expect(screen.queryByText('详细生成过程，仅按需显示')).not.toBeInTheDocument()
    expect(screen.queryByText(/流式中间候选/)).not.toBeInTheDocument()
    expect(screen.queryByText('流式结果')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '采纳这个版本' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '查看思考过程' }))
    expect(screen.getByRole('region', { name: '模型思考过程' })).toHaveTextContent('详细生成过程，仅按需显示')
    expect(screen.queryByText('上游已结束输出，等待最终整理。')).not.toBeInTheDocument()
    clock.mockReturnValue(69000)
    await act(async () => { complete({ original: '原始项目简介', candidates: ['整理完成的最终版本'] }) })
    expect(screen.getByText('用时 1 分 08 秒')).toBeInTheDocument()
    expect(screen.queryByText('优化完成')).not.toBeInTheDocument()
    expect(screen.queryByText('详细生成过程，仅按需显示')).not.toBeInTheDocument()
    expect(screen.getByText('整理完成的最终版本')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('流式中间候选')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '采纳这个版本' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '重新生成' }))
    expect(screen.queryByText('用时 1 分 08 秒')).not.toBeInTheDocument()
    clock.mockReturnValue(72000)
    await act(async () => { complete({ original: '原始项目简介', candidates: ['第二次生成'] }) })
    expect(screen.getByText('用时 0 分 03 秒')).toBeInTheDocument()
  })
  it('历史记录不展示原始流，过程默认收起', async () => {
    api.getLatestFieldOptimizeRecord.mockResolvedValue(envelope({ status: 'completed', original: '原始项目简介', reasoning: '历史详细过程', streamedContent: '{"candidates":["原始流"]}', candidates: ['历史最终版本'] }))
    mount()
    expect(await screen.findByText('历史最终版本')).toBeInTheDocument()
    expect(screen.getByText('已生成')).toBeInTheDocument()
    expect(screen.queryByText(/用时/)).not.toBeInTheDocument()
    expect(screen.queryByText('历史详细过程')).not.toBeInTheDocument()
    expect(screen.queryByText(/原始流/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '查看思考过程' }))
    expect(screen.getByText('历史详细过程')).toBeInTheDocument()
  })
  it('弹窗不展示未完成结果和原始流', () => {
    render(<AiOptimizeStreamModal title="优化" original="原文" reasoning="详细过程" streamedContent="原始 JSON" candidates={['未完成版本']} status="streaming" multiCandidate onClose={() => {}} />)
    expect(screen.queryByText('原始 JSON')).not.toBeInTheDocument()
    expect(screen.queryByText('详细过程')).not.toBeInTheDocument()
    expect(screen.queryByText('未完成版本')).not.toBeInTheDocument()
  })
  it('筛选版本并编辑复制，采纳时使用编辑后的内容', async () => {
    api.getLatestFieldOptimizeRecord.mockResolvedValue(envelope({ status: 'completed', original: '原始项目简介', candidates: ['版本一原文', '版本二原文，使用滑动窗口算法'], candidateTags: [['concise'], ['technical']] }))
    const user = userEvent.setup()
    const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    mount()
    await screen.findByText('版本一原文')
    await user.click(screen.getByRole('button', { name: '简洁优先', exact: true }))
    expect(screen.getByRole('article', { name: '版本 1' })).toBeVisible()
    expect(screen.queryByRole('article', { name: '版本 2' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '编辑版本 1' }))
    await user.clear(screen.getByRole('textbox', { name: '版本 1内容' }))
    expect(screen.getByRole('button', { name: '采纳这个版本' })).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: '版本 1内容' }), 'Redis限流')
    await user.click(screen.getByRole('button', { name: '复制版本 1' }))
    expect(clipboard).toHaveBeenCalledWith('Redis限流')
    await user.click(screen.getByRole('button', { name: '完成编辑版本 1' }))
    expect(screen.queryByRole('textbox', { name: '版本 1内容' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '采纳这个版本' }))
    expect(store.updateModuleContent).toHaveBeenCalledWith(1, 2, expect.objectContaining({ description: 'Redis限流' }))
  })
  it('采纳清除旧草稿并保留草稿中的其他字段，返回后不再覆盖结果', async () => {
    const draftKey = 'pai-resume:draft:1:2'
    const draft = { description: '旧简介', projectName: '尚未同步的项目名', achievements: ['保留职责'] }
    localStorage.setItem(draftKey, JSON.stringify({ content: draft, serialized: JSON.stringify(draft) }))
    api.getLatestFieldOptimizeRecord.mockResolvedValue(envelope({ status: 'completed', candidates: ['已采纳的新简介'] }))
    mount()
    await screen.findByText('已采纳的新简介')
    await userEvent.click(screen.getByRole('button', { name: '采纳这个版本' }))
    await waitFor(() => expect(store.updateModuleContent).toHaveBeenCalledWith(1, 2, expect.objectContaining({
      description: '已采纳的新简介', projectName: '尚未同步的项目名', achievements: ['保留职责'],
    })))
    expect(localStorage.getItem(draftKey)).toBeNull()
  })
  it('没有后台标签时不根据关键词贴标，流式结果按后台标签筛选', async () => {
    api.getLatestFieldOptimizeRecord.mockResolvedValue(envelope({ status: 'completed', original: '原始项目简介', candidates: ['Redis滑动窗口算法优化99%'] }))
    const user = userEvent.setup()
    mount()
    await screen.findByText('Redis滑动窗口算法优化99%')
    await user.click(screen.getByRole('button', { name: '数据量化', exact: true }))
    expect(screen.getByText('暂无符合此分类的版本')).toBeInTheDocument()
    api.aiOptimizeFieldStream.mockResolvedValue({ original: '原始项目简介', candidates: ['服务端指定的候选正文'], candidateTags: [['technical']] })
    await user.click(screen.getByRole('button', { name: '重新生成' }))
    await screen.findByText('服务端指定的候选正文')
    await user.click(screen.getByRole('button', { name: '技术深度', exact: true }))
    expect(screen.getByRole('article', { name: '版本 1' })).toBeVisible()
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
