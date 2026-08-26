import type {
  ResumeReviewAdminRequest,
  UserAdmin,
} from '../../api/admin'

export function getUserAdminLabel(user: UserAdmin): string {
  const nickname = user.nickname?.trim()
  if (nickname && nickname !== '微信用户') return nickname
  if (user.email) return user.email
  if (user.wechatIdentifier) return `微信账号 ${user.wechatIdentifier}`
  return `用户 #${user.id}`
}

export function resumeReviewNeedsAdminAction(
  request: ResumeReviewAdminRequest,
): boolean {
  return request.requestStatus === 'EMAILED'
    || request.requestStatus === 'ACCEPTED'
    || request.requestStatus === 'REFUND_REQUIRED'
    || (request.requestStatus === 'EMAIL_PENDING'
      && (request.mailStatus === 'FAILED' || request.mailStatus === null))
}
