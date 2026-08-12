import { AdminBadge } from './AdminUi'

/**
 * 管理后台状态徽章与中文文案映射。
 * 所有枚举状态必须经这里中文化，禁止把后端原始码（INVALID / REVOKED 等）直接渲染上屏。
 */

type AdminBadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

interface StatusMeta {
  label: string
  tone: AdminBadgeTone
}

const VIP_INVITE_STATUS_META: Record<string, StatusMeta> = {
  ACTIVE: { label: '生效中', tone: 'success' },
  EXHAUSTED: { label: '已兑完', tone: 'neutral' },
  INVALID: { label: '已作废', tone: 'danger' },
  EXPIRED: { label: '已过期', tone: 'warning' },
}

const REDEMPTION_STATUS_META: Record<string, StatusMeta> = {
  ACTIVE: { label: '已兑换', tone: 'success' },
  REVOKED: { label: '已撤销', tone: 'danger' },
}

const FEEDBACK_REVIEW_STATUS_META: Record<string, StatusMeta> = {
  PENDING: { label: '待审核', tone: 'warning' },
  APPROVED: { label: '已通过', tone: 'success' },
  REJECTED: { label: '已拒绝', tone: 'danger' },
}

const FEEDBACK_PUBLISH_STATUS_META: Record<string, StatusMeta> = {
  UNPUBLISHED: { label: '未发布', tone: 'neutral' },
  PUBLISHED: { label: '已发布', tone: 'success' },
}

const COUPON_STATUS_META: Record<string, StatusMeta> = {
  PENDING: { label: '待发放', tone: 'warning' },
  ISSUED: { label: '已发放', tone: 'success' },
  USED: { label: '已使用', tone: 'neutral' },
  INVALID: { label: '已作废', tone: 'danger' },
  REJECTED: { label: '未发放', tone: 'danger' },
  EXPIRED: { label: '已过期', tone: 'warning' },
}

function resolveMeta(map: Record<string, StatusMeta>, status: string): StatusMeta {
  return map[status] ?? { label: status, tone: 'neutral' }
}

interface AdminStatusBadgeProps {
  map: Record<string, StatusMeta>
  prefix?: string
  status: string
}

export function AdminStatusBadge({ map, prefix, status }: AdminStatusBadgeProps) {
  const meta = resolveMeta(map, status)
  return <AdminBadge tone={meta.tone}>{prefix ? `${prefix}${meta.label}` : meta.label}</AdminBadge>
}

export function VipInviteStatusBadge({ status }: { status: string }) {
  return <AdminStatusBadge map={VIP_INVITE_STATUS_META} status={status} />
}

export function RedemptionStatusBadge({ status }: { status: string }) {
  return <AdminStatusBadge map={REDEMPTION_STATUS_META} status={status} />
}

export function FeedbackReviewStatusBadge({ status }: { status: string }) {
  return <AdminStatusBadge map={FEEDBACK_REVIEW_STATUS_META} prefix="审核 " status={status} />
}

export function FeedbackPublishStatusBadge({ status }: { status: string }) {
  return <AdminStatusBadge map={FEEDBACK_PUBLISH_STATUS_META} prefix="发布 " status={status} />
}

export function CouponStatusBadge({ status }: { status: string }) {
  return <AdminStatusBadge map={COUPON_STATUS_META} status={status} />
}
