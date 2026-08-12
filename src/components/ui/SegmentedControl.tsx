import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface SegmentedControlOption<T extends string | number | boolean> {
  value: T
  label: ReactNode
  ariaLabel?: string
  disabled?: boolean
}

interface SegmentedControlProps<T extends string | number | boolean> {
  ariaLabel: string
  value: T
  options: readonly SegmentedControlOption<T>[]
  onChange: (value: T) => void
  label?: ReactNode
  size?: 'sm' | 'md'
  fullWidth?: boolean
  className?: string
  semantic?: 'group' | 'tabs'
  getOptionId?: (option: SegmentedControlOption<T>) => string | undefined
  getOptionControls?: (option: SegmentedControlOption<T>) => string | undefined
}

export function SegmentedControl<T extends string | number | boolean>({
  ariaLabel,
  value,
  options,
  onChange,
  label,
  size = 'sm',
  fullWidth = false,
  className = '',
  semantic = 'group',
  getOptionId,
  getOptionControls,
}: SegmentedControlProps<T>) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const sizeClassName = size === 'md'
    ? 'min-h-10 px-4 py-2 text-sm'
    : 'min-h-9 px-3 py-2 text-xs'

  const selectByKeyboard = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const enabledIndexes = options
      .map((option, index) => option.disabled ? -1 : index)
      .filter((index) => index >= 0)

    if (!enabledIndexes.length) return

    const position = enabledIndexes.indexOf(currentIndex)
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = enabledIndexes[(position + 1) % enabledIndexes.length]
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = enabledIndexes[(position - 1 + enabledIndexes.length) % enabledIndexes.length]
    } else if (event.key === 'Home') {
      nextIndex = enabledIndexes[0]
    } else if (event.key === 'End') {
      nextIndex = enabledIndexes[enabledIndexes.length - 1]
    }

    if (nextIndex === undefined) return
    event.preventDefault()
    onChange(options[nextIndex].value)
    buttonRefs.current[nextIndex]?.focus()
  }

  return (
    <div role={semantic === 'tabs' ? 'tablist' : 'group'} aria-label={ariaLabel} className={`flex min-w-0 flex-wrap items-center gap-2 ${className}`}>
      {label ? <span className="shrink-0 text-xs font-medium text-slate-500">{label}</span> : null}
      <div className={`inline-flex max-w-full items-stretch divide-x divide-slate-200 overflow-x-auto overflow-y-hidden rounded-lg border border-slate-200 bg-white ${fullWidth ? 'w-full' : ''}`}>
        {options.map((option, index) => {
          const isActive = value === option.value
          return (
            <button
              key={String(option.value)}
              ref={(element) => { buttonRefs.current[index] = element }}
              type="button"
              id={getOptionId?.(option)}
              role={semantic === 'tabs' ? 'tab' : undefined}
              aria-label={option.ariaLabel}
              aria-pressed={semantic === 'group' ? isActive : undefined}
              aria-selected={semantic === 'tabs' ? isActive : undefined}
              aria-controls={getOptionControls?.(option)}
              disabled={option.disabled}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => selectByKeyboard(event, index)}
              className={`segmented-control__option relative whitespace-nowrap font-medium transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 ${sizeClassName} ${fullWidth ? 'min-w-0 flex-1' : ''} ${
                isActive
                  ? 'bg-primary-50 text-primary-700 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary-600'
                  : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
