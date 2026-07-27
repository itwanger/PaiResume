import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi, type WechatChallengeCreateData } from '../api/auth'
import { ApiError } from '../api/client'
import {
  membershipApi,
  type VipInviteClaimResult,
  type VipInviteRedemption,
} from '../api/membership'
import { LegalConsentCheckbox } from '../components/auth/LegalConsentCheckbox'
import { LogoMark } from '../components/branding/LogoMark'
import { AUTHENTICATED_HOME_PATH } from '../config/site'
import { useAuthStore } from '../store/authStore'

const CLAIM_STORAGE_KEY = 'pai-resume:vip-invite-claim'
const QR_POLL_INTERVAL_MS = 1_500
const MAX_INVITE_CODE_LENGTH = 64
const LEGAL_CONSENT_REQUIRED_CODE = 1123
const VIP_INVITE_CLAIM_INVALID_CODE = 7020
const VIP_INVITE_CLAIM_NOT_BOUND_CODE = 7021
const VIP_INVITE_CLAIM_FORBIDDEN_CODE = 7022

type QrPhase = 'idle' | 'loading' | 'pending' | 'exchanging' | 'expired' | 'consumed' | 'error'
type CompletionPhase = 'idle' | 'loading' | 'error'

interface StoredClaim {
  claimToken: string
  expiresAt: number
  challenge?: {
    challengeId: string
    pollToken: string
    qrImageDataUrl: string
    expiresAt: number
  }
}

interface InitialClaimState {
  claim: StoredClaim | null
  expired: boolean
}

function readStoredClaim(): InitialClaimState {
  if (typeof window === 'undefined') {
    return { claim: null, expired: false }
  }

  let value: string | null
  try {
    value = window.sessionStorage.getItem(CLAIM_STORAGE_KEY)
  } catch {
    return { claim: null, expired: false }
  }
  if (!value) {
    return { claim: null, expired: false }
  }

  try {
    const parsed = JSON.parse(value) as Partial<StoredClaim>
    if (
      typeof parsed.claimToken !== 'string'
      || !parsed.claimToken
      || typeof parsed.expiresAt !== 'number'
      || !Number.isFinite(parsed.expiresAt)
    ) {
      clearStoredClaim()
      return { claim: null, expired: false }
    }
    if (parsed.expiresAt <= Date.now()) {
      clearStoredClaim()
      return { claim: null, expired: true }
    }
    const storedChallenge = parsed.challenge
    const challenge = (
      storedChallenge
      && typeof storedChallenge.challengeId === 'string'
      && /^[A-Za-z0-9_-]{43}$/.test(storedChallenge.challengeId)
      && typeof storedChallenge.pollToken === 'string'
      && /^[A-Za-z0-9_-]{43}$/.test(storedChallenge.pollToken)
      && typeof storedChallenge.qrImageDataUrl === 'string'
      && storedChallenge.qrImageDataUrl.startsWith('data:image/')
      && storedChallenge.qrImageDataUrl.length <= 512_000
      && typeof storedChallenge.expiresAt === 'number'
      && Number.isFinite(storedChallenge.expiresAt)
      && storedChallenge.expiresAt > Date.now()
    ) ? storedChallenge : undefined

    const claim: StoredClaim = {
      claimToken: parsed.claimToken,
      expiresAt: parsed.expiresAt,
      challenge,
    }
    if (!challenge && storedChallenge) {
      writeStoredClaim(claim)
    }
    return { claim, expired: false }
  } catch {
    clearStoredClaim()
    return { claim: null, expired: false }
  }
}

function writeStoredClaim(claim: StoredClaim) {
  window.sessionStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(claim))
}

function clearStoredClaim() {
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(CLAIM_STORAGE_KEY)
    } catch {
      // The short-lived claim will expire server-side if browser storage is unavailable.
    }
  }
}

