export const ADMIN_VIEWS = [
  'overview',
  'members',
  'vip-invites',
  'membership-payments',
  'showcases',
  'marketplace-listings',
  'marketplace-governance',
  'creator-earnings',
  'marketplace-payments',
  'resume-reviews',
  'surveys',
  'platform-config',
  'audit-logs',
] as const

export type AdminView = (typeof ADMIN_VIEWS)[number]

export function isAdminView(value: string | null): value is AdminView {
  return value !== null && ADMIN_VIEWS.includes(value as AdminView)
}

export function buildAdminViewPath(view: AdminView): string {
  return view === 'overview'
    ? '/admin'
    : `/admin?view=${encodeURIComponent(view)}`
}

export interface AdminNavigationItem {
  id: AdminView
  label: string
  shortLabel: string
  mark: string
}

interface AdminNavigationGroup {
  label: string
  items: AdminNavigationItem[]
}

export const ADMIN_NAVIGATION: AdminNavigationGroup[] = [
  {
    label: '工作台',
    items: [
      {
        id: 'overview',
        label: '运营总览',
        shortLabel: '总览',
        mark: '总',
      },
    ],
  },
  {
    label: '会员与增长',
    items: [
      {
        id: 'members',
        label: '用户与会员',
        shortLabel: '会员',
        mark: '员',
      },
      {
        id: 'vip-invites',
        label: 'VIP 邀请福利',
        shortLabel: '邀请',
        mark: '邀',
      },
      {
        id: 'membership-payments',
        label: '会员支付订单',
        shortLabel: '会员订单',
        mark: '订',
      },
    ],
  },
  {
    label: '内容与市场',
    items: [
      {
        id: 'showcases',
        label: '官方精选简历',
        shortLabel: '精选',
        mark: '精',
      },
      {
        id: 'marketplace-listings',
        label: '市场投稿审核',
        shortLabel: '投稿',
        mark: '稿',
      },
      {
        id: 'marketplace-governance',
        label: '举报与申诉',
        shortLabel: '治理',
        mark: '治',
      },
      {
        id: 'creator-earnings',
        label: '作者收益结算',
        shortLabel: '结算',
        mark: '结',
      },
      {
        id: 'marketplace-payments',
        label: '市场支付异常',
        shortLabel: '异常支付',
        mark: '异',
      },
    ],
  },
  {
    label: '服务与反馈',
    items: [
      {
        id: 'resume-reviews',
        label: '人工精修工单',
        shortLabel: '精修',
        mark: '修',
      },
      {
        id: 'surveys',
        label: '问卷与优惠码',
        shortLabel: '问卷',
        mark: '问',
      },
    ],
  },
  {
    label: '系统与安全',
    items: [
      {
        id: 'platform-config',
        label: '平台业务配置',
        shortLabel: '配置',
        mark: '配',
      },
      {
        id: 'audit-logs',
        label: '会员审计日志',
        shortLabel: '审计',
        mark: '审',
      },
    ],
  },
]

export const ADMIN_VIEW_META = Object.fromEntries(
  ADMIN_NAVIGATION.flatMap((group) => group.items.map((item) => [item.id, item])),
) as Record<AdminView, AdminNavigationItem>
