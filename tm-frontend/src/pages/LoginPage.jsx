/**
 * LoginPage — /login route.
 *
 * Renders a username/password form with client-side validation.
 * On valid submit: calls loginWithCredentials() from useAuth (which POSTs to
 * /auth/login with application/x-www-form-urlencoded), then navigates to /dashboard.
 *
 * Error handling (Requirements 1.2, 1.5, 1.6):
 * - Empty/whitespace fields: field-level error, no network request.
 * - 401 response: "Invalid username or password" below the form.
 * - 429 response: lockout duration message, submit button disabled.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import styles from './LoginPage.module.css'

/** Route: /login */
function LoginPage() {
  const { loginWithCredentials } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Field-level validation errors
  const [usernameError, setUsernameError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Form-level error shown below the form (401, 429, network)
  const [formError, setFormError] = useState('')

  // True while the login request is in flight
  const [isSubmitting, setIsSubmitting] = useState(false)

  // True when account is locked out (429) — disables the submit button
  const [isLocked, setIsLocked] = useState(false)

  /**
   * Validate fields client-side.
   * Returns true when all fields are valid, false otherwise.
   */
  function validate() {
    let isValid = true

    if (!username.trim()) {
      setUsernameError('Username is required.')
      isValid = false
    } else {
      setUsernameError('')
    }

    if (!password.trim()) {
      setPasswordError('Password is required.')
      isValid = false
    } else {
      setPasswordError('')
    }

    return isValid
  }

  /** Handle form submission. */
  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    if (!validate()) return

    setIsSubmitting(true)
    try {
      await loginWithCredentials(username, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const status = err.response?.status

      if (status === 401) {
        setFormError('Invalid username or password.')
      } else if (status === 429) {
        const detail =
          err.response?.data?.detail ?? 'Too many failed attempts. Please try again later.'
        setFormError(detail)
        setIsLocked(true)
      } else {
        setFormError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const isDisabled = isSubmitting || isLocked

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sign in</h1>

        {formError && (
          <div className={styles.formError} role="alert">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="username" className={styles.label}>
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={[styles.input, usernameError ? styles.inputError : ''].join(' ')}
              aria-describedby={usernameError ? 'username-error' : undefined}
              aria-invalid={!!usernameError}
              disabled={isDisabled}
            />
            {usernameError && (
              <p id="username-error" className={styles.fieldError} role="alert">
                {usernameError}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={[styles.input, passwordError ? styles.inputError : ''].join(' ')}
              aria-describedby={passwordError ? 'password-error' : undefined}
              aria-invalid={!!passwordError}
              disabled={isDisabled}
            />
            {passwordError && (
              <p id="password-error" className={styles.fieldError} role="alert">
                {passwordError}
              </p>
            )}
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isDisabled}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
