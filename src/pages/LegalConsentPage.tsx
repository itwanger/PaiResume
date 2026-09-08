import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { AUTHENTICATED_HOME_PATH } from '../config/site'
import { getSafeInternalPath } from '../utils/navigation'

// Preserve old bookmarks and in-flight login redirects without a separate consent step.
export default function LegalConsentPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const returnTo = getSafeInternalPath(searchParams.get('redirect'), AUTHENTICATED_HOME_PATH)
  const destination = returnTo.split(/[?#]/)[0] === '/legal-consent' ? AUTHENTICATED_HOME_PATH : returnTo
  return <Navigate to={destination} state={location.state} replace />
}
