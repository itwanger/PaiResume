import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  resumeReviewApi,
  type ResumeReviewEligibility,
  type ResumeReviewFollowChallenge,
  type ResumeReviewRequest,
  type ResumeReviewStatus,
} from '../../api/resumeReview'

interface ResumeReviewModalProps {
  open: boolean
  resumeId: number
  userId: number
  accountEmail: string | null
  hasResumeContent: boolean
  onBeforeSubmit: () => Promise<void>
  onClose: () => void
}

const REQUEST_POLL_INTERVAL_MS = 4_000
const FOLLOW_POLL_INTERVAL_MS = 4_000
const CONTACT_CODE_COOLDOWN_SECONDS = 60

const TERMINAL_REQUEST_STATUSES = new Set<ResumeReviewStatus>([
  'COMPLETED',
  'RETURNED',
  'REFUNDED',
])

const REQUEST_STATUS_COPY: Record<ResumeReviewStatus, { title: string; description: string; tone: string }> = {
  AWAITING_PAYMENT: {
    title: '等待微信支付',
    description: '这份简历快照已经锁定。请完成本单支付，系统确认到账后才会发送邮件。',
    tone: 'border-amber-200 bg-amber-50 text-amber-950',
  },
  EMAIL_PENDING: {
    title: '正在发送简历',
    description: '系统正在把服务端生成的 PDF 投递到固定人工审阅邮箱；此状态还不代表邮件已被接收。',
    tone: 'border-blue-200 bg-blue-50 text-blue-950',
  },
  EMAILED: {
    title: '简历已发送给二哥',
    description: '固定审阅邮箱已接收 PDF 附件，等待二哥接单。邮件副本一旦发出便无法远程召回。',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  },
  ACCEPTED: {
    title: '二哥已接单',
    description: '本次人工精修正在处理中，请留意你填写的联系邮箱。',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  },
  COMPLETED: {
    title: '本次人工精修已完成',
    description: '本次服务已完成。如需再次提交，请重新创建一份独立快照。',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  },
  REFUND_REQUIRED: {
    title: '本笔付款需要人工退款处理',
    description: '请勿重复支付。该状态只表示需要人工核对，不代表退款已经到账。',
    tone: 'border-red-200 bg-red-50 text-red-950',
  },
  RETURNED: {
    title: '本次申请已退回',
    description: '本次申请没有继续处理，可以查看最新资格后重新提交。',
    tone: 'border-slate-200 bg-slate-50 text-slate-950',
  },
  REFUNDED: {
    title: '退款已人工确认',
    description: '本次申请已经结束，可以查看最新资格后重新提交。',
    tone: 'border-slate-200 bg-slate-50 text-slate-950',
  },
}

