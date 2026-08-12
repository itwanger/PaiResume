import type { ReactNode } from 'react'
import type { AdminView } from './adminNavigation'

interface AdminNavIconProps {
  view: AdminView
  className?: string
}

const ICON_PATHS: Record<AdminView, ReactNode> = {
  overview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" />
      <rect x="13.5" y="11" width="7" height="9.5" rx="1.5" />
      <rect x="3.5" y="14" width="7" height="6.5" rx="1.5" />
    </>
  ),
  members: (
    <>
      <path d="M15.5 20.5v-1.7a4.3 4.3 0 0 0-4.3-4.3H6.8a4.3 4.3 0 0 0-4.3 4.3v1.7" />
      <circle cx="9" cy="6.5" r="3.5" />
      <path d="M17 10.3a3.5 3.5 0 0 0 0-6.8M21.5 20.5v-1.7a4.3 4.3 0 0 0-3.2-4.2" />
    </>
  ),
  'vip-invites': (
    <>
      <rect x="3" y="8" width="18" height="12.5" rx="2" />
      <path d="M12 8v12.5M3 12.2h18" />
      <path d="M12 8H8.7a2.6 2.6 0 1 1 2.5-3.3L12 8Zm0 0h3.3a2.6 2.6 0 1 0-2.5-3.3L12 8Z" />
    </>
  ),
  'membership-payments': (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9h19M6.5 15h4" />
    </>
  ),
  coupons: (
    <>
      <path d="M4.5 6.5h15v4a2.5 2.5 0 0 0 0 5v4h-15v-4a2.5 2.5 0 0 0 0-5v-4Z" />
      <path d="M12 8.5v1M12 12v1M12 15.5v1" />
    </>
  ),
  showcases: (
    <>
      <path d="m12 3 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 17.03l-5.5 2.89 1.05-6.12L3.1 9.47l6.15-.9L12 3Z" />
    </>
  ),
  'content-library': (
    <>
      <path d="M4 4.5h6.5a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3v-12Z" />
      <path d="M20 4.5h-6.5v15H17a3 3 0 0 0 3-3v-12ZM7.5 9h3M7.5 13h3M16 9h1M16 13h1" />
    </>
  ),
  'marketplace-listings': (
    <>
      <path d="M6 3.5h9l3 3v14H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
      <path d="M14.5 3.5V7H18M8 11h6M8 15h8" />
    </>
  ),
  'marketplace-governance': (
    <>
      <path d="M12 2.8 20 6v5.6c0 4.8-3.2 7.9-8 9.6-4.8-1.7-8-4.8-8-9.6V6l8-3.2Z" />
      <path d="m8.5 12 2.2 2.2 4.8-4.8" />
    </>
  ),
  'creator-earnings': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5h-5a2.2 2.2 0 0 0 0 4.4h3a2.2 2.2 0 0 1 0 4.4h-5M12 6.5v12" />
    </>
  ),
  'marketplace-payments': (
    <>
      <path d="M12 3 2.7 19h18.6L12 3Z" />
      <path d="M12 9v4.5M12 17h.01" />
    </>
  ),
  'resume-reviews': (
    <>
      <path d="M6 3.5h8.5L18 7v13.5H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
      <path d="M14 3.5V7h4M8 11h5M8 15h3" />
      <path d="m14 16 1.5 1.5L19 14" />
    </>
  ),
  surveys: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h5M8 16h3" />
      <path d="m15 15.5 1.2 1.2 2.3-2.4" />
    </>
  ),
  'platform-config': (
    <>
      <path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h7M15 18h5" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="13" cy="18" r="2" />
    </>
  ),
  'audit-logs': (
    <>
      <path d="M5 3.5h14v17H5zM8 8h8M8 12h8M8 16h5" />
      <path d="M9 3.5v-1M15 3.5v-1" />
    </>
  ),
}

export function AdminNavIcon({ view, className = 'h-5 w-5' }: AdminNavIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[view]}
    </svg>
  )
}
