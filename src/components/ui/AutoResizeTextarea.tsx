import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

interface AutoResizeTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number
}

function resizeTextarea(element: HTMLTextAreaElement, minRows: number) {
  const styles = window.getComputedStyle(element)
  const lineHeight = Number.parseFloat(styles.lineHeight) || 24
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0
  const borderTop = Number.parseFloat(styles.borderTopWidth) || 0
  const borderBottom = Number.parseFloat(styles.borderBottomWidth) || 0
  const minHeight = lineHeight * minRows + paddingTop + paddingBottom + borderTop + borderBottom

  element.style.height = 'auto'
  element.style.height = `${Math.max(element.scrollHeight, minHeight)}px`
}

export function AutoResizeTextarea({
  minRows = 4,
  className = '',
  onInput,
  value,
  ...props
}: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    if (textareaRef.current) {
      resizeTextarea(textareaRef.current, minRows)
    }
  }, [minRows, value])

  return (
    <textarea
      {...props}
      ref={textareaRef}
      rows={minRows}
      value={value}
      onInput={(event) => {
        resizeTextarea(event.currentTarget, minRows)
        onInput?.(event)
      }}
      className={className}
      style={{ overflow: 'hidden', ...props.style }}
    />
  )
}
