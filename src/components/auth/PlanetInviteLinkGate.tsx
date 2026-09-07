import { Navigate, useLocation } from 'react-router-dom'
import { readPlanetInvite } from '../../utils/planetInvite'

export function PlanetInviteLinkGate({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const code = ['/', '/login', '/vip/claim'].includes(location.pathname)
    ? readPlanetInvite(location.search)
    : null
  if (code) {
    // Only the share code enters the URL; claim and polling tokens stay in memory.
    const params = new URLSearchParams({ method: 'wechat' })
    const redirect = new URLSearchParams(location.search).get('redirect')
    if (redirect) params.set('redirect', redirect)
    return <Navigate to={`/login?${params}`} state={{ planetInviteCode: code }} replace />
  }
  return <>{children}</>
}
