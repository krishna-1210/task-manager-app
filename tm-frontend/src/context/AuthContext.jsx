/**
 * AuthContext — provides JWT token state, login, and logout to the whole app.
 *
 * Rules (Requirements 1.4, 2.5):
 * - Token lives in React state only — never written to localStorage or sessionStorage.
 * - AuthProvider wraps the entire app in main.jsx / App.jsx.
 * - useAuth() hook is the only way components access auth state.
 * - The Axios client (src/api/client.js) reads the token via a ref so interceptors
 *   always see the latest value without needing a re-render.
 */

import { createContext, useCallback, useContext, useRef, useState } from 'react'

/** @type {React.Context<AuthContextValue|null>} */
const AuthContext = createContext(null)

/**
 * @typedef {Object} AuthContextValue
 * @property {string|null} token - Current JWT access token, or null when logged out.
 * @property {(token: string) => void} login - Store a new JWT and mark user as authenticated.
 * @property {() => void} logout - Clear the JWT and mark user as logged out.
 * @property {React.MutableRefObject<string|null>} tokenRef - Ref mirror of token for
 *   use inside Axios interceptors (avoids stale closure issues).
 */

/**
 * AuthProvider — wraps the app and provides auth state.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)

  // Ref mirror so Axios interceptors always see the latest token value
  // without depending on a re-render cycle.
  const tokenRef = useRef(null)

  /** Store a fresh JWT after successful login. */
  const login = useCallback((newToken) => {
    tokenRef.current = newToken
    setToken(newToken)
  }, [])

  /** Clear the JWT on logout or 401 response. */
  const logout = useCallback(() => {
    tokenRef.current = null
    setToken(null)
  }, [])

  return (
    <AuthContext.Provider value={{ token, login, logout, tokenRef }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * useAuth — returns the current auth context.
 *
 * Must be called inside a component that is a descendant of AuthProvider.
 *
 * @returns {AuthContextValue}
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useAuth must be called inside <AuthProvider>.')
  }
  return ctx
}
