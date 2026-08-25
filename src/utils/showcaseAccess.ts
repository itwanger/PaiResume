import type { ShowcaseAccessType } from '../api/showcase'

const ACCESS_LABELS: Record<ShowcaseAccessType, string> = {
  PUBLIC: '公开免费',
  LOGIN: '登录查看',
  PAID: '付费查看',
}

export function getShowcaseAccessLabel(accessType: ShowcaseAccessType): string {
  return ACCESS_LABELS[accessType]
}

export function isShowcaseRestricted(accessType: ShowcaseAccessType): boolean {
  return accessType !== 'PUBLIC'
}
