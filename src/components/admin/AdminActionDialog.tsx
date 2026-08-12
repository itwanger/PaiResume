import {
  createContext,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

type DialogTone = 'default' | 'danger'

export interface AdminConfirmOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  tone?: DialogTone
}

export interface AdminPromptOptions extends AdminConfirmOptions {
  label: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
  maxLength?: number
  multiline?: boolean
  inputMode?: 'text' | 'numeric' | 'decimal'
  /** 提交前校验（收到 trim 后的值）；返回错误消息则保持弹窗打开并行内报错。 */
  validate?: (value: string) => string | null
}

interface ConfirmRequest extends AdminConfirmOptions {
  kind: 'confirm'
}

interface PromptRequest extends AdminPromptOptions {
  kind: 'prompt'
}

type DialogRequest = ConfirmRequest | PromptRequest

interface AdminActionDialogContextValue {
  confirm: (options: AdminConfirmOptions) => Promise<boolean>
  prompt: (options: AdminPromptOptions) => Promise<string | null>
}

const AdminActionDialogContext = createContext<AdminActionDialogContextValue | null>(null)

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
  ))
}

export function AdminActionDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null)
  const [value, setValue] = useState('')
  const [inputError, setInputError] = useState('')
  const resolverRef = useRef<((result: boolean | string | null) => void) | null>(null)
  const cancelResultRef = useRef<boolean | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()
  const inputId = useId()
  const inputErrorId = useId()

  const settle = useCallback((result: boolean | string | null) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setRequest(null)
    setInputError('')
    resolve?.(result)
  }, [])

  const open = useCallback((nextRequest: DialogRequest) => {
    resolverRef.current?.(cancelResultRef.current)
    cancelResultRef.current = nextRequest.kind === 'confirm' ? false : null
    setValue(nextRequest.kind === 'prompt' ? nextRequest.defaultValue ?? '' : '')
    setInputError('')
    setRequest(nextRequest)
    return new Promise<boolean | string | null>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const contextValue = useMemo<AdminActionDialogContextValue>(() => ({
    confirm: (options) => open({ kind: 'confirm', ...options }) as Promise<boolean>,
    prompt: (options) => open({ kind: 'prompt', ...options }) as Promise<string | null>,
  }), [open])

  useEffect(() => () => {
    resolverRef.current?.(cancelResultRef.current)
    resolverRef.current = null
  }, [])

  useEffect(() => {
    if (!request) return

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => {
      if (request.kind === 'prompt') {
        inputRef.current?.focus()
        inputRef.current?.select()
      } else {
        cancelButtonRef.current?.focus()
      }
    })

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      settle(request.kind === 'confirm' ? false : null)
    }
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
      previouslyFocused?.focus()
    }
  }, [request, settle])

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = getFocusableElements(dialogRef.current)
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!request) return
    if (request.kind === 'confirm') {
      settle(true)
      return
    }

    const normalizedValue = value.trim()
    if (request.required && !normalizedValue) {
      setInputError(`${request.label}不能为空`)
      inputRef.current?.focus()
      return
    }
    if (request.maxLength && normalizedValue.length > request.maxLength) {
      setInputError(`${request.label}不能超过 ${request.maxLength} 个字符`)
      inputRef.current?.focus()
      return
    }
    if (request.kind === 'prompt' && request.validate) {
      const validationError = request.validate(normalizedValue)
      if (validationError) {
        setInputError(validationError)
        inputRef.current?.focus()
        return
      }
    }
    settle(normalizedValue)
  }

  return (
    <AdminActionDialogContext.Provider value={contextValue}>
      {children}
      {request ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              settle(request.kind === 'confirm' ? false : null)
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onKeyDown={handleKeyDown}
            className="w-full max-w-lg overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_28px_80px_-28px_rgba(15,23,42,0.55)]"
          >
            <form onSubmit={handleSubmit}>
              <div className="flex items-start gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${
                  request.tone === 'danger'
                    ? 'bg-red-50 text-red-600'
                    : 'bg-primary-50 text-primary-700'
                }`} aria-hidden="true">
                  {request.tone === 'danger' ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.8 2.7 17a2 2 0 0 0 1.73 3h15.14a2 2 0 0 0 1.73-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8h.01M11 12h1v4h1m8-4a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-950">
                    {request.title}
                  </h2>
                  <p id={descriptionId} className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">
                    {request.description}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="关闭对话框"
                  onClick={() => settle(request.kind === 'confirm' ? false : null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              {request.kind === 'prompt' ? (
                <div className="px-5 py-5 sm:px-6">
                  <label htmlFor={inputId} className="text-sm font-semibold text-slate-800">
                    {request.label}{request.required ? <span className="ml-1 text-red-600">*</span> : null}
                  </label>
                  {request.multiline ? (
                    <textarea
                      ref={(element) => { inputRef.current = element }}
                      id={inputId}
                      value={value}
                      rows={5}
                      maxLength={request.maxLength}
                      placeholder={request.placeholder}
                      aria-invalid={Boolean(inputError)}
                      aria-describedby={inputError ? inputErrorId : undefined}
                      onChange={(event) => {
                        setValue(event.target.value)
                        setInputError('')
                      }}
                      className="mt-2 w-full resize-y rounded-[10px] border border-slate-300 px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                    />
                  ) : (
                    <input
                      ref={(element) => { inputRef.current = element }}
                      id={inputId}
                      value={value}
                      inputMode={request.inputMode}
                      maxLength={request.maxLength}
                      placeholder={request.placeholder}
                      aria-invalid={Boolean(inputError)}
                      aria-describedby={inputError ? inputErrorId : undefined}
                      onChange={(event) => {
                        setValue(event.target.value)
                        setInputError('')
                      }}
                      className="mt-2 h-11 w-full rounded-[10px] border border-slate-300 px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                    />
                  )}
                  <div className="mt-2 flex min-h-5 items-start justify-between gap-4 text-xs">
                    <span id={inputErrorId} role={inputError ? 'alert' : undefined} className="text-red-600">
                      {inputError}
                    </span>
                    {request.maxLength ? (
                      <span className="ml-auto shrink-0 text-slate-400">{value.trim().length}/{request.maxLength}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-2 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  ref={cancelButtonRef}
                  type="button"
                  onClick={() => settle(request.kind === 'confirm' ? false : null)}
                  className="min-h-11 rounded-[10px] border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                >
                  {request.cancelText ?? '取消'}
                </button>
                <button
                  type="submit"
                  className={`min-h-11 rounded-[10px] px-4 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-4 ${
                    request.tone === 'danger'
                      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-100'
                      : 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-100'
                  }`}
                >
                  {request.confirmText ?? '确认'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminActionDialogContext.Provider>
  )
}

// Provider and hook stay together so every admin action uses the same dialog queue.
// eslint-disable-next-line react-refresh/only-export-components
export function useAdminActionDialog() {
  const context = useContext(AdminActionDialogContext)
  if (!context) {
    throw new Error('useAdminActionDialog 必须在 AdminActionDialogProvider 内使用')
  }
  return context
}
