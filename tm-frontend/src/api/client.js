/**
 * Axios instance for all API calls.
 * Full interceptor implementation (Bearer token + 401 handling) added in Task 11.2.
 *
 * Rules:
 * - This is the ONLY place an Axios instance is created.
 * - Base URL reads from VITE_API_BASE_URL env var (defaults to /api for Vite proxy).
 * - Components never import this file directly — only hooks do.
 */

import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export default apiClient
