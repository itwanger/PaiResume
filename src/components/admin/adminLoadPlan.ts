import type { AdminView } from './adminNavigation'

export const ADMIN_DATA_SECTIONS = [
  'platformConfig',
  'feedbacks',
  'coupons',
  'vipInvites',
  'users',
  'membershipAuditLogs',
  'showcases',
  'resumes',
  'marketListings',
  'creatorEarnings',
  'creatorEarningCount',
  'paymentReviews',
  'marketPaymentIssues',
  'paymentCloseWork',
  'membershipSummary',
  'membershipOrders',
  'governance',
  'resumeReviewActionCount',
] as const

export type AdminDataSection = (typeof ADMIN_DATA_SECTIONS)[number]

export const OVERVIEW_LOAD_SECTIONS: readonly AdminDataSection[] = [
  'feedbacks',
  'vipInvites',
  'users',
  'showcases',
  'marketListings',
  'creatorEarningCount',
  'marketPaymentIssues',
  'membershipSummary',
  'governance',
  'resumeReviewActionCount',
]

export const ADMIN_DATA_SECTION_LABELS: Record<AdminDataSection, string> = {
  platformConfig: '会员价格配置',
  feedbacks: '问卷与评价',
  coupons: '优惠码',
  vipInvites: 'VIP 邀请福利',
  users: '用户与会员',
  membershipAuditLogs: '会员审计日志',
  showcases: '官方精选简历',
  resumes: '精选候选简历',
  marketListings: '市场投稿审核',
  creatorEarnings: '作者收益结算',
  creatorEarningCount: '待结算作者收益统计',
  paymentReviews: '市场支付复核列表',
  marketPaymentIssues: '市场支付异常统计',
  paymentCloseWork: '市场关单任务',
  membershipSummary: '会员支付复核摘要',
  membershipOrders: '会员支付订单',
  governance: '举报与申诉',
  resumeReviewActionCount: '待处理人工精修工单统计',
}

/**
 * The governance and resume-review panels load their own paginated/list data.
 * Their parent plans only load the precise navigation-badge counts.
 */
export const ADMIN_VIEW_LOAD_SECTIONS: Record<AdminView, readonly AdminDataSection[]> = {
  overview: OVERVIEW_LOAD_SECTIONS,
  members: ['users'],
  'vip-invites': ['vipInvites'],
  'membership-payments': ['membershipSummary', 'membershipOrders'],
  coupons: ['coupons'],
  showcases: ['showcases', 'resumes'],
  'content-library': [],
  'marketplace-listings': ['marketListings'],
  'marketplace-governance': ['governance'],
  'creator-earnings': ['creatorEarnings', 'creatorEarningCount'],
  'marketplace-payments': ['paymentReviews', 'marketPaymentIssues', 'paymentCloseWork'],
  'resume-reviews': ['resumeReviewActionCount'],
  surveys: ['feedbacks'],
  'platform-config': ['platformConfig'],
  'analysis-prompts': [],
  'ai-provider': [],
  'resume-photo-oss': [],
  'audit-logs': ['membershipAuditLogs'],
}

export type AdminViewLoadState = 'loading' | 'failed' | 'ready'

export function getAdminViewFailedSections(
  view: AdminView,
  failedSections: ReadonlySet<AdminDataSection>,
): AdminDataSection[] {
  return ADMIN_VIEW_LOAD_SECTIONS[view].filter((section) => failedSections.has(section))
}

export function getAdminViewLoadState(
  view: AdminView,
  loadedSections: ReadonlySet<AdminDataSection>,
  loadingSections: ReadonlySet<AdminDataSection>,
  failedSections: ReadonlySet<AdminDataSection>,
): AdminViewLoadState {
  const sections = ADMIN_VIEW_LOAD_SECTIONS[view]
  const loading = sections.some((section) => (
    loadingSections.has(section)
    || (!loadedSections.has(section) && !failedSections.has(section))
  ))
  if (loading) return 'loading'
  return sections.some((section) => failedSections.has(section)) ? 'failed' : 'ready'
}
