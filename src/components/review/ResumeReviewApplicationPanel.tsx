import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  resumeReviewApi,
  type ResumeReviewEligibility,
  type ResumeReviewRequest,
} from '../../api/resumeReview'
import { buildLoginPath, buildMembershipPath } from '../../utils/navigation'

const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024
const PDF_MAGIC = '%PDF-'
const PAYMENT_POLL_INTERVAL_MS = 4_000
const CONTACT_CODE_COOLDOWN_SECONDS = 60
const PRIORITY_PRESETS = [66, 128, 233, 520, 888]

type QueueMode = 'free' | 'priority'
type SubmissionStage = 'idle' | 'hashing' | 'creating' | 'dispatching'

interface ResumeReviewApplicationPanelProps {
  initialized: boolean
  isAuthenticated: boolean
  isMember: boolean
  userId?: number
  accountEmail?: string | null
  currentRequest: ResumeReviewRequest | null
  onRequestChange: (request: ResumeReviewRequest | null) => void
  onQueueRefresh: () => void
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function parsePriorityFeeCents(value: string) {
  const normalized = value.trim()
  if (!normalized) return 0
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null
  const cents = Math.round(Number(normalized) * 100)
  return Number.isSafeInteger(cents) ? cents : null
}

function formatCents(value: number) {
  const yuan = value / 100
  return `¥${Number.isInteger(yuan) ? yuan.toFixed(0) : yuan.toFixed(2)}`
}

function formatFileSize(sizeBytes: number) {
  return sizeBytes < 1024 * 1024
    ? `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
    : `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
}

function paymentExpiryTimestamp(value: string | null) {
  if (!value) return null
  const timestamp = new Date(value.replace(' ', 'T')).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function formatPaymentRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function PdfFileIcon() {
  return (
    <span className="relative block h-10 w-9 shrink-0 text-primary-600" aria-hidden="true">
      <svg viewBox="0 0 36 40" fill="none" className="h-full w-full">
        <path d="M7 1.5h14l8 8V35a3.5 3.5 0 0 1-3.5 3.5h-18A3.5 3.5 0 0 1 4 35V5a3.5 3.5 0 0 1 3-3.5Z" fill="currentColor" fillOpacity=".08" stroke="currentColor" strokeWidth="1.5" />
        <path d="M21 1.5v8h8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M10 17h13M10 22h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".55" />
      </svg>
      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-primary-600 px-1.5 py-0.5 text-[8px] font-black leading-none text-white">PDF</span>
    </span>
  )
}

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `review-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

async function validateAndHashPdf(file: File) {
  if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('请选择扩展名为 .pdf 的文件')
  if (file.type && file.type.toLowerCase() !== 'application/pdf') throw new Error('文件类型必须是 PDF')
  if (file.size <= 0) throw new Error('PDF 文件不能为空')
  if (file.size > MAX_PDF_SIZE_BYTES) throw new Error('PDF 文件不能超过 5MB')
  if (!globalThis.crypto?.subtle) throw new Error('当前浏览器不支持安全文件校验，请升级浏览器后重试')
  const content = await file.arrayBuffer()
  const header = new TextDecoder('ascii').decode(content.slice(0, PDF_MAGIC.length))
  if (header !== PDF_MAGIC) throw new Error('文件内容不是有效的 PDF')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', content)
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('')
}

function requestStatusCopy(request: ResumeReviewRequest) {
  if (request.requestStatus === 'AWAITING_PAYMENT') return ['等待支付', '请使用右侧付款码完成加急支付。']
  if (request.requestStatus === 'EMAIL_PENDING' && !request.dispatchedAt) return ['可以发送', request.paymentStatus === 'PAID' ? '支付已确认，点击发送 PDF。' : 'PDF 已准备好，点击发送并进入队列。']
  if (request.requestStatus === 'EMAIL_PENDING') return ['正在发送', '邮件送达后会自动进入排队大厅。']
  if (request.requestStatus === 'EMAILED') return ['已发送至二哥邮箱', '请耐心等待，一般24小时内回复。']
  if (request.requestStatus === 'ACCEPTED') return ['正在人工精修', '二哥已经接单，请留意联系邮箱。']
  if (request.requestStatus === 'COMPLETED') return ['已完成', '二哥已在管理端标记本次精修完成。']
  if (request.requestStatus === 'REFUND_REQUIRED') return ['等待退款处理', '请勿重复支付或重复提交。']
  if (request.requestStatus === 'RETURNED') return ['申请已退回', '可以重新选择 PDF 申请。']
  if (request.requestStatus === 'REFUNDED') return ['退款已确认', '本次申请已经结束。']
  return [request.requestStatus, '正在读取最新状态。']
}

export function ResumeReviewApplicationPanel({
  initialized,
  isAuthenticated,
  isMember,
  userId,
  accountEmail,
  currentRequest,
  onRequestChange,
  onQueueRefresh,
}: ResumeReviewApplicationPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pollingRef = useRef(false)
  const customPaymentTimerRef = useRef<number | null>(null)
  const [eligibility, setEligibility] = useState<ResumeReviewEligibility | null>(null)
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null)
  const [selectedPdfSha256, setSelectedPdfSha256] = useState('')
  const [queueMode, setQueueMode] = useState<QueueMode>('free')
  const [priorityFeeYuan, setPriorityFeeYuan] = useState('66')
  const [contactEmail, setContactEmail] = useState(accountEmail ?? '')
  const [verificationCode, setVerificationCode] = useState('')
  const [dragging, setDragging] = useState(false)
  const [stage, setStage] = useState<SubmissionStage>('idle')
  const [sendingCode, setSendingCode] = useState(false)
  const [codeCooldown, setCodeCooldown] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const busy = stage !== 'idle'
  const idempotencyStorageKey = `pai-resume:review-idempotency:${userId ?? 'anonymous'}`
  const pendingRequest = currentRequest
    && !currentRequest.dispatchedAt
    && ['AWAITING_PAYMENT', 'EMAIL_PENDING'].includes(currentRequest.requestStatus)
    ? currentRequest
    : null
  const pendingPriorityRequest = Boolean(pendingRequest && pendingRequest.priorityFeeCents > 0)
  const priorityPaymentConfirmed = Boolean(pendingPriorityRequest && pendingRequest?.paymentStatus === 'PAID')
  const terminalRequest = Boolean(currentRequest && ['RETURNED', 'REFUNDED', 'COMPLETED'].includes(currentRequest.requestStatus))
  const displayedQueueMode: QueueMode = pendingPriorityRequest ? 'priority' : queueMode
  const displayedPriorityFeeYuan = pendingPriorityRequest && pendingRequest
    ? String(pendingRequest.priorityFeeCents / 100)
    : priorityFeeYuan
  const verifiedContactEmail = pendingRequest?.contactEmail ?? accountEmail
  const contactEmailVerified = Boolean(verifiedContactEmail
    && normalizeEmail(contactEmail) === normalizeEmail(verifiedContactEmail))

  const loadEligibility = useCallback(async () => {
    if (!isAuthenticated || !isMember) return
    try {
      const { data: response } = await resumeReviewApi.eligibility()
      setEligibility(response.data)
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, '获取人工精修资格失败'))
    }
  }, [isAuthenticated, isMember])

  useEffect(() => { void loadEligibility() }, [loadEligibility])
  useEffect(() => {
    if (pendingRequest?.contactEmail) {
      setContactEmail(pendingRequest.contactEmail)
      return
    }
    setContactEmail((current) => current || accountEmail || '')
  }, [accountEmail, pendingRequest?.requestNo])
  useEffect(() => {
    if (codeCooldown <= 0) return
    const timer = window.setInterval(() => setCodeCooldown((current) => Math.max(0, current - 1)), 1_000)
    return () => window.clearInterval(timer)
  }, [codeCooldown])
  useEffect(() => () => {
    if (customPaymentTimerRef.current !== null) {
      window.clearTimeout(customPaymentTimerRef.current)
    }
  }, [])

  const refreshRequest = useCallback(async (silent = false) => {
    if (!currentRequest || pollingRef.current) return currentRequest
    pollingRef.current = true
    try {
      const response = currentRequest.requestStatus === 'AWAITING_PAYMENT'
        ? await resumeReviewApi.refreshPayment(currentRequest.requestNo)
        : await resumeReviewApi.request(currentRequest.requestNo)
      onRequestChange(response.data.data)
      if (!silent) setNotice('状态已更新。')
      setError('')
      return response.data.data
    } catch (refreshError: unknown) {
      if (!silent) setError(getErrorMessage(refreshError, '刷新状态失败'))
      return currentRequest
    } finally {
      pollingRef.current = false
    }
  }, [currentRequest, onRequestChange])

  useEffect(() => {
    if (!currentRequest || !['AWAITING_PAYMENT', 'EMAIL_PENDING'].includes(currentRequest.requestStatus)) return
    const timer = window.setInterval(() => void refreshRequest(true), PAYMENT_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [currentRequest, refreshRequest])

  const choosePdf = async (file: File | null) => {
    if (!file) return
    setStage('hashing')
    setError('')
    setNotice('正在校验 PDF…')
    try {
      const sha256 = await validateAndHashPdf(file)
      setSelectedPdf(file)
      setSelectedPdfSha256(sha256)
      setNotice('PDF 校验通过。')
    } catch (fileError: unknown) {
      setSelectedPdf(null)
      setSelectedPdfSha256('')
      setError(getErrorMessage(fileError, 'PDF 校验失败'))
    } finally {
      setStage('idle')
    }
  }

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    void choosePdf(event.target.files?.[0] ?? null)
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setDragging(false)
    void choosePdf(event.dataTransfer.files?.[0] ?? null)
  }

  const handleSendContactCode = async () => {
    const normalized = normalizeEmail(contactEmail)
    if (!isEmail(normalized)) return setError('请先填写有效的联系邮箱')
    if (contactEmailVerified) return
    setSendingCode(true)
    setError('')
    try {
      await resumeReviewApi.sendContactEmailCode(normalized)
      setCodeCooldown(CONTACT_CODE_COOLDOWN_SECONDS)
      setNotice('验证码已发送。')
    } catch (sendError: unknown) {
      setError(getErrorMessage(sendError, '验证码发送失败'))
    } finally {
      setSendingCode(false)
    }
  }

  const validateForm = (mode: QueueMode, feeCents: number | null) => {
    if (!selectedPdf || !selectedPdfSha256) return '请选择已经导出的 PDF'
    if (!isEmail(contactEmail)) return '请填写有效的联系邮箱'
    if (!contactEmailVerified && !verificationCode.trim()) return '请先验证联系邮箱'
    if (mode === 'priority' && (feeCents === null || feeCents < 1 || feeCents > (eligibility?.maxPriorityFeeCents ?? 0))) return `加急金额应在 ¥0.01 至 ${formatCents(eligibility?.maxPriorityFeeCents ?? 0)} 之间`
    if (mode === 'priority' && !eligibility?.paidReviewAvailable) return '加急支付暂不可用，可以选择普通排队'
    return ''
  }

  const createRequest = async (mode: QueueMode = 'free', feeCents: number | null = 0) => {
    const formError = validateForm(mode, feeCents)
    if (formError) return setError(formError)
    const pdfFile = selectedPdf
    if (!pdfFile || !selectedPdfSha256) return
    setError('')
    try {
      const idempotencyKey = window.sessionStorage.getItem(idempotencyStorageKey) || createIdempotencyKey()
      window.sessionStorage.setItem(idempotencyStorageKey, idempotencyKey)
      setStage('creating')
      setNotice(mode === 'priority' ? '正在生成付款码…' : '正在确认申请…')
      const { data: createResponse } = await resumeReviewApi.create({
        resumeId: null,
        idempotencyKey,
        fileName: pdfFile.name,
        sizeBytes: pdfFile.size,
        sha256: selectedPdfSha256,
        priorityFeeCents: mode === 'priority' ? feeCents || 0 : 0,
        contactEmail: normalizeEmail(contactEmail),
        verificationCode: contactEmailVerified ? undefined : verificationCode.trim(),
      })
      window.sessionStorage.removeItem(idempotencyStorageKey)
      onRequestChange(createResponse.data)
      if (mode === 'free') {
        setStage('dispatching')
        setNotice('正在发送到人工精修邮箱…')
        const { data: dispatchResponse } = await resumeReviewApi.dispatch(createResponse.data.requestNo, pdfFile)
        onRequestChange(dispatchResponse.data)
        setNotice('PDF 已作为附件发送，已进入排队大厅。')
        onQueueRefresh()
      } else {
        setNotice('')
      }
    } catch (submitError: unknown) {
      setNotice('')
      setError(getErrorMessage(submitError, '人工精修申请提交失败'))
    } finally {
      setStage('idle')
    }
  }

  const syncPendingContactEmail = async (request: ResumeReviewRequest) => {
    const normalized = normalizeEmail(contactEmail)
    if (!isEmail(normalized)) throw new Error('请填写有效的联系邮箱')
    if (normalized === normalizeEmail(request.contactEmail)) return request
    if (!contactEmailVerified && !verificationCode.trim()) throw new Error('请先验证联系邮箱')
    const { data: response } = await resumeReviewApi.updateContactEmail(
      request.requestNo,
      normalized,
      contactEmailVerified ? undefined : verificationCode.trim(),
    )
    onRequestChange(response.data)
    setVerificationCode('')
    return response.data
  }

  const dispatchCurrentRequest = async () => {
    if (!currentRequest) return
    setStage('dispatching')
    setError('')
    try {
      const requestWithContact = await syncPendingContactEmail(currentRequest)
      const refreshed = requestWithContact.requestStatus === 'AWAITING_PAYMENT'
        ? await refreshRequest(false)
        : requestWithContact
      if (!refreshed) throw new Error('没有找到可发送的人工精修申请')
      if (refreshed.requestStatus === 'AWAITING_PAYMENT' || (refreshed.entitlementType === 'PAID' && refreshed.paymentStatus !== 'PAID')) throw new Error('尚未确认支付，请完成付款后刷新')
      if (!selectedPdf || !selectedPdfSha256) throw new Error('请选择本次申请的 PDF')
      if (selectedPdf.size !== refreshed.pdfSizeBytes
        || selectedPdf.name !== refreshed.pdfFileName
        || selectedPdfSha256.toLowerCase() !== refreshed.contentHash.toLowerCase()) {
        throw new Error('请选择申请时的同一份 PDF')
      }
      const { data: response } = await resumeReviewApi.dispatch(refreshed.requestNo, selectedPdf)
      onRequestChange(response.data)
      setNotice('PDF 已作为附件发送，已进入排队大厅。')
      onQueueRefresh()
    } catch (dispatchError: unknown) {
      setNotice('')
      setError(getErrorMessage(dispatchError, 'PDF 发送失败'))
    } finally {
      setStage('idle')
    }
  }

  const generatePriorityPayment = async (feeCents: number | null) => {
    if (busy || pendingPriorityRequest) return
    if (feeCents === null || feeCents < 1
      || feeCents > (eligibility?.maxPriorityFeeCents ?? 0)) {
      setError(`加急金额应在 ¥0.01 至 ${formatCents(eligibility?.maxPriorityFeeCents ?? 0)} 之间`)
      return
    }
    if (!eligibility?.paidReviewAvailable) {
      setError('加急支付暂不可用，可以选择普通排队')
      return
    }
    if (!pendingRequest) {
      await createRequest('priority', feeCents)
      return
    }
    if (!pendingRequest || pendingPriorityRequest) return
    setStage('creating')
    setError('')
    setNotice('正在生成付款码…')
    try {
      await syncPendingContactEmail(pendingRequest)
      const { data: response } = await resumeReviewApi.upgradePriority(
        pendingRequest.requestNo,
        feeCents,
      )
      onRequestChange(response.data)
      setNotice('')
    } catch (upgradeError: unknown) {
      setNotice('')
      setError(getErrorMessage(upgradeError, '加急付款码生成失败'))
    } finally {
      setStage('idle')
    }
  }

  const selectPriorityAmount = (amountYuan: string) => {
    if (customPaymentTimerRef.current !== null) {
      window.clearTimeout(customPaymentTimerRef.current)
      customPaymentTimerRef.current = null
    }
    setPriorityFeeYuan(amountYuan)
    void generatePriorityPayment(parsePriorityFeeCents(amountYuan))
  }

  const selectFreeQueue = () => {
    if (customPaymentTimerRef.current !== null) {
      window.clearTimeout(customPaymentTimerRef.current)
      customPaymentTimerRef.current = null
    }
    setQueueMode('free')
  }

  const changeCustomPriorityAmount = (value: string) => {
    const normalized = value.replace(/[^\d.]/g, '').slice(0, 7)
    setPriorityFeeYuan(normalized)
    if (customPaymentTimerRef.current !== null) {
      window.clearTimeout(customPaymentTimerRef.current)
    }
    const feeCents = parsePriorityFeeCents(normalized)
    if (feeCents === null || feeCents < 1) return
    customPaymentTimerRef.current = window.setTimeout(() => {
      customPaymentTimerRef.current = null
      void generatePriorityPayment(feeCents)
    }, 600)
  }

  const resetTerminalRequest = () => {
    onRequestChange(null)
    setSelectedPdf(null)
    setSelectedPdfSha256('')
    selectFreeQueue()
    setError('')
    setNotice('')
  }

  const primaryLabel = stage === 'hashing' ? '正在校验 PDF…'
    : stage === 'creating' ? '正在确认申请…'
      : stage === 'dispatching' ? '正在发送…'
        : '发送并进入简历大厅'

  const submitLabel = displayedQueueMode === 'priority'
    ? priorityPaymentConfirmed ? '发送并进入简历大厅' : '支付后发送'
    : primaryLabel
  const submitDisabled = busy || !selectedPdf
    || (displayedQueueMode === 'priority' && !priorityPaymentConfirmed)

  const paymentPanel = pendingRequest && pendingRequest.priorityFeeCents > 0
    ? <PaymentPanel request={pendingRequest} busy={busy} onRefresh={() => void refreshRequest(false)} />
    : queueMode === 'priority'
      ? <section className="flex min-h-64 items-center justify-center rounded-[10px] border border-slate-200 bg-white shadow-sm" aria-label="加急付款状态"><div className="flex h-44 w-44 items-center justify-center rounded-2xl bg-amber-50 text-sm font-semibold text-amber-700">选择金额</div></section>
      : null
  const feedbackPanel = error || notice
    ? <div className="space-y-3">
        {error ? <p role="alert" className="border-l-4 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {notice ? <p role="status" className="border-l-4 border-blue-400 bg-blue-50 px-4 py-3 text-sm text-blue-700">{notice}</p> : null}
      </div>
    : null

  if (!initialized) {
    return (
      <div className="rounded-[10px] border border-slate-200 bg-white px-6 py-14 text-center shadow-sm lg:col-span-2" role="status">
        <h2 className="text-lg font-bold text-slate-950">正在读取会员状态</h2>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <div className="rounded-[10px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-xl text-amber-700">♛</div>
          <h2 className="mt-3 text-lg font-bold text-slate-950">登录后申请人工精修</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">有效会员可以上传导出的 PDF 免费排队，也可以选择付费插队。</p>
          <Link to={buildLoginPath('/resume-review')} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-600 px-6 text-sm font-semibold text-white">登录</Link>
        </div>
        <RulesPanel />
      </>
    )
  }

  if (!isMember) {
    return (
      <section className="rounded-[10px] border border-amber-400 bg-white px-6 py-14 text-center shadow-sm sm:px-10 sm:py-16 lg:col-span-2" aria-labelledby="review-membership-gate-title">
        <div className="text-[38px] leading-none" aria-hidden="true">🔒</div>
        <h2 id="review-membership-gate-title" className="mt-5 text-xl font-bold text-slate-950">人工精修仅对派简历会员开放</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-600 sm:text-base">人工精修由真人逐份处理，需要先成为派简历会员，才能申请并进入精修队列。</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5" aria-label="会员人工精修权益">
          {['人工精修资格', '加急插队', '优先处理'].map((benefit) => (
            <span key={benefit} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm text-slate-600">{benefit}</span>
          ))}
        </div>
        <Link to={buildMembershipPath('/resume-review')} className="mt-6 inline-flex min-h-12 min-w-52 items-center justify-center rounded-lg bg-primary-600 px-7 text-base font-semibold text-white transition hover:bg-primary-700">成为派简历会员</Link>
      </section>
    )
  }

  if (currentRequest && !pendingRequest && !terminalRequest) {
    const [title, description] = requestStatusCopy(currentRequest)
    return (
      <>
        <div className="rounded-[10px] border border-slate-200 bg-white shadow-sm">
          <div className="flex min-h-[81px] flex-col justify-center border-b border-slate-200 px-6 py-4"><h2 className="text-lg font-bold text-slate-950">让二哥帮忙改简历</h2><p className="mt-1 truncate text-xs text-slate-500">{currentRequest.pdfFileName || '已上传 PDF'}</p></div>
          <div className="p-6">
            <div className="flex items-center gap-4 py-3" aria-label="精修状态"><span className="flex h-16 w-12 items-center justify-center"><PdfFileIcon /></span><span className="min-w-0"><b className="block truncate text-base text-slate-950">{title}</b><span className="mt-1 block text-sm text-slate-500">{description}</span></span></div>
            <dl className="mt-6 grid gap-4 bg-slate-50 p-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-500">申请编号</dt><dd className="mt-1 truncate font-medium">{currentRequest.requestNo}</dd></div><div><dt className="text-xs text-slate-500">排队方式</dt><dd className="mt-1 font-medium">{currentRequest.priorityFeeCents > 0 ? `加急 ${formatCents(currentRequest.priorityFeeCents)}` : '普通排队'}</dd></div></dl>
            <button type="button" onClick={() => void refreshRequest(false)} disabled={busy} className="mt-5 min-h-11 w-full rounded-lg border border-primary-200 bg-primary-50 text-sm font-semibold text-primary-700 transition hover:border-primary-300 hover:bg-primary-100 disabled:opacity-50">{busy ? '刷新中…' : '刷新进度'}</button>
          </div>
        </div>
        <div className="space-y-6" aria-label="申请状态与排队规则">{feedbackPanel}{paymentPanel}<RulesPanel /></div>
      </>
    )
  }

  return (
    <>
      <div className="rounded-[10px] border border-slate-200 bg-white shadow-sm">
        <div className="flex min-h-[81px] items-center border-b border-slate-200 px-5 py-4 sm:px-6"><h2 className="text-lg font-bold text-slate-950">让二哥帮忙改简历</h2></div>
        <div className="p-5 sm:p-6">
          {terminalRequest ? <button type="button" onClick={resetTerminalRequest} className="mb-4 text-sm font-semibold text-primary-700">申请下一份</button> : null}

          <div className="flex gap-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[13px] font-bold text-primary-700">1</span>
            <div className="min-w-0 flex-1"><h3 className="mt-0.5 text-[15px] font-semibold text-slate-950">选择要精修的 PDF 简历</h3>
              <div className="mt-3 rounded-lg border border-slate-200">
                <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={handleFileInput} />
                <button type="button" onClick={() => fileInputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} disabled={busy} className={`flex w-full items-center justify-center gap-4 px-4 py-5 text-left transition ${dragging ? 'bg-primary-50' : 'hover:bg-primary-50/50'}`}>
                  <PdfFileIcon />
                  <span className="min-w-0"><b className="block truncate text-sm text-slate-900">{selectedPdf ? selectedPdf.name : '点击选择或拖入 PDF'}</b><span className="mt-1 block text-xs text-slate-500">{selectedPdf ? `${formatFileSize(selectedPdf.size)} · 已校验` : '仅支持 PDF，单份不超过 5MB'}</span></span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-7 flex gap-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[13px] font-bold text-primary-700">2</span>
            <div className="min-w-0 flex-1"><h3 className="mt-0.5 text-[15px] font-semibold text-slate-950">选择排队方式</h3>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <button type="button" onClick={selectFreeQueue} disabled={pendingPriorityRequest} className={`rounded-lg border p-3.5 text-left disabled:cursor-default ${displayedQueueMode === 'free' ? 'border-primary-600 bg-primary-50' : 'border-slate-200'}`}><b className="text-sm">普通排队</b><span className="mt-1.5 block text-xs leading-5 text-slate-500">按申请顺序在队尾等待。</span></button>
                <button type="button" onClick={() => eligibility?.paidReviewAvailable && setQueueMode('priority')} disabled={pendingPriorityRequest || !eligibility?.paidReviewAvailable} className={`rounded-lg border p-3.5 text-left disabled:cursor-not-allowed disabled:opacity-50 ${displayedQueueMode === 'priority' ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}><b className="flex items-center gap-2 text-sm">加急插队 <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">付费</span></b><span className="mt-1.5 block text-xs leading-5 text-slate-500">金额越高，等待位置越靠前。</span></button>
              </div>
              {displayedQueueMode === 'priority' ? <div className="mt-4"><div className="flex flex-wrap gap-2">{PRIORITY_PRESETS.map((amount) => <button key={amount} type="button" onClick={() => selectPriorityAmount(String(amount))} disabled={busy || pendingPriorityRequest} className={`rounded-lg border px-3 py-2 text-sm font-bold disabled:cursor-default ${displayedPriorityFeeYuan === String(amount) ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200'}`}>¥{amount}</button>)}</div><label className="mt-3 flex items-center gap-2 text-sm"><span className="shrink-0 text-slate-600">自定义金额 ¥</span><input value={displayedPriorityFeeYuan} onChange={(event) => changeCustomPriorityAmount(event.target.value)} disabled={busy || pendingPriorityRequest} inputMode="decimal" className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 outline-none focus:border-amber-500 disabled:bg-slate-50" /></label></div> : null}
            </div>
          </div>

          <div className="mt-7 flex gap-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[13px] font-bold text-primary-700">3</span>
            <div className="min-w-0 flex-1">
              <h3 className="mt-0.5 text-[15px] font-semibold text-slate-950">填写联系邮箱</h3>
              <div className="mt-3 grid gap-2.5">
                <input aria-label="联系邮箱" type="email" value={contactEmail} onChange={(event) => { setContactEmail(event.target.value); setVerificationCode('') }} disabled={busy} className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-primary-500 disabled:bg-slate-50" />
                {!contactEmailVerified ? <div className="flex gap-2"><input aria-label="邮箱验证码" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.trim().slice(0, 12))} placeholder="邮箱验证码" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm" /><button type="button" onClick={() => void handleSendContactCode()} disabled={sendingCode || codeCooldown > 0} className="shrink-0 rounded-lg border border-primary-200 px-3 text-xs font-semibold text-primary-700 disabled:opacity-50">{codeCooldown > 0 ? `${codeCooldown}s` : '发送验证码'}</button></div> : null}
              </div>
            </div>
          </div>

          <button type="button" onClick={() => void (displayedQueueMode === 'priority' ? priorityPaymentConfirmed && dispatchCurrentRequest() : pendingRequest ? dispatchCurrentRequest() : createRequest())} disabled={submitDisabled} className="mt-5 min-h-12 w-full rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">{submitLabel}</button>
        </div>
      </div>
      <div className="space-y-6" aria-label="申请状态与排队规则">{feedbackPanel}{paymentPanel}<RulesPanel /></div>
    </>
  )
}

