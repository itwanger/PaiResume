import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ResumeListItem } from '../api/resume'
import { useResumeStore } from '../store/resumeStore'
import { Header } from '../components/layout/Header'
import { ResumeCard } from '../components/dashboard/ResumeCard'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { resumeList, loading, fetchResumeList, createResume, renameResume, deleteResume } = useResumeStore()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [dialogMode, setDialogMode] = useState<'create' | 'rename' | null>(null)
  const [resumeTitle, setResumeTitle] = useState('')
  const [editingResume, setEditingResume] = useState<ResumeListItem | null>(null)

  useEffect(() => {
    fetchResumeList()
  }, [fetchResumeList])

  const handleCreate = async () => {
    setError('')
    setCreating(true)
    try {
      const title = resumeTitle.trim()
      let nextResumeId: number | null = null
      if (dialogMode === 'rename' && editingResume) {
        await renameResume(editingResume.id, title)
      } else {
        const resume = await createResume(title || undefined)
        nextResumeId = resume.id
      }
      setResumeTitle('')
      setEditingResume(null)
      setDialogMode(null)
      if (nextResumeId) {
        navigate(`/editor/${nextResumeId}?moduleType=basic_info`)
      }
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : dialogMode === 'rename'
          ? '重命名失败，请稍后重试'
          : '创建失败，请稍后重试'
      setError(message)
    } finally {
      setCreating(false)
    }
  }

  const openCreateDialog = () => {
    setError('')
    setResumeTitle('')
    setEditingResume(null)
    setDialogMode('create')
  }

  const openRenameDialog = (resume: ResumeListItem) => {
    setError('')
    setResumeTitle(resume.title)
    setEditingResume(resume)
    setDialogMode('rename')
  }

  const closeCreateDialog = () => {
    if (creating) return
    setDialogMode(null)
    setResumeTitle('')
    setEditingResume(null)
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteResume(id)
    } catch (err) {
      console.error('删除失败:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">我的简历</h1>
            <p className="text-gray-500 mt-1">共 {resumeList.length} 份简历</p>
          </div>
          <button
            onClick={openCreateDialog}
            disabled={creating}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {creating ? '创建中...' : '新建简历'}
          </button>
        </div>

        {loading && resumeList.length === 0 ? (
          <div className="text-center py-20 text-gray-400">加载中...</div>
        ) : resumeList.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 mb-4">还没有简历，点击上方按钮创建</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {resumeList.map((resume) => (
              <ResumeCard
                key={resume.id}
                resume={resume}
                onDelete={handleDelete}
                onRename={openRenameDialog}
              />
            ))}
          </div>
        )}
      </main>

      {dialogMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {dialogMode === 'rename' ? '重命名简历' : '新建简历'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {dialogMode === 'rename'
                  ? '换一个更清晰的标题，后续查找会更方便。'
                  : '先给这份简历起个名字，后续也更方便管理。'}
              </p>
            </div>

            <div>
              <label htmlFor="resume-title" className="mb-2 block text-sm font-medium text-gray-700">
                简历名称
              </label>
              <input
                id="resume-title"
                name="resumeTitle"
                type="text"
                value={resumeTitle}
                onChange={(e) => setResumeTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !creating) {
                    void handleCreate()
                  }
                }}
                placeholder="例如：Java 后端简历"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeCreateDialog}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              >
                {creating
                  ? (dialogMode === 'rename' ? '保存中...' : '创建中...')
                  : (dialogMode === 'rename' ? '保存修改' : '确认创建')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
