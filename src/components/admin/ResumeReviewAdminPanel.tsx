import { useEffect, useMemo, useState } from 'react'
import {
  adminApi,
  type ResumeReviewAudit,
  type ResumeReviewAdminRequest,
  type ResumeReviewFallbackCode,
} from '../../api/admin'
import type { ResumeReviewStatus } from '../../api/resumeReview'

type ReviewFilter =
  | 'ACTION_REQUIRED'
  | 'ACTIVE'
  | 'ALL'
  | ResumeReviewStatus

type ReviewAction = 'ACCEPT' | 'COMPLETE' | 'RETURN' | 'RETRY_MAIL'

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
  FOLLOW_REWARD_ISSUED: '签发关注奖励',
  FOLLOW_FALLBACK_REDEEM: '兑换人工兜底码',
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
  { value: 'ALL', label: '最近 300 条' },
]

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

function formatCents(value: number) {
  return `¥${(value / 100).toFixed(2)}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('zh-CN', { hour12: false })
}

function displayFallbackStatus(code: ResumeReviewFallbackCode) {
  if (code.status !== 'ISSUED') return code.status
  const expiresAt = new Date(code.expiresAt.includes('T') ? code.expiresAt : code.expiresAt.replace(' ', 'T'))
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()
    ? 'EXPIRED'
    : 'ISSUED'
}

function entitlementLabel(request: ResumeReviewAdminRequest) {
  if (request.entitlementType === 'WELCOME_FREE') return '首次免费'
  if (request.entitlementType === 'FOLLOW_REWARD') return '关注奖励免费'
  return `逐次付费 ${formatCents(request.priceCents)}`
}

function needsAdminAction(request: ResumeReviewAdminRequest) {
  return request.requestStatus === 'EMAILED'
    || request.requestStatus === 'ACCEPTED'
    || request.requestStatus === 'REFUND_REQUIRED'
    || (request.requestStatus === 'EMAIL_PENDING'
      && (request.mailStatus === 'FAILED' || request.mailStatus === null))
}

export function ResumeReviewAdminPanel() {
  const [reviews, setReviews] = useState<ResumeReviewAdminRequest[]>([])
  const [fallbackCodes, setFallbackCodes] = useState<ResumeReviewFallbackCode[]>([])
  const [filter, setFilter] = useState<ReviewFilter>('ACTION_REQUIRED')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [workingRequestNo, setWorkingRequestNo] = useState<string | null>(null)
  const [selectedAuditRequestNo, setSelectedAuditRequestNo] = useState<string | null>(null)
  const [audits, setAudits] = useState<ResumeReviewAudit[]>([])
  const [auditsLoading, setAuditsLoading] = useState(false)
  const [validHours, setValidHours] = useState('24')
  const [creatingFallbackCode, setCreatingFallbackCode] = useState(false)
  const [latestFallbackCode, setLatestFallbackCode] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
    setError('')
    void Promise.all([
      adminApi.listResumeReviews(),
      adminApi.listResumeReviewFallbackCodes(),
    ]).then(([reviewResponse, codeResponse]) => {
      if (canceled) return
      setReviews(reviewResponse.data.data)
      setFallbackCodes(codeResponse.data.data)
    }).catch((loadError: unknown) => {
      if (!canceled) setError(getErrorMessage(loadError, '人工精修工作台加载失败'))
    }).finally(() => {
      if (!canceled) setLoading(false)
    })
    return () => {
      canceled = true
    }
  }, [])

  async function refreshWorkspace() {
    setRefreshing(true)
    setError('')
    try {
      const [reviewResponse, codeResponse] = await Promise.all([
        adminApi.listResumeReviews(),
        adminApi.listResumeReviewFallbackCodes(),
      ])
      setReviews(reviewResponse.data.data)
      setFallbackCodes(codeResponse.data.data)
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, '人工精修工作台刷新失败'))
    } finally {
      setRefreshing(false)
    }
  }

  function requestReason(message: string) {
    const rawReason = window.prompt(message, '')
    if (rawReason === null) return null
    const reason = rawReason.trim()
    if (!reason) {
      setError('操作原因不能为空')
      return null
    }
    if (reason.length > 500) {
      setError('操作原因不能超过 500 个字符')
      return null
    }
    return reason
  }

  function replaceReview(nextReview: ResumeReviewAdminRequest) {
    setReviews((current) => current.map((review) => (
      review.requestNo === nextReview.requestNo ? nextReview : review
    )))
  }

  async function reloadSelectedAudits(requestNo: string) {
    if (selectedAuditRequestNo !== requestNo) return
    const { data: response } = await adminApi.listResumeReviewAudits(requestNo)
    setAudits(response.data)
  }

  async function handleAction(request: ResumeReviewAdminRequest, action: ReviewAction) {
    const actionLabel = action === 'ACCEPT'
      ? '接受申请'
      : action === 'COMPLETE'
        ? '标记完成'
        : action === 'RETURN'
          ? '退回申请'
          : '重试邮件投递'
    const reason = requestReason(`请输入“${actionLabel}”的原因（必填，将写入审计日志）`)
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
    if (!window.confirm(confirmation)) return

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
      try {
        const { data: detailResponse } = await adminApi.getResumeReview(request.requestNo)
        replaceReview(detailResponse.data)
        await reloadSelectedAudits(request.requestNo)
      } catch {
        setSuccess(`${request.requestNo}：${actionLabel}已执行，但详情刷新失败，请刷新工作台确认`)
        return
      }
      setSuccess(`${request.requestNo}：${actionLabel}成功`)
    } catch (actionError: unknown) {
      setError(getErrorMessage(actionError, `${actionLabel}失败`))
    } finally {
      setWorkingRequestNo(null)
    }
  }

  async function handleConfirmRefund(request: ResumeReviewAdminRequest) {
    const rawReference = window.prompt(
      `请先在 ${request.provider || '微信'} 商户平台按订单 ${request.orderNo || request.requestNo}${request.providerTransactionId ? `（支付交易号 ${request.providerTransactionId}）` : ''}完成原路退款，再填写真实退款单号或核验流水（必填）`,
      '',
    )
    if (rawReference === null) return
    const refundReference = rawReference.trim()
    if (!refundReference || refundReference.length > 128) {
      setError('退款单号或核验流水不能为空，且不能超过 128 个字符')
      return
    }
    const reason = requestReason('请输入退款核对说明（必填，例如退款渠道、核对人和用户沟通情况）')
    if (!reason) return
    if (!window.confirm(
      `再次确认：你已在 ${request.provider || '微信'} 商户平台为订单 ${request.orderNo || '未记录'} 实际完成 ${formatCents(request.priceCents)} 原路退款。\n\n支付时间：${formatDate(request.paidAt)}\n支付交易号：${request.providerTransactionId || '未记录，请先在商户平台核实'}\n\n本操作只登记外部退款结果，不会发起退款。`,
    )) return

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
      try {
        const { data: detailResponse } = await adminApi.getResumeReview(request.requestNo)
        replaceReview(detailResponse.data)
        await reloadSelectedAudits(request.requestNo)
      } catch {
        setSuccess(`${request.requestNo}：退款结果已登记，但详情刷新失败，请刷新工作台确认`)
        return
      }
      setSuccess(`${request.requestNo}：外部退款结果已登记`)
    } catch (actionError: unknown) {
      setError(getErrorMessage(actionError, '退款结果登记失败'))
    } finally {
      setWorkingRequestNo(null)
    }
  }

  async function toggleAudits(requestNo: string) {
    if (selectedAuditRequestNo === requestNo) {
      setSelectedAuditRequestNo(null)
      setAudits([])
      return
    }
    setSelectedAuditRequestNo(requestNo)
    setAuditsLoading(true)
    setError('')
    try {
      const { data: response } = await adminApi.listResumeReviewAudits(requestNo)
      setAudits(response.data)
    } catch (loadError: unknown) {
      setAudits([])
      setError(getErrorMessage(loadError, '人工精修审计记录加载失败'))
    } finally {
      setAuditsLoading(false)
    }
  }

  async function handleCreateFallbackCode() {
    const hours = Number(validHours)
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
      setError('兜底码有效期必须是 1-168 小时之间的整数')
      return
    }
    if (!window.confirm(
      '确认生成关注验证故障兜底码？\n\n仅在“沉默王二”公众号回调故障且人工核验用户后发放；它不代表系统实时验证了关注。',
    )) return

    setCreatingFallbackCode(true)
    setError('')
    setSuccess('')
    try {
      const { data: response } = await adminApi.createResumeReviewFallbackCode(hours)
      const rawCode = response.data.code
      if (!rawCode) throw new Error('服务端没有返回一次性兜底码明文')
      setLatestFallbackCode(rawCode)
      try {
        const { data: listResponse } = await adminApi.listResumeReviewFallbackCodes()
        setFallbackCodes(listResponse.data)
      } catch {
        setSuccess('一次性故障兜底码已生成；列表刷新失败，但下方明文仍可复制，请勿再次生成。')
        return
      }
      setSuccess('一次性故障兜底码已生成；关闭或刷新后不能再次查看明文。')
    } catch (createError: unknown) {
      setError(getErrorMessage(createError, '故障兜底码生成失败'))
    } finally {
      setCreatingFallbackCode(false)
    }
  }

  async function copyText(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value)
      setSuccess(message)
    } catch {
      window.prompt('请复制下面的内容', value)
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-violet-200 bg-white px-6 py-6">
        <h2 className="text-lg font-semibold text-gray-900">人工简历精修工作台</h2>
        <p className="mt-4 text-sm text-gray-500">正在加载人工精修申请和故障兜底码…</p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-violet-200 bg-white px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">人工简历精修工作台</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            首次免费，第二次须验证“沉默王二”关注奖励；奖励核销后，第三次及以后每份快照单独付费。接受、完成、退回、邮件重试和退款确认都会写入审计记录。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshWorkspace()}
          disabled={refreshing}
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
        <span className="self-center text-sm text-gray-500">当前 {filteredReviews.length} 条</span>
      </div>

      <div className="mt-5 space-y-4">
        {filteredReviews.map((request) => {
          const working = workingRequestNo === request.requestNo
          const auditsOpen = selectedAuditRequestNo === request.requestNo
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
                    <ActionButton disabled={working} onClick={() => void handleAction(request, 'ACCEPT')}>接受</ActionButton>
                  ) : null}
                  {request.requestStatus === 'ACCEPTED' ? (
                    <ActionButton disabled={working} onClick={() => void handleAction(request, 'COMPLETE')}>完成</ActionButton>
                  ) : null}
                  {request.requestStatus === 'EMAIL_PENDING'
                    && (request.mailStatus === 'FAILED' || request.mailStatus === null) ? (
                    <ActionButton disabled={working} onClick={() => void handleAction(request, 'RETRY_MAIL')}>重试邮件</ActionButton>
                  ) : null}
                  {['AWAITING_PAYMENT', 'EMAIL_PENDING', 'EMAILED', 'ACCEPTED'].includes(request.requestStatus) ? (
                    <ActionButton tone="secondary" disabled={working} onClick={() => void handleAction(request, 'RETURN')}>退回</ActionButton>
                  ) : null}
                  {request.requestStatus === 'REFUND_REQUIRED' ? (
                    <ActionButton tone="danger" disabled={working} onClick={() => void handleConfirmRefund(request)}>确认外部退款</ActionButton>
                  ) : null}
                  <ActionButton tone="secondary" disabled={working || auditsLoading} onClick={() => void toggleAudits(request.requestNo)}>
                    {auditsOpen ? '收起审计' : '查看审计'}
                  </ActionButton>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-xs text-gray-400">快照 / 资格</dt><dd className="mt-1 text-gray-800">简历 #{request.resumeId} · {entitlementLabel(request)}</dd></div>
                <div><dt className="text-xs text-gray-400">用户 / 处理人</dt><dd className="mt-1 text-gray-800">用户 #{request.userId} · {request.handledBy ? `管理员 #${request.handledBy}` : '尚未接单'}</dd></div>
                <div><dt className="text-xs text-gray-400">创建 / 付款</dt><dd className="mt-1 text-gray-800">{formatDate(request.createdAt)}{request.paidAt ? ` · ${formatDate(request.paidAt)}` : ''}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-gray-400">支付订单</dt><dd className="mt-1 break-all text-gray-800">{request.orderNo || '免费申请，无支付订单'}</dd></div>
                <div><dt className="text-xs text-gray-400">支付通道 / 金额</dt><dd className="mt-1 text-gray-800">{request.provider ? `${request.provider} · ${request.paymentStatus || '待确认'}` : '无需支付'} · {formatCents(request.priceCents)}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-gray-400">支付交易号</dt><dd className="mt-1 break-all text-gray-800">{request.providerTransactionId || '未记录'}</dd></div>
                <div><dt className="text-xs text-gray-400">邮件投递</dt><dd className="mt-1 text-gray-800">{request.mailStatus ? MAIL_STATUS_LABELS[request.mailStatus] || request.mailStatus : '尚未建立投递任务'}{request.mailAttemptCount !== null ? ` · ${request.mailAttemptCount} 次尝试` : ''}</dd></div>
                <div><dt className="text-xs text-gray-400">邮件时间</dt><dd className="mt-1 text-gray-800">{request.mailSentAt ? `已发送 ${formatDate(request.mailSentAt)}` : `下次 ${formatDate(request.mailNextAttemptAt)}`}</dd></div>
              </dl>
              {request.mailLastErrorType ? <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">最近邮件错误类型：{request.mailLastErrorType}</p> : null}
              {request.refundReason ? <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">退款原因：{request.refundReason}</p> : null}
              {request.refundReference ? <p className="mt-3 break-all rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700">已登记退款流水：{request.refundReference}</p> : null}

              {auditsOpen ? (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900">审计记录</h3>
                  {auditsLoading ? (
                    <p className="mt-2 text-sm text-gray-500">正在加载…</p>
                  ) : audits.length > 0 ? (
                    <ol className="mt-3 space-y-2">
                      {audits.map((audit) => (
                        <li key={audit.id} className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-xs leading-5 text-gray-600">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong className="text-gray-900">{AUDIT_ACTION_LABELS[audit.action] || audit.action}</strong>
                            <span>{formatDate(audit.createdAt)}</span>
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
          <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">当前筛选条件下暂无人工精修申请。</p>
        ) : null}
      </div>

      <div className="mt-8 border-t border-gray-200 pt-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">“沉默王二”关注验证故障兜底码</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">仅当公众号关键词回调故障，且已人工核验用户关注后生成。兜底码只能兑换一次，不代表实时关注验证。</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              有效小时
              <input
                type="number"
                min={1}
                max={168}
                step={1}
                value={validHours}
                onChange={(event) => setValidHours(event.target.value)}
                className="min-h-11 w-24 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleCreateFallbackCode()}
              disabled={creatingFallbackCode}
              className="min-h-11 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
            >
              {creatingFallbackCode ? '生成中…' : '生成一次性兜底码'}
            </button>
          </div>
        </div>

        {latestFallbackCode ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-4">
            <p className="text-sm font-semibold text-amber-950">仅本次显示明文，请核验用户后私下发送</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-950 px-3 py-3 text-sm font-semibold text-white">{latestFallbackCode}</code>
              <button
                type="button"
                onClick={() => void copyText(latestFallbackCode, '兜底码已复制')}
                className="min-h-11 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
              >
                复制兜底码
              </button>
              <button
                type="button"
                onClick={() => setLatestFallbackCode(null)}
                className="min-h-11 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                已妥善保存，隐藏
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-xs text-gray-500">
              <tr>
                <th className="py-3 pr-4 font-medium">编号</th>
                <th className="py-3 pr-4 font-medium">末尾提示</th>
                <th className="py-3 pr-4 font-medium">状态</th>
                <th className="py-3 font-medium">有效期</th>
              </tr>
            </thead>
            <tbody>
              {fallbackCodes.map((code) => {
                const status = displayFallbackStatus(code)
                return (
                  <tr key={code.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 pr-4 text-gray-700">#{code.id}</td>
                    <td className="py-3 pr-4 font-mono text-gray-900">***{code.codeHint}</td>
                    <td className="py-3 pr-4 text-gray-700">{status === 'ISSUED' ? '未兑换' : status === 'REDEEMED' ? '已兑换' : status === 'EXPIRED' ? '已过期' : status}</td>
                    <td className="py-3 text-gray-600">{formatDate(code.expiresAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {fallbackCodes.length === 0 ? <p className="py-5 text-sm text-gray-500">尚未生成故障兜底码。</p> : null}
        </div>
      </div>
    </section>
  )
}

interface ActionButtonProps {
  children: React.ReactNode
  disabled: boolean
  tone?: 'primary' | 'secondary' | 'danger'
  onClick: () => void
}

function ActionButton({ children, disabled, tone = 'primary', onClick }: ActionButtonProps) {
  const className = tone === 'danger'
    ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
    : tone === 'secondary'
      ? 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
      : 'border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-10 rounded-lg border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}
