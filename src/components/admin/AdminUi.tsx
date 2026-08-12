import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from 'react'

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

type AdminTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

interface AdminCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  action?: ReactNode
  children: ReactNode
  description?: ReactNode
  title?: ReactNode
  tone?: AdminTone
}

export function AdminCard({
  action,
  children,
  className,
  description,
  title,
  tone = 'neutral',
  ...props
}: AdminCardProps) {
  return (
    <section
      className={joinClassNames('admin-card', `admin-card--${tone}`, className)}
      {...props}
    >
      {title || description || action ? (
        <header className="admin-card__header">
          <div className="min-w-0">
            {title ? <h2 className="admin-card__title">{title}</h2> : null}
            {description ? <p className="admin-card__description">{description}</p> : null}
          </div>
          {action ? <div className="admin-card__action">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}

type AdminButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
type AdminButtonSize = 'sm' | 'md'

interface AdminButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  loading?: boolean
  size?: AdminButtonSize
  variant?: AdminButtonVariant
}

export function AdminButton({
  children,
  className,
  disabled,
  loading = false,
  size = 'md',
  type = 'button',
  variant = 'primary',
  ...props
}: AdminButtonProps) {
  return (
    <button
      type={type}
      className={joinClassNames(
        'admin-button',
        `admin-button--${variant}`,
        `admin-button--${size}`,
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <svg
          aria-hidden="true"
          className="admin-button__spinner"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
        </svg>
      ) : null}
      <span>{children}</span>
    </button>
  )
}

interface AdminBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  tone?: AdminTone
}

export function AdminBadge({
  children,
  className,
  tone = 'neutral',
  ...props
}: AdminBadgeProps) {
  return (
    <span
      className={joinClassNames('admin-badge', `admin-badge--${tone}`, className)}
      {...props}
    >
      {children}
    </span>
  )
}

interface AdminEmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  action?: ReactNode
  description?: ReactNode
  title?: ReactNode
}

export function AdminEmptyState({
  action,
  className,
  description,
  title = '暂无数据',
  ...props
}: AdminEmptyStateProps) {
  return (
    <div className={joinClassNames('admin-empty-state', className)} {...props}>
      <span className="admin-empty-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M5 8.5h14v10H5z" stroke="currentColor" strokeWidth="1.6" />
          <path d="m7.5 5.5 2-2h5l2 2M5 13h4l1.5 2h3l1.5-2h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
        </svg>
      </span>
      <h3 className="admin-empty-state__title">{title}</h3>
      {description ? <p className="admin-empty-state__description">{description}</p> : null}
      {action ? <div className="admin-empty-state__action">{action}</div> : null}
    </div>
  )
}

interface AdminTableScrollerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  label: string
}

export function AdminTableScroller({
  children,
  className,
  label,
  tabIndex = 0,
  ...props
}: AdminTableScrollerProps) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={tabIndex}
      className={joinClassNames('admin-table-scroll', className)}
      {...props}
    >
      {children}
    </div>
  )
}

type AdminFeedbackTone = 'info' | 'success' | 'warning' | 'danger'

interface AdminFeedbackProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  tone?: AdminFeedbackTone
}

const FEEDBACK_MARKS: Record<AdminFeedbackTone, string> = {
  info: 'i',
  success: '✓',
  warning: '!',
  danger: '!',
}

export function AdminFeedback({
  children,
  className,
  role,
  tone = 'info',
  ...props
}: AdminFeedbackProps) {
  const resolvedRole = role ?? (tone === 'danger' || tone === 'warning' ? 'alert' : 'status')

  return (
    <div
      role={resolvedRole}
      className={joinClassNames('admin-feedback', `admin-feedback--${tone}`, className)}
      {...props}
    >
      <span className="admin-feedback__mark" aria-hidden="true">
        {FEEDBACK_MARKS[tone]}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
