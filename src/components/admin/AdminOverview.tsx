import type { AdminView } from './adminNavigation'

interface AdminOverviewProps {
  activeInviteCount: number | null
  activeMemberCount: number | null
  dataComplete: boolean
  failedSections: string[]
  lastUpdatedAt: Date | null
  marketplacePaymentIssueCount: number | null
  membershipPaymentIssueCount: number | null
  pendingCreatorEarningCount: number | null
  pendingFeedbackCount: number | null
  pendingGovernanceCount: number | null
  pendingListingCount: number | null
  pendingResumeReviewCount: number | null
  publishedShowcaseCount: number | null
  reconciliationFailureCount: number | null
  refreshing: boolean
  totalUserCount: number | null
  lastReconciliationFailureAt: string | null
  onNavigate: (view: AdminView) => void
  onRefresh: () => void
}

interface MetricCardProps {
  label: string
  value: number | null
  detail: string
  tone: 'blue' | 'emerald' | 'amber' | 'violet'
}

const METRIC_TONES = {
  blue: 'border-blue-100 bg-blue-50/70 text-blue-700',
  emerald: 'border-emerald-100 bg-emerald-50/70 text-emerald-700',
  amber: 'border-amber-100 bg-amber-50/70 text-amber-700',
  violet: 'border-violet-100 bg-violet-50/70 text-violet-700',
}

