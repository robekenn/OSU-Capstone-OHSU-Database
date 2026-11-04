import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import './AuthPage.css'

export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  if (session) return <Navigate to="/cases/new" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      if (mode === 'signup') {
        const result = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } })
        if (result.error) throw result.error
        if (!result.data.session) { setMessage('Check your email to confirm your account, then sign in.'); return }
      } else {
        const result = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (result.error) throw result.error
      }
      navigate('/cases/new', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed.')
    } finally { setBusy(false) }
  }

  const isSignup = mode === 'signup'
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">OHSU Simulation Library</p>
        <h1 id="auth-title">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
        <p>{isSignup ? 'Sign up to create and manage simulation cases.' : 'Sign in to continue to your cases.'}</p>
        <form onSubmit={handleSubmit}>
          {isSignup && <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" /></label>}
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={isSignup ? 'new-password' : 'current-password'} /></label>
          <button type="submit" disabled={busy}>{busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}</button>
        </form>
        {message && <p className="notice" role="status">{message}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <p className="auth-switch">{isSignup ? 'Already have an account? ' : 'Need an account? '}<Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Sign up'}</Link></p>
      </section>
    </main>
  )
}
