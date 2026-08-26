import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

export type ToastTone = 'success' | 'error' | 'warning' | 'info'

interface ToastOptions {
  message: string
  tone?: ToastTone
  duration?: number
}

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => number
  dismissToast: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE_STYLES: Record<ToastTone, { icon: string; ring: string }> = {
  success: { icon: 'text-emerald-600', ring: 'bg-emerald-50' },
  error: { icon: 'text-red-600', ring: 'bg-red-50' },
  warning: { icon: 'text-amber-600', ring: 'bg-amber-50' },
  info: { icon: 'text-primary-600', ring: 'bg-primary-50' },
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'success') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4 4L19 7" />
      </svg>
    )
  }
  if (tone === 'error') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-5 w-5">
        <path strokeLinecap="round" d="m7 7 10 10M17 7 7 17" />
      </svg>
    )
  }
  if (tone === 'warning') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.8 2.7 17a2 2 0 0 0 1.73 3h15.14a2 2 0 0 0 1.73-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8h.01M11 12h1v4h1m8-4a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextIdRef = useRef(1)
  const timersRef = useRef(new Map<number, number>())

  const dismissToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((options: ToastOptions) => {
    const id = nextIdRef.current
    nextIdRef.current += 1
    const tone = options.tone ?? 'info'
    setToasts((current) => [...current, {
      id,
      message: options.message,
      tone,
    }])

    const duration = options.duration ?? (tone === 'error' ? 5600 : 3600)
    if (duration > 0) {
      const timer = window.setTimeout(() => dismissToast(id), duration)
      timersRef.current.set(id, timer)
    }
    return id
  }, [dismissToast])

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current.clear()
  }, [])

  const contextValue = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 top-4 z-[120] flex flex-col items-end gap-2 sm:left-auto sm:right-5 sm:w-[360px]"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => {
          const styles = TONE_STYLES[toast.tone]
          return (
            <div
              key={toast.id}
              className="app-toast pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-[0_18px_50px_-20px_rgba(15,23,42,0.55)]"
              role={toast.tone === 'error' ? 'alert' : 'status'}
            >
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${styles.ring} ${styles.icon}`} aria-hidden="true">
                <ToastIcon tone={toast.tone} />
              </span>
              <p className="min-w-0 flex-1 py-1 text-sm font-medium leading-6 text-slate-800">
                {toast.message}
              </p>
              <button
                type="button"
                aria-label="关闭消息"
                onClick={() => dismissToast(toast.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

// Provider and hook stay together so every page uses the same notification surface.
// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast 必须在 ToastProvider 内使用')
  }
  return context
}
