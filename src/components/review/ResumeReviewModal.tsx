import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  resumeReviewApi,
  type ResumeReviewEligibility,
  type ResumeReviewRequest,
  type ResumeReviewStatus,
} from '../../api/resumeReview'

interface ResumeReviewModalProps {
  open: boolean
  resumeId: number
  userId: number
  accountEmail: string | null
  onClose: () => void
}

const REQUEST_POLL_INTERVAL_MS = 4_000
const CONTACT_CODE_COOLDOWN_SECONDS = 60
const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024
const PDF_MAGIC = '%PDF-'

type SubmissionStage =
  | 'idle'
  | 'requesting-upload'
  | 'uploading'
  | 'completing-upload'
  | 'creating-request'

const TERMINAL_REQUEST_STATUSES = new Set<ResumeReviewStatus>([
  'COMPLETED',
  'RETURNED',
  'REFUNDED',
])

const REQUEST_STATUS_COPY: Record<ResumeReviewStatus, { title: string; description: string; tone: string }> = {
  AWAITING_PAYMENT: {
    title: '等待微信支付',
    description: '支付成功后发送 PDF。',
    tone: 'border-amber-200 bg-amber-50 text-amber-950',
  },
  EMAIL_PENDING: {
    title: '正在发送简历',
    description: '正在发送 PDF。',
    tone: 'border-blue-200 bg-blue-50 text-blue-950',
  },
  EMAILED: {
    title: '简历已发送给二哥',
    description: 'PDF 已送达，等待接单。',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  },
  ACCEPTED: {
    title: '二哥已接单',
    description: '处理中，请留意联系邮箱。',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  },
  COMPLETED: {
    title: '本次人工精修已完成',
    description: '本次已结束，可查看下一次资格。',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  },
  REFUND_REQUIRED: {
    title: '本笔付款需要人工退款处理',
    description: '请勿重复支付；此状态不代表退款已到账。',
    tone: 'border-red-200 bg-red-50 text-red-950',
  },
  RETURNED: {
    title: '本次申请已退回',
    description: '本次已结束，可查看下一次资格。',
    tone: 'border-slate-200 bg-slate-50 text-slate-950',
  },
  REFUNDED: {
    title: '退款已人工确认',
    description: '本次已结束，可查看下一次资格。',
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

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
}

async function validateAndHashPdf(file: File) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('请选择扩展名为 .pdf 的文件')
  }
  if (file.type && file.type.toLowerCase() !== 'application/pdf') {
    throw new Error('文件 MIME 类型必须是 application/pdf')
  }
  if (file.size <= 0) {
    throw new Error('PDF 文件不能为空')
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new Error('PDF 文件不能超过 10MB')
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error('当前浏览器不支持安全文件校验，请升级浏览器后重试')
  }

  const content = await file.arrayBuffer()
  const header = new TextDecoder('ascii').decode(content.slice(0, PDF_MAGIC.length))
  if (header !== PDF_MAGIC) {
    throw new Error('文件内容不是有效的 PDF')
  }

  const digest = await globalThis.crypto.subtle.digest('SHA-256', content)
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

function isRequestTerminal(request: ResumeReviewRequest) {
  return TERMINAL_REQUEST_STATUSES.has(request.requestStatus)
}

