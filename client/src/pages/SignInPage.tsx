import { useState } from 'react'
import type { FormEvent } from 'react'
import { localDemo, supabase } from '../auth/supabase'

export default function SignInPage() {
  const [busy, setBusy] = useState(false)
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy) return
    const data = new FormData(event.currentTarget)
    const identifier = String(data.get('identifier')).trim()
    const email = localDemo && identifier.toLowerCase() === 'admin' ? 'admin@example.com' : identifier
    setBusy(true)
    setError('')
    try {
      const { error: failure } = await supabase.auth.signInWithPassword({
        email, password: String(data.get('password')),
      })
      if (failure) {
        setError(failure.status === 429
          ? 'Too many attempts. Please wait a moment and try again.'
          : failure.status === 400 || failure.status === 401 || failure.status === 422
            ? 'Those sign-in details didn’t work. Check them and try again.'
            : 'Sign-in is temporarily unavailable. Please try again.')
      }
    } catch {
      setError('Sign-in is temporarily unavailable. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="sign-in">
      <div className="sign-in-frame">
        <section className="sign-in-intro" aria-labelledby="workspace-title">
          <div className="sign-in-mark" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M6 12h3l2-4 3 8 2-4h2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="sign-in-eyebrow">OHSU School of Nursing</p>
          <h2 id="workspace-title">Simulation<br className="sign-in-break" /> Database</h2>
          <p>A shared workspace to create, find, and maintain simulation cases across campuses.</p>
          <span className="sign-in-badge">Instructor access only</span>
        </section>
        <section className="sign-in-panel" aria-labelledby="sign-in-title">
          <h1 id="sign-in-title">Sign in</h1>
          <p>Use the account provided by your simulation program.</p>
          <form className="sign-in-form" onSubmit={signIn} aria-busy={busy}>
            <label htmlFor="sign-in-id">{localDemo ? 'Username or email' : 'Email address'}</label>
            <input id="sign-in-id" name="identifier" type={localDemo ? 'text' : 'email'}
              autoComplete="username" autoCapitalize="none" spellCheck={false} required />
            <label htmlFor="sign-in-password">Password</label>
            <div className="sign-in-password">
              <input id="sign-in-password" name="password" type={visible ? 'text' : 'password'}
                autoComplete="current-password" required />
              <button type="button" aria-controls="sign-in-password"
                onClick={() => setVisible(!visible)}>{visible ? 'Hide password' : 'Show password'}</button>
            </div>
            {error && <p className="error" role="alert">{error}</p>}
            {!supabase && <p className="error" role="alert">Sign-in hasn’t been configured for this environment.</p>}
            <button type="submit" disabled={busy || !supabase}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <p className="sign-in-help">Need access or a password reset? Contact your simulation program coordinator.</p>
        </section>
      </div>
    </main>
  )
}
