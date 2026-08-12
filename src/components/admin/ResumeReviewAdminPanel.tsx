import { useEffect, useMemo, useRef, useState } from 'react'
import {
  adminApi,
  type ResumeReviewAudit,
  type ResumeReviewAdminRequest,
} from '../../api/admin'
import type { ResumeReviewStatus } from '../../api/resumeReview'
import { useAdminActionDialog } from './AdminActionDialog'
import { formatAdminCents, formatAdminDateTime, getAdminErrorMessage } from './adminFormat'

type ReviewFilter =
  | 'ACTION_REQUIRED'
  | 'ACTIVE'
  | 'ALL'
  | ResumeReviewStatus

type ReviewAction = 'ACCEPT' | 'COMPLETE' | 'RETURN' | 'RETRY_MAIL'

interface ResumeReviewAdminPanelProps {
  onActionCountChanged: () => Promise<void>
}

/** 服务端工作台接口最多返回的工单条数 */
const PAGE_LIMIT = 300

const ACTIVE_STATUSES = new Set<ResumeReviewStatus>([
  'AWAITING_PAYMENT',
  'EMAIL_PENDING',
  'EMAILED',
  'ACCEPTED',
  'REFUND_REQUIRED',
])

const STATUS_LABELS: Record<ResumeReviewStatus, string> = {
  AWAITING_PAYMENT: '等待用户支付',
  EMAIL_PENDING: '邮件待投递',
  EMAILED: '已发送待接单',
  ACCEPTED: '已接单处理中',
  COMPLETED: '已完成',
  REFUND_REQUIRED: '待人工退款',
  RETURNED: '已退回',
  REFUNDED: '退款已确认',
}

const MAIL_STATUS_LABELS: Record<string, string> = {
  PENDING: '等待投递',
  SENDING: '投递中',
  FAILED: '投递失败待重试',
  SENT: 'SMTP 已接收',
}

const STATUS_TONES: Record<ResumeReviewStatus, string> = {
  AWAITING_PAYMENT: 'border-amber-200 bg-amber-50 text-amber-800',
  EMAIL_PENDING: 'border-blue-200 bg-blue-50 text-blue-800',
  EMAILED: 'border-violet-200 bg-violet-50 text-violet-800',
  ACCEPTED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  REFUND_REQUIRED: 'border-red-200 bg-red-50 text-red-800',
  RETURNED: 'border-slate-200 bg-slate-50 text-slate-700',
  REFUNDED: 'border-slate-200 bg-slate-50 text-slate-700',
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: '创建申请',
  MAIL_RETRY: '重试邮件',
  ACCEPT: '接受申请',
  COMPLETE: '完成精修',
  RETURN_REFUND_REQUIRED: '退回并转人工退款',
  RETURN_AND_RELEASE: '退回申请',
  CONFIRM_REFUND: '确认外部退款',
  FOLLOW_REWARD_ISSUED: '历史关注奖励签发（已停用）',
  FOLLOW_FALLBACK_REDEEM: '历史兜底码兑换（已停用）',
}

const FILTER_OPTIONS: Array<{ value: ReviewFilter; label: string }> = [
  { value: 'ACTION_REQUIRED', label: '需要处理' },
  { value: 'ACTIVE', label: '全部进行中' },
  { value: 'EMAIL_PENDING', label: '邮件待投递' },
  { value: 'EMAILED', label: '待接单' },
  { value: 'ACCEPTED', label: '处理中' },
  { value: 'REFUND_REQUIRED', label: '待退款' },
  { value: 'AWAITING_PAYMENT', label: '待用户支付' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'RETURNED', label: '已退回' },
  { value: 'REFUNDED', label: '已退款' },
  { value: 'ALL', label: `最近 ${PAGE_LIMIT} 条` },
]

function entitlementLabel(request: ResumeReviewAdminRequest) {
  if (request.entitlementType === 'WELCOME_FREE') return '首次免费'
  if (request.entitlementType === 'FOLLOW_REWARD') return '历史免费权益（已停用）'
  return `逐次付费 ${formatAdminCents(request.priceCents)}`
}

