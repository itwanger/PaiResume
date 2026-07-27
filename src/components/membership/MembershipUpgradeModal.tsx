import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { buildMembershipPath } from '../../utils/navigation'

interface Props {
  open: boolean
  onClose: () => void
}

export function MembershipUpgradeModal({ open, onClose }: Props) {
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}${location.hash}`

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="membership-upgrade-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="membership-upgrade-title" className="text-xl font-semibold text-slate-950">
              该功能需要 VIP
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              开通后可使用全部 VIP 功能。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
          <Link
            to={buildMembershipPath(returnTo)}
            onClick={onClose}
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            查看会员方案
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            暂不开通
          </button>
        </div>
      </section>
    </div>
  )
}
