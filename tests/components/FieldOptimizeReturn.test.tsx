import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import FieldOptimizePage from '../../src/pages/FieldOptimizePage'
import { fieldOptimizeInputId, useFieldOptimizeReturn } from '../../src/hooks/useFieldOptimizeReturn'

const api = vi.hoisted(() => ({ getFieldOptimizeMethods: vi.fn(), getLatestFieldOptimizeRecord: vi.fn() }))
const store = vi.hoisted(() => ({ currentResumeId: 1, loading: false, fetchModules: vi.fn(), updateModuleContent: vi.fn(), modules: [{ id: 7, resumeId: 1, moduleType: 'internship', sortOrder: 0, createdAt: '', updatedAt: '', content: { company: '示例公司', projects: [{ id: 'p0', responsibilities: ['第一项目职责'] }, { id: 'p1', responsibilities: ['待优化职责'] }] } }] }))
vi.mock('../../src/api/resume', () => ({ resumeApi: api }))
vi.mock('../../src/store/resumeStore', () => ({ useResumeStore: () => store }))
const scroll = vi.fn()
function EditorDestination() {
  const location = useLocation()
  const [focusedExperienceModuleId, setFocusedExperienceModuleId] = useState<number | null>(null)
  const [, setCollapsedModuleIds] = useState(new Set<number>())
  useFieldOptimizeReturn({ resumeId: 1, modules: store.modules, modulesLoaded: true, activeModuleType: 'internship', focusedExperienceModuleId, setFocusedExperienceModuleId, setCollapsedModuleIds })
  return <><output>{JSON.stringify(location.state)}</output>{focusedExperienceModuleId === 7 ? <><h1>项目编辑</h1><textarea aria-label="目标职责" id={fieldOptimizeInputId(7, 1, 'responsibility', 0)} /></> : <h1>公司编辑</h1>}</>
}
beforeEach(() => {
  vi.clearAllMocks()
  HTMLElement.prototype.scrollIntoView = scroll
  api.getFieldOptimizeMethods.mockResolvedValue({ data: { data: [{ id: 'standard', name: '标准优化', description: '精简表达' }] } })
  api.getLatestFieldOptimizeRecord.mockResolvedValue({ data: { data: { status: 'completed', original: '待优化职责', candidates: ['优化完成的职责'] } } })
  store.updateModuleContent.mockResolvedValue(undefined)
})
it.each(['返回核心职责 1编辑', '采纳这个版本'])('%s 后打开原项目并聚焦原职责', async (action) => {
  render(<MemoryRouter initialEntries={['/editor/1/modules/7/field-optimize?fieldType=responsibility&projectIndex=1&index=0&returnModuleType=internship']}><Routes><Route path="/editor/:id/modules/:moduleId/field-optimize" element={<FieldOptimizePage />} /><Route path="/editor/:id" element={<EditorDestination />} /></Routes></MemoryRouter>)
  await screen.findByDisplayValue('优化完成的职责')
  await userEvent.click(screen.getByRole('button', { name: action }))
  expect(await screen.findByRole('heading', { name: '项目编辑' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '公司编辑' })).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByLabelText('目标职责')).toHaveFocus())
  expect(scroll).toHaveBeenCalledWith({ block: 'center' })
  if (action === '采纳这个版本') expect(store.updateModuleContent).toHaveBeenCalledWith(1, 7, expect.objectContaining({ projects: expect.arrayContaining([expect.objectContaining({ id: 'p1', responsibilities: ['优化完成的职责'] })]) }))
})
