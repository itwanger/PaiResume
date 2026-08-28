interface CreateResumeCardProps {
  disabled?: boolean
  onClick: () => void
}

export function CreateResumeCard({ disabled = false, onClick }: CreateResumeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-haspopup="dialog"
      className="group flex min-h-64 w-full flex-col items-center justify-center rounded-xl border border-dashed border-primary-200 bg-white p-5 text-center transition-all hover:border-primary-400 hover:bg-primary-50/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-100"
        aria-hidden="true"
      >
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
        </svg>
      </span>
      <span className="mt-4 font-semibold text-gray-900 group-hover:text-primary-700">
        {disabled ? '创建中...' : '新建简历'}
      </span>
    </button>
  )
}
