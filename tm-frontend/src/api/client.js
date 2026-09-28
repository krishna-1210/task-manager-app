/**
 * Axios instance for all API calls.
 *
 * Rules:
 * - This is the ONLY place an Axios instance is created.
 * - Base URL reads from VITE_API_BASE_URL env var (defaults to /api for Vite proxy).
 * - Components never import this file directly — only hooks do.
 * - Request interceptor: attaches Authorization: Bearer <token> when token present.
 * - Response interceptor: on 401, calls logout() and redirects to /login.
 *
 * Because the Axios instance is a module singleton created before React mounts,
 * auth dependencies (tokenRef, logout, navigate) are injected via initApiClient()
 * which is called once from App.jsx after AuthProvider is mounted.
 */

import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// ---------------------------------------------------------------------------
// Interceptor injection
// ---------------------------------------------------------------------------

/**
 * Injected auth dependencies — set once by initApiClient().
 * Using a plain object so interceptors always close over the same reference.
 */
const _auth = {
  /** @type {React.MutableRefObject<string|null>|null} */
  tokenRef: null,
  /** @type {(() => void)|null} */
  logout: null,
  /** @type {((path: string) => void)|null} */
  navigate: null,
}

/**
 * initApiClient — inject auth dependencies into the Axios interceptors.
 *
 * Call this once from App.jsx after AuthProvider has mounted:
 *   initApiClient(tokenRef, logout, navigate)
 *
 * @param {React.MutableRefObject<string|null>} tokenRef - Ref to the current JWT.
 * @param {() => void} logout - Clears the JWT and auth state.
 * @param {(path: string) => void} navigate - React Router navigate function.
 */
export function initApiClient(tokenRef, logout, navigate) {
  _auth.tokenRef = tokenRef
  _auth.logout = logout
  _auth.navigate = navigate
}

// ---------------------------------------------------------------------------
// Request interceptor — attach Bearer token
// ---------------------------------------------------------------------------

apiClient.interceptors.request.use(
  (config) => {
    const token = _auth.tokenRef?.current
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ---------------------------------------------------------------------------
// Response interceptor — handle 401 globally
// ---------------------------------------------------------------------------

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth state and redirect to login
      _auth.logout?.()
      _auth.navigate?.('/login')
    }
    return Promise.reject(error)
  },
)

export default apiClient