function formatExpiry(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function formatMembershipExpiry(value: string | null | undefined) {
  if (!value) {
    return ''
  }
  const date = new Date(value.includes(' ') ? value.replace(' ', 'T') : value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

function getApiErrorCode(error: unknown) {
  return error instanceof ApiError ? error.code : null
}

function LoadingSpinner({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-75"
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function VipInviteClaimPage() {
  const initialClaimStateRef = useRef<InitialClaimState | null>(null)
  if (initialClaimStateRef.current === null) {
    initialClaimStateRef.current = readStoredClaim()
  }
  const initialClaimState = initialClaimStateRef.current

  const { initialized, isAuthenticated, user } = useAuthStore()
  const completeWechatLogin = useAuthStore((state) => state.completeWechatLogin)
  const refreshUser = useAuthStore((state) => state.refreshUser)

  const [inviteCode, setInviteCode] = useState('')
  const [claim, setClaim] = useState<StoredClaim | null>(initialClaimState.claim)
  const [creatingClaim, setCreatingClaim] = useState(false)
  const [agreementsAccepted, setAgreementsAccepted] = useState(false)
  const [qrPhase, setQrPhase] = useState<QrPhase>('idle')
  const [qrDisplay, setQrDisplay] = useState<WechatChallengeCreateData | null>(null)
  const [qrRefreshKey, setQrRefreshKey] = useState(0)
  const [completionPhase, setCompletionPhase] = useState<CompletionPhase>('idle')
  const [completionAttempt, setCompletionAttempt] = useState(0)
  const [redemption, setRedemption] = useState<VipInviteRedemption | null>(null)
  const [alreadyVip, setAlreadyVip] = useState(false)
  const [error, setError] = useState(
    initialClaimState.expired
      ? '上次领取凭证已过期，请重新输入知识星球邀请码。'
      : '',
  )
  const [now, setNow] = useState(Date.now())
  const challengeRequestRef = useRef<{
    key: string
    request: Promise<WechatChallengeCreateData>
  } | null>(null)
  const completionRequestRef = useRef<{
    token: string
    request: Promise<VipInviteClaimResult>
  } | null>(null)

  const claimExpiresIn = claim
    ? Math.max(0, Math.ceil((claim.expiresAt - now) / 1_000))
    : 0

  useEffect(() => {
    if (!claim) {
      return
    }
    setNow(Date.now())
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [claim])

  useEffect(() => {
    if (!claim || claim.expiresAt > now || completionPhase === 'loading') {
      return
    }
    clearStoredClaim()
    setClaim(null)
    setQrDisplay(null)
    setQrPhase('idle')
    setCompletionPhase('idle')
    setError('本次领取凭证已过期，请重新输入知识星球邀请码。')
  }, [claim, completionPhase, now])

  useEffect(() => {
    if (!initialized || !isAuthenticated || !user || !claim || redemption) {
      return
    }

    if (user.legalConsentRequired) {
      return
    }

    if (user.membershipStatus === 'ACTIVE') {
      clearStoredClaim()
      setClaim(null)
      setAlreadyVip(true)
      setError('')
      return
    }

    let cancelled = false
    setCompletionPhase('loading')
    setError('')

    if (completionRequestRef.current?.token !== claim.claimToken) {
      completionRequestRef.current = {
        token: claim.claimToken,
        request: membershipApi.completeInviteClaim(claim.claimToken)
          .then(({ data: response }) => response.data),
      }
    }

    void completionRequestRef.current.request
      .then((result) => {
        if (cancelled) {
          return
        }

        if (result.status === 'REDEEMED' && result.redemption) {
          clearStoredClaim()
          setClaim(null)
          setRedemption(result.redemption)
          setCompletionPhase('idle')
          setError('')
          void refreshUser().catch(() => {
            // The confirmed redemption remains authoritative; session restore can refresh later.
          })
          return
        }

        const message = result.message || 'VIP 领取尚未完成，请稍后重试。'
        clearStoredClaim()
        setClaim(null)
        setCompletionPhase('error')
        setError(message)
      })
      .catch((completionError: unknown) => {
        if (cancelled) {
          return
        }
        completionRequestRef.current = null
        const errorCode = getApiErrorCode(completionError)
        if (errorCode === LEGAL_CONSENT_REQUIRED_CODE) {
          setCompletionPhase('idle')
          return
        }
        if (errorCode === VIP_INVITE_CLAIM_NOT_BOUND_CODE) {
          clearStoredClaim()
          setClaim(null)
          setQrDisplay(null)
          setQrPhase('idle')
          setCompletionPhase('error')
          setError('扫码登录已经成功，但本次领取凭证没有绑定成功。请重新输入原邀请码，系统会直接为当前已登录账号兑换，无需再次扫码。')
          return
        }
        if (
          errorCode === VIP_INVITE_CLAIM_INVALID_CODE
          || errorCode === VIP_INVITE_CLAIM_FORBIDDEN_CODE
        ) {
          clearStoredClaim()
          setClaim(null)
          setQrDisplay(null)
          setQrPhase('idle')
          setCompletionPhase('error')
          setError(
            errorCode === VIP_INVITE_CLAIM_FORBIDDEN_CODE
              ? '这份领取凭证不属于当前账号，已为你清理。请重新输入邀请码。'
              : '这份领取凭证无效或已经过期，请重新输入邀请码。',
          )
          return
        }
        const message = getErrorMessage(completionError, 'VIP 领取失败，请稍后重试。')
        setCompletionPhase('error')
        setError(message)
      })

    return () => {
      cancelled = true
    }
  }, [
    claim,
    completionAttempt,
    initialized,
    isAuthenticated,
    redemption,
    refreshUser,
    user,
  ])

  useEffect(() => {
    if (
      !initialized
      || isAuthenticated
      || !claim
      || redemption
      || !agreementsAccepted
      || claim.expiresAt <= Date.now()
    ) {
      return
    }

    let cancelled = false
    let pollTimer: number | null = null

    const stopPolling = () => {
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer)
        pollTimer = null
      }
    }

    const failQr = (message: string) => {
      if (cancelled) {
        return
      }
      stopPolling()
      setQrPhase('error')
      setError(message)
    }

    const pollChallenge = async (challenge: WechatChallengeCreateData): Promise<void> => {
      if (cancelled) {
        return
      }

      try {
        const { data: response } = await authApi.getWechatChallenge(
          challenge.challengeId,
          challenge.pollToken,
        )
        if (cancelled) {
          return
        }

        const status = response.data
        if (status.challengeId !== challenge.challengeId) {
          failQr('扫码状态校验失败，请刷新二维码后重试。')
          return
        }
        setQrDisplay((current) => current ? { ...current, expiresIn: status.expiresIn } : current)

        if (status.status === 'PENDING' && status.expiresIn > 0) {
          pollTimer = window.setTimeout(() => {
            void pollChallenge(challenge)
          }, QR_POLL_INTERVAL_MS)
          return
        }

        if (status.status === 'CONFIRMED') {
          setQrPhase('exchanging')
          setError('')
          try {
            await completeWechatLogin(
              challenge.challengeId,
              challenge.pollToken,
              agreementsAccepted,
            )
          } catch {
            failQr('扫码已确认，但登录未完成。二维码可能已过期，请刷新后重试。')
          }
          return
        }

        if (status.status === 'CONSUMED') {
          setQrPhase('consumed')
          setError('该二维码已经使用，请刷新后重新扫码。')
          return
        }

        setQrPhase('expired')
        setError('派聪明登录二维码已过期，邀请码领取凭证仍然有效，请刷新二维码。')
      } catch {
        failQr('网络连接异常，请刷新二维码后重试。')
      }
    }

    const startQrLogin = async () => {
      setQrPhase('loading')
      setQrDisplay(null)
      setError('')
      const requestKey = `${claim.claimToken}:${qrRefreshKey}`

      if (claim.challenge && claim.challenge.expiresAt > Date.now()) {
        const recoveredChallenge: WechatChallengeCreateData = {
          challengeId: claim.challenge.challengeId,
          pollToken: claim.challenge.pollToken,
          qrImageDataUrl: claim.challenge.qrImageDataUrl,
          expiresIn: Math.max(
            0,
            Math.ceil((claim.challenge.expiresAt - Date.now()) / 1_000),
          ),
        }
        setQrDisplay(recoveredChallenge)
        setQrPhase('pending')
        pollTimer = window.setTimeout(() => {
          void pollChallenge(recoveredChallenge)
        }, QR_POLL_INTERVAL_MS)
        return
      }

      if (challengeRequestRef.current?.key !== requestKey) {
        challengeRequestRef.current = {
          key: requestKey,
          request: authApi.createWechatChallenge({ claimToken: claim.claimToken })
            .then(({ data: response }) => response.data),
        }
      }

      try {
        const challenge = await challengeRequestRef.current.request
        if (cancelled) {
          return
        }
        try {
          writeStoredClaim({
            ...claim,
            challenge: {
              challengeId: challenge.challengeId,
              pollToken: challenge.pollToken,
              qrImageDataUrl: challenge.qrImageDataUrl,
              expiresAt: Date.now() + Math.max(0, challenge.expiresIn) * 1_000,
            },
          })
        } catch {
          // The claim token is already stored. The backend permits a safe QR
          // replacement if this larger display payload cannot be persisted.
        }
        setQrDisplay(challenge)
        setQrPhase('pending')
        pollTimer = window.setTimeout(() => {
          void pollChallenge(challenge)
        }, QR_POLL_INTERVAL_MS)
      } catch (challengeError: unknown) {
        const errorCode = getApiErrorCode(challengeError)
        const message = getErrorMessage(
          challengeError,
          '派聪明登录二维码生成失败，请稍后重试。',
        )
        if (
          errorCode === VIP_INVITE_CLAIM_INVALID_CODE
          || errorCode === VIP_INVITE_CLAIM_FORBIDDEN_CODE
        ) {
          clearStoredClaim()
          setClaim(null)
        }
        failQr(message)
      }
    }

    void startQrLogin()

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [
    agreementsAccepted,
    claim,
    completeWechatLogin,
    initialized,
    isAuthenticated,
    qrRefreshKey,
    redemption,
  ])

  const submitInviteCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedCode = inviteCode.trim().toUpperCase()

    if (!normalizedCode) {
      setError('请输入知识星球发放的 VIP 邀请码。')
      return
    }
    if (normalizedCode.length > MAX_INVITE_CODE_LENGTH) {
      setError('邀请码格式不正确，请核对后重新输入。')
      return
    }

    setCreatingClaim(true)
    setAlreadyVip(false)
    setRedemption(null)
    setError('')
    try {
      if (isAuthenticated) {
        const { data: response } = await membershipApi.redeemInvite(normalizedCode)
        setRedemption(response.data)
        setInviteCode('')
        void refreshUser().catch(() => {
          // The confirmed redemption remains authoritative; session restore can refresh later.
        })
        return
      }

      const { data: response } = await membershipApi.createInviteClaim(normalizedCode)
      const created = response.data
      const expiresAt = Date.now() + Math.max(0, created.expiresIn) * 1_000

      if (!created.claimToken || expiresAt <= Date.now()) {
        throw new Error('邀请码领取凭证无效或已经过期，请重新输入。')
      }

      const nextClaim: StoredClaim = {
        claimToken: created.claimToken,
        expiresAt,
      }
      try {
        writeStoredClaim(nextClaim)
      } catch {
        throw new Error('当前浏览器无法保存领取进度，请关闭无痕模式或允许会话存储后重试。')
      }
      completionRequestRef.current = null
      challengeRequestRef.current = null
      setClaim(nextClaim)
      setInviteCode('')
      setNow(Date.now())
      setQrRefreshKey(0)
      setAgreementsAccepted(false)
      setQrPhase('idle')
      setCompletionPhase('idle')
      setCompletionAttempt(0)
    } catch (claimError: unknown) {
      setError(getErrorMessage(
        claimError,
        '邀请码校验失败，请核对邀请码或稍后再试。',
      ))
    } finally {
      setCreatingClaim(false)
    }
  }

  const restartClaim = () => {
    clearStoredClaim()
    completionRequestRef.current = null
    challengeRequestRef.current = null
    setClaim(null)
    setQrDisplay(null)
    setAgreementsAccepted(false)
    setQrPhase('idle')
    setCompletionPhase('idle')
    setCompletionAttempt(0)
    setError('')
  }

  const refreshQr = () => {
    challengeRequestRef.current = null
    if (claim) {
      const claimWithoutChallenge: StoredClaim = {
        claimToken: claim.claimToken,
        expiresAt: claim.expiresAt,
      }
      try {
        writeStoredClaim(claimWithoutChallenge)
      } catch {
        // Continue in memory; the server-side claim remains short-lived.
      }
      setClaim(claimWithoutChallenge)
    }
    setQrRefreshKey((value) => value + 1)
  }

  const retryCompletion = () => {
    completionRequestRef.current = null
    setCompletionPhase('idle')
    setError('')
    setCompletionAttempt((value) => value + 1)
  }

  const handleAgreementsAcceptedChange = (checked: boolean) => {
    setAgreementsAccepted(checked)
    if (!checked) {
      setQrDisplay(null)
      setQrPhase('idle')
    }
  }

  const qrUnavailable = qrPhase === 'expired' || qrPhase === 'consumed' || qrPhase === 'error'
  const membershipExpiry = formatMembershipExpiry(
    redemption?.membershipExpiresAt ?? user?.membershipExpiresAt,
  )

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-lg">
        <Link
          to="/"
          className="mb-7 flex items-center justify-center gap-3"
          aria-label="返回派简历首页"
        >
          <LogoMark className="h-11 w-11 shrink-0" />
          <span className="text-2xl font-bold tracking-tight text-slate-950">派简历</span>
        </Link>

        <main className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-950">领取 VIP 会员</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              输入知识星球邀请码；未登录用户还需使用「派聪明」扫码确认账号。
            </p>
          </div>

          {error ? (
            <div
              className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {redemption ? (
            <section className="mt-7 text-center" aria-labelledby="claim-success-title">
              <div
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700"
                aria-hidden="true"
              >
                ✓
              </div>
              <h2 id="claim-success-title" className="mt-4 text-xl font-bold text-slate-950">
                VIP 领取成功
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600" role="status">
                权益已绑定到当前派简历账号
                {membershipExpiry ? `，有效期至 ${membershipExpiry}` : ''}。
              </p>
              <Link
                to={AUTHENTICATED_HOME_PATH}
                className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-primary-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                进入我的简历
              </Link>
            </section>
          ) : alreadyVip || (initialized && isAuthenticated && user?.membershipStatus === 'ACTIVE' && !claim) ? (
            <section className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center" aria-labelledby="already-vip-title">
              <h2 id="already-vip-title" className="text-lg font-semibold text-emerald-950">
                当前账号已经是 VIP
              </h2>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                无需再次兑换，本页不会消耗新的邀请码
                {membershipExpiry ? `。当前权益有效期至 ${membershipExpiry}` : ''}。
              </p>
              <Link
                to={AUTHENTICATED_HOME_PATH}
                className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-emerald-700 px-5 py-2.5 font-medium text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
              >
                返回工作台
              </Link>
            </section>
          ) : !claim ? (
            <form
              onSubmit={submitInviteCode}
              className="mt-7"
              aria-busy={creatingClaim}
            >
              <label htmlFor="vip-invite-code" className="block text-sm font-semibold text-slate-800">
                VIP 邀请码
              </label>
              <p id="vip-invite-help" className="mt-1 text-xs leading-5 text-slate-500">
                邀请码仅在最终领取成功时消耗；仅输入邀请码不会占用名额。
              </p>
              <input
                id="vip-invite-code"
                type="text"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                maxLength={MAX_INVITE_CODE_LENGTH}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby="vip-invite-help"
                placeholder="请输入知识星球邀请码"
                className="mt-3 w-full rounded-lg border border-slate-300 px-4 py-3 text-center font-mono text-base tracking-wider text-slate-950 outline-none transition-colors placeholder:font-sans placeholder:tracking-normal focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              />
              <button
                type="submit"
                disabled={creatingClaim || !initialized}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-3 font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingClaim ? <LoadingSpinner className="h-5 w-5" /> : null}
                {creatingClaim ? '正在校验邀请码…' : isAuthenticated ? '确认领取 VIP' : '下一步：派聪明扫码'}
              </button>
            </form>
          ) : isAuthenticated ? (
            <section className="mt-7 text-center" aria-live="polite" aria-busy={completionPhase === 'loading'}>
              {completionPhase === 'loading' ? (
                <>
                  <LoadingSpinner className="mx-auto h-8 w-8 text-primary-600" />
                  <h2 className="mt-4 text-lg font-semibold text-slate-950">正在开通 VIP，请勿关闭页面</h2>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-slate-950">领取尚未完成</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    领取凭证剩余 {formatExpiry(claimExpiresIn)}，可以重试，失败不会消耗邀请码。
                  </p>
                  <button
                    type="button"
                    onClick={retryCompletion}
                    className="mt-4 w-full rounded-lg bg-primary-600 px-5 py-2.5 font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  >
                    重试领取
                  </button>
                </>
              )}
            </section>
          ) : (
            <section className="mt-7" aria-labelledby="claim-qr-title">
              <div className="text-center">
                <h2 id="claim-qr-title" className="text-lg font-semibold text-slate-950">
                  使用派聪明扫码确认
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  这个微信以前绑定过派简历时会登录原微信账号；从未绑定过时会在本次确认协议后创建新的微信账号。
                </p>
              </div>

              <LegalConsentCheckbox
                checked={agreementsAccepted}
                onChange={handleAgreementsAcceptedChange}
                disabled={qrPhase === 'exchanging'}
                className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              />

              <div className="mt-5 flex flex-col items-center">
                <div
                  className="relative flex h-56 w-56 items-center justify-center overflow-hidden border border-slate-200 bg-slate-50 p-2"
                  aria-busy={qrPhase === 'loading' || qrPhase === 'exchanging'}
                >
                  {qrDisplay ? (
                    <img
                      src={qrDisplay.qrImageDataUrl}
                      alt="派聪明服务号 VIP 邀请码领取二维码"
                      className={`h-full w-full object-contain ${qrUnavailable ? 'opacity-20' : ''}`}
                    />
                  ) : qrPhase === 'idle' ? (
                    <div className="px-5 text-center text-sm leading-6 text-slate-500">
                      请先阅读并勾选上方协议，随后生成领取二维码
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <LoadingSpinner />
                      <span className="text-sm">正在加载二维码…</span>
                    </div>
                  )}

                  {qrPhase === 'exchanging' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/95 px-4 text-primary-700">
                      <LoadingSpinner />
                      <span className="text-sm font-medium">已确认，正在登录…</span>
                    </div>
                  ) : null}

                  {qrUnavailable ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 px-5 text-center">
                      <p className="text-sm leading-6 text-slate-600">
                        {qrPhase === 'expired' ? '二维码已过期' : '二维码暂不可用'}
                      </p>
                      <button
                        type="button"
                        onClick={refreshQr}
                        className="border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                      >
                        刷新二维码
                      </button>
                    </div>
                  ) : null}
                </div>

                {qrPhase === 'pending' && qrDisplay ? (
                  <div className="mt-3 text-center text-sm text-slate-500" aria-live="polite">
                    <span>
                      等待扫码 · 二维码剩余 {formatExpiry(qrDisplay.expiresIn)}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
                <strong className="font-semibold">正在手机上打开？</strong>
                可以长按二维码识别；也可以截图后，在微信“扫一扫”中从相册选择。
              </div>
              <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                领取凭证剩余 {formatExpiry(claimExpiresIn)}；刷新页面后可在当前浏览器继续。
              </p>
              <button
                type="button"
                onClick={restartClaim}
                className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              >
                换一个邀请码
              </button>
            </section>
          )}

          <div className="mt-7 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-500">
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
              <Link to="/terms" className="hover:text-primary-700">服务条款</Link>
              <Link to="/privacy" className="hover:text-primary-700">隐私政策</Link>
              <Link to="/customer-service" className="hover:text-primary-700">遇到问题</Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
