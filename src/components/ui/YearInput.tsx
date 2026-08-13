import { useEffect, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { normalizeYearInput } from '../../utils/yearInput'

interface YearInputProps {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}

function isCompleteTypedValue(value: string): boolean {
  return /^\d{4}$/.test(value.trim())
}

export function YearInput({ value, onChange, ariaLabel }: YearInputProps) {
  const [draft, setDraft] = useState(value)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    const normalized = normalizeYearInput(value)
    setDraft(normalized ?? value)
    setInvalid(false)
  }, [value])

  const commit = (rawValue: string) => {
    const normalized = normalizeYearInput(rawValue)
    if (normalized === null) {
      setInvalid(true)
      return false
    }

    setInvalid(false)
    setDraft(normalized)
    if (normalized !== value) onChange(normalized)
    return true
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pastedValue = event.clipboardData.getData('text')
    if (normalizeYearInput(pastedValue) === null) return
    event.preventDefault()
    commit(pastedValue)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    commit(draft)
  }

  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        aria-invalid={invalid}
        value={draft}
        placeholder="YYYY"
        onChange={(event) => {
          const nextDraft = event.target.value
          setDraft(nextDraft)
          setInvalid(false)
          if (!nextDraft) {
            onChange('')
            return
          }
          if (isCompleteTypedValue(nextDraft)) commit(nextDraft)
        }}
        onPaste={handlePaste}
        onBlur={() => commit(draft)}
        onKeyDown={handleKeyDown}
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
          invalid
            ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
            : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
        }`}
      />
      {invalid ? <p className="mt-1 text-xs text-red-600" role="alert">请输入有效年份</p> : null}
    </div>
  )
}
