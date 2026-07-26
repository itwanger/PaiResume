import type {
  ResumeReviewAdminRequest,
  UserAdmin,
} from '../../api/admin'

export function getUserAdminLabel(user: UserAdmin): string {
  return user.email || user.nickname || `用户 #${user.id}`
}

export function filterAdminUsers(
  users: UserAdmin[],
  keyword: string,
  membershipFilter: '' | 'ACTIVE' | 'FREE',
): UserAdmin[] {
  const normalizedKeyword = keyword.trim().toLowerCase()
  return users.filter((user) => {
    const matchesKeyword = !normalizedKeyword
      || (user.email ?? '').toLowerCase().includes(normalizedKeyword)
      || (user.nickname ?? '').toLowerCase().includes(normalizedKeyword)
      || String(user.id).includes(normalizedKeyword)
    const matchesMembership = !membershipFilter
      || user.membershipStatus === membershipFilter
    return matchesKeyword && matchesMembership
  })
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