function MetricCard({ label, value, detail, tone }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.5)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {value ?? '—'}
          </div>
        </div>
        <div className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold ${METRIC_TONES[tone]}`}>
          {value === null ? '加载失败' : '本次加载'}
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400">{detail}</p>
    </article>
  )
}

interface ActionItem {
  count: number | null
  description: string
  label: string
  tone: string
  view: AdminView
}

export function AdminOverview({
  activeInviteCount,
  activeMemberCount,
  dataComplete,
  failedSections,
  lastUpdatedAt,
  marketplacePaymentIssueCount,
  membershipPaymentIssueCount,
  pendingCreatorEarningCount,
  pendingFeedbackCount,
  pendingGovernanceCount,
  pendingListingCount,
  pendingResumeReviewCount,
  publishedShowcaseCount,
  reconciliationFailureCount,
  refreshing,
  totalUserCount,
  lastReconciliationFailureAt,
  onNavigate,
  onRefresh,
}: AdminOverviewProps) {
  const actionItems: ActionItem[] = [
    {
      count: pendingListingCount,
      description: '新投稿与修订版本需要审核后才能进入市场。',
      label: '待审市场投稿',
      tone: 'bg-blue-600',
      view: 'marketplace-listings',
    },
    {
      count: membershipPaymentIssueCount,
      description: '迟到付款、重复付款或退款事项需要人工确认。',
      label: '会员支付复核',
      tone: 'bg-orange-500',
      view: 'membership-payments',
    },
    {
      count: marketplacePaymentIssueCount,
      description: '用户简历交易存在待核验支付或退款记录。',
      label: '市场支付异常',
      tone: 'bg-red-500',
      view: 'marketplace-payments',
    },
    {
      count: pendingCreatorEarningCount,
      description: '作者已发起提现申请，完成线下打款后登记流水。',
      label: '待结算作者收益',
      tone: 'bg-amber-500',
      view: 'creator-earnings',
    },
    {
      count: pendingGovernanceCount,
      description: '开放举报与申诉需要在治理工作台中处理并留痕。',
      label: '待处理举报与申诉',
      tone: 'bg-rose-500',
      view: 'marketplace-governance',
    },
    {
      count: pendingResumeReviewCount,
      description: '已发送、处理中、待退款或邮件失败的精修工单需要跟进。',
      label: '待处理人工精修',
      tone: 'bg-cyan-500',
      view: 'resume-reviews',
    },
    {
      count: pendingFeedbackCount,
      description: '用户评价与问卷需要审核后再决定是否发布。',
      label: '待审问卷反馈',
      tone: 'bg-violet-500',
      view: 'surveys',
    },
  ]
  const totalActionCount = dataComplete
    ? actionItems.reduce((total, item) => total + (item.count ?? 0), 0)
    : null
  const formattedLastUpdatedAt = lastUpdatedAt?.toLocaleString('zh-CN', { hour12: false }) ?? '尚未完整加载'

  return (
    <div className="admin-workspace space-y-6">
      <section className="overflow-hidden border-0 bg-[linear-gradient(135deg,#0f172a_0%,#172554_58%,#1d4ed8_150%)] px-6 py-7 text-white shadow-[0_22px_60px_-36px_rgba(15,23,42,0.85)] sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)] lg:items-end">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Today at a glance</div>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
              {totalActionCount === null
                ? '运营数据未完整加载'
                : totalActionCount > 0
                  ? `当前有 ${totalActionCount} 项运营事项需要处理`
                  : '当前运营队列已清空'}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              {dataComplete
                ? '数据直接来自现有管理接口。优先处理支付、退款和内容审核，再处理增长与日常运营事项。'
                : `以下数据加载失败，不能据此判断队列已清空：${failedSections.join('、') || '未知模块'}。`}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span>更新时间：{formattedLastUpdatedAt}</span>
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 font-medium text-white transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-60"
              >
                {refreshing ? '刷新中…' : '刷新总览'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3 backdrop-blur">
              <div className="text-xs text-slate-300">待办事项</div>
              <div className="mt-1 text-2xl font-semibold">{totalActionCount ?? '—'}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3 backdrop-blur">
              <div className="text-xs text-slate-300">已发布精选</div>
              <div className="mt-1 text-2xl font-semibold">{publishedShowcaseCount ?? '—'}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-0 bg-transparent p-0 shadow-none sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="平台注册用户"
          value={totalUserCount}
          detail="当前管理接口返回的全部用户"
          tone="blue"
        />
        <MetricCard
          label="有效 VIP"
          value={activeMemberCount}
          detail="会员状态为 ACTIVE 的账号"
          tone="emerald"
        />
        <MetricCard
          label="有效邀请批次"
          value={activeInviteCount}
          detail="仍可继续兑换的知识星球批次"
          tone="violet"
        />
        <MetricCard
          label="公开精选简历"
          value={publishedShowcaseCount}
          detail="当前发布状态为 PUBLISHED 的官方内容"
          tone="amber"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section className="border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.5)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">优先处理</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">按资金风险、内容曝光和用户体验排序。</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {totalActionCount === null ? '数据不完整' : `${totalActionCount} 项`}
            </span>
          </div>
          <div className="mt-5 divide-y divide-slate-100">
            {actionItems.map((item) => (
              <button
                key={item.view}
                type="button"
                onClick={() => onNavigate(item.view)}
                className="group flex w-full items-center gap-4 py-4 text-left first:pt-0 last:pb-0"
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  item.count === null ? 'bg-slate-300' : item.count > 0 ? item.tone : 'bg-slate-200'
                }`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-800 group-hover:text-blue-700">{item.label}</span>
                  <span className="mt-1 block truncate text-xs text-slate-400">{item.description}</span>
                </span>
                <span className={`text-sm font-semibold ${
                  item.count === null ? 'text-slate-400' : item.count > 0 ? 'text-slate-950' : 'text-emerald-600'
                }`}>
                  {item.count === null ? '加载失败' : item.count > 0 ? item.count : '已清空'}
                </span>
                <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </section>

        <section className="border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.5)] sm:p-6">
          <h2 className="text-base font-semibold text-slate-950">安全与运行提示</h2>
          <div className="mt-5 space-y-4">
            <div className="flex gap-3">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                reconciliationFailureCount === null
                  ? 'bg-slate-300'
                  : reconciliationFailureCount > 0
                    ? 'bg-red-500'
                    : 'bg-emerald-500'
              }`} />
              <div>
                <div className="text-sm font-medium text-slate-800">会员支付对账</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {reconciliationFailureCount === null
                    ? '对账状态加载失败，请刷新总览后再判断。'
                    : reconciliationFailureCount > 0
                      ? `本进程启动后记录 ${reconciliationFailureCount} 次失败，最近一次：${lastReconciliationFailureAt || '时间未记录'}。`
                      : '本进程启动后未记录对账失败。'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
              <div>
                <div className="text-sm font-medium text-slate-800">收款开关独立控制</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  后台业务价格不代表生产收款已开放，正式开关仍由部署环境与验收流程控制。
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('audit-logs')}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              查看高风险人工操作审计
              <span className="float-right" aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
