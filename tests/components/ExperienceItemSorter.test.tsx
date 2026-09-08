import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ExperienceItemSorter } from '../../src/components/modules/ExperienceItemSorter'
import type { ResumeModule } from '../../src/api/resume'

const modules = [
  { id: 11, moduleType: 'project', content: { projectName: '项目甲', role: '开发', techStack: 'Java' } },
  { id: 22, moduleType: 'project', content: { projectName: '项目乙', role: '负责人' } },
] as ResumeModule[]

it('项目经历按模块标识保存新顺序并展示项目摘要', async () => {
  const onReorder = vi.fn().mockResolvedValue(undefined)
  render(<ExperienceItemSorter modules={modules} moduleLabel="项目经历" projectMode onReorder={onReorder} />)
  expect(screen.getByText('Java')).toBeInTheDocument()
  expect(screen.queryByText(/个项目/)).not.toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('button', { name: /拖动项目乙/ }), { key: 'ArrowUp' })
  await waitFor(() => expect(onReorder).toHaveBeenCalledWith([22, 11]))
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
})

it('项目排序保存失败时显示可重试错误', async () => {
  const onReorder = vi.fn().mockRejectedValue(new Error('network unavailable'))
  render(<ExperienceItemSorter modules={modules} moduleLabel="项目经历" projectMode onReorder={onReorder} />)
  fireEvent.keyDown(screen.getByRole('button', { name: /拖动项目甲/ }), { key: 'ArrowDown' })
  expect(await screen.findByRole('alert')).toHaveTextContent('顺序保存失败，请重试')
  expect(screen.getByRole('button', { name: /拖动项目甲/ })).toBeEnabled()
})
