import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { ResearchForm } from '../../src/components/modules/ResearchForm'

const store = vi.hoisted(() => ({ updateModuleContent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../src/store/resumeStore', () => ({ useResumeStore: () => store }))

beforeEach(() => {
  vi.clearAllMocks()
  HTMLElement.prototype.scrollIntoView = vi.fn()
})

it('科研内容像核心职责一样逐条添加、排序和删除旧版内容', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <ResearchForm resumeId={1} moduleId={2} initialContent={{ projectName: '科研项目', workContent: '- 第一条\n- 第二条' }}
        itemIndex={0} collapsed={false} onToggleCollapsed={vi.fn()} onDelete={vi.fn()} />
    </MemoryRouter>
  )

  expect(screen.queryByRole('textbox', { name: '科研内容 1' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /可选信息/ }))
  expect(screen.getByRole('textbox', { name: '科研内容 1' })).toHaveValue('第一条')
  expect(screen.getByRole('textbox', { name: '科研内容 2' })).toHaveValue('第二条')
  await user.click(screen.getByRole('button', { name: '继续添加科研内容' }))
  await user.type(screen.getByRole('textbox', { name: '科研内容 3' }), '第三条')
  await user.click(screen.getByRole('button', { name: '调整顺序' }))
  await user.type(screen.getByRole('button', { name: /拖动科研内容 3 调整顺序/ }), '{ArrowUp}')
  await user.click(screen.getByRole('button', { name: '完成排序' }))
  expect(screen.getByRole('textbox', { name: '科研内容 2' })).toHaveValue('第三条')
  await user.click(screen.getByRole('button', { name: '删除科研内容 2' }))
  expect(screen.getAllByRole('textbox', { name: /科研内容 \d/ })).toHaveLength(2)
  expect(screen.getByRole('textbox', { name: '科研内容 2' })).toHaveValue('第二条')
})
