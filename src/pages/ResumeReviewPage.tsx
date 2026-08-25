import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  resumeReviewApi,
  type ResumeReviewQueueItem,
  type ResumeReviewRequest,
} from '../api/resumeReview'
import { Header } from '../components/layout/Header'
import { ResumeReviewApplicationPanel } from '../components/review/ResumeReviewApplicationPanel'
import { useAuthStore } from '../store/authStore'

function formatCents(value: number) {
  const amount = value / 100
  return `¥${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)}`
}

function publicCodeFromRequestNo(requestNo: string | null | undefined) {
  if (!requestNo?.trim()) return ''
  const normalized = requestNo.trim().toUpperCase()
  return `精修单 · ${normalized.slice(-8)}`
}

function ReviewThumbnail({ code, compact = false }: { code: string; compact?: boolean }) {
  const palette = [
    ['bg-blue-600', 'bg-blue-500'],
    ['bg-sky-400', 'bg-blue-400'],
    ['bg-rose-500', 'bg-rose-400'],
    ['bg-emerald-500', 'bg-teal-400'],
    ['bg-violet-500', 'bg-indigo-400'],
  ]
  const seed = Array.from(code).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const colors = palette[seed % palette.length]

  return (
    <div className={`border border-slate-200 bg-white shadow-[0_4px_10px_-6px_rgba(15,23,42,.2)] ${compact ? 'h-[82px] w-full p-2' : 'h-[100px] w-[150px] p-2.5'}`} aria-hidden="true">
      <div className="flex items-center gap-2">
        <span className={`h-6 w-6 shrink-0 rounded-full ${colors[0]}`} />
        <span className="min-w-0 flex-1">
          <span className={`block h-1.5 w-3/4 rounded-full ${colors[1]}`} />
          <span className="mt-1 block h-1 w-1/2 rounded-full bg-slate-200" />
        </span>
      </div>
      <span className="mt-2 block h-1.5 w-full rounded-full bg-slate-100" />
      <span className="mt-1.5 block h-1.5 w-[86%] rounded-full bg-slate-100" />
      <span className="mt-1.5 block h-1.5 w-[92%] rounded-full bg-slate-100" />
      <span className="mt-1.5 block h-1.5 w-[64%] rounded-full bg-slate-100" />
    </div>
  )
}

function QueuePill({ label, value, priority = false }: { label: string; value: number; priority?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-600">
      {label}
      <b className={`text-base tabular-nums ${priority ? 'text-amber-700' : 'text-slate-900'}`}>{value}</b>
    </span>
  )
}

function QueueTicket({ item, mine, duplicate = false }: { item: ResumeReviewQueueItem; mine: boolean; duplicate?: boolean }) {
  return (
    <li aria-hidden={duplicate || undefined} className={`review-ticket relative w-44 shrink-0 border bg-white p-3.5 ${item.priority ? 'border-amber-400' : mine ? 'border-primary-500' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-bold tabular-nums ${item.priority ? 'text-amber-700' : 'text-slate-400'}`}>#{item.position}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${mine ? 'bg-primary-600 text-white' : item.priority ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
          {mine ? '我的' : item.priority ? '加急' : '排队中'}
        </span>
      </div>
      <div className="relative mt-2.5">
        {item.priority ? <span className="absolute -right-1 -top-3 z-10 text-xl" aria-hidden="true">♛</span> : null}
        <ReviewThumbnail code={item.publicCode} compact />
      </div>
      <p className="mt-2.5 truncate text-[13px] font-semibold text-slate-900"><span className="font-normal text-slate-400">匿名 · </span>{item.publicCode.replace('精修单 · ', '')}</p>
      <p className={`mt-2 text-xs font-semibold ${item.priority ? 'text-amber-700' : 'text-slate-400'}`}>
        {item.priority ? `加急 ${formatCents(item.priorityFeeCents)}` : '会员排队'}
      </p>
    </li>
  )
}