function PaymentPanel({ request, busy, onRefresh }: { request: ResumeReviewRequest; busy: boolean; onRefresh: () => void }) {
  const paid = request.paymentStatus === 'PAID'
  const [now, setNow] = useState(() => Date.now())
  const expiresAt = paymentExpiryTimestamp(request.paymentExpiresAt)
  const expired = !paid && expiresAt !== null && now >= expiresAt

  useEffect(() => {
    if (paid || expiresAt === null || expired) return
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [paid, expiresAt, expired])

  if (paid) {
    return (
      <section className="rounded-[10px] border border-slate-200 bg-white px-3 py-6 text-center shadow-sm" aria-label="加急付款状态">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl font-bold text-emerald-700" aria-hidden="true">✓</div>
        <h2 className="mt-4 text-lg font-bold text-slate-950">支付成功</h2>
        <p className="mt-1 text-2xl font-bold text-slate-950">{formatCents(request.priceCents)}</p>
      </section>
    )
  }

  if (expired) {
    return (
      <section className="rounded-[10px] border border-slate-200 bg-white px-3 py-6 text-center shadow-sm" aria-label="加急付款状态">
        <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-500">付款码已过期</div>
        <p className="mt-4 text-2xl font-bold text-slate-950">{formatCents(request.priceCents)}</p>
        <button type="button" onClick={onRefresh} disabled={busy} className="mt-4 min-h-10 w-full rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 disabled:opacity-50">刷新付款状态</button>
      </section>
    )
  }

  return (
    <section className="rounded-[10px] border border-slate-200 bg-white px-3 py-4 text-center shadow-sm" aria-label="加急付款状态">
      {request.qrCodeDataUrl ? <img src={request.qrCodeDataUrl} alt="人工精修加急付款码" className="mx-auto h-52 w-52 bg-white" /> : <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-500">付款码生成中</div>}
      <h2 className="mt-4 text-sm font-semibold text-amber-700">等待支付</h2>
      <p className="mt-4 text-2xl font-bold text-slate-950">{formatCents(request.priceCents)}</p>
      {expiresAt !== null ? <p className="mt-1 text-xs tabular-nums text-slate-500">{formatPaymentRemaining(expiresAt - now)} 后过期</p> : null}
      <button type="button" onClick={onRefresh} disabled={busy} className="mt-4 text-sm font-semibold text-primary-700 disabled:opacity-50">我已付款，刷新状态</button>
    </section>
  )
}

function RulesPanel() {
  return (
    <aside className="rounded-[10px] border border-slate-200 bg-white shadow-sm"><div className="flex min-h-[81px] items-center border-b border-slate-200 px-5 py-4"><h2 className="text-lg font-bold text-slate-950">排队规则</h2></div><ul className="grid gap-3 px-5 py-5 pl-10 text-[13px] leading-6 text-slate-600"><li className="list-disc">正在精修的简历优先处理，不受后来申请影响。</li><li className="list-disc">插队按加急金额从高到低排列，同金额按付款时间排列。</li><li className="list-disc">普通排队按申请时间在队尾等待。</li><li className="list-disc">邮件送达后，PDF 才会出现在排队大厅中。</li></ul></aside>
  )
}
