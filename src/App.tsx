import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import HomePage from './pages/HomePage'
import ShowcasePage from './pages/ShowcasePage'
import SurveyPage from './pages/SurveyPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import EditorPage from './pages/EditorPage'
import ResumeEditorEntryPage from './pages/ResumeEditorEntryPage'
import ChromePreviewPage from './pages/ChromePreviewPage'
import FieldOptimizePage from './pages/FieldOptimizePage'
import AdminPage from './pages/AdminPage'
import ExcellentResumesPage from './pages/ExcellentResumesPage'
import MembershipPage from './pages/MembershipPage'
import MarketplaceResumePage from './pages/MarketplaceResumePage'
import CreatorMarketplacePage from './pages/CreatorMarketplacePage'
import { AUTHENTICATED_HOME_PATH } from './config/site'
import {
  buildLoginPath,
  buildMembershipPath,
  getSafeInternalPath,
} from './utils/navigation'

function AuthenticationLoading() {
  return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">加载中...</div>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized } = useAuthStore()
  const location = useLocation()
  if (!initialized) {
    return <AuthenticationLoading />
  }
  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={buildLoginPath(returnTo)} replace />
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
  if (user?.membershipStatus !== 'ACTIVE') {
    return <Navigate to={buildMembershipPath(returnTo)} replace />
  }
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized, user } = useAuthStore()
  if (!initialized) {
    return <AuthenticationLoading />
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
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
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/excellent-resumes" element={<ExcellentResumesPage />} />
        <Route path="/marketplace/resumes/:slug" element={<MarketplaceResumePage />} />
        <Route
          path="/showcases/:slug"
          element={(
            <VipRoute>
              <ShowcasePage />
            </VipRoute>
          )}
        />
        <Route path="/survey" element={<SurveyPage />} />
        <Route
          path="/login"
          element={(
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          )}
        />
        <Route
          path="/register"
          element={(
            <GuestRoute>
              <RegisterPage />
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
    </BrowserRouter>
  )
}

export default App
