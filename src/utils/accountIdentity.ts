export interface AccountIdentity {
  id: number
  nickname?: string | null
  email?: string | null
}

const GENERIC_NICKNAMES = new Set(['用户', '微信用户'])

export function getAccountDisplayName(user: AccountIdentity): string {
  const nickname = user.nickname?.trim()

  if (nickname && !GENERIC_NICKNAMES.has(nickname)) {
    return nickname
  }

  const email = user.email?.trim()

  if (email) {
    const separatorIndex = email.indexOf('@')
    const username = (separatorIndex > 0 ? email.slice(0, separatorIndex) : email).trim()

    if (username) {
      return username
    }
  }

  return `${nickname || '用户'} #${user.id}`
}
