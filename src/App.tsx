import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import HomePage from './pages/HomePage'
import ShowcasePage from './pages/ShowcasePage'
import SurveyPage from './pages/SurveyPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import EditorPage from './pages/EditorPage'
import ChromePreviewPage from './pages/ChromePreviewPage'
import FieldOptimizePage from './pages/FieldOptimizePage'
import AdminPage from './pages/AdminPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized } = useAuthStore()
  if (!initialized) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">加载中...</div>
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized, user } = useAuthStore()
  if (!initialized) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">加载中...</div>
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.admin) return <Navigate to="/dashboard" replace />
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
        <Route path="/showcases/:slug" element={<ShowcasePage />} />
        <Route path="/survey" element={<SurveyPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
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
            <ProtectedRoute>
              <FieldOptimizePage />
            </ProtectedRoute>
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