export function ResumeReviewModal({
  open,
  resumeId,
  userId,
  accountEmail,
  onClose,
}: ResumeReviewModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const requestPollingRef = useRef(false)
  const pdfValidationSequenceRef = useRef(0)
  const [eligibility, setEligibility] = useState<ResumeReviewEligibility | null>(null)
  const [currentRequest, setCurrentRequest] = useState<ResumeReviewRequest | null>(null)
  const [contactEmail, setContactEmail] = useState(accountEmail ?? '')
  const [verificationCode, setVerificationCode] = useState('')
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null)
  const [selectedPdfSha256, setSelectedPdfSha256] = useState('')
  const [validatingPdf, setValidatingPdf] = useState(false)
  const [manualReviewConsent, setManualReviewConsent] = useState(false)
  const [emailDeliveryConsent, setEmailDeliveryConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [codeCooldown, setCodeCooldown] = useState(0)
  const [submissionStage, setSubmissionStage] = useState<SubmissionStage>('idle')
  const [refreshingRequest, setRefreshingRequest] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const submitting = submissionStage !== 'idle'

  const currentRequestStorageKey = `pai-resume:review-request:${userId}`
  const idempotencyStorageKey = `pai-resume:review-idempotency:${userId}:${resumeId}`
  const accountEmailVerified = Boolean(
    accountEmail && normalizeEmail(contactEmail) === normalizeEmail(accountEmail),
  )
  const paidReviewBlocked = Boolean(
    eligibility
    && (!eligibility.enabled
      || (!eligibility.welcomeFreeAvailable
        && (eligibility.priceCents <= 0 || !eligibility.paidReviewAvailable))),
  )
  const canShowApplicationForm = Boolean(
    eligibility
    && !paidReviewBlocked,
  )

  const entitlementSummary = useMemo(() => {
    if (!eligibility) return null
    if (!eligibility.enabled) {
      return {
        title: '人工精修暂未开放',
        description: '',
        tone: 'border-slate-200 bg-slate-50',
      }
    }
    if (eligibility.welcomeFreeAvailable) {
      return {
        title: '首次精修免费',
        description: '邮件受理后核销免费次数。',
        tone: 'border-emerald-200 bg-emerald-50',
      }
    }
    if (eligibility.paidReviewAvailable && eligibility.priceCents > 0) {
      return {
        title: `本次 ${formatCents(eligibility.priceCents)}`,
        description: '每次仅对应当前 PDF，不会自动续费。',
        tone: 'border-blue-200 bg-blue-50',
      }
    }
    return {
      title: '付费精修暂未开放',
      description: '',
      tone: 'border-slate-200 bg-slate-50',
    }
  }, [eligibility])

  const updateCurrentRequest = useCallback((request: ResumeReviewRequest) => {
    setCurrentRequest(request)
    window.localStorage.setItem(currentRequestStorageKey, request.requestNo)
  }, [currentRequestStorageKey])

  const loadEligibility = useCallback(async () => {
    const { data: response } = await resumeReviewApi.eligibility()
    setEligibility(response.data)
    return response.data
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
    if (open) return
    pdfValidationSequenceRef.current += 1
    setSelectedPdf(null)
    setSelectedPdfSha256('')
    setValidatingPdf(false)
    setSubmissionStage('idle')
  }, [open])

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

  if (!open) return null

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

  const handlePdfFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    const validationSequence = pdfValidationSequenceRef.current + 1
    pdfValidationSequenceRef.current = validationSequence
    setSelectedPdf(null)
    setSelectedPdfSha256('')
    setError('')
    setNotice('')

    if (!file) {
      setValidatingPdf(false)
      return
    }

    setValidatingPdf(true)
    try {
      const sha256 = await validateAndHashPdf(file)
      if (pdfValidationSequenceRef.current !== validationSequence) return
      setSelectedPdf(file)
      setSelectedPdfSha256(sha256)
      setNotice('PDF 校验完成，提交时会直传到平台的私有存储。')
    } catch (pdfError: unknown) {
      if (pdfValidationSequenceRef.current !== validationSequence) return
      setError(getErrorMessage(pdfError, 'PDF 文件校验失败'))
    } finally {
      if (pdfValidationSequenceRef.current === validationSequence) {
        setValidatingPdf(false)
      }
    }
  }

  const handleSubmit = async () => {
    if (!eligibility || !canShowApplicationForm) return
    const normalized = normalizeEmail(contactEmail)
    const pdfFile = selectedPdf
    const pdfSha256 = selectedPdfSha256
    if (!pdfFile || !pdfSha256 || validatingPdf) {
      setError('请先选择并完成校验一份不超过 10MB 的 PDF')
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

    setSubmissionStage('requesting-upload')
    setError('')
    setNotice('正在申请 PDF 安全上传凭证…')
    try {
      const idempotencyKey = window.sessionStorage.getItem(idempotencyStorageKey)
        || createIdempotencyKey()
      window.sessionStorage.setItem(idempotencyStorageKey, idempotencyKey)

      const { data: uploadResponse } = await resumeReviewApi.requestUpload({
        resumeId,
        fileName: pdfFile.name,
        sizeBytes: pdfFile.size,
        sha256: pdfSha256,
      })
      const uploadCredential = uploadResponse.data
      if (!Number.isFinite(uploadCredential.maxSizeBytes) || uploadCredential.maxSizeBytes <= 0) {
        throw new Error('服务端 PDF 上传大小配置无效')
      }
      if (pdfFile.size > uploadCredential.maxSizeBytes) {
        throw new Error(`PDF 超过服务端允许的 ${formatFileSize(uploadCredential.maxSizeBytes)} 上限`)
      }

      setSubmissionStage('uploading')
      setNotice('正在把 PDF 加密直传到平台的私有存储…')
      await resumeReviewApi.uploadPdf(uploadCredential, pdfFile)

      setSubmissionStage('completing-upload')
      setNotice('PDF 已上传，正在由服务端核验文件…')
      const { data: completedResponse } = await resumeReviewApi.completeUpload(uploadCredential.uploadNo)
      const completedUpload = completedResponse.data
      if (
        completedUpload.status !== 'READY'
        || completedUpload.uploadNo !== uploadCredential.uploadNo
        || completedUpload.sizeBytes !== pdfFile.size
        || completedUpload.sha256.toLowerCase() !== pdfSha256
      ) {
        throw new Error('服务端返回的 PDF 校验结果不一致，请重新选择文件')
      }

      setSubmissionStage('creating-request')
      setNotice('PDF 已通过核验，正在确认本次人工精修申请…')
      const { data: response } = await resumeReviewApi.create({
        resumeId,
        idempotencyKey,
        uploadNo: completedUpload.uploadNo,
        contactEmail: normalized,
        verificationCode: accountEmailVerified ? undefined : verificationCode.trim(),
        manualReviewConsent: true,
        emailDeliveryConsent: true,
      })
      updateCurrentRequest(response.data)
      window.sessionStorage.removeItem(idempotencyStorageKey)
      setNotice(response.data.requestStatus === 'AWAITING_PAYMENT'
        ? 'PDF 已确认提交，请完成本单支付。'
        : 'PDF 已确认提交，正在发送给二哥。')
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError, '人工精修申请提交失败'))
    } finally {
      setSubmissionStage('idle')
    }
  }

  const handleStartNext = async () => {
    window.localStorage.removeItem(currentRequestStorageKey)
    window.sessionStorage.removeItem(idempotencyStorageKey)
    setCurrentRequest(null)
    setVerificationCode('')
    pdfValidationSequenceRef.current += 1
    setSelectedPdf(null)
    setSelectedPdfSha256('')
    setValidatingPdf(false)
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
        className="relative max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl outline-none sm:max-w-2xl sm:rounded-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <h2 id="resume-review-title" className="text-xl font-semibold text-slate-950">人工精修</h2>
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
              正在加载…
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
                  <h3 className="text-lg font-semibold text-slate-950">{entitlementSummary.title}</h3>
                  {entitlementSummary.description ? (
                    <p className="mt-1 text-sm leading-6 text-slate-700">{entitlementSummary.description}</p>
                  ) : null}
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
                  submissionStage={submissionStage}
                  selectedPdf={selectedPdf}
                  validatingPdf={validatingPdf}
                  eligibility={eligibility}
                  onPdfFileChange={(event) => void handlePdfFileChange(event)}
                  onRemovePdf={() => {
                    pdfValidationSequenceRef.current += 1
                    setSelectedPdf(null)
                    setSelectedPdfSha256('')
                    setValidatingPdf(false)
                    setError('')
                    setNotice('')
                  }}
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

interface ApplicationFormProps {
  contactEmail: string
  accountEmailVerified: boolean
  verificationCode: string
  manualReviewConsent: boolean
  emailDeliveryConsent: boolean
  sendingCode: boolean
  codeCooldown: number
  submitting: boolean
  submissionStage: SubmissionStage
  selectedPdf: File | null
  validatingPdf: boolean
  eligibility: ResumeReviewEligibility
  onPdfFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onRemovePdf: () => void
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
  submissionStage,
  selectedPdf,
  validatingPdf,
  eligibility,
  onPdfFileChange,
  onRemovePdf,
  onContactEmailChange,
  onVerificationCodeChange,
  onManualReviewConsentChange,
  onEmailDeliveryConsentChange,
  onSendCode,
  onSubmit,
}: ApplicationFormProps) {
  const isPaid = !eligibility.welcomeFreeAvailable
  const submitLabel = submissionStage === 'requesting-upload'
    ? '正在申请上传凭证…'
    : submissionStage === 'uploading'
      ? '正在上传 PDF…'
      : submissionStage === 'completing-upload'
        ? '正在核验 PDF…'
        : submissionStage === 'creating-request'
          ? '正在确认申请…'
          : isPaid
            ? `确认并获取支付二维码 · ${formatCents(eligibility.priceCents)}`
            : '确认提交本次免费精修'

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white px-4 py-5 sm:px-5">
      <div>
        <h3 className="text-base font-semibold text-slate-950">选择 PDF</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">最大 10MB，仅用于本次人工精修。</p>
        <label htmlFor="resume-review-pdf" className="sr-only">PDF 文件</label>
        <input
          id="resume-review-pdf"
          type="file"
          accept=".pdf,application/pdf"
          onChange={onPdfFileChange}
          disabled={submitting || validatingPdf}
          className="mt-3 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {validatingPdf ? (
          <p className="mt-2 text-xs font-medium text-blue-700" role="status">正在校验 PDF…</p>
        ) : selectedPdf ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-emerald-950" title={selectedPdf.name}>{selectedPdf.name}</p>
              <p className="mt-1 text-xs text-emerald-700">{formatFileSize(selectedPdf.size)} · 已校验</p>
            </div>
            <button
              type="button"
              onClick={onRemovePdf}
              disabled={submitting}
              className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              移除
            </button>
          </div>
        ) : null}
      </div>

      <div>
        <label htmlFor="resume-review-contact-email" className="mb-2 block text-base font-semibold text-slate-950">联系邮箱</label>
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
          <p className="mt-2 text-xs font-medium text-emerald-700">邮箱已验证</p>
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
        <legend className="text-sm font-semibold text-slate-900">确认授权</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 transition hover:border-primary-200">
          <input
            type="checkbox"
            checked={manualReviewConsent}
            onChange={(event) => onManualReviewConsentChange(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm leading-6 text-slate-700">同意二哥人工审阅这份 PDF</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 transition hover:border-primary-200">
          <input
            type="checkbox"
            checked={emailDeliveryConsent}
            onChange={(event) => onEmailDeliveryConsentChange(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm leading-6 text-slate-700">同意上传至私有存储并发送到固定审阅邮箱；邮件发出后无法撤回</span>
        </label>
      </fieldset>

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || validatingPdf || !selectedPdf}
        className="min-h-12 w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitLabel}
      </button>
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
        <h3 className="text-lg font-semibold">{copy.title}</h3>
        {copy.description ? <p className="mt-2 text-sm leading-6 opacity-80">{copy.description}</p> : null}
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
              <p className="mt-2 text-xs leading-5 text-slate-500">支付有效期至 {formatServerDate(request.paymentExpiresAt)}。每笔订单只对应当前确认的 PDF。</p>
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
                ? '历史免费权益（已停用）'
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
