import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { ResumeListItem } from '../api/resume'
import { useResumeStore } from '../store/resumeStore'
import { Header } from '../components/layout/Header'
import { CreateResumeCard } from '../components/dashboard/CreateResumeCard'
import { ResumeCard } from '../components/dashboard/ResumeCard'
import {
  AUTHENTICATED_HOME_PATH,
  buildResumeEditorPath,
} from '../config/site'
import {
  RESUME_TITLE_MAX_LENGTH,
  getResumeTitleError,
  hasResumeCreateIntent,
  normalizeResumeTitle,
} from '../utils/resumeCreation'

export default function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { resumeList, loading, fetchResumeList, createResume, renameResume, deleteResume } = useResumeStore()
  const [creating, setCreating] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [dialogMode, setDialogMode] = useState<'create' | 'rename' | null>(null)
  const [resumeTitle, setResumeTitle] = useState('')
  const [editingResume, setEditingResume] = useState<ResumeListItem | null>(null)

  useEffect(() => {
    fetchResumeList()
  }, [fetchResumeList])

  useEffect(() => {
    if (!hasResumeCreateIntent(location.search)) {
      return
    }

    setDialogError('')
    setResumeTitle('')
    setEditingResume(null)
    setDialogMode('create')
    navigate(AUTHENTICATED_HOME_PATH, { replace: true })
  }, [location.search, navigate])

  const handleCreate = async () => {
    const titleError = getResumeTitleError(resumeTitle)
    if (titleError) {
      setDialogError(titleError)
      return
    }

    setDialogError('')
    setCreating(true)
    try {
      const title = normalizeResumeTitle(resumeTitle)
      let nextResumeId: number | null = null
      if (dialogMode === 'rename' && editingResume) {
        await renameResume(editingResume.id, title)
      } else {
        const resume = await createResume(title)
        nextResumeId = resume.id
      }
      setResumeTitle('')
      setEditingResume(null)
      setDialogMode(null)
      if (nextResumeId) {
        navigate(buildResumeEditorPath(nextResumeId))
      }
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : dialogMode === 'rename'
          ? '重命名失败，请稍后重试'
          : '创建失败，请稍后重试'
      setDialogError(message)
    } finally {
      setCreating(false)
    }
  }

  const openCreateDialog = () => {
    setDialogError('')
    setResumeTitle('')
    setEditingResume(null)
    setDialogMode('create')
  }

  const openRenameDialog = (resume: ResumeListItem) => {
    setDialogError('')
    setResumeTitle(resume.title)
    setEditingResume(resume)
    setDialogMode('rename')
  }

  const closeCreateDialog = () => {
    if (creating) return
    setDialogMode(null)
    setDialogError('')
    setResumeTitle('')
    setEditingResume(null)
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteResume(id)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('删除失败:', err instanceof Error ? err.name : 'Error')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header enableResumeDrop />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="sr-only">我的简历</h1>
        {loading ? <p className="sr-only" role="status">正在加载简历</p> : null}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <CreateResumeCard
            disabled={creating}
            onClick={openCreateDialog}
          />
          {resumeList.map((resume) => (
            <ResumeCard
              key={resume.id}
              resume={resume}
              onDelete={handleDelete}
              onRename={openRenameDialog}
            />
          ))}
        </div>
      </main>

      {dialogMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="resume-title-dialog-heading"
          >
            <div className="mb-4">
              <h2 id="resume-title-dialog-heading" className="text-lg font-semibold text-gray-900">
                {dialogMode === 'rename' ? '重命名简历' : '新建简历'}
              </h2>
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
                onChange={(e) => {
                  setResumeTitle(e.target.value)
                  if (dialogError) {
                    setDialogError('')
                  }
                }}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) {
                    return
                  }
                  if (e.key === 'Enter' && !creating) {
                    void handleCreate()
                  }
                }}
                placeholder="例如：Java 后端简历"
                required
                maxLength={RESUME_TITLE_MAX_LENGTH}
                aria-describedby={dialogError ? 'resume-title-error' : undefined}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
              {dialogError ? (
                <p id="resume-title-error" className="mt-2 text-sm text-red-600" role="alert">
                  {dialogError}
                </p>
              ) : null}
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
                disabled={creating || !normalizeResumeTitle(resumeTitle)}
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
