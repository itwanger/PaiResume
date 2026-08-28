import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { ResumeListItem } from '../api/resume'
import { useResumeStore } from '../store/resumeStore'
import { Header } from '../components/layout/Header'
import { CreateResumeCard } from '../components/dashboard/CreateResumeCard'
import { ResumeCard } from '../components/dashboard/ResumeCard'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
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
import { contentLibraryApi, type ResumeContentTemplate } from '../api/contentLibrary'

export default function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { resumeList, loading, fetchResumeList, createResume, renameResume, deleteResume } = useResumeStore()
  const [creating, setCreating] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [dialogMode, setDialogMode] = useState<'create' | 'rename' | null>(null)
  const [resumeTitle, setResumeTitle] = useState('')
  const [editingResume, setEditingResume] = useState<ResumeListItem | null>(null)
  const [contentTemplates, setContentTemplates] = useState<ResumeContentTemplate[]>([])
  const [selectedContentTemplateId, setSelectedContentTemplateId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ResumeListItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    fetchResumeList()
    void contentLibraryApi.listTemplates().then((response) => {
      setContentTemplates(response.data.data)
    }).catch(() => {
      setContentTemplates([])
    })
  }, [fetchResumeList])

  useEffect(() => {
    if (!hasResumeCreateIntent(location.search)) {
      return
    }

    setDialogError('')
    setResumeTitle('')
    setEditingResume(null)
    setSelectedContentTemplateId(null)
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
      } else if (selectedContentTemplateId !== null) {
        const response = await contentLibraryApi.createResumeFromTemplate(selectedContentTemplateId, title)
        nextResumeId = response.data.data.id
        await fetchResumeList()
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
    setSelectedContentTemplateId(null)
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
    setSelectedContentTemplateId(null)
  }

  const openDeleteDialog = (id: number) => {
    const target = resumeList.find((resume) => resume.id === id)
    if (!target) return
    setDeleteError('')
    setDeleteTarget(target)
  }

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteResume(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '删除失败，请稍后重试')
      if (import.meta.env.DEV) {
        console.error('删除失败:', err instanceof Error ? err.name : 'Error')
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header enableResumeDrop />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="sr-only">我的简历</h1>
        {loading ? <p className="sr-only" role="status">正在加载简历</p> : null}

        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">
          <div className="mb-5 break-inside-avoid">
            <CreateResumeCard
              disabled={creating}
              onClick={openCreateDialog}
            />
          </div>
          {resumeList.map((resume) => (
            <div key={resume.id} className="mb-5 break-inside-avoid">
              <ResumeCard
                resume={resume}
                onDelete={openDeleteDialog}
                onRename={openRenameDialog}
              />
            </div>
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

            {dialogMode === 'create' && contentTemplates.length ? (
              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-gray-700">创建方式</p>
                <div className="grid max-h-52 gap-2 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => setSelectedContentTemplateId(null)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${selectedContentTemplateId === null ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-primary-200'}`}
                  >
                    <span className="block text-sm font-medium text-gray-900">空白简历</span>
                  </button>
                  {contentTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        setSelectedContentTemplateId(template.id)
                        if (!resumeTitle.trim()) setResumeTitle(template.title)
                      }}
                      className={`rounded-xl border px-4 py-3 text-left transition ${selectedContentTemplateId === template.id ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-primary-200'}`}
                    >
                      <span className="block text-sm font-medium text-gray-900">{template.title}</span>
                      <span className="mt-1 block text-xs text-gray-500">{template.summary || [template.targetRole, template.careerStage].filter(Boolean).join(' · ')}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除这份简历？"
        description={deleteError || `删除「${deleteTarget?.title ?? ''}」后无法恢复。`}
        confirmText="确认删除"
        tone="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteError('')
        }}
      />
    </div>
  )
}