export default function ResumeReviewPage() {
  const { initialized, isAuthenticated, user } = useAuthStore()
  const [queue, setQueue] = useState<ResumeReviewQueueItem[]>([])
  const [currentRequest, setCurrentRequest] = useState<ResumeReviewRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadQueue = useCallback(async (silent = false) => {
    try {
      const { data: response } = await resumeReviewApi.publicQueue()
      setQueue(response.data)
      setError('')
    } catch (loadError: unknown) {
      if (!silent) setError(loadError instanceof Error ? loadError.message : '人工精修队伍加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCurrentRequest = useCallback(async () => {
    if (!isAuthenticated) {
      setCurrentRequest(null)
      return
    }
    try {
      const { data: response } = await resumeReviewApi.current()
      setCurrentRequest(response.data)
    } catch {
      setCurrentRequest(null)
    }
  }, [isAuthenticated])

  useEffect(() => { void loadQueue() }, [loadQueue])
  useEffect(() => { if (initialized) void loadCurrentRequest() }, [initialized, loadCurrentRequest])

  const waiting = useMemo(() => queue.filter((item) => item.queueStatus === 'WAITING'), [queue])
  const priorityCount = useMemo(() => waiting.filter((item) => item.priority).length, [waiting])
  const myPublicCode = publicCodeFromRequestNo(currentRequest?.requestNo)
  const myQueueItem = myPublicCode ? queue.find((item) => item.publicCode === myPublicCode) ?? null : null
  const isMember = user?.membershipStatus === 'ACTIVE'

  const myPositionLabel = !initialized || !isAuthenticated || !isMember ? '–' : myQueueItem ? `#${myQueueItem.position}` : '–'
  const myPositionHint = !initialized
    ? '正在读取账号状态'
    : !isAuthenticated
      ? '登录后查看你的位置'
      : !isMember
        ? '开通会员后可以排队'
        : currentRequest && !myQueueItem
          ? '邮件送达后自动入队'
          : myQueueItem?.queueStatus === 'IN_PROGRESS'
            ? '你的简历正在精修'
            : myQueueItem
              ? myQueueItem.priority ? '已按加急金额排序' : '已进入会员队列'
              : '提交后自动入队'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-6 sm:px-6">
        <section className="review-hall relative overflow-hidden rounded-[10px] border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-7 sm:py-6" aria-labelledby="review-hall-title">
          <div className="relative flex flex-wrap items-center gap-3 sm:gap-x-6">
            <h1 id="review-hall-title" className="flex items-center gap-3 text-xl font-bold tracking-tight text-slate-950 sm:text-[23px]">
              简历大厅
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"><span className="review-live-dot h-1.5 w-1.5 rounded-full bg-emerald-600" />实时</span>
            </h1>
            <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto" aria-label="队列统计">
              <QueuePill label="排队中" value={waiting.length} />
              <QueuePill label="插队中" value={priorityCount} priority />
            </div>
          </div>

          {error ? <div role="alert" className="relative mt-5 border-l-4 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <div className="relative mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_150px] lg:items-start">
            <div className="relative min-w-0">
              {loading ? (
                <div className="py-12 text-center text-sm text-slate-500" role="status">正在读取队伍…</div>
              ) : waiting.length === 0 ? (
                <div className="flex min-h-36 items-center justify-center border border-dashed border-slate-200 bg-slate-50/70 text-sm text-slate-500">等待队列暂时空着</div>
              ) : (
                <div className="review-marquee overflow-hidden">
                  <div className={`review-marquee-track flex gap-3 ${waiting.length > 1 ? 'is-moving' : ''}`}>
                    <ol className="review-marquee-cycle flex shrink-0 gap-3">
                      {waiting.map((item) => <QueueTicket key={item.publicCode} item={item} mine={item.publicCode === myPublicCode} />)}
                    </ol>
                    {waiting.length > 1 ? <ol className="review-marquee-cycle flex shrink-0 gap-3" aria-hidden="true">
                      {waiting.map((item) => <QueueTicket key={`copy-${item.publicCode}`} item={item} mine={item.publicCode === myPublicCode} duplicate />)}
                    </ol> : null}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 lg:block lg:text-center">
              <div className="flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-full border-2 border-primary-600 bg-white lg:mx-auto"><span className="flex flex-col items-center"><b className="text-2xl font-extrabold leading-none text-primary-600">{myPositionLabel}</b><span className="mt-1 text-[11px] text-slate-500">你的位置</span></span></div>
              <p className="text-xs leading-5 text-slate-500 lg:mt-3">{myPositionHint}</p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" aria-label="申请人工精修">
          <ResumeReviewApplicationPanel
            initialized={initialized}
            isAuthenticated={isAuthenticated}
            isMember={isMember}
            userId={user?.id}
            accountEmail={user?.email}
            currentRequest={currentRequest}
            onRequestChange={setCurrentRequest}
            onQueueRefresh={() => void loadQueue(true)}
          />
        </section>
      </main>

      <style>{`
        .review-hall::before { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, #f0f5ff 0%, #fff 26%); opacity: .5; pointer-events: none; }
        .review-live-dot { animation: review-pulse 1.6s ease-in-out infinite; }
        .review-marquee { margin: -6px 0 -12px; padding: 6px 0 12px; -webkit-mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent); mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent); }
        .review-marquee-track { width: calc(200% + 12px); }
        .review-marquee-cycle { width: calc(50% - 6px); }
        .review-marquee-track:not(.is-moving) { width: 100%; }
        .review-marquee-track:not(.is-moving) .review-marquee-cycle { width: 100%; }
        .review-marquee-track.is-moving { animation: review-scroll 46s linear infinite; }
        .review-marquee:hover .review-marquee-track { animation-play-state: paused; }
        .review-ticket { transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease; }
        .review-ticket:hover { transform: translateY(-4px); box-shadow: 0 12px 24px -14px rgba(15,23,42,.25); }
        @keyframes review-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        @keyframes review-scroll { from { transform: translateX(0); } to { transform: translateX(calc(-50% - 6px)); } }
        @media (prefers-reduced-motion: reduce) { .review-live-dot, .review-marquee-track.is-moving { animation: none; } }
      `}</style>
    </div>
  )
}
