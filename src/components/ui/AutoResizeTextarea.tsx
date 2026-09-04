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
  element.style.height = `${Math.max(element.scrollHeight + borderTop + borderBottom, minHeight)}px`
}

export function AutoResizeTextarea({
  minRows,
  className = '',
  onInput,
  rows,
  value,
  ...props
}: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const effectiveMinRows = typeof rows === 'number' && rows > 0
    ? rows
    : (minRows ?? 2)

  useLayoutEffect(() => {
    if (textareaRef.current?.getClientRects().length) {
      resizeTextarea(textareaRef.current, effectiveMinRows)
    }
  }, [effectiveMinRows, value])

  useLayoutEffect(() => {
    const element = textareaRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    let previousWidth = -1
    const observer = new ResizeObserver(() => {
      const width = element.getBoundingClientRect().width
      if (width === previousWidth) return
      previousWidth = width
      // Recalculate when a collapsed field becomes visible or its container changes width.
      // Ignore height-only changes so resizing the textarea does not create an observer loop.
      if (width > 0) resizeTextarea(element, effectiveMinRows)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [effectiveMinRows])

  return (
    <textarea
      {...props}
      ref={textareaRef}
      rows={effectiveMinRows}
      value={value}
      onInput={(event) => {
        resizeTextarea(event.currentTarget, effectiveMinRows)
        onInput?.(event)
      }}
      className={className}
      style={{ overflow: 'hidden', ...props.style }}
    />
  )
}
