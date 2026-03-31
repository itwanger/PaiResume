import { useNavigate } from 'react-router-dom'
import type { ResumeListItem } from '../../api/resume'

interface ResumeCardProps {
  resume: ResumeListItem
  onDelete: (id: number) => void
  onRename: (resume: ResumeListItem) => void
}

const thumbnailThemes = [
  {
    frame: 'border-primary-100 bg-gradient-to-br from-primary-50 via-white to-sky-50',
    glow: 'bg-primary-200/60',
    badge: 'bg-primary-600 text-white',
    accent: 'bg-primary-500',
    soft: 'bg-primary-100',
    ink: 'bg-primary-200',
  },
  {
    frame: 'border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-sky-50',
    glow: 'bg-cyan-200/60',
    badge: 'bg-cyan-600 text-white',
    accent: 'bg-cyan-500',
    soft: 'bg-cyan-100',
    ink: 'bg-cyan-200',
  },
  {
    frame: 'border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50',
    glow: 'bg-blue-200/60',
    badge: 'bg-blue-600 text-white',
    accent: 'bg-blue-500',
    soft: 'bg-blue-100',
    ink: 'bg-blue-200',
  },
]

export function ResumeCard({ resume, onDelete, onRename }: ResumeCardProps) {
  const navigate = useNavigate()
  const theme = thumbnailThemes[resume.id % thumbnailThemes.length]

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm(`确定要删除「${resume.title}」吗？`)) {
      onDelete(resume.id)
    }
  }

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRename(resume)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const templateLabel = resume.templateId && resume.templateId !== 'default'
    ? resume.templateId
    : '标准版'

  return (
    <div
      onClick={() => navigate(`/editor/${resume.id}`)}
      className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-primary-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
          {resume.title}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRename}
            className="text-gray-300 hover:text-primary-600 transition-colors p-1"
            title="重命名"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6.768-6.768a2.5 2.5 0 113.536 3.536L12.536 14.536A4 4 0 019.708 15.708L6 16l.292-3.708A4 4 0 017.464 9.464L9 11z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="text-gray-300 hover:text-red-500 transition-colors p-1"
            title="删除"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className={`relative mb-4 h-36 w-full overflow-hidden rounded-2xl border ${theme.frame}`}>
        <div className={`absolute -left-6 bottom-3 h-16 w-16 rounded-full blur-2xl ${theme.glow}`} />
        <div className={`absolute -right-5 top-2 h-20 w-20 rounded-full blur-2xl ${theme.glow}`} />
        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-white/70">
              <div className="relative h-3.5 w-3.5">
                <div className={`absolute left-0 right-0 top-0 h-1.5 rounded-full ${theme.accent}`} />
                <div className={`absolute bottom-0 left-0.5 h-2.5 w-1.5 rounded-full ${theme.accent}`} />
                <div className={`absolute bottom-0 right-0.5 h-2.5 w-1.5 rounded-full ${theme.accent}`} />
              </div>
            </div>
            <div className="h-2.5 w-16 rounded-full bg-white/80" />
          </div>
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold shadow-sm ${theme.badge}`}>
            {templateLabel}
          </span>
        </div>

        <div className="absolute inset-x-6 top-10 bottom-4">
          <div className="mx-auto flex h-full max-w-[164px] -rotate-2 flex-col rounded-2xl border border-white/80 bg-white/95 p-3 shadow-[0_12px_32px_rgba(15,23,42,0.10)] transition-transform duration-200 group-hover:rotate-0">
            <div className="flex items-start gap-2">
              <div className={`mt-0.5 h-8 w-8 rounded-xl ${theme.soft}`} />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 h-2.5 w-20 rounded-full bg-slate-800/85" />
                <div className={`mb-1 h-2 w-14 rounded-full ${theme.ink}`} />
                <div className="h-2 w-24 rounded-full bg-slate-100" />
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className={`h-1.5 w-10 rounded-full ${theme.accent}`} />
              <div className="grid grid-cols-[1.3fr_0.9fr] gap-2">
                <div className="space-y-1.5">
                  <div className="h-2 rounded-full bg-slate-200" />
                  <div className="h-2 w-11/12 rounded-full bg-slate-100" />
                  <div className="h-2 w-4/5 rounded-full bg-slate-100" />
                </div>
                <div className={`rounded-xl ${theme.soft} p-2`}>
                  <div className={`mb-1.5 h-2 w-8 rounded-full ${theme.ink}`} />
                  <div className="h-2 rounded-full bg-white/90" />
                  <div className="mt-1 h-2 w-4/5 rounded-full bg-white/80" />
                </div>
              </div>
            </div>

            <div className="mt-2.5 space-y-1.5">
              <div className={`h-1.5 w-12 rounded-full ${theme.accent}`} />
              <div className="flex items-center gap-1.5">
                <div className={`h-4 w-4 rounded-md ${theme.soft}`} />
                <div className="h-2 w-full rounded-full bg-slate-100" />
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`h-4 w-4 rounded-md ${theme.soft}`} />
                <div className="h-2 w-5/6 rounded-full bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>模板: {templateLabel}</span>
        <span>更新于 {formatDate(resume.updatedAt)}</span>
      </div>
    </div>
  )
}