function formatCents(value: number) {
  return `¥${(value / 100).toFixed(2)}`
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function parseServerDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatServerDate(value: string | null | undefined) {
  const parsed = parseServerDate(value)
  return parsed ? parsed.toLocaleString('zh-CN', { hour12: false }) : value || '—'
}

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `review-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

function isRequestTerminal(request: ResumeReviewRequest) {
  return TERMINAL_REQUEST_STATUSES.has(request.requestStatus)
}

export function ResumeReviewModal({
  open,
  resumeId,
  userId,
  accountEmail,
  hasResumeContent,
  onBeforeSubmit,
  onClose,
}: ResumeReviewModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const requestPollingRef = useRef(false)
  const followPollingRef = useRef(false)
  const [eligibility, setEligibility] = useState<ResumeReviewEligibility | null>(null)
  const [currentRequest, setCurrentRequest] = useState<ResumeReviewRequest | null>(null)
  const [challenge, setChallenge] = useState<ResumeReviewFollowChallenge | null>(null)
  const [contactEmail, setContactEmail] = useState(accountEmail ?? '')
  const [verificationCode, setVerificationCode] = useState('')
  const [manualReviewConsent, setManualReviewConsent] = useState(false)
  const [emailDeliveryConsent, setEmailDeliveryConsent] = useState(false)
  const [fallbackCode, setFallbackCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [creatingChallenge, setCreatingChallenge] = useState(false)
  const [refreshingFollow, setRefreshingFollow] = useState(false)
  const [redeemingFallback, setRedeemingFallback] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [codeCooldown, setCodeCooldown] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [refreshingRequest, setRefreshingRequest] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)

  const currentRequestStorageKey = `pai-resume:review-request:${userId}`
  const idempotencyStorageKey = `pai-resume:review-idempotency:${userId}:${resumeId}`
  const accountEmailVerified = Boolean(
    accountEmail && normalizeEmail(contactEmail) === normalizeEmail(accountEmail),
  )
  const secondReviewNeedsFollow = Boolean(
    eligibility
    && !eligibility.welcomeFreeAvailable
    && !eligibility.followRewardIssued,
  )
  const paidReviewBlocked = Boolean(
    eligibility
    && eligibility.nextEntitlement === 'PAID'
    && (eligibility.priceCents <= 0 || !eligibility.paidReviewAvailable),
  )
  const canShowApplicationForm = Boolean(
    eligibility
    && !secondReviewNeedsFollow
    && !paidReviewBlocked,
  )

  const entitlementSummary = useMemo(() => {
    if (!eligibility) return null
    if (eligibility.welcomeFreeAvailable) {
      return {
        eyebrow: '第 1 次',
        title: '首次人工精修免费',
        description: '本次不会创建支付订单。免费额度在收件邮件服务器受理后核销。',
        tone: 'border-emerald-200 bg-emerald-50',
      }
    }
    if (eligibility.followRewardAvailable) {
      return {
        eyebrow: '第 2 次',
        title: '关注奖励已到账，本次免费',
        description: '这次免费机会只能使用一次，在收件邮件服务器受理后核销。',
        tone: 'border-emerald-200 bg-emerald-50',
      }
    }
    if (!eligibility.followRewardIssued) {
      return {
        eyebrow: '第 2 次',
        title: `需先关注“${eligibility.followOfficialAccountName || '沉默王二'}”`,
        description: '按下方挑战口令完成验证后，可获得一次免费的人工精修机会。',
        tone: 'border-amber-200 bg-amber-50',
      }
    }
    if (eligibility.paidReviewAvailable && eligibility.priceCents > 0) {
      return {
        eyebrow: '第 3 次及以后',
        title: `本次需单独支付 ${formatCents(eligibility.priceCents)}`,
        description: '每次付款只对应当前这一份不可变简历快照，不会自动续费。',
        tone: 'border-blue-200 bg-blue-50',
      }
    }
    return {
      eyebrow: '第 3 次及以后',
      title: '付费人工精修暂未开放',
      description: '后台尚未同时配置真实价格和收款开关，目前不会创建订单。',
      tone: 'border-slate-200 bg-slate-50',
    }
  }, [eligibility])

  const updateCurrentRequest = useCallback((request: ResumeReviewRequest) => {
    setCurrentRequest(request)
    window.localStorage.setItem(currentRequestStorageKey, request.requestNo)
  }, [currentRequestStorageKey])

  const loadEligibility = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshingFollow(true)
    try {
      const { data: response } = await resumeReviewApi.eligibility()
      setEligibility(response.data)
      if (response.data.followRewardAvailable) {
        setNotice('关注奖励已到账，可以免费提交本次简历。')
      }
      return response.data
    } finally {
      if (showRefreshing) setRefreshingFollow(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    let canceled = false
    setLoading(true)
    setError('')
    setNotice('')
    setContactEmail((current) => current || accountEmail || '')

    const restore = async () => {
      const storedRequestNo = window.localStorage.getItem(currentRequestStorageKey)
      const restoreRequest = async () => {
        const { data: currentResponse } = await resumeReviewApi.current()
        if (currentResponse.data) {
          if (!canceled) updateCurrentRequest(currentResponse.data)
          return
        }
        if (!storedRequestNo) {
          if (!canceled) setCurrentRequest(null)
          return
        }
        const { data: storedResponse } = await resumeReviewApi.request(storedRequestNo)
        if (!canceled) updateCurrentRequest(storedResponse.data)
      }
      const jobs: Promise<unknown>[] = [
        loadEligibility().catch((loadError: unknown) => {
          if (!canceled) setError(getErrorMessage(loadError, '获取人工精修资格失败'))
        }),
        restoreRequest().catch((loadError: unknown) => {
          if (!canceled) {
            setError((current) => current || getErrorMessage(loadError, '恢复当前人工精修申请失败'))
          }
        }),
      ]

      await Promise.allSettled(jobs)
      if (!canceled) {
        setLoading(false)
        window.requestAnimationFrame(() => closeButtonRef.current?.focus())
      }
    }

    void restore()
    return () => {
      canceled = true
    }
  }, [accountEmail, currentRequestStorageKey, loadEligibility, open, updateCurrentRequest])

  useEffect(() => {
    if (!open || codeCooldown <= 0) return
    const timer = window.setInterval(() => {
      setCodeCooldown((current) => Math.max(0, current - 1))
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [codeCooldown, open])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => element.getClientRects().length > 0)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open, submitting])

  const refreshCurrentRequest = useCallback(async (silent = false) => {
    if (!currentRequest || requestPollingRef.current) return
    requestPollingRef.current = true
    if (!silent) setRefreshingRequest(true)
    try {
      const response = currentRequest.requestStatus === 'AWAITING_PAYMENT'
        ? await resumeReviewApi.refreshPayment(currentRequest.requestNo)
        : await resumeReviewApi.request(currentRequest.requestNo)
      updateCurrentRequest(response.data.data)
      if (isRequestTerminal(response.data.data)) {
        await loadEligibility()
      }
      setError('')
    } catch (refreshError: unknown) {
      if (!silent) setError(getErrorMessage(refreshError, '刷新人工精修状态失败'))
    } finally {
      requestPollingRef.current = false
      if (!silent) setRefreshingRequest(false)
    }
  }, [currentRequest, loadEligibility, updateCurrentRequest])

  useEffect(() => {
    if (!open || !currentRequest || isRequestTerminal(currentRequest)) return
    const timer = window.setInterval(() => {
      void refreshCurrentRequest(true)
    }, REQUEST_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [currentRequest, open, refreshCurrentRequest])

  const refreshFollowReward = useCallback(async (silent = false) => {
    if (followPollingRef.current) return
    followPollingRef.current = true
    try {
      const nextEligibility = await loadEligibility(!silent)
      if (!nextEligibility.followRewardAvailable && !silent) {
        setNotice('暂未收到公众号验证，请确认已发送完整挑战口令后再刷新。')
      }
      setError('')
    } catch (refreshError: unknown) {
      if (!silent) setError(getErrorMessage(refreshError, '刷新关注验证失败'))
    } finally {
      followPollingRef.current = false
    }
  }, [loadEligibility])

  useEffect(() => {
    if (!open || !challenge || eligibility?.followRewardAvailable) return
    const expiresAt = parseServerDate(challenge.expiresAt)
    if (expiresAt && expiresAt.getTime() <= Date.now()) return
    const timer = window.setInterval(() => {
      void refreshFollowReward(true)
    }, FOLLOW_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [challenge, eligibility?.followRewardAvailable, open, refreshFollowReward])

  if (!open) return null

  const handleCreateChallenge = async () => {
    setCreatingChallenge(true)
    setError('')
    setNotice('')
    try {
      const { data: response } = await resumeReviewApi.createFollowChallenge()
      setChallenge(response.data)
      setNotice('挑战已创建。发送完整口令后，本页会自动刷新验证结果。')
    } catch (createError: unknown) {
      setError(getErrorMessage(createError, '创建公众号验证挑战失败'))
    } finally {
      setCreatingChallenge(false)
    }
  }

  const handleCopyChallenge = async () => {
    if (!challenge) return
    const message = `简历精修 ${challenge.challengeCode}`
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2_000)
    } catch {
      setError(`复制失败，请手动发送：${message}`)
    }
  }

  const handleRedeemFallback = async () => {
    if (!fallbackCode.trim()) {
      setError('请输入二哥人工提供的故障兜底码')
      return
    }
    setRedeemingFallback(true)
    setError('')
    setNotice('')
    try {
      await resumeReviewApi.redeemFollowFallbackCode(fallbackCode.trim())
      setFallbackCode('')
      await loadEligibility()
      setNotice('人工兜底码已兑换，本次关注奖励可以使用。')
    } catch (redeemError: unknown) {
      setError(getErrorMessage(redeemError, '兜底码兑换失败'))
    } finally {
      setRedeemingFallback(false)
    }
  }

  const handleSendContactCode = async () => {
    const normalized = normalizeEmail(contactEmail)
    if (!isEmail(normalized)) {
      setError('请先填写有效的联系邮箱')
      return
    }
    if (accountEmailVerified) {
      setNotice('这是当前账号已验证邮箱，无需重复输入验证码。')
      return
    }
    setSendingCode(true)
    setError('')
    setNotice('')
    try {
      await resumeReviewApi.sendContactEmailCode(normalized)
      setCodeCooldown(CONTACT_CODE_COOLDOWN_SECONDS)
      setNotice('联系邮箱验证码已发送，请查收后填写。')
    } catch (sendError: unknown) {
      setError(getErrorMessage(sendError, '联系邮箱验证码发送失败'))
    } finally {
      setSendingCode(false)
    }
  }

  const handleSubmit = async () => {
    if (!eligibility || !canShowApplicationForm) return
    const normalized = normalizeEmail(contactEmail)
    if (!hasResumeContent) {
      setError('请先完善至少一个简历模块，再提交人工精修')
      return
    }
    if (!isEmail(normalized)) {
      setError('请填写有效的联系邮箱')
      return
    }
    if (!accountEmailVerified && !verificationCode.trim()) {
      setError('请先验证这个联系邮箱')
      return
    }
    if (!manualReviewConsent || !emailDeliveryConsent) {
      setError('请分别确认人工审阅和固定邮箱发送 PDF 两项授权')
      return
    }

    setSubmitting(true)
    setError('')
    setNotice('')
    try {
      try {
        await onBeforeSubmit()
      } catch (saveError: unknown) {
        setError(`简历尚未全部保存，本次没有创建快照：${getErrorMessage(saveError, '请重试')}`)
        return
      }

      const idempotencyKey = window.sessionStorage.getItem(idempotencyStorageKey)
        || createIdempotencyKey()
      window.sessionStorage.setItem(idempotencyStorageKey, idempotencyKey)
      const { data: response } = await resumeReviewApi.create({
        resumeId,
        idempotencyKey,
        contactEmail: normalized,
        verificationCode: accountEmailVerified ? undefined : verificationCode.trim(),
        manualReviewConsent: true,
        emailDeliveryConsent: true,
      })
      updateCurrentRequest(response.data)
      window.sessionStorage.removeItem(idempotencyStorageKey)
      setNotice(response.data.requestStatus === 'AWAITING_PAYMENT'
        ? '简历快照已锁定，请完成本单支付。'
        : '简历快照已锁定，正在发送给二哥。')
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError, '人工精修申请提交失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartNext = async () => {
    window.localStorage.removeItem(currentRequestStorageKey)
    window.sessionStorage.removeItem(idempotencyStorageKey)
    setCurrentRequest(null)
    setChallenge(null)
    setVerificationCode('')
    setManualReviewConsent(false)
    setEmailDeliveryConsent(false)
    setError('')
    setNotice('')
    setLoading(true)
    try {
      await loadEligibility()
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, '获取下一次人工精修资格失败'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={submitting ? undefined : onClose}
        aria-label="关闭人工精修窗口"
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-review-title"
        aria-describedby="resume-review-description"
        className="relative max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl outline-none sm:max-w-2xl sm:rounded-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-600">人工简历精修</p>
            <h2 id="resume-review-title" className="mt-1 text-xl font-semibold text-slate-950">请二哥帮我改简历</h2>
            <p id="resume-review-description" className="mt-1 text-sm leading-6 text-slate-500">
              提交前会先保存全部修改，再锁定当前快照并生成 PDF。
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
            aria-label="关闭人工精修窗口"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          {error ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
              {notice}
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-slate-500" role="status">
              正在读取人工精修资格与申请状态…
            </div>
          ) : currentRequest ? (
            <RequestStatusPanel
              request={currentRequest}
              refreshing={refreshingRequest}
              onRefresh={() => void refreshCurrentRequest(false)}
              onStartNext={isRequestTerminal(currentRequest) ? () => void handleStartNext() : undefined}
            />
          ) : (
            <>
              {entitlementSummary ? (
                <div className={`rounded-2xl border px-4 py-4 sm:px-5 ${entitlementSummary.tone}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{entitlementSummary.eyebrow}</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">{entitlementSummary.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{entitlementSummary.description}</p>
                </div>
              ) : null}

              {secondReviewNeedsFollow && eligibility ? (
                <FollowVerificationPanel
                  eligibility={eligibility}
                  challenge={challenge}
                  creating={creatingChallenge}
                  refreshing={refreshingFollow}
                  copied={copied}
                  fallbackCode={fallbackCode}
                  redeemingFallback={redeemingFallback}
                  onCreate={() => void handleCreateChallenge()}
                  onRefresh={() => void refreshFollowReward(false)}
                  onCopy={() => void handleCopyChallenge()}
                  onFallbackCodeChange={setFallbackCode}
                  onRedeemFallback={() => void handleRedeemFallback()}
                />
              ) : null}

              {paidReviewBlocked && !secondReviewNeedsFollow ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                  付费人工精修暂未开放。只有后台配置真实价格并开启独立收款开关后，这里才会显示服务端金额和支付入口。
                </div>
              ) : null}

              {canShowApplicationForm && eligibility ? (
                <ApplicationForm
                  contactEmail={contactEmail}
                  accountEmailVerified={accountEmailVerified}
                  verificationCode={verificationCode}
                  manualReviewConsent={manualReviewConsent}
                  emailDeliveryConsent={emailDeliveryConsent}
                  sendingCode={sendingCode}
                  codeCooldown={codeCooldown}
                  submitting={submitting}
                  hasResumeContent={hasResumeContent}
                  eligibility={eligibility}
                  onContactEmailChange={(value) => {
                    setContactEmail(value)
                    setVerificationCode('')
                    setCodeCooldown(0)
                  }}
                  onVerificationCodeChange={setVerificationCode}
                  onManualReviewConsentChange={setManualReviewConsent}
                  onEmailDeliveryConsentChange={setEmailDeliveryConsent}
                  onSendCode={() => void handleSendContactCode()}
                  onSubmit={() => void handleSubmit()}
                />
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  )
}

