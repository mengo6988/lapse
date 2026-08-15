import { useEffect, useState } from 'react'

/**
 * Walking-skeleton shell (build ticket 01): log in, prove the session reaches
 * the API. The real screens and tokens land in milestone 2.
 */
export function App() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<string>('checking…')
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? 'ok' : `unhealthy (${res.status})`))
      .catch(() => 'unreachable')
      .then(setHealth)
  }, [])

  async function login(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      setAuthed(true)
      setPassword('')
    } else {
      setError(res.status === 401 ? 'wrong password' : 'could not log in')
    }
  }

  return (
    <main>
      <h1>lapse</h1>
      <p>api: {health}</p>
      {authed ? (
        <p>logged in</p>
      ) : (
        <form onSubmit={login}>
          <label htmlFor="password">password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
          <button type="submit">log in</button>
          {error ? <p role="alert">{error}</p> : null}
        </form>
      )}
    </main>
  )
}
