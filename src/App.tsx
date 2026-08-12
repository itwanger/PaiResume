import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import HomePage from './pages/HomePage'
import { RouteSeo } from './components/seo/RouteSeo'
import { AUTHENTICATED_HOME_PATH } from './config/site'
import {
  buildLoginPath,
  buildMembershipPath,
  getSafeInternalPath,
} from './utils/navigation'

const ShowcasePage = lazy(() => import('./pages/ShowcasePage'))
const SurveyPage = lazy(() => import('./pages/SurveyPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const EditorPage = lazy(() => import('./pages/EditorPage'))
const ResumeEditorEntryPage = lazy(() => import('./pages/ResumeEditorEntryPage'))
const ChromePreviewPage = lazy(() => import('./pages/ChromePreviewPage'))
const FieldOptimizePage = lazy(() => import('./pages/FieldOptimizePage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const ExcellentResumesPage = lazy(() => import('./pages/ExcellentResumesPage'))
const MembershipPage = lazy(() => import('./pages/MembershipPage'))
const MarketplaceResumePage = lazy(() => import('./pages/MarketplaceResumePage'))
const CreatorMarketplacePage = lazy(() => import('./pages/CreatorMarketplacePage'))
const PasswordResetPage = lazy(() => import('./pages/PasswordResetPage'))
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'))
const MyMaterialsPage = lazy(() => import('./pages/MyMaterialsPage'))
const LegalConsentPage = lazy(() => import('./pages/LegalConsentPage'))
const VipInviteClaimPage = lazy(() => import('./pages/VipInviteClaimPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PolicyPages').then((module) => ({ default: module.PrivacyPolicyPage })))
const TermsPage = lazy(() => import('./pages/PolicyPages').then((module) => ({ default: module.TermsPage })))
const RefundPolicyPage = lazy(() => import('./pages/PolicyPages').then((module) => ({ default: module.RefundPolicyPage })))
const CustomerServicePage = lazy(() => import('./pages/PolicyPages').then((module) => ({ default: module.CustomerServicePage })))

function AuthenticationLoading() {
  return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">加载中...</div>
}

function buildLegalConsentPath(location: ReturnType<typeof useLocation>) {
  const returnTo = `${location.pathname}${location.search}${location.hash}`
  return `/legal-consent?redirect=${encodeURIComponent(returnTo)}`
}

const LEGAL_CONSENT_EXEMPT_PATHS = new Set([
  '/legal-consent',
  '/settings/account',
  '/privacy',
  '/terms',
  '/refund-policy',
  '/customer-service',
])

function isLegalConsentExemptPath(pathname: string) {
  return LEGAL_CONSENT_EXEMPT_PATHS.has(pathname)
}

function LegalConsentGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized, user } = useAuthStore()
  const location = useLocation()

  if (isLegalConsentExemptPath(location.pathname)) {
    return <>{children}</>
  }
  if (!initialized) {
    return <AuthenticationLoading />
  }
  if (isAuthenticated && user?.legalConsentRequired) {
    return <Navigate to={buildLegalConsentPath(location)} replace />
  }
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized, user } = useAuthStore()
  const location = useLocation()
  if (!initialized) {
    return <AuthenticationLoading />
  }
  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={buildLoginPath(returnTo)} replace />
  }
  if (user?.legalConsentRequired && !isLegalConsentExemptPath(location.pathname)) {
    return <Navigate to={buildLegalConsentPath(location)} replace />
  }
  return <>{children}</>
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized } = useAuthStore()
  const location = useLocation()
  if (!initialized) {
    return <AuthenticationLoading />
  }
  if (isAuthenticated) {
    const returnTo = getSafeInternalPath(
      new URLSearchParams(location.search).get('redirect'),
      AUTHENTICATED_HOME_PATH,
    )
    return <Navigate to={returnTo} replace />
  }
  return <>{children}</>
}

function VipRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized, user } = useAuthStore()
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}${location.hash}`

  if (!initialized) {
    return <AuthenticationLoading />
  }
  if (!isAuthenticated) {
    return <Navigate to={buildLoginPath(returnTo)} replace />
  }
  if (user?.legalConsentRequired) {
    return <Navigate to={buildLegalConsentPath(location)} replace />
  }
  if (user?.membershipStatus !== 'ACTIVE') {
    return <Navigate to={buildMembershipPath(returnTo)} replace />
  }
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized, user } = useAuthStore()
  const location = useLocation()
  if (!initialized) {
    return <AuthenticationLoading />
  }
  if (!isAuthenticated) return <Navigate to={buildLoginPath('/admin')} replace />
  if (user?.legalConsentRequired) {
    return <Navigate to={buildLegalConsentPath(location)} replace />
  }
  if (!user?.admin) return <Navigate to={AUTHENTICATED_HOME_PATH} replace />
  return <>{children}</>
}

function App() {
  const restoreSession = useAuthStore((state) => state.restoreSession)

  useEffect(() => {
    void restoreSession()
  }, [restoreSession])

  return (
    <BrowserRouter>
      <RouteSeo />
      <LegalConsentGate>
        <Suspense fallback={<AuthenticationLoading />}>
          <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/excellent-resumes" element={<ExcellentResumesPage />} />
        <Route path="/marketplace/resumes/:slug" element={<MarketplaceResumePage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/refund-policy" element={<RefundPolicyPage />} />
        <Route path="/customer-service" element={<CustomerServicePage />} />
        <Route path="/vip/claim" element={<VipInviteClaimPage />} />
        <Route path="/showcases/:slug" element={<ShowcasePage />} />
        <Route path="/survey" element={<SurveyPage />} />
        <Route
          path="/login"
          element={(
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          )}
        />
        <Route path="/register" element={<Navigate to={buildLoginPath()} replace />} />
        <Route
          path="/forgot-password"
          element={(
            <GuestRoute>
              <PasswordResetPage />
            </GuestRoute>
          )}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/membership"
          element={
            <ProtectedRoute>
              <MembershipPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/legal-consent"
          element={
            <ProtectedRoute>
              <LegalConsentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/materials"
          element={
            <ProtectedRoute>
              <MyMaterialsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/account"
          element={
            <ProtectedRoute>
              <AccountSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/creator/marketplace"
          element={
            <ProtectedRoute>
              <CreatorMarketplacePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/editor"
          element={
            <ProtectedRoute>
              <ResumeEditorEntryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/editor/:id"
          element={
            <ProtectedRoute>
              <EditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/preview/:id"
          element={
            <ProtectedRoute>
              <ChromePreviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/editor/:id/modules/:moduleId/field-optimize"
          element={
            <VipRoute>
              <FieldOptimizePage />
            </VipRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </LegalConsentGate>
    </BrowserRouter>
  )
}

export default App
