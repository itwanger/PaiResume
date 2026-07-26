import { useEffect, useState } from 'react'
import {
  adminApi,
  type MarketplaceAppealAction,
  type MarketplaceGovernanceAudit,
  type MarketplaceReportAction,
} from '../../api/admin'
import type {
  MarketplaceAppeal,
  MarketplaceAppealStatus,
  MarketplaceReport,
  MarketplaceReportStatus,
} from '../../api/marketplace'

type GovernanceTab = 'REPORTS' | 'APPEALS' | 'AUDITS'

interface MarketplaceGovernancePanelProps {
  auditRefreshKey: number
  onListingsChanged: () => Promise<void>
  onPendingCountChanged: () => Promise<void>
}

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  loading: boolean
  noun: string
  onPageChange: (page: number) => void
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  PRIVACY: '隐私泄露',
  COPYRIGHT: '版权侵权',
  FRAUD: '欺诈风险',
  ILLEGAL: '违法内容',
  MISLEADING: '虚假或误导',
  OTHER: '其他问题',
}

const REPORT_STATUS_LABELS: Record<MarketplaceReportStatus, string> = {
  OPEN: '待处理',
  RESOLVED: '已结案',
  DISMISSED: '已驳回',
}

const APPEAL_STATUS_LABELS: Record<MarketplaceAppealStatus, string> = {
  OPEN: '待处理',
  APPROVED: '已通过',
  REJECTED: '已驳回',
}

const APPEAL_TYPE_LABELS: Record<string, string> = {
  REVIEW_REJECTION: '投稿驳回申诉',
  TAKEDOWN: '下架申诉',
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  SUBMIT_REVIEW: '提交投稿审核',
  REFRESH_REVIEW: '提交版本更新',
  APPROVE: '通过投稿',
  REJECT: '驳回投稿',
  SUSPEND: '下架条目',
  RESTORE: '恢复条目',
  SUBMIT_REPORT: '提交举报',
  RESOLVE: '举报结案',
  DISMISS: '驳回举报',
  TAKEDOWN: '举报下架',
  SUBMIT_APPEAL: '提交申诉',
  APPROVE_APPEAL: '通过申诉',
  REJECT_APPEAL: '驳回申诉',
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function Pagination({
  page,
  totalPages,
  total,
  loading,
  noun,
  onPageChange,
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages)
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
      <span>共 {total} 条{noun} · 第 {page} / {safeTotalPages} 页</span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-gray-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          上一页
        </button>
        <button
          type="button"
          disabled={page >= safeTotalPages || loading}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-gray-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          下一页
        </button>
      </div>
    </div>
  )
}

