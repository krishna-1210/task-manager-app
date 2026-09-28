/**
 * App — router setup, AuthProvider, and top-level layout.
 *
 * AuthProvider wraps all routes so every component can call useAuth().
 * initApiClient() is called once here to wire the Axios interceptors to the
 * auth context (token ref + logout + navigate).
 *
 * Protected route wrapper (ProtectedRoute) added in Task 12.1.
 */

import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'

import { initApiClient } from './api/client'
import { AuthProvider, useAuth } from './context/AuthContext'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'

/**
 * ApiClientInit — mounts inside AuthProvider so it has access to auth context.
 * Calls initApiClient() once to inject tokenRef, logout, and navigate into Axios.
 */
function ApiClientInit() {
  const { tokenRef, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    initApiClient(tokenRef, logout, navigate)
    // Only run once on mount — dependencies are stable refs/callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ApiClientInit />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* ProtectedRoute wrapper added in Task 12.1 */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
