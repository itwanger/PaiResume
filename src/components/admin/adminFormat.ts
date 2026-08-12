/**
 * 管理后台共享格式化与错误提取工具。
 * 各视图/面板统一从这里取实现，避免每处各抄一份且行为不一致。
 */

export function formatAdminCents(value: number) {
  return `¥${(value / 100).toFixed(2)}`
}

function padTwo(value: number) {
  return String(value).padStart(2, '0')
}

/**
 * 统一后台时间展示为 `YYYY-MM-DD HH:mm:ss`（本地时区）。
 * 兼容服务端返回的 `2026-07-22 17:03:57` 与 ISO 两种格式；无法解析时原样返回。
 */
export function formatAdminDateTime(value: string | number | Date | null | undefined) {
  if (value === null || value === undefined || value === '') return '—'
  const date = value instanceof Date
    ? value
    : new Date(typeof value === 'string' && !value.includes('T') ? value.replace(' ', 'T') : value)
  if (Number.isNaN(date.getTime())) return String(value)
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`
    + ` ${padTwo(date.getHours())}:${padTwo(date.getMinutes())}:${padTwo(date.getSeconds())}`
}

/** 从异常中提取可展示消息；空白消息回退到 fallback，避免渲染空错误框。 */
export function getAdminErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}
