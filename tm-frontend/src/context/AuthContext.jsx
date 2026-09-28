/**
 * AuthContext — provides JWT token state, login, logout, and loginWithCredentials.
 *
 * Rules (Requirements 1.4, 2.5):
 * - Token lives in React state only — never written to localStorage or sessionStorage.
 * - AuthProvider wraps the entire app in main.jsx / App.jsx.
 * - useAuth() hook is the only way components access auth state.
 * - The Axios client (src/api/client.js) reads the token via a ref so interceptors
 *   always see the latest value without needing a re-render.
 * - loginWithCredentials() is the single place that calls POST /auth/login so
 *   components never import apiClient directly.
 */

import { createContext, useCallback, useContext, useRef, useState } from 'react'

import apiClient from '../api/client'

/** @type {React.Context<AuthContextValue|null>} */
const AuthContext = createContext(null)

/**
 * @typedef {Object} AuthContextValue
 * @property {string|null} token - Current JWT access token, or null when logged out.
 * @property {(token: string) => void} login - Store a new JWT and mark user as authenticated.
 * @property {() => void} logout - Clear the JWT and mark user as logged out.
 * @property {React.MutableRefObject<string|null>} tokenRef - Ref mirror of token for
 *   use inside Axios interceptors (avoids stale closure issues).
 * @property {(username: string, password: string) => Promise<void>} loginWithCredentials -
 *   POST /auth/login, store token on success. Throws on 401/429/network error.
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

  /**
   * POST /auth/login with form-encoded credentials.
   * Stores the returned JWT on success.
   * Throws the Axios error on failure so LoginPage can inspect status.
   *
   * @param {string} username
   * @param {string} password
   */
  const loginWithCredentials = useCallback(async (username, password) => {
    const params = new URLSearchParams()
    params.append('username', username)
    params.append('password', password)

    const response = await apiClient.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    const newToken = response.data.access_token
    tokenRef.current = newToken
    setToken(newToken)
  }, [])

  return (
    <AuthContext.Provider value={{ token, login, logout, tokenRef, loginWithCredentials }}>
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