function needsAdminAction(request: ResumeReviewAdminRequest) {
  return request.requestStatus === 'EMAILED'
    || request.requestStatus === 'ACCEPTED'
    || request.requestStatus === 'REFUND_REQUIRED'
    || (request.requestStatus === 'EMAIL_PENDING'
      && (request.mailStatus === 'FAILED' || request.mailStatus === null))
}

export function ResumeReviewAdminPanel({
  onActionCountChanged,
}: ResumeReviewAdminPanelProps) {
  const {
    confirm: confirmAdminAction,
    prompt: promptAdminValue,
  } = useAdminActionDialog()
  const [reviews, setReviews] = useState<ResumeReviewAdminRequest[]>([])
  const [filter, setFilter] = useState<ReviewFilter>('ACTION_REQUIRED')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false)
  const [workingRequestNo, setWorkingRequestNo] = useState<string | null>(null)
  const [selectedAuditRequestNo, setSelectedAuditRequestNo] = useState<string | null>(null)
  const selectedAuditRequestNoRef = useRef<string | null>(null)
  const [audits, setAudits] = useState<ResumeReviewAudit[]>([])
  const [auditsLoading, setAuditsLoading] = useState(false)
  const [auditsError, setAuditsError] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 任一工单操作在途时禁用所有行的操作按钮与刷新，避免跨行并发写
  const actionInFlight = workingRequestNo !== null

  const filteredReviews = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return reviews.filter((review) => {
      const matchesFilter = filter === 'ALL'
        || (filter === 'ACTIVE' && ACTIVE_STATUSES.has(review.requestStatus))
        || (filter === 'ACTION_REQUIRED' && needsAdminAction(review))
        || review.requestStatus === filter
      if (!matchesFilter) return false
      if (!normalizedQuery) return true
      return [
        review.requestNo,
        review.orderNo,
        review.contactEmail,
        String(review.resumeId),
      ].some((value) => value?.toLowerCase().includes(normalizedQuery))
    })
  }, [filter, query, reviews])

  const stats = useMemo(() => ({
    actionRequired: reviews.filter(needsAdminAction).length,
    emailed: reviews.filter((review) => review.requestStatus === 'EMAILED').length,
    accepted: reviews.filter((review) => review.requestStatus === 'ACCEPTED').length,
    refundRequired: reviews.filter((review) => review.requestStatus === 'REFUND_REQUIRED').length,
  }), [reviews])

  useEffect(() => {
    let canceled = false
    setLoading(true)
    setWorkspaceLoaded(false)
    setError('')
    void adminApi.listResumeReviews().then((reviewResponse) => {
      if (canceled) return
      setReviews(reviewResponse.data.data)
      setWorkspaceLoaded(true)
    }).catch((loadError: unknown) => {
      if (!canceled) {
        setWorkspaceLoaded(false)
        setError(getAdminErrorMessage(loadError, '人工精修工作台加载失败'))
      }
    }).finally(() => {
      if (!canceled) setLoading(false)
    })
    return () => {
      canceled = true
    }
  }, [])

  function selectAuditRequest(requestNo: string | null) {
    selectedAuditRequestNoRef.current = requestNo
    setSelectedAuditRequestNo(requestNo)
  }

  // 后台静默刷新：保留筛选、搜索词、展开的审计面板与滚动位置，失败时保留现有数据
  async function refreshWorkspace() {
    setRefreshing(true)
    setError('')
    try {
      const reviewResponse = await adminApi.listResumeReviews()
      setReviews(reviewResponse.data.data)
      await onActionCountChanged().catch(() => undefined)
      // 首屏加载失败后的“重新加载”也走这里，成功后需要离开错误屏
      setWorkspaceLoaded(true)
    } catch (loadError: unknown) {
      setError(getAdminErrorMessage(loadError, '人工精修工作台刷新失败，当前展示的是刷新前的数据'))
    } finally {
      setRefreshing(false)
    }
  }

  function requestReason(message: string) {
    return promptAdminValue({
      title: '填写工单操作原因',
      description: `${message}\n\n原因会写入人工精修审计记录，请填写可复核的真实说明。`,
      label: '操作原因',
      placeholder: '请填写具体操作原因',
      required: true,
      maxLength: 500,
      multiline: true,
      confirmText: '继续',
    })
  }

  function replaceReview(nextReview: ResumeReviewAdminRequest) {
    setReviews((current) => current.map((review) => (
      review.requestNo === nextReview.requestNo ? nextReview : review
    )))
  }

  async function reloadSelectedAudits(requestNo: string) {
    // 通过 ref 读取最新展开目标，避免闭包旧值把审计记录写进另一个工单
    if (selectedAuditRequestNoRef.current !== requestNo) return
    try {
      const { data: response } = await adminApi.listResumeReviewAudits(requestNo)
      setAudits(response.data)
      setAuditsError('')
    } catch (loadError: unknown) {
      setAudits([])
      setAuditsError(getAdminErrorMessage(loadError, '人工精修审计记录刷新失败'))
      throw loadError
    }
  }

  async function handleAction(request: ResumeReviewAdminRequest, action: ReviewAction) {
    const actionLabel = action === 'ACCEPT'
      ? '接受申请'
      : action === 'COMPLETE'
        ? '标记完成'
        : action === 'RETURN'
          ? '退回申请'
          : '重试邮件投递'
    const reason = await requestReason(`请输入“${actionLabel}”的原因（必填，将写入审计日志）`)
    if (!reason) return

    const confirmation = action === 'RETURN'
      ? request.paidAt
        ? `确认退回 ${request.requestNo}？\n\n该申请已经付款，只会转为“待人工退款”，本页面不会向微信发起退款。`
        : request.requestStatus === 'EMAILED' || request.requestStatus === 'ACCEPTED'
          ? `确认退回 ${request.requestNo}？\n\nPDF 邮件已经发出，无法远程召回；已使用的免费次数也不会返还。`
          : `确认退回 ${request.requestNo}？\n\n邮件尚未确认投递，符合条件的免费次数会由服务端释放。`
      : action === 'RETRY_MAIL'
        ? `确认重新调度 ${request.requestNo} 的邮件投递？\n\n这里只会重置邮件队列，不代表邮件已经发送成功。`
        : action === 'COMPLETE'
          ? `确认 ${request.requestNo} 的人工精修确已完成？\n\n完成后用户可以申请下一次服务。`
          : `确认接受 ${request.requestNo}？\n\n接受后该申请会进入人工处理中。`
    if (!await confirmAdminAction({
      title: actionLabel,
      description: confirmation,
      confirmText: `确认${actionLabel}`,
      tone: action === 'RETURN' ? 'danger' : 'default',
    })) return

    setWorkingRequestNo(request.requestNo)
    setError('')
    setSuccess('')
    try {
      const actionResponse = await (action === 'ACCEPT'
        ? adminApi.acceptResumeReview(request.requestNo, reason)
        : action === 'COMPLETE'
          ? adminApi.completeResumeReview(request.requestNo, reason)
          : action === 'RETURN'
            ? adminApi.returnResumeReview(request.requestNo, reason)
            : adminApi.retryResumeReviewMail(request.requestNo, reason))
      replaceReview({ ...request, ...actionResponse.data.data })
      void onActionCountChanged().catch(() => undefined)
      // 详情刷新与审计刷新分别捕获，失败消息各自归因
      let detailFailed = false
      try {
        const { data: detailResponse } = await adminApi.getResumeReview(request.requestNo)
        replaceReview(detailResponse.data)
      } catch {
        detailFailed = true
      }
      let auditsFailed = false
      try {
        await reloadSelectedAudits(request.requestNo)
      } catch {
        auditsFailed = true
      }
      if (detailFailed) {
        setSuccess(`${request.requestNo}：${actionLabel}已执行，但详情刷新失败，请刷新工作台确认`)
      } else if (auditsFailed) {
        setSuccess(`${request.requestNo}：${actionLabel}已执行，但审计记录刷新失败，可在审计面板中重试`)
      } else {
        setSuccess(`${request.requestNo}：${actionLabel}成功`)
      }
    } catch (actionError: unknown) {
      setError(getAdminErrorMessage(actionError, `${actionLabel}失败`))
    } finally {
      setWorkingRequestNo(null)
    }
  }

  async function handleConfirmRefund(request: ResumeReviewAdminRequest) {
    const refundReference = await promptAdminValue({
      title: '登记人工精修退款',
      description: `请先在 ${request.provider || '未知通道'} 商户平台按订单 ${request.orderNo || request.requestNo}${request.providerTransactionId ? `（支付交易号 ${request.providerTransactionId}）` : ''}完成原路退款。本页面只登记结果。`,
      label: '真实退款单号或核验流水',
      required: true,
      maxLength: 128,
      confirmText: '下一步',
      tone: 'danger',
    })
    // 对话框已按 required/maxLength 校验并 trim，返回值直接使用，无需重复校验
    if (refundReference === null) return
    const reason = await requestReason('请输入退款核对说明（必填，例如退款渠道、核对人和用户沟通情况）')
    if (!reason) return
    if (!await confirmAdminAction({
      title: '再次确认外部退款已完成',
      description: `你已在 ${request.provider || '未知通道'} 商户平台为订单 ${request.orderNo || '未记录'} 实际完成 ${formatAdminCents(request.priceCents)} 原路退款。\n\n支付时间：${formatAdminDateTime(request.paidAt)}\n支付交易号：${request.providerTransactionId || '未记录，请先在商户平台核实'}\n\n本操作只登记外部退款结果，不会发起退款。`,
      confirmText: '确认已退款',
      tone: 'danger',
    })) return

    setWorkingRequestNo(request.requestNo)
    setError('')
    setSuccess('')
    try {
      const actionResponse = await adminApi.confirmResumeReviewRefund(
        request.requestNo,
        refundReference,
        reason,
      )
      replaceReview({ ...request, ...actionResponse.data.data, refundReference })
      void onActionCountChanged().catch(() => undefined)
      let detailFailed = false
      try {
        const { data: detailResponse } = await adminApi.getResumeReview(request.requestNo)
        replaceReview(detailResponse.data)
      } catch {
        detailFailed = true
      }
      let auditsFailed = false
      try {
        await reloadSelectedAudits(request.requestNo)
      } catch {
        auditsFailed = true
      }
      if (detailFailed) {
        setSuccess(`${request.requestNo}：退款结果已登记，但详情刷新失败，请刷新工作台确认`)
      } else if (auditsFailed) {
        setSuccess(`${request.requestNo}：退款结果已登记，但审计记录刷新失败，可在审计面板中重试`)
      } else {
        setSuccess(`${request.requestNo}：外部退款结果已登记`)
      }
    } catch (actionError: unknown) {
      setError(getAdminErrorMessage(actionError, '退款结果登记失败'))
    } finally {
      setWorkingRequestNo(null)
    }
  }

  async function loadAudits(requestNo: string) {
    setAuditsLoading(true)
    setAuditsError('')
    try {
      const { data: response } = await adminApi.listResumeReviewAudits(requestNo)
      setAudits(response.data)
    } catch (loadError: unknown) {
      setAudits([])
      setAuditsError(getAdminErrorMessage(loadError, '人工精修审计记录加载失败'))
    } finally {
      setAuditsLoading(false)
    }
  }

  async function toggleAudits(requestNo: string) {
    if (selectedAuditRequestNo === requestNo) {
      selectAuditRequest(null)
      setAudits([])
      setAuditsError('')
      return
    }
    selectAuditRequest(requestNo)
    setError('')
    await loadAudits(requestNo)
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-violet-200 bg-white px-6 py-6">
        <h2 className="text-lg font-semibold text-gray-900">人工简历精修工作台</h2>
        <p className="mt-4 text-sm text-gray-500">正在加载人工精修申请…</p>
      </section>
    )
  }

  if (!workspaceLoaded) {
    return (
      <section className="rounded-lg border border-red-200 bg-white px-6 py-6">
        <h2 className="text-lg font-semibold text-gray-900">人工简历精修工作台</h2>
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || '人工精修工作台加载失败，请重试。'}
        </div>
        <button
          type="button"
          onClick={() => void refreshWorkspace()}
          className="mt-4 min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
        >
          重新加载
        </button>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-violet-200 bg-white px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">人工简历精修工作台</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            接受、完成、退回、邮件重试和退款确认均写入审计记录。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshWorkspace()}
          disabled={refreshing || actionInFlight}
          className="min-h-11 shrink-0 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          {refreshing ? '刷新中…' : '刷新工作台'}
        </button>
      </div>

      {error ? <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['需要处理', stats.actionRequired, 'text-violet-700'],
          ['已发送待接单', stats.emailed, 'text-blue-700'],
          ['处理中', stats.accepted, 'text-emerald-700'],
          ['待人工退款', stats.refundRequired, 'text-red-700'],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 md:flex-row">
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as ReviewFilter)}
          aria-label="人工精修状态筛选"
          className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        >
          {FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索申请号、订单号、邮箱或简历 ID"
          aria-label="搜索人工精修申请"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
        <span className="self-center text-sm text-gray-500">{filteredReviews.length} 条</span>
      </div>

      <div className="mt-5 space-y-4">
        {filteredReviews.map((request) => {
          const working = workingRequestNo === request.requestNo
          const auditsOpen = selectedAuditRequestNo === request.requestNo
          const auditRegionId = `review-audits-${request.requestNo}`
          return (
            <article key={request.requestNo} className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_TONES[request.requestStatus]}`}>
                      {STATUS_LABELS[request.requestStatus]}
                    </span>
                    <span className="break-all text-sm font-semibold text-gray-900">{request.requestNo}</span>
                  </div>
                  <p className="mt-2 break-all text-sm text-gray-700">{request.contactEmail}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {request.requestStatus === 'EMAILED' ? (
                    <ActionButton busy={working} disabled={actionInFlight} onClick={() => void handleAction(request, 'ACCEPT')}>接受</ActionButton>
                  ) : null}
                  {request.requestStatus === 'ACCEPTED' ? (
                    <ActionButton busy={working} disabled={actionInFlight} onClick={() => void handleAction(request, 'COMPLETE')}>完成</ActionButton>
                  ) : null}
                  {request.requestStatus === 'EMAIL_PENDING'
                    && (request.mailStatus === 'FAILED' || request.mailStatus === null) ? (
                    <ActionButton busy={working} disabled={actionInFlight} onClick={() => void handleAction(request, 'RETRY_MAIL')}>重试邮件</ActionButton>
                  ) : null}
                  {['AWAITING_PAYMENT', 'EMAIL_PENDING', 'EMAILED', 'ACCEPTED'].includes(request.requestStatus) ? (
                    <ActionButton tone="secondary" busy={working} disabled={actionInFlight} onClick={() => void handleAction(request, 'RETURN')}>退回</ActionButton>
                  ) : null}
                  {request.requestStatus === 'REFUND_REQUIRED' ? (
                    <ActionButton tone="danger" busy={working} disabled={actionInFlight} onClick={() => void handleConfirmRefund(request)}>确认外部退款</ActionButton>
                  ) : null}
                  <ActionButton
                    tone="secondary"
                    disabled={actionInFlight || auditsLoading}
                    aria-expanded={auditsOpen}
                    aria-controls={auditRegionId}
                    onClick={() => void toggleAudits(request.requestNo)}
                  >
                    {auditsOpen ? '收起审计' : '查看审计'}
                  </ActionButton>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-xs text-gray-400">快照 / 资格</dt><dd className="mt-1 text-gray-800">简历 #{request.resumeId} · {entitlementLabel(request)}</dd></div>
                <div><dt className="text-xs text-gray-400">用户 / 处理人</dt><dd className="mt-1 text-gray-800">用户 #{request.userId} · {request.handledBy ? `管理员 #${request.handledBy}` : '尚未接单'}</dd></div>
                <div><dt className="text-xs text-gray-400">创建 / 付款</dt><dd className="mt-1 text-gray-800">{formatAdminDateTime(request.createdAt)}{request.paidAt ? ` · ${formatAdminDateTime(request.paidAt)}` : ''}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-gray-400">支付订单</dt><dd className="mt-1 break-all text-gray-800">{request.orderNo || '免费申请，无支付订单'}</dd></div>
                <div><dt className="text-xs text-gray-400">支付通道 / 金额</dt><dd className="mt-1 text-gray-800">{request.provider ? `${request.provider} · ${request.paymentStatus || '待确认'}` : '无需支付'} · {formatAdminCents(request.priceCents)}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-gray-400">支付交易号</dt><dd className="mt-1 break-all text-gray-800">{request.providerTransactionId || '未记录'}</dd></div>
                <div><dt className="text-xs text-gray-400">邮件投递</dt><dd className="mt-1 text-gray-800">{request.mailStatus ? MAIL_STATUS_LABELS[request.mailStatus] || request.mailStatus : '尚未建立投递任务'}{request.mailAttemptCount !== null ? ` · ${request.mailAttemptCount} 次尝试` : ''}</dd></div>
                <div><dt className="text-xs text-gray-400">邮件时间</dt><dd className="mt-1 text-gray-800">{request.mailSentAt ? `已发送 ${formatAdminDateTime(request.mailSentAt)}` : `下次 ${formatAdminDateTime(request.mailNextAttemptAt)}`}</dd></div>
              </dl>
              {request.mailLastErrorType ? <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">最近邮件错误类型：{request.mailLastErrorType}</p> : null}
              {request.refundReason ? <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">退款原因：{request.refundReason}</p> : null}
              {request.refundReference ? <p className="mt-3 break-all rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700">已登记退款流水：{request.refundReference}</p> : null}

              {auditsOpen ? (
                <div id={auditRegionId} className="mt-4 border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900">审计记录</h3>
                  {auditsLoading ? (
                    <p className="mt-2 text-sm text-gray-500">正在加载…</p>
                  ) : auditsError ? (
                    <div role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                      <p>{auditsError}</p>
                      <button
                        type="button"
                        onClick={() => void loadAudits(request.requestNo)}
                        className="mt-2 min-h-11 rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-red-700"
                      >
                        重试加载审计
                      </button>
                    </div>
                  ) : audits.length > 0 ? (
                    <ol className="mt-3 space-y-2">
                      {audits.map((audit) => (
                        <li key={audit.id} className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-xs leading-5 text-gray-600">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong className="text-gray-900">{AUDIT_ACTION_LABELS[audit.action] || audit.action}</strong>
                            <span>{formatAdminDateTime(audit.createdAt)}</span>
                          </div>
                          <p className="mt-1">{audit.actorType}{audit.actorUserId ? ` #${audit.actorUserId}` : ''} · {audit.fromStatus || '—'} → {audit.toStatus || '—'}</p>
                          {audit.reason ? <p className="mt-1 break-words text-gray-700">原因：{audit.reason}</p> : null}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">暂无审计记录。</p>
                  )}
                </div>
              ) : null}
            </article>
          )
        })}
        {filteredReviews.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">暂无申请</p>
        ) : null}
      </div>

      <p className="mt-5 text-xs text-gray-400">仅显示最近 {PAGE_LIMIT} 条工单，更早的申请请结合状态筛选与搜索定位。</p>
    </section>
  )
}

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  busy?: boolean
  tone?: 'primary' | 'secondary' | 'danger'
}

function ActionButton({ busy = false, tone = 'primary', children, ...rest }: ActionButtonProps) {
  const className = tone === 'danger'
    ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
    : tone === 'secondary'
      ? 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
      : 'border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100'
  return (
    <button
      type="button"
      aria-busy={busy || undefined}
      {...rest}
      className={`min-h-10 rounded-lg border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {busy ? '处理中…' : children}
    </button>
  )
}
