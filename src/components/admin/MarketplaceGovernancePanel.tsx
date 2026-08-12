import { useCallback, useEffect, useRef, useState } from 'react'
import {
  adminApi,
  type MarketplaceAppealAction,
  type MarketplaceAppealType,
  type MarketplaceGovernanceAudit,
  type MarketplaceReportAction,
} from '../../api/admin'
import type {
  MarketplaceAppeal,
  MarketplaceAppealStatus,
  MarketplaceReport,
  MarketplaceReportStatus,
  MarketplaceReportType,
} from '../../api/marketplace'
import { useAdminActionDialog } from './AdminActionDialog'
import { formatAdminDateTime, getAdminErrorMessage } from './adminFormat'
import { SegmentedControl } from '../ui/SegmentedControl'

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

/** 治理列表统一的分页大小 */
const PAGE_SIZE = 20

const REPORT_TYPE_LABELS: Record<MarketplaceReportType, string> = {
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

const APPEAL_TYPE_LABELS: Record<MarketplaceAppealType, string> = {
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
    <nav aria-label={`${noun}分页`} className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
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
    </nav>
  )
}

export function MarketplaceGovernancePanel({
  auditRefreshKey,
  onListingsChanged,
  onPendingCountChanged,
}: MarketplaceGovernancePanelProps) {
  const {
    confirm: confirmAdminAction,
    prompt: promptAdminValue,
  } = useAdminActionDialog()
  const [activeTab, setActiveTab] = useState<GovernanceTab>('REPORTS')
  const [reports, setReports] = useState<MarketplaceReport[]>([])
  const [reportStatus, setReportStatus] = useState<'' | MarketplaceReportStatus>('OPEN')
  const [reportPage, setReportPage] = useState(1)
  const [reportTotalPages, setReportTotalPages] = useState(1)
  const [reportTotal, setReportTotal] = useState(0)
  const [reportOpenCount, setReportOpenCount] = useState(0)
  const [appeals, setAppeals] = useState<MarketplaceAppeal[]>([])
  const [appealStatus, setAppealStatus] = useState<'' | MarketplaceAppealStatus>('OPEN')
  const [appealPage, setAppealPage] = useState(1)
  const [appealTotalPages, setAppealTotalPages] = useState(1)
  const [appealTotal, setAppealTotal] = useState(0)
  const [appealOpenCount, setAppealOpenCount] = useState(0)
  const [audits, setAudits] = useState<MarketplaceGovernanceAudit[]>([])
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotalPages, setAuditTotalPages] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditAllCount, setAuditAllCount] = useState(0)
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

  const markTabLoaded = useCallback((tab: GovernanceTab) => {
    setFailedTabs((current) => {
      if (!current.has(tab)) return current
      const next = new Set(current)
      next.delete(tab)
      return next
    })
  }, [])

  const markTabFailed = useCallback((tab: GovernanceTab) => {
    setFailedTabs((current) => {
      if (current.has(tab)) return current
      return new Set(current).add(tab)
    })
  }, [])

  const loadReports = useCallback(async (
    page: number,
    status: '' | MarketplaceReportStatus,
    trackFailure = true,
  ) => {
    setReportsLoading(true)
    try {
      let { data: response } = await adminApi.listMarketplaceReports({
        page,
        size: PAGE_SIZE,
        status,
      })
      let totalPages = Math.max(1, response.data.totalPages)
      if (response.data.page > totalPages) {
        // 总数收缩后当前页超界，回退到最后一页重新加载
        const fallback = await adminApi.listMarketplaceReports({
          page: totalPages,
          size: PAGE_SIZE,
          status,
        })
        response = fallback.data
        totalPages = Math.max(1, response.data.totalPages)
      }
      setReports(response.data.records)
      setReportPage(response.data.page)
      setReportTotal(response.data.total)
      setReportTotalPages(totalPages)
      if (status === 'OPEN') setReportOpenCount(response.data.total)
      markTabLoaded('REPORTS')
    } catch (loadError: unknown) {
      if (trackFailure) markTabFailed('REPORTS')
      throw loadError
    } finally {
      setReportsLoading(false)
    }
  }, [markTabFailed, markTabLoaded])

  const loadAppeals = useCallback(async (
    page: number,
    status: '' | MarketplaceAppealStatus,
    trackFailure = true,
  ) => {
    setAppealsLoading(true)
    try {
      let { data: response } = await adminApi.listMarketplaceAppeals({
        page,
        size: PAGE_SIZE,
        status,
      })
      let totalPages = Math.max(1, response.data.totalPages)
      if (response.data.page > totalPages) {
        // 总数收缩后当前页超界，回退到最后一页重新加载
        const fallback = await adminApi.listMarketplaceAppeals({
          page: totalPages,
          size: PAGE_SIZE,
          status,
        })
        response = fallback.data
        totalPages = Math.max(1, response.data.totalPages)
      }
      setAppeals(response.data.records)
      setAppealPage(response.data.page)
      setAppealTotal(response.data.total)
      setAppealTotalPages(totalPages)
      if (status === 'OPEN') setAppealOpenCount(response.data.total)
      markTabLoaded('APPEALS')
    } catch (loadError: unknown) {
      if (trackFailure) markTabFailed('APPEALS')
      throw loadError
    } finally {
      setAppealsLoading(false)
    }
  }, [markTabFailed, markTabLoaded])

  const loadAudits = useCallback(async (
    page: number,
    listingId: number | null,
    trackFailure = true,
  ) => {
    setAuditsLoading(true)
    try {
      const params = { page, size: PAGE_SIZE, listingId: listingId ?? undefined }
      let { data: response } = await adminApi.listMarketplaceGovernanceAudits(params)
      let totalPages = Math.max(1, response.data.totalPages)
      if (response.data.page > totalPages) {
        // 总数收缩后当前页超界，回退到最后一页重新加载
        const fallback = await adminApi.listMarketplaceGovernanceAudits({ ...params, page: totalPages })
        response = fallback.data
        totalPages = Math.max(1, response.data.totalPages)
      }
      setAudits(response.data.records)
      setAuditPage(response.data.page)
      setAuditTotal(response.data.total)
      setAuditTotalPages(totalPages)
      if (listingId === null) setAuditAllCount(response.data.total)
      markTabLoaded('AUDITS')
    } catch (loadError: unknown) {
      if (trackFailure) markTabFailed('AUDITS')
      throw loadError
    } finally {
      setAuditsLoading(false)
    }
  }, [markTabFailed, markTabLoaded])

  // 外部触发工作台重载时读取最新的筛选与页码，只重载数据、不重置筛选状态
  const queryStateRef = useRef<{
    reportPage: number
    reportStatus: '' | MarketplaceReportStatus
    appealPage: number
    appealStatus: '' | MarketplaceAppealStatus
    auditPage: number
    auditListingId: number | null
  }>({
    reportPage: 1,
    reportStatus: 'OPEN',
    appealPage: 1,
    appealStatus: 'OPEN',
    auditPage: 1,
    auditListingId: null,
  })
  useEffect(() => {
    queryStateRef.current = {
      reportPage,
      reportStatus,
      appealPage,
      appealStatus,
      auditPage,
      auditListingId,
    }
  })

  useEffect(() => {
    let cancelled = false
    setWorkspaceLoading(true)
    setWorkspaceLoaded(false)
    setError('')
    setSuccess('')
    const query = queryStateRef.current
    // 单个列表失败不影响其他列表，复用 failedTabs 部分失败机制
    void Promise.allSettled([
      loadReports(query.reportPage, query.reportStatus, false),
      loadAppeals(query.appealPage, query.appealStatus, false),
      loadAudits(query.auditPage, query.auditListingId, false),
    ]).then((results) => {
      if (cancelled) return
      const failed = new Set<GovernanceTab>()
      if (results[0].status === 'rejected') failed.add('REPORTS')
      if (results[1].status === 'rejected') failed.add('APPEALS')
      if (results[2].status === 'rejected') failed.add('AUDITS')
      setFailedTabs(failed)
      if (failed.size === results.length) {
        const firstRejected = results.find(
          (result): result is PromiseRejectedResult => result.status === 'rejected',
        )
        setWorkspaceLoaded(false)
        setError(getAdminErrorMessage(firstRejected?.reason, '市场治理数据加载失败'))
      } else {
        setWorkspaceLoaded(true)
      }
      setWorkspaceLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [auditRefreshKey, workspaceReloadKey, loadReports, loadAppeals, loadAudits])

  function requestReason(message: string) {
    return promptAdminValue({
      title: '填写治理原因',
      description: `${message}\n\n原因会永久写入治理审计记录，请填写可复核的真实说明。`,
      label: '处理原因',
      placeholder: '请填写具体处理原因',
      required: true,
      maxLength: 500,
      multiline: true,
      confirmText: '继续',
    })
  }

  function runReportLoad(page: number, status: '' | MarketplaceReportStatus) {
    setError('')
    void loadReports(page, status).catch((loadError: unknown) => {
      setError(getAdminErrorMessage(loadError, '举报记录加载失败'))
    })
  }

  function runAppealLoad(page: number, status: '' | MarketplaceAppealStatus) {
    setError('')
    void loadAppeals(page, status).catch((loadError: unknown) => {
      setError(getAdminErrorMessage(loadError, '申诉记录加载失败'))
    })
  }

  function runAuditLoad(page: number, listingId: number | null) {
    setError('')
    void loadAudits(page, listingId).catch((loadError: unknown) => {
      setError(getAdminErrorMessage(loadError, '审计记录加载失败'))
    })
  }

  // 轻量查询待处理数量，保证 tab 徽标始终展示最新的 OPEN 数
  function refreshReportOpenCount() {
    return adminApi.listMarketplaceReports({ page: 1, size: 1, status: 'OPEN' })
      .then(({ data: envelope }) => {
        setReportOpenCount(envelope.data.total)
      })
  }

  function refreshAppealOpenCount() {
    return adminApi.listMarketplaceAppeals({ page: 1, size: 1, status: 'OPEN' })
      .then(({ data: envelope }) => {
        setAppealOpenCount(envelope.data.total)
      })
  }

  async function handleReport(report: MarketplaceReport, action: MarketplaceReportAction) {
    const actionLabel = action === 'RESOLVE'
      ? '结案'
      : action === 'DISMISS'
        ? '驳回举报'
        : '下架条目并结案'
    const reason = await requestReason(`请输入“${actionLabel}”的处理原因（必填，将写入审计记录）`)
    if (!reason) return
    if (action === 'TAKEDOWN' && !await confirmAdminAction({
      title: '根据举报下架条目',
      description: `确认根据举报 #${report.id} 下架 /${report.listingSlug ?? report.listingId}？\n\n下架会阻止除作者和管理员外的所有访问，并关闭该版本未完成的成交。`,
      confirmText: '确认下架',
      tone: 'danger',
    })) return

    setWorkingTarget(`report-${report.id}`)
    setError('')
    setSuccess('')
    let actionFailed = false
    try {
      await adminApi.handleMarketplaceReport(report.id, action, reason)
    } catch (actionError: unknown) {
      actionFailed = true
      setError(getAdminErrorMessage(actionError, `${actionLabel}失败`))
    } finally {
      setWorkingTarget(null)
    }
    if (actionFailed) return
    setSuccess(`举报 #${report.id} 已${actionLabel}`)
    // 动作已成功，之后只是刷新数据：刷新失败单独提示，不误报动作失败、不标记 tab 失败；
    // 举报/申诉保留当前页与筛选，审计保留当前页，仅徽标数量单独刷新
    const refreshResults = await Promise.allSettled([
      loadReports(reportPage, reportStatus, false),
      loadAudits(auditPage, auditListingId, false),
      refreshReportOpenCount(),
      action === 'TAKEDOWN' ? onListingsChanged().catch(() => undefined) : Promise.resolve(),
      onPendingCountChanged().catch(() => undefined),
    ])
    if (refreshResults.some((result) => result.status === 'rejected')) {
      setError('列表刷新失败，请手动刷新')
    }
  }

  async function handleAppeal(appeal: MarketplaceAppeal, action: MarketplaceAppealAction) {
    const approving = action === 'APPROVE'
    const effectLabel = appeal.appealType === 'TAKEDOWN' ? '恢复条目' : '通过投稿版本'
    const actionLabel = approving ? `通过申诉并${effectLabel}` : '驳回申诉'
    const reason = await requestReason(`请输入“${actionLabel}”的处理原因（必填，将写入审计记录）`)
    if (!reason) return
    if (approving && !await confirmAdminAction({
      title: actionLabel,
      description: '系统会同时校验申诉针对的版本和当前状态，状态已经变化时不会执行。',
      confirmText: '确认通过申诉',
    })) return

    setWorkingTarget(`appeal-${appeal.id}`)
    setError('')
    setSuccess('')
    let actionFailed = false
    try {
      await adminApi.handleMarketplaceAppeal(appeal.id, action, reason)
    } catch (actionError: unknown) {
      actionFailed = true
      setError(getAdminErrorMessage(actionError, `${actionLabel}失败`))
    } finally {
      setWorkingTarget(null)
    }
    if (actionFailed) return
    setSuccess(`申诉 #${appeal.id} 已${approving ? '通过' : '驳回'}`)
    const refreshResults = await Promise.allSettled([
      loadAppeals(appealPage, appealStatus, false),
      loadAudits(auditPage, auditListingId, false),
      refreshAppealOpenCount(),
      approving ? onListingsChanged().catch(() => undefined) : Promise.resolve(),
      onPendingCountChanged().catch(() => undefined),
    ])
    if (refreshResults.some((result) => result.status === 'rejected')) {
      setError('列表刷新失败，请手动刷新')
    }
  }

  function applyAuditListingFilter() {
    const value = auditListingIdInput.trim()
    if (!value) {
      setAuditListingId(null)
      runAuditLoad(1, null)
      return
    }
    if (!/^\d+$/.test(value)) {
      setError('请输入有效的条目 ID')
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

  // tab 徽标固定展示待处理（OPEN）数量，审计展示全量总数，均不随当前筛选变化
  const tabs: Array<{ id: GovernanceTab; label: string; count: number }> = [
    { id: 'REPORTS', label: '举报与侵权投诉', count: reportOpenCount },
    { id: 'APPEALS', label: '创作者申诉', count: appealOpenCount },
    { id: 'AUDITS', label: '治理审计记录', count: auditAllCount },
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
          className="mt-4 min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
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
            处理原因会永久写入治理审计记录。
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
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {success ? (
        <div role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
      ) : null}

      <SegmentedControl
        ariaLabel="市场治理列表"
        value={activeTab}
        options={tabs.map((tab) => ({
          value: tab.id,
          label: (
            <>
              {tab.label}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {tab.count}
              </span>
            </>
          ),
        }))}
        onChange={setActiveTab}
        size="md"
        semantic="tabs"
        getOptionId={(option) => `governance-tab-${option.value}`}
        getOptionControls={(option) => `governance-tabpanel-${option.value}`}
        className="mt-5"
      />

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
        <div
          id="governance-tabpanel-REPORTS"
          role="tabpanel"
          aria-labelledby="governance-tab-REPORTS"
          className="mt-5"
        >
          <div className="flex flex-wrap items-center justify-end gap-3">
            <select
              aria-label="举报处理状态筛选"
              value={reportStatus}
              disabled={reportsLoading}
              onChange={(event) => {
                const value = event.target.value as '' | MarketplaceReportStatus
                setReportStatus(value)
                runReportLoad(1, value)
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
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
                        <div className="mt-1 text-xs text-gray-400">提交于 {formatAdminDateTime(report.createdAt)}</div>
                        {report.handledReason ? (
                          <div className="mt-2 max-w-xs text-xs leading-5 text-gray-500">
                            {report.handledAt ? formatAdminDateTime(report.handledAt) : '已处理'} · 管理员 #{report.handledBy ?? '-'}<br />
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
                              {workingTarget === `report-${report.id}` ? '处理中...' : '驳回举报'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleReport(report, 'TAKEDOWN')}
                              disabled={workingTarget !== null}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {workingTarget === `report-${report.id}` ? '处理中...' : '下架并结案'}
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
              暂无举报或投诉
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
        <div
          id="governance-tabpanel-APPEALS"
          role="tabpanel"
          aria-labelledby="governance-tab-APPEALS"
          className="mt-5"
        >
          <div className="flex justify-end">
            <select
              aria-label="申诉处理状态筛选"
              value={appealStatus}
              disabled={appealsLoading}
              onChange={(event) => {
                const value = event.target.value as '' | MarketplaceAppealStatus
                setAppealStatus(value)
                runAppealLoad(1, value)
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
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
                        <div className="mt-1 text-xs text-gray-400">提交于 {formatAdminDateTime(appeal.createdAt)}</div>
                        {appeal.handledReason ? (
                          <div className="mt-2 max-w-sm text-xs leading-5 text-gray-500">
                            {appeal.handledAt ? formatAdminDateTime(appeal.handledAt) : '已处理'} · 管理员 #{appeal.handledBy ?? '-'}<br />
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
                              {workingTarget === `appeal-${appeal.id}` ? '处理中...' : '驳回申诉'}
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
              暂无申诉
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
        <div
          id="governance-tabpanel-AUDITS"
          role="tabpanel"
          aria-labelledby="governance-tab-AUDITS"
          className="mt-5"
        >
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">按条目 ID 追踪</span>
              <input
                type="text"
                inputMode="numeric"
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
              disabled={auditsLoading}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                disabled={auditsLoading}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
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
                        <div>{formatAdminDateTime(audit.createdAt)}</div>
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
              暂无审计记录
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
