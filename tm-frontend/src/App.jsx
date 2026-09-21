/**
 * App — router setup and top-level layout.
 *
 * Protected routes and full AuthProvider wrapping added in Tasks 11.1 and 12.1.
 * Page components are stubs until Tasks 13.1 and 16.1.
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        {/* Default redirect — ProtectedRoute wrapper added in Task 12.1 */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
