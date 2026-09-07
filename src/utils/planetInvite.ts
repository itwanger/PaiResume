export function readPlanetInvite(search: string): string | null {
  const params = new URLSearchParams(search)
  const named = params.get('invite')
  const bare = [...params.entries()].find(([key, value]) => !value && /^VIP[A-Z0-9]+$/i.test(key))?.[0]
  const code = (named ?? bare)?.trim().toUpperCase()
  return code && /^VIP[A-Z0-9]{1,61}$/.test(code) ? code : null
}

export function buildPlanetInvitePost(publicOrigin: string, code: string): string {
  return `派简历（二哥编程星球专属，支持AI优化、人工精修、智能长一页、多种精美模板、前辈简历参考）：${publicOrigin.replace(/\/+$/, '')}/login?invite=${encodeURIComponent(code)}`
}
