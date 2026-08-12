import { useNavigate } from 'react-router-dom'
import type { ResumeCardPreview, ResumeListItem } from '../../api/resume'
import { buildResumeEditorPath } from '../../config/site'

interface ResumeCardProps {
  resume: ResumeListItem
  onDelete: (id: number) => void
  onRename: (resume: ResumeListItem) => void
}

const emptyPreview: ResumeCardPreview = {
  name: '',
  targetRole: '',
  education: '',
  experience: '',
  project: '',
  skills: [],
  moduleCounts: {},
  filledModuleCount: 0,
}

const sectionLabels: Record<string, string> = {
  education: '教育',
  internship: '实习',
  work_experience: '工作',
  project: '项目',
  skill: '技能',
  paper: '论文',
  research: '科研',
  award: '获奖',
}

function ResumeContentThumbnail({ preview }: { preview: ResumeCardPreview }) {
  const summaryRows = [
    { label: '教育背景', value: preview.education },
    { label: '工作/实习', value: preview.experience },
    { label: '项目经历', value: preview.project },
  ].filter((item) => item.value)
  const moduleSummary = Object.entries(preview.moduleCounts || {})
    .filter(([type]) => type !== 'basic_info' && type !== 'job_intention')
    .map(([type, count]) => `${sectionLabels[type] || type}${count > 1 ? ` ${count}` : ''}`)
    .slice(0, 5)
  const hasContent = preview.filledModuleCount > 0

  return (
    <div
      className="relative mb-4 h-40 w-full shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-3"
      aria-label={hasContent
        ? `简历内容概览：${preview.name || '姓名待填写'}，${preview.targetRole || '求职方向待填写'}，已填写 ${preview.filledModuleCount} 个模块`
        : '空白简历，尚未填写内容'}
    >
      <div className="mx-auto flex h-full max-w-[260px] flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="border-b border-primary-100 bg-primary-50/70 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold leading-4 text-slate-900">
                {preview.name || '姓名待填写'}
              </p>
              <p className="truncate text-[9px] leading-3.5 text-primary-700">
                {preview.targetRole || '求职方向待填写'}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[8px] font-medium text-slate-500 ring-1 ring-slate-200">
              {preview.filledModuleCount} 个模块
            </span>
          </div>
        </div>

        {hasContent ? (
          <div className="grid min-h-0 flex-1 grid-cols-[74px_minmax(0,1fr)]">
            <aside className="border-r border-slate-100 bg-slate-50/80 px-2 py-2">
              <p className="text-[8px] font-semibold tracking-wide text-slate-500">技能概览</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {preview.skills.length ? preview.skills.slice(0, 5).map((skill) => (
                  <span key={skill} className="max-w-full truncate rounded bg-primary-50 px-1 py-0.5 text-[7px] leading-3 text-primary-700">
                    {skill}
                  </span>
                )) : (
                  <span className="text-[7px] leading-3 text-slate-400">暂未填写技能</span>
                )}
              </div>
              {moduleSummary.length ? (
                <p className="mt-2 text-[7px] leading-3 text-slate-400">{moduleSummary.join(' · ')}</p>
              ) : null}
            </aside>

            <div className="min-w-0 space-y-2 px-2.5 py-2">
              {summaryRows.length ? summaryRows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <div className="mb-0.5 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                    <span className="text-[8px] font-semibold leading-3 text-slate-600">{row.label}</span>
                  </div>
                  <p className="truncate pl-2.5 text-[8px] leading-3 text-slate-500">{row.value}</p>
                </div>
              )) : (
                <div className="flex h-full items-center justify-center text-center text-[8px] leading-4 text-slate-400">
                  已填写基础信息，继续补充教育、经历和项目
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
            <div className="mb-2 grid w-full grid-cols-2 gap-1.5 opacity-70">
              <span className="h-1.5 rounded-full bg-slate-100" />
              <span className="h-1.5 rounded-full bg-slate-100" />
              <span className="h-1.5 rounded-full bg-slate-100" />
              <span className="h-1.5 rounded-full bg-slate-100" />
            </div>
            <p className="text-[9px] font-medium text-slate-500">尚未填写简历内容</p>
            <p className="mt-0.5 text-[8px] text-slate-400">打开后开始完善</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function ResumeCard({ resume, onDelete, onRename }: ResumeCardProps) {
  const navigate = useNavigate()
  const preview = resume.preview || emptyPreview

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (window.confirm(`确定要删除「${resume.title}」吗？`)) onDelete(resume.id)
  }

  const handleRename = (event: React.MouseEvent) => {
    event.stopPropagation()
    onRename(resume)
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const templateLabel = resume.templateId && resume.templateId !== 'default' ? resume.templateId : '标准版'

  return (
    <article
      onClick={() => navigate(buildResumeEditorPath(resume.id))}
      className="group flex h-full min-h-72 cursor-pointer flex-col rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-primary-300 hover:shadow-md"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2
          className="min-w-0 flex-1 whitespace-normal break-words text-base font-semibold leading-6 text-gray-900 transition-colors group-hover:text-primary-600"
          title={resume.title}
        >
          {resume.title}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleRename}
            className="p-1 text-gray-300 transition-colors hover:text-primary-600"
            title="重命名"
            aria-label={`重命名「${resume.title}」`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6.768-6.768a2.5 2.5 0 113.536 3.536L12.536 14.536A4 4 0 019.708 15.708L6 16l.292-3.708A4 4 0 017.464 9.464L9 11z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="p-1 text-gray-300 transition-colors hover:text-red-500"
            title="删除"
            aria-label={`删除「${resume.title}」`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <ResumeContentThumbnail preview={preview} />

      <footer className="mt-auto flex items-center justify-between gap-3 text-xs text-gray-400">
        <span className="truncate">模板：{templateLabel}</span>
        <span className="shrink-0">更新于 {formatDate(resume.updatedAt)}</span>
      </footer>
    </article>
  )
}
