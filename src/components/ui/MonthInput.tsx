import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { formatMonthInput, normalizeMonthInput } from '../../utils/monthInput'

interface MonthInputProps {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  allowPresent?: boolean
}

function isCompleteTypedValue(value: string, allowPresent: boolean): boolean {
  const trimmed = value.trim()
  if (allowPresent && ['至今', '现在', '当前', 'present', 'current'].includes(trimmed.toLocaleLowerCase())) return true
  return /^\d{4}[-./]\d{2}$/.test(trimmed)
    || /^\d{6}$/.test(trimmed)
    || /^\d{4}\s*年\s*\d{1,2}\s*月$/.test(trimmed)
}

export function MonthInput({ value, onChange, ariaLabel, allowPresent = false }: MonthInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(() => formatMonthInput(value))
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    setDraft(formatMonthInput(value))
    setInvalid(false)
  }, [value])

  const commit = (rawValue: string) => {
    const normalized = normalizeMonthInput(rawValue, allowPresent)
    if (normalized === null) {
      setInvalid(true)
      return false
    }

    setInvalid(false)
    setDraft(formatMonthInput(normalized))
    if (normalized !== value) onChange(normalized)
    return true
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pastedValue = event.clipboardData.getData('text')
    if (normalizeMonthInput(pastedValue, allowPresent) === null) return
    event.preventDefault()
    commit(pastedValue)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    commit(draft)
  }

  const openPicker = () => {
    const picker = pickerRef.current
    if (!picker) return

    try {
      picker.showPicker()
    } catch {
      picker.focus()
      picker.click()
    }
  }

  const pickerValue = /^\d{4}-\d{2}$/.test(value) ? value : ''

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            inputMode="numeric"
            aria-label={ariaLabel}
            aria-invalid={invalid}
            value={draft}
            placeholder="YYYY-MM"
            onChange={(event) => {
              const nextDraft = event.target.value
              setDraft(nextDraft)
              setInvalid(false)
              if (!nextDraft) {
                onChange('')
                return
              }

              const normalized = normalizeMonthInput(nextDraft, allowPresent)
              if (normalized !== null && isCompleteTypedValue(nextDraft, allowPresent)) commit(nextDraft)
            }}
            onPaste={handlePaste}
            onBlur={() => commit(draft)}
            onKeyDown={handleKeyDown}
            className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm outline-none focus:ring-2 ${
              invalid
                ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
            }`}
          />
          <input
            ref={pickerRef}
            type="month"
            value={pickerValue}
            onChange={(event) => commit(event.target.value)}
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none absolute h-px w-px opacity-0"
          />
          <button
            type="button"
            aria-label={`选择${ariaLabel}`}
            onClick={openPicker}
            className="absolute inset-y-0 right-1.5 flex w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 3v3m10-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
            </svg>
          </button>
        </div>
        {allowPresent ? (
          <button
            type="button"
            aria-pressed={value === '至今'}
            onClick={() => commit(value === '至今' ? '' : '至今')}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              value === '至今'
                ? 'border-primary-600 bg-primary-600 text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-primary-300 hover:text-primary-700'
            }`}
          >
            至今
          </button>
        ) : null}
      </div>
      {invalid ? <p className="mt-1 text-xs text-red-600" role="alert">请输入有效月份</p> : null}
    </div>
  )
}