interface FollowVerificationPanelProps {
  eligibility: ResumeReviewEligibility
  challenge: ResumeReviewFollowChallenge | null
  creating: boolean
  refreshing: boolean
  copied: boolean
  fallbackCode: string
  redeemingFallback: boolean
  onCreate: () => void
  onRefresh: () => void
  onCopy: () => void
  onFallbackCodeChange: (value: string) => void
  onRedeemFallback: () => void
}

function FollowVerificationPanel({
  eligibility,
  challenge,
  creating,
  refreshing,
  copied,
  fallbackCode,
  redeemingFallback,
  onCreate,
  onRefresh,
  onCopy,
  onFallbackCodeChange,
  onRedeemFallback,
}: FollowVerificationPanelProps) {
  const officialAccountName = challenge?.officialAccountName || eligibility.followOfficialAccountName || '沉默王二'
  const qrCodeUrl = challenge?.qrCodeUrl || eligibility.followQrCodeUrl

  return (
    <div className="rounded-2xl border border-amber-200 bg-white px-4 py-5 sm:px-5">
      <h3 className="text-base font-semibold text-slate-950">验证“沉默王二”公众号关注</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        登录扫码使用的是“派聪明”服务号；它与“{officialAccountName}”不是同一个账号，也不等于完成本次关注验证。
      </p>

      {!challenge ? (
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 sm:w-auto"
        >
          {creating ? '正在创建验证口令…' : '生成关注验证口令'}
        </button>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-[176px_1fr] sm:items-center">
          <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:mx-0">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt={`${officialAccountName}公众号二维码`} className="h-full w-full object-contain" />
            ) : (
              <p className="px-3 text-center text-xs leading-5 text-slate-500">公众号二维码暂未配置，请在微信中搜索“{officialAccountName}”。</p>
            )}
          </div>
          <div>
            <p className="text-sm leading-6 text-slate-700">关注后，请向公众号发送下面这条完整消息：</p>
            <code className="mt-2 block break-all rounded-xl bg-slate-950 px-3 py-3 text-sm font-semibold text-white">
              简历精修 {challenge.challengeCode}
            </code>
            <p className="mt-2 text-xs leading-5 text-slate-500">口令有效期至 {formatServerDate(challenge.expiresAt)}，验证成功后页面会自动刷新。</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={onCopy}
                className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {copied ? '已复制完整口令' : '复制完整口令'}
              </button>
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="min-h-11 rounded-xl bg-primary-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {refreshing ? '正在验证…' : '我已发送，刷新验证'}
              </button>
              <button
                type="button"
                onClick={onCreate}
                disabled={creating}
                className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {creating ? '获取中…' : '重新获取口令'}
              </button>
            </div>
          </div>
        </div>
      )}

      <details className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">公众号回调故障时的人工兜底</summary>
        <p className="mt-2 text-xs leading-5 text-slate-500">仅输入二哥人工提供的一次性故障兜底码。此方式不代表系统实时核验了关注状态。</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={fallbackCode}
            onChange={(event) => onFallbackCodeChange(event.target.value.toUpperCase())}
            maxLength={64}
            autoComplete="off"
            placeholder="输入人工兜底码"
            aria-label="人工故障兜底码"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          />
          <button
            type="button"
            onClick={onRedeemFallback}
            disabled={redeemingFallback}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            {redeemingFallback ? '兑换中…' : '兑换兜底码'}
          </button>
        </div>
      </details>
    </div>
  )
}

