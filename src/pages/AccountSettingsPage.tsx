import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { authApi, type WechatChallengeCreateData } from '../api/auth'
import { resumePhotoApi } from '../api/resumePhoto'
import { Header } from '../components/layout/Header'
import { useAuthStore } from '../store/authStore'
import {
  BASIC_INFO_PHOTO_MAX_SIZE_MB,
  inspectResumePhotoFile,
} from '../utils/resumePhoto'

type BindPhase = 'idle' | 'loading' | 'pending' | 'confirmed' | 'expired' | 'error'

const BIND_POLL_INTERVAL_MS = 1500
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d).{8,20}$/

function formatExpiry(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  return `${minutes}:${(safeSeconds % 60).toString().padStart(2, '0')}`
}

export default function AccountSettingsPage() {
  const { user, setCurrentUser } = useAuthStore()
  const [bindRun, setBindRun] = useState(0)
  const [bindPhase, setBindPhase] = useState<BindPhase>('idle')
  const [bindChallenge, setBindChallenge] = useState<WechatChallengeCreateData | null>(null)
  const [bindError, setBindError] = useState('')
  const [email, setEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [bindingEmail, setBindingEmail] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)
  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar ?? '')
  const [avatarPhotoId, setAvatarPhotoId] = useState<number | null>(user?.avatarPhotoId ?? null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const bindChallengeRequestRef = useRef<{
    key: number
    request: Promise<WechatChallengeCreateData>
  } | null>(null)

  useEffect(() => {
    setNickname(user?.nickname ?? '')
    setAvatarPreview(user?.avatar ?? '')
    setAvatarPhotoId(user?.avatarPhotoId ?? null)
    setRemoveAvatar(false)
  }, [user?.avatar, user?.avatarPhotoId, user?.id, user?.nickname])

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setProfileError('')
    setProfileSuccess('')
    let localPreview = ''
    try {
      const inspected = await inspectResumePhotoFile(file)
      localPreview = URL.createObjectURL(file)
      setAvatarPreview(localPreview)
      const { data: authorizeResponse } = await resumePhotoApi.requestUpload({
        fileName: file.name,
        ...inspected,
      })
      await resumePhotoApi.upload(authorizeResponse.data, file)
      const { data: completeResponse } = await resumePhotoApi.completeUpload(
        authorizeResponse.data.photoNo,
      )
      const asset = completeResponse.data
      setAvatarPreview(asset.accessUrl)
      setAvatarPhotoId(asset.id)
      setRemoveAvatar(false)
    } catch (avatarError: unknown) {
      setAvatarPreview(user?.avatar ?? '')
      setAvatarPhotoId(user?.avatarPhotoId ?? null)
      setProfileError(avatarError instanceof Error ? avatarError.message : '头像上传失败，请稍后重试')
    } finally {
      if (localPreview) URL.revokeObjectURL(localPreview)
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const handleRemoveAvatar = () => {
    setAvatarPreview('')
    setAvatarPhotoId(null)
    setRemoveAvatar(true)
    setProfileError('')
    setProfileSuccess('')
  }

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault()
    const normalizedNickname = nickname.trim()
    if (!normalizedNickname || normalizedNickname.length > 64) {
      setProfileError('昵称请控制在1-64个字符')
      return
    }
    setSavingProfile(true)
    setProfileError('')
    setProfileSuccess('')
    try {
      const { data: response } = await authApi.updateProfile({
        nickname: normalizedNickname,
        avatarPhotoId,
        removeAvatar,
      })
      setCurrentUser(response.data)
      setProfileSuccess('已保存')
      setRemoveAvatar(false)
    } catch (saveError: unknown) {
      setProfileError(saveError instanceof Error ? saveError.message : '保存失败，请稍后重试')
    } finally {
      setSavingProfile(false)
    }
  }

  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendSeconds])

  useEffect(() => {
    if (bindRun === 0 || user?.paicongmingLinked) return

    let cancelled = false
    let pollTimer: number | null = null

    const stopPolling = () => {
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer)
        pollTimer = null
      }
    }

    const fail = (message: string, phase: BindPhase = 'error') => {
      if (cancelled) return
      stopPolling()
      setBindPhase(phase)
      setBindError(message)
    }

    const poll = async (challenge: WechatChallengeCreateData): Promise<void> => {
      if (cancelled) return
      try {
        const { data: response } = await authApi.getWechatBindChallenge(
          challenge.challengeId,
          challenge.pollToken,
        )
        if (cancelled) return
        const status = response.data
        if (status.challengeId !== challenge.challengeId) {
          fail('绑定状态校验失败，请重新生成二维码')
          return
        }
        setBindChallenge((current) => current ? { ...current, expiresIn: status.expiresIn } : current)
        if (status.status === 'PENDING' && status.expiresIn > 0) {
          pollTimer = window.setTimeout(() => void poll(challenge), BIND_POLL_INTERVAL_MS)
          return
        }
        if (status.status === 'CONFIRMED') {
          const { data: exchangeResponse } = await authApi.exchangeWechatBindChallenge(
            challenge.challengeId,
            challenge.pollToken,
          )
          if (cancelled) return
          setCurrentUser(exchangeResponse.data)
          setBindPhase('confirmed')
          setBindError('')
          stopPolling()
          return
        }
        if (status.status === 'EXPIRED') {
          fail('二维码已过期，请重新生成', 'expired')
          return
        }
        fail('该二维码已经使用，请重新生成')
      } catch (bindFailure: unknown) {
        fail(bindFailure instanceof Error ? bindFailure.message : '绑定失败，请稍后重试')
      }
    }

    const start = async () => {
      setBindPhase('loading')
      setBindChallenge(null)
      setBindError('')
      if (bindChallengeRequestRef.current?.key !== bindRun) {
        bindChallengeRequestRef.current = {
          key: bindRun,
          request: authApi.createWechatBindChallenge()
            .then(({ data: response }) => response.data),
        }
      }
      try {
        const challenge = await bindChallengeRequestRef.current.request
        if (cancelled) return
        setBindChallenge(challenge)
        setBindPhase('pending')
        pollTimer = window.setTimeout(() => void poll(challenge), BIND_POLL_INTERVAL_MS)
      } catch (bindFailure: unknown) {
        fail(bindFailure instanceof Error ? bindFailure.message : '暂时无法生成绑定二维码，请稍后重试')
      }
    }

    void start()
    return () => {
      cancelled = true
      stopPolling()
    }
  }, [bindRun, setCurrentUser, user?.paicongmingLinked])

  const validateEmail = () => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setEmailError('请输入正确的邮箱地址')
      return null
    }
    return normalizedEmail
  }

  const handleSendEmailCode = async () => {
    const normalizedEmail = validateEmail()
    if (!normalizedEmail) return
    setSendingCode(true)
    setEmailError('')
    try {
      await authApi.requestEmailBindingCode(normalizedEmail)
      setEmail(normalizedEmail)
      setResendSeconds(60)
    } catch (sendError: unknown) {
      setEmailError(sendError instanceof Error ? sendError.message : '验证码发送失败，请稍后重试')
    } finally {
      setSendingCode(false)
    }
  }

  const handleBindEmail = async (event: FormEvent) => {
    event.preventDefault()
    const normalizedEmail = validateEmail()
    if (!normalizedEmail) return
    if (!/^\d{6}$/.test(verificationCode)) {
      setEmailError('请输入6位验证码')
      return
    }
    if (!PASSWORD_PATTERN.test(emailPassword)) {
      setEmailError('密码需8-20位，包含字母和数字')
      return
    }
    setBindingEmail(true)
    setEmailError('')
    try {
      const { data: response } = await authApi.bindEmail({
        email: normalizedEmail,
        verificationCode,
        password: emailPassword,
      })
      setCurrentUser(response.data)
      setVerificationCode('')
      setEmailPassword('')
    } catch (bindEmailError: unknown) {
      setEmailError(bindEmailError instanceof Error ? bindEmailError.message : '邮箱绑定失败，请稍后重试')
    } finally {
      setBindingEmail(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-950">账号设置</h1>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6" aria-labelledby="profile-title">
          <h2 id="profile-title" className="text-lg font-semibold text-slate-950">个人资料</h2>
          <form onSubmit={handleSaveProfile} className="mt-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary-50 text-2xl font-semibold text-primary-700">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="当前头像" className="h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden="true">{(nickname.trim() || '用').slice(0, 1)}</span>
                  )}
                </div>
                <div className="flex flex-col items-start gap-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(event) => void handleAvatarChange(event)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploadingAvatar}
                    onClick={() => avatarInputRef.current?.click()}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-primary-300 hover:text-primary-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    {uploadingAvatar ? '上传中...' : '更换头像'}
                  </button>
                  {avatarPreview ? (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="text-sm text-slate-500 hover:text-red-600"
                    >
                      移除头像
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <label htmlFor="account-nickname" className="block text-sm font-medium text-slate-700">昵称</label>
                <input
                  id="account-nickname"
                  value={nickname}
                  onChange={(event) => {
                    setNickname(event.target.value)
                    setProfileError('')
                    setProfileSuccess('')
                  }}
                  maxLength={64}
                  required
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
                <p className="mt-2 text-xs text-slate-500">PNG/JPG，不超过 {BASIC_INFO_PHOTO_MAX_SIZE_MB}MB</p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-4">
              <button
                type="submit"
                disabled={savingProfile || uploadingAvatar}
                className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-wait disabled:opacity-60"
              >
                {savingProfile ? '保存中...' : '保存资料'}
              </button>
              <span aria-live="polite" className={`text-sm ${profileError ? 'text-red-600' : 'text-emerald-700'}`}>
                {profileError || profileSuccess}
              </span>
            </div>
          </form>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6" aria-labelledby="wechat-binding-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="wechat-binding-title" className="text-lg font-semibold text-slate-950">绑定微信</h2>
            {user?.paicongmingLinked ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">已绑定</span>
            ) : null}
          </div>

          {!user?.paicongmingLinked ? (
            <div className="mt-5">
              {bindChallenge ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="h-44 w-44 shrink-0 border border-slate-200 bg-white p-2">
                    <img
                      src={bindChallenge.qrImageDataUrl}
                      alt="派聪明服务号账号绑定二维码"
                      className={`h-full w-full object-contain ${bindPhase === 'expired' || bindPhase === 'error' ? 'opacity-25' : ''}`}
                    />
                  </div>
                  <div className="text-sm leading-6 text-slate-600" aria-live="polite">
                    {bindPhase === 'pending' ? <p>等待扫码 · 剩余 {formatExpiry(bindChallenge.expiresIn)}</p> : null}
                    {bindError ? <p role="alert" className="text-red-600">{bindError}</p> : null}
                    {(bindPhase === 'expired' || bindPhase === 'error') ? (
                      <button
                        type="button"
                        onClick={() => setBindRun((value) => value + 1)}
                        className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-primary-300 hover:text-primary-700"
                      >
                        重新生成二维码
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <>
                  {bindError ? <p role="alert" className="mb-3 text-sm text-red-600">{bindError}</p> : null}
                  <button
                    type="button"
                    onClick={() => setBindRun((value) => value + 1)}
                    disabled={bindPhase === 'loading'}
                    className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    {bindPhase === 'loading' ? '正在生成二维码...' : '绑定微信'}
                  </button>
                </>
              )}
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6" aria-labelledby="email-binding-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="email-binding-title" className="text-lg font-semibold text-slate-950">绑定邮箱</h2>
            {user?.emailLoginEnabled ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">已绑定</span>
            ) : null}
          </div>

          {user?.emailLoginEnabled ? (
            <p className="mt-4 text-slate-700">{user.email}</p>
          ) : (
            <form onSubmit={handleBindEmail} className="mt-5 space-y-4">
              {emailError ? <p role="alert" className="text-sm text-red-600">{emailError}</p> : null}
              <div>
                <label htmlFor="binding-email" className="block text-sm font-medium text-slate-700">邮箱</label>
                <div className="mt-2 flex gap-3">
                  <input
                    id="binding-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    maxLength={128}
                    required
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendEmailCode()}
                    disabled={sendingCode || resendSeconds > 0}
                    className="shrink-0 rounded-lg border border-primary-200 px-4 py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingCode ? '发送中...' : resendSeconds > 0 ? `${resendSeconds}s` : '发送验证码'}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="binding-code" className="block text-sm font-medium text-slate-700">验证码</label>
                <input
                  id="binding-code"
                  inputMode="numeric"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div>
                <label htmlFor="binding-password" className="block text-sm font-medium text-slate-700">登录密码</label>
                <input
                  id="binding-password"
                  type="password"
                  value={emailPassword}
                  onChange={(event) => setEmailPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={20}
                  required
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
                <p className="mt-2 text-xs text-slate-500">8-20位，包含字母和数字</p>
              </div>
              <button
                type="submit"
                disabled={bindingEmail}
                className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-wait disabled:opacity-60"
              >
                {bindingEmail ? '正在绑定...' : '绑定邮箱'}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  )
}
