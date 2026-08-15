import { useState, type FormEvent } from 'react'
import { session } from '../auth/session'

type LoginError = 'wrong-password' | 'unknown'

const ERROR_COPY: Record<LoginError, string> = {
  'wrong-password': 'wrong password',
  unknown: 'could not log in',
}

/**
 * shown instead of the tabbed app whenever session state is 'unauthorized'.
 * posts { password } to /api/auth/login; 401 is a known failure (wrong
 * password), anything else (5xx, network error) is an unknown one.
 */
export function LoginScreen() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<LoginError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      })
      if (response.ok) {
        setPassword('')
        session.markAuthed()
        return
      }
      setError(response.status === 401 ? 'wrong-password' : 'unknown')
    } catch {
      setError('unknown')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="noise-overlay" aria-hidden="true" />
      <form className="login-form" onSubmit={handleSubmit}>
        <h1 className="login-form__wordmark">lapse</h1>
        <label className="login-form__label" htmlFor="password">
          password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="login-form__input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error && (
          <p className="login-form__error" role="alert">
            {ERROR_COPY[error]}
          </p>
        )}
        <button type="submit" className="login-form__submit" disabled={submitting} aria-busy={submitting}>
          log in
        </button>
      </form>
    </div>
  )
}
