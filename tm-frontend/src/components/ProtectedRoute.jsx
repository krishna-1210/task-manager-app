/**
 * ProtectedRoute — redirects unauthenticated users to /login.
 *
 * Reads the JWT token from AuthContext via useAuth(). If no token is present
 * the user is redirected to /login with `replace` so the protected URL is not
 * added to the browser history stack (Requirement 2.1).
 *
 * Usage in App.jsx:
 *   <Route path="/dashboard" element={
 *     <ProtectedRoute><DashboardPage /></ProtectedRoute>
 *   } />
 *
 * @param {{ children: React.ReactNode }} props
 */

import { Navigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'

/**
 * ProtectedRoute — renders children when authenticated, redirects to /login otherwise.
 *
 * @param {{ children: React.ReactNode }} props
 * @returns {React.ReactElement}
 */
function ProtectedRoute({ children }) {
  const { token } = useAuth()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
