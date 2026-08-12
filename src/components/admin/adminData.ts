import type {
  ResumeReviewAdminRequest,
  UserAdmin,
} from '../../api/admin'

export function getUserAdminLabel(user: UserAdmin): string {
  return user.email || user.nickname || `用户 #${user.id}`
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