interface ApplicationFormProps {
  contactEmail: string
  accountEmailVerified: boolean
  verificationCode: string
  manualReviewConsent: boolean
  emailDeliveryConsent: boolean
  sendingCode: boolean
  codeCooldown: number
  submitting: boolean
  hasResumeContent: boolean
  eligibility: ResumeReviewEligibility
  onContactEmailChange: (value: string) => void
  onVerificationCodeChange: (value: string) => void
  onManualReviewConsentChange: (value: boolean) => void
  onEmailDeliveryConsentChange: (value: boolean) => void
  onSendCode: () => void
  onSubmit: () => void
}

function ApplicationForm({
  contactEmail,
  accountEmailVerified,
  verificationCode,
  manualReviewConsent,
  emailDeliveryConsent,
  sendingCode,
  codeCooldown,
  submitting,
  hasResumeContent,
  eligibility,
  onContactEmailChange,
  onVerificationCodeChange,
  onManualReviewConsentChange,
  onEmailDeliveryConsentChange,
  onSendCode,
  onSubmit,
}: ApplicationFormProps) {
  const isPaid = eligibility.nextEntitlement === 'PAID'
  const submitLabel = submitting
    ? '正在保存并锁定快照…'
    : isPaid
      ? `确认并获取支付二维码 · ${formatCents(eligibility.priceCents)}`
      : '确认提交本次免费精修'

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white px-4 py-5 sm:px-5">
      <div>
        <h3 className="text-base font-semibold text-slate-950">联系邮箱</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">用于二哥联系你；简历 PDF 只由服务端发送到平台固定审阅邮箱，页面不接受附件、链接或自定义收件人。</p>
      </div>

      <div>
        <label htmlFor="resume-review-contact-email" className="mb-2 block text-sm font-medium text-slate-700">邮箱地址</label>
        <input
          id="resume-review-contact-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={contactEmail}
          onChange={(event) => onContactEmailChange(event.target.value)}
          placeholder="用于接收人工沟通的邮箱"
          className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
        {accountEmailVerified ? (
          <p className="mt-2 text-xs font-medium text-emerald-700">当前账号已验证该邮箱，无需重复输入验证码。</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <div className="min-w-0 flex-1">
              <label htmlFor="resume-review-email-code" className="sr-only">联系邮箱验证码</label>
              <input
                id="resume-review-email-code"
                value={verificationCode}
                onChange={(event) => onVerificationCodeChange(event.target.value.trim().slice(0, 12))}
                autoComplete="one-time-code"
                maxLength={12}
                placeholder="输入联系邮箱验证码"
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <button
              type="button"
              onClick={onSendCode}
              disabled={sendingCode || codeCooldown > 0 || !isEmail(contactEmail)}
              className="min-h-11 shrink-0 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendingCode ? '发送中…' : codeCooldown > 0 ? `${codeCooldown} 秒后重发` : '发送验证码'}
            </button>
          </div>
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-900">提交授权（需分别确认）</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 transition hover:border-primary-200">
          <input
            type="checkbox"
            checked={manualReviewConsent}
            onChange={(event) => onManualReviewConsentChange(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm leading-6 text-slate-700">我同意将当前简历的不可变快照交给二哥进行人工审阅。</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 transition hover:border-primary-200">
          <input
            type="checkbox"
            checked={emailDeliveryConsent}
            onChange={(event) => onEmailDeliveryConsentChange(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm leading-6 text-slate-700">我同意由服务端生成 PDF，并发送到平台预设的固定人工审阅邮箱；邮件发出后无法远程召回。</span>
        </label>
      </fieldset>

      {!hasResumeContent ? (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">请先完善至少一个简历模块。</p>
      ) : null}

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || !hasResumeContent}
        className="min-h-12 w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitLabel}
      </button>
      <p className="text-center text-xs leading-5 text-slate-500">点击后先等待全部自动保存成功；保存失败时不会创建快照、扣减次数或生成订单。</p>
    </div>
  )
}

interface RequestStatusPanelProps {
  request: ResumeReviewRequest
  refreshing: boolean
  onRefresh: () => void
  onStartNext?: () => void
}

function RequestStatusPanel({ request, refreshing, onRefresh, onStartNext }: RequestStatusPanelProps) {
  const copy = REQUEST_STATUS_COPY[request.requestStatus] ?? {
    title: request.requestStatus,
    description: '正在读取最新处理状态。',
    tone: 'border-slate-200 bg-slate-50 text-slate-950',
  }
  const awaitingPayment = request.requestStatus === 'AWAITING_PAYMENT'
  const paymentUncertain = request.paymentStatus === 'PREPAY_UNKNOWN'

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border px-4 py-5 sm:px-5 ${copy.tone}`} role="status">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-70">申请状态</p>
        <h3 className="mt-1 text-lg font-semibold">{copy.title}</h3>
        <p className="mt-2 text-sm leading-6 opacity-80">{copy.description}</p>
        {request.requestStatus === 'REFUND_REQUIRED' && request.refundReason ? (
          <p className="mt-2 text-xs leading-5 opacity-80">服务端复核原因：{request.refundReason}</p>
        ) : null}
      </div>

      {awaitingPayment ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 sm:px-5">
          {paymentUncertain ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
              支付平台预下单结果暂时无法确认。请勿重复创建或付款，先刷新本单状态；没有二维码时请稍后再试。
            </div>
          ) : request.qrCodeDataUrl ? (
            <div className="text-center">
              <img src={request.qrCodeDataUrl} alt="本次人工精修微信支付二维码" className="mx-auto h-56 w-56 rounded-2xl border border-slate-200 bg-white p-2 object-contain shadow-sm" />
              <p className="mt-4 text-sm font-medium text-slate-900">请使用微信扫一扫支付</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{formatCents(request.priceCents)}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">支付有效期至 {formatServerDate(request.paymentExpiresAt)}。每笔订单只对应当前快照。</p>
            </div>
          ) : (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm leading-6 text-blue-800">支付二维码生成中，请先刷新本单状态，不要重复提交。</div>
          )}
        </div>
      ) : null}

      <dl className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm sm:grid-cols-2 sm:px-5">
        <div className="min-w-0">
          <dt className="text-xs text-slate-500">申请编号</dt>
          <dd className="mt-1 truncate font-medium text-slate-900" title={request.requestNo}>{request.requestNo}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-slate-500">联系邮箱</dt>
          <dd className="mt-1 truncate font-medium text-slate-900" title={request.contactEmail}>{request.contactEmail}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">本次资格</dt>
          <dd className="mt-1 font-medium text-slate-900">
            {request.entitlementType === 'WELCOME_FREE'
              ? '首次免费'
              : request.entitlementType === 'FOLLOW_REWARD'
                ? '公众号关注奖励'
                : `独立付费 ${formatCents(request.priceCents)}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">创建时间</dt>
          <dd className="mt-1 font-medium text-slate-900">{formatServerDate(request.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">快照简历</dt>
          <dd className="mt-1 font-medium text-slate-900">简历 #{request.resumeId}</dd>
        </div>
        {request.orderNo ? (
          <div className="min-w-0">
            <dt className="text-xs text-slate-500">支付订单</dt>
            <dd className="mt-1 truncate font-medium text-slate-900" title={request.orderNo}>{request.orderNo} · {request.paymentStatus || '待确认'}</dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
        >
          {refreshing ? '正在刷新…' : awaitingPayment ? '刷新支付结果' : '刷新处理状态'}
        </button>
        {onStartNext ? (
          <button
            type="button"
            onClick={onStartNext}
            className="min-h-11 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            查看资格并申请下一次
          </button>
        ) : null}
      </div>
    </div>
  )
}