export function MarketplaceGovernancePanel({
  auditRefreshKey,
  onListingsChanged,
  onPendingCountChanged,
}: MarketplaceGovernancePanelProps) {
  const [activeTab, setActiveTab] = useState<GovernanceTab>('REPORTS')
  const [reports, setReports] = useState<MarketplaceReport[]>([])
  const [reportStatus, setReportStatus] = useState<'' | MarketplaceReportStatus>('OPEN')
  const [reportPage, setReportPage] = useState(1)
  const [reportTotalPages, setReportTotalPages] = useState(1)
  const [reportTotal, setReportTotal] = useState(0)
  const [appeals, setAppeals] = useState<MarketplaceAppeal[]>([])
  const [appealStatus, setAppealStatus] = useState<'' | MarketplaceAppealStatus>('OPEN')
  const [appealPage, setAppealPage] = useState(1)
  const [appealTotalPages, setAppealTotalPages] = useState(1)
  const [appealTotal, setAppealTotal] = useState(0)
  const [audits, setAudits] = useState<MarketplaceGovernanceAudit[]>([])
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotalPages, setAuditTotalPages] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditListingIdInput, setAuditListingIdInput] = useState('')
  const [auditListingId, setAuditListingId] = useState<number | null>(null)
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false)
  const [workspaceReloadKey, setWorkspaceReloadKey] = useState(0)
  const [failedTabs, setFailedTabs] = useState<Set<GovernanceTab>>(() => new Set())
  const [reportsLoading, setReportsLoading] = useState(false)
  const [appealsLoading, setAppealsLoading] = useState(false)
  const [auditsLoading, setAuditsLoading] = useState(false)
  const [workingTarget, setWorkingTarget] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false
    setWorkspaceLoading(true)
    setWorkspaceLoaded(false)
    setError('')
    setSuccess('')
    void Promise.all([
      adminApi.listMarketplaceReports({ page: 1, size: 20, status: 'OPEN' }),
      adminApi.listMarketplaceAppeals({ page: 1, size: 20, status: 'OPEN' }),
      adminApi.listMarketplaceGovernanceAudits({ page: 1, size: 20 }),
    ]).then(([reportResponse, appealResponse, auditResponse]) => {
      if (cancelled) return
      const reportData = reportResponse.data.data
      const appealData = appealResponse.data.data
      const auditData = auditResponse.data.data
      setReportStatus('OPEN')
      setReports(reportData.records)
      setReportPage(reportData.page)
      setReportTotal(reportData.total)
      setReportTotalPages(Math.max(1, reportData.totalPages))
      setAppealStatus('OPEN')
      setAppeals(appealData.records)
      setAppealPage(appealData.page)
      setAppealTotal(appealData.total)
      setAppealTotalPages(Math.max(1, appealData.totalPages))
      setAudits(auditData.records)
      setAuditPage(auditData.page)
      setAuditTotal(auditData.total)
      setAuditTotalPages(Math.max(1, auditData.totalPages))
      setAuditListingIdInput('')
      setAuditListingId(null)
      setFailedTabs(new Set())
      setWorkspaceLoaded(true)
    }).catch((loadError: unknown) => {
      if (!cancelled) {
        setWorkspaceLoaded(false)
        setError(getErrorMessage(loadError, '市场治理数据加载失败'))
      }
    }).finally(() => {
      if (!cancelled) setWorkspaceLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [auditRefreshKey, workspaceReloadKey])

  function markTabLoaded(tab: GovernanceTab) {
    setFailedTabs((current) => {
      if (!current.has(tab)) return current
      const next = new Set(current)
      next.delete(tab)
      return next
    })
  }

  function markTabFailed(tab: GovernanceTab) {
    setFailedTabs((current) => {
      if (current.has(tab)) return current
      return new Set(current).add(tab)
    })
  }

  async function loadReports(page: number, status: '' | MarketplaceReportStatus) {
    setReportsLoading(true)
    try {
      const { data: response } = await adminApi.listMarketplaceReports({
        page,
        size: 20,
        status,
      })
      setReports(response.data.records)
      setReportPage(response.data.page)
      setReportTotal(response.data.total)
      setReportTotalPages(Math.max(1, response.data.totalPages))
      markTabLoaded('REPORTS')
    } catch (loadError: unknown) {
      markTabFailed('REPORTS')
      throw loadError
    } finally {
      setReportsLoading(false)
    }
  }

  async function loadAppeals(page: number, status: '' | MarketplaceAppealStatus) {
    setAppealsLoading(true)
    try {
      const { data: response } = await adminApi.listMarketplaceAppeals({
        page,
        size: 20,
        status,
      })
      setAppeals(response.data.records)
      setAppealPage(response.data.page)
      setAppealTotal(response.data.total)
      setAppealTotalPages(Math.max(1, response.data.totalPages))
      markTabLoaded('APPEALS')
    } catch (loadError: unknown) {
      markTabFailed('APPEALS')
      throw loadError
    } finally {
      setAppealsLoading(false)
    }
  }

  async function loadAudits(page: number, listingId: number | null) {
    setAuditsLoading(true)
    try {
      const { data: response } = await adminApi.listMarketplaceGovernanceAudits({
        page,
        size: 20,
        listingId: listingId ?? undefined,
      })
      setAudits(response.data.records)
      setAuditPage(response.data.page)
      setAuditTotal(response.data.total)
      setAuditTotalPages(Math.max(1, response.data.totalPages))
      markTabLoaded('AUDITS')
    } catch (loadError: unknown) {
      markTabFailed('AUDITS')
      throw loadError
    } finally {
      setAuditsLoading(false)
    }
  }

  function requestReason(message: string) {
    const rawReason = window.prompt(message, '')
    if (rawReason === null) return null
    const reason = rawReason.trim()
    if (!reason) {
      setError('处理原因不能为空')
      return null
    }
    if (reason.length > 500) {
      setError('处理原因不能超过 500 个字符')
      return null
    }
    return reason
  }

  function runReportLoad(page: number, status: '' | MarketplaceReportStatus) {
    setError('')
    void loadReports(page, status).catch((loadError: unknown) => {
      setError(getErrorMessage(loadError, '举报记录加载失败'))
    })
  }

  function runAppealLoad(page: number, status: '' | MarketplaceAppealStatus) {
    setError('')
    void loadAppeals(page, status).catch((loadError: unknown) => {
      setError(getErrorMessage(loadError, '申诉记录加载失败'))
    })
  }

  function runAuditLoad(page: number, listingId: number | null) {
    setError('')
    void loadAudits(page, listingId).catch((loadError: unknown) => {
      setError(getErrorMessage(loadError, '审计记录加载失败'))
    })
  }

  async function handleReport(report: MarketplaceReport, action: MarketplaceReportAction) {
    const actionLabel = action === 'RESOLVE'
      ? '结案'
      : action === 'DISMISS'
        ? '驳回举报'
        : '下架条目并结案'
    const reason = requestReason(`请输入“${actionLabel}”的处理原因（必填，将写入审计记录）`)
    if (!reason) return
    if (action === 'TAKEDOWN' && !window.confirm(
      `确认根据举报 #${report.id} 下架 /${report.listingSlug ?? report.listingId}？\n\n下架会阻止除作者和管理员外的所有访问，并关闭该版本未完成的成交。`,
    )) return

    setWorkingTarget(`report-${report.id}`)
    setError('')
    setSuccess('')
    try {
      await adminApi.handleMarketplaceReport(report.id, action, reason)
      await Promise.all([
        loadReports(reportPage, reportStatus),
        loadAudits(1, auditListingId),
        action === 'TAKEDOWN' ? onListingsChanged() : Promise.resolve(),
        onPendingCountChanged().catch(() => undefined),
      ])
      setSuccess(`举报 #${report.id} 已${actionLabel}`)
    } catch (actionError: unknown) {
      setError(getErrorMessage(actionError, `${actionLabel}失败`))
    } finally {
      setWorkingTarget(null)
    }
  }

  async function handleAppeal(appeal: MarketplaceAppeal, action: MarketplaceAppealAction) {
    const approving = action === 'APPROVE'
    const effectLabel = appeal.appealType === 'TAKEDOWN' ? '恢复条目' : '通过投稿版本'
    const actionLabel = approving ? `通过申诉并${effectLabel}` : '驳回申诉'
    const reason = requestReason(`请输入“${actionLabel}”的处理原因（必填，将写入审计记录）`)
    if (!reason) return
    if (approving && !window.confirm(
      `确认${actionLabel}？\n\n系统会同时校验申诉针对的版本和当前状态，状态已经变化时不会执行。`,
    )) return

    setWorkingTarget(`appeal-${appeal.id}`)
    setError('')
    setSuccess('')
    try {
      await adminApi.handleMarketplaceAppeal(appeal.id, action, reason)
      await Promise.all([
        loadAppeals(appealPage, appealStatus),
        loadAudits(1, auditListingId),
        approving ? onListingsChanged() : Promise.resolve(),
        onPendingCountChanged().catch(() => undefined),
      ])
      setSuccess(`申诉 #${appeal.id} 已${approving ? '通过' : '驳回'}`)
    } catch (actionError: unknown) {
      setError(getErrorMessage(actionError, `${actionLabel}失败`))
    } finally {
      setWorkingTarget(null)
    }
  }

  function applyAuditListingFilter() {
    const value = auditListingIdInput.trim()
    if (!value) {
      setAuditListingId(null)
      runAuditLoad(1, null)
      return
    }
    const parsed = Number(value)
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      setError('请输入有效的条目 ID')
      return
    }
    setAuditListingId(parsed)
    runAuditLoad(1, parsed)
  }

  const tabs: Array<{ id: GovernanceTab; label: string; count: number }> = [
    { id: 'REPORTS', label: '举报与侵权投诉', count: reportTotal },
    { id: 'APPEALS', label: '创作者申诉', count: appealTotal },
    { id: 'AUDITS', label: '治理审计记录', count: auditTotal },
  ]

  if (workspaceLoading) {
    return (
      <section className="rounded-lg border border-violet-200 bg-white px-6 py-6">
        <h2 className="text-lg font-semibold text-gray-900">市场治理工作台</h2>
        <p className="mt-4 text-sm text-gray-500">正在加载市场治理数据...</p>
      </section>
    )
  }

  if (!workspaceLoaded) {
    return (
      <section className="rounded-lg border border-red-200 bg-white px-6 py-6">
        <h2 className="text-lg font-semibold text-gray-900">市场治理工作台</h2>
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || '市场治理数据加载失败，请重试。'}
        </div>
        <button
          type="button"
          onClick={() => setWorkspaceReloadKey((current) => current + 1)}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          重新加载
        </button>
      </section>
    )
  }

  const activeTabLoading = activeTab === 'REPORTS'
    ? reportsLoading
    : activeTab === 'APPEALS'
      ? appealsLoading
      : auditsLoading
  const activeTabFailed = failedTabs.has(activeTab)

  return (
    <section className="rounded-lg border border-violet-200 bg-white px-6 py-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">市场治理工作台</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            处理公开举报、侵权投诉与创作者申诉。所有处理动作必须填写原因，并会永久写入治理审计记录。
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (activeTab === 'REPORTS') runReportLoad(reportPage, reportStatus)
            if (activeTab === 'APPEALS') runAppealLoad(appealPage, appealStatus)
            if (activeTab === 'AUDITS') runAuditLoad(auditPage, auditListingId)
          }}
          disabled={reportsLoading || appealsLoading || auditsLoading}
          className="w-fit rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-gray-300 hover:text-gray-900 disabled:cursor-wait disabled:opacity-50"
        >
          {reportsLoading || appealsLoading || auditsLoading ? '刷新中...' : '刷新当前列表'}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {success ? (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="市场治理列表">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id
              ? 'rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white'
              : 'rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:border-violet-200 hover:text-violet-700'}
          >
            {tab.label}
            <span className={activeTab === tab.id
              ? 'ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs'
              : 'ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500'}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {activeTabLoading ? (
        <p className="mt-5 text-sm text-gray-500">正在加载当前列表...</p>
      ) : null}

      {!activeTabLoading && activeTabFailed ? (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-4">
          <p className="text-sm text-red-700">当前列表加载失败，已隐藏处理操作，请重试。</p>
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'REPORTS') runReportLoad(reportPage, reportStatus)
              if (activeTab === 'APPEALS') runAppealLoad(appealPage, appealStatus)
              if (activeTab === 'AUDITS') runAuditLoad(auditPage, auditListingId)
            }}
            className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            重试当前列表
          </button>
        </div>
      ) : null}

      {!activeTabLoading && !activeTabFailed && activeTab === 'REPORTS' ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">待处理举报按最早提交优先排列。</p>
            <select
              aria-label="举报处理状态筛选"
              value={reportStatus}
              onChange={(event) => {
                const value = event.target.value as '' | MarketplaceReportStatus
                setReportStatus(value)
                runReportLoad(1, value)
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            >
              <option value="">全部处理状态</option>
              <option value="OPEN">待处理</option>
              <option value="RESOLVED">已结案</option>
              <option value="DISMISSED">已驳回</option>
            </select>
          </div>

          {reports.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[1120px] w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-3 pr-4 font-medium">类型 / 条目</th>
                    <th className="py-3 pr-4 font-medium">举报说明</th>
                    <th className="py-3 pr-4 font-medium">联系方式</th>
                    <th className="py-3 pr-4 font-medium">状态 / 处理记录</th>
                    <th className="py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {reports.map((report) => (
                    <tr key={report.id} className="align-top">
                      <td className="py-4 pr-4">
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                          {REPORT_TYPE_LABELS[report.reportType] ?? report.reportType}
                        </span>
                        <div className="mt-2 max-w-[220px] truncate font-medium text-gray-900">
                          /{report.listingSlug ?? `listing-${report.listingId}`}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">举报 #{report.id} · 条目 #{report.listingId}</div>
                      </td>
                      <td className="max-w-md whitespace-pre-wrap py-4 pr-4 leading-6">{report.description}</td>
                      <td className="max-w-[220px] break-all py-4 pr-4 text-gray-500">{report.contact || '未提供'}</td>
                      <td className="py-4 pr-4">
                        <div className={report.processingStatus === 'OPEN'
                          ? 'font-medium text-amber-700'
                          : report.processingStatus === 'RESOLVED'
                            ? 'font-medium text-emerald-700'
                            : 'font-medium text-gray-500'}>
                          {REPORT_STATUS_LABELS[report.processingStatus]}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">提交于 {report.createdAt}</div>
                        {report.handledReason ? (
                          <div className="mt-2 max-w-xs text-xs leading-5 text-gray-500">
                            {report.handledAt ?? '已处理'} · 管理员 #{report.handledBy ?? '-'}<br />
                            {report.handledReason}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-4">
                        {report.processingStatus === 'OPEN' ? (
                          <div className="flex min-w-[230px] flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void handleReport(report, 'RESOLVE')}
                              disabled={workingTarget !== null}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {workingTarget === `report-${report.id}` ? '处理中...' : '核实后结案'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleReport(report, 'DISMISS')}
                              disabled={workingTarget !== null}
                              className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:border-gray-300 disabled:opacity-50"
                            >
                              驳回举报
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleReport(report, 'TAKEDOWN')}
                              disabled={workingTarget !== null}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              下架并结案
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">该举报已处理</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
              当前筛选条件下暂无举报或侵权投诉。
            </p>
          )}
          <Pagination
            page={reportPage}
            totalPages={reportTotalPages}
            total={reportTotal}
            loading={reportsLoading}
            noun="举报"
            onPageChange={(page) => runReportLoad(page, reportStatus)}
          />
        </div>
      ) : null}

      {!activeTabLoading && !activeTabFailed && activeTab === 'APPEALS' ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">通过申诉前，系统会校验申诉针对的版本和当前状态是否仍然一致。</p>
            <select
              aria-label="申诉处理状态筛选"
              value={appealStatus}
              onChange={(event) => {
                const value = event.target.value as '' | MarketplaceAppealStatus
                setAppealStatus(value)
                runAppealLoad(1, value)
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            >
              <option value="">全部处理状态</option>
              <option value="OPEN">待处理</option>
              <option value="APPROVED">已通过</option>
              <option value="REJECTED">已驳回</option>
            </select>
          </div>

          {appeals.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[1080px] w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-3 pr-4 font-medium">申诉类型 / 条目</th>
                    <th className="py-3 pr-4 font-medium">创作者说明</th>
                    <th className="py-3 pr-4 font-medium">状态 / 处理记录</th>
                    <th className="py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {appeals.map((appeal) => (
                    <tr key={appeal.id} className="align-top">
                      <td className="py-4 pr-4">
                        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                          {APPEAL_TYPE_LABELS[appeal.appealType] ?? appeal.appealType}
                        </span>
                        <div className="mt-2 font-medium text-gray-900">条目 #{appeal.listingId}</div>
                        <div className="mt-1 text-xs text-gray-400">
                          申诉 #{appeal.id} · 创作者 #{appeal.creatorUserId} · 版本 #{appeal.listingRevisionId ?? '-'}
                        </div>
                      </td>
                      <td className="max-w-lg whitespace-pre-wrap py-4 pr-4 leading-6">{appeal.description}</td>
                      <td className="py-4 pr-4">
                        <div className={appeal.appealStatus === 'OPEN'
                          ? 'font-medium text-amber-700'
                          : appeal.appealStatus === 'APPROVED'
                            ? 'font-medium text-emerald-700'
                            : 'font-medium text-red-700'}>
                          {APPEAL_STATUS_LABELS[appeal.appealStatus]}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">提交于 {appeal.createdAt}</div>
                        {appeal.handledReason ? (
                          <div className="mt-2 max-w-sm text-xs leading-5 text-gray-500">
                            {appeal.handledAt ?? '已处理'} · 管理员 #{appeal.handledBy ?? '-'}<br />
                            {appeal.handledReason}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-4">
                        {appeal.appealStatus === 'OPEN' ? (
                          <div className="flex min-w-[190px] flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void handleAppeal(appeal, 'APPROVE')}
                              disabled={workingTarget !== null}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {workingTarget === `appeal-${appeal.id}` ? '处理中...' : '通过申诉'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAppeal(appeal, 'REJECT')}
                              disabled={workingTarget !== null}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              驳回申诉
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">该申诉已处理</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
              当前筛选条件下暂无创作者申诉。
            </p>
          )}
          <Pagination
            page={appealPage}
            totalPages={appealTotalPages}
            total={appealTotal}
            loading={appealsLoading}
            noun="申诉"
            onPageChange={(page) => runAppealLoad(page, appealStatus)}
          />
        </div>
      ) : null}

      {!activeTabLoading && !activeTabFailed && activeTab === 'AUDITS' ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">按条目 ID 追踪</span>
              <input
                type="number"
                min="1"
                value={auditListingIdInput}
                onChange={(event) => setAuditListingIdInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyAuditListingFilter()
                }}
                placeholder="例如 1024"
                className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              />
            </label>
            <button
              type="button"
              onClick={applyAuditListingFilter}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              查询轨迹
            </button>
            {auditListingId !== null ? (
              <button
                type="button"
                onClick={() => {
                  setAuditListingIdInput('')
                  setAuditListingId(null)
                  runAuditLoad(1, null)
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:border-gray-300"
              >
                查看全部
              </button>
            ) : null}
          </div>

          {audits.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[1160px] w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-3 pr-4 font-medium">时间 / 条目</th>
                    <th className="py-3 pr-4 font-medium">操作者</th>
                    <th className="py-3 pr-4 font-medium">动作 / 对象</th>
                    <th className="py-3 pr-4 font-medium">状态变化</th>
                    <th className="py-3 font-medium">原因</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {audits.map((audit) => (
                    <tr key={audit.id} className="align-top">
                      <td className="py-4 pr-4">
                        <div>{audit.createdAt}</div>
                        <div className="mt-1 text-xs text-gray-400">审计 #{audit.id} · 条目 #{audit.listingId}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <span className={audit.actorType === 'ADMIN'
                          ? 'rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700'
                          : audit.actorType === 'CREATOR'
                            ? 'rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700'
                            : 'rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600'}>
                          {audit.actorType === 'ADMIN' ? '管理员' : audit.actorType === 'CREATOR' ? '创作者' : '公开用户'}
                        </span>
                        <div className="mt-2 text-xs text-gray-400">用户 #{audit.actorUserId ?? '-'}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="font-medium text-gray-900">{AUDIT_ACTION_LABELS[audit.action] ?? audit.action}</div>
                        <div className="mt-1 text-xs text-gray-400">{audit.targetType} #{audit.targetId ?? '-'}</div>
                      </td>
                      <td className="py-4 pr-4">
                        {audit.fromStatus || audit.toStatus
                          ? <span>{audit.fromStatus || '无'} → {audit.toStatus || '无'}</span>
                          : <span className="text-gray-400">无状态变化</span>}
                      </td>
                      <td className="max-w-lg whitespace-pre-wrap py-4 leading-6">{audit.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
              当前筛选条件下暂无治理审计记录。
            </p>
          )}
          <Pagination
            page={auditPage}
            totalPages={auditTotalPages}
            total={auditTotal}
            loading={auditsLoading}
            noun="审计记录"
            onPageChange={(page) => runAuditLoad(page, auditListingId)}
          />
        </div>
      ) : null}
    </section>
  )
}
