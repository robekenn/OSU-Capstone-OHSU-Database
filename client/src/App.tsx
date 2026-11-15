import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { appFetch } from './api/http'
import { supabase } from './auth/supabase'
import Layout from './components/Layout'
import CasesPage from './pages/CasesPage'
import CaseDetailPage from './pages/CaseDetailPage'
import NewCasePage from './pages/NewCasePage'
import NotFoundPage from './pages/NotFoundPage'
import SignInPage from './pages/SignInPage'
// Imported here, not inside CasesPage.tsx, because the client tests load
// CasesPage.tsx directly in Node, which can't import a .css file.
import './pages/CasesPage.css'
import './pages/CaseDetailPage.css'
import './pages/SignInPage.css'

function InstructorRoutes() {
  const location = useLocation()
  const [subject, setSubject] = useState<string | null | undefined>(supabase ? undefined : null)
  const [approval, setApproval] = useState<{ subject: string; status: number } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [signOutError, setSignOutError] = useState('')

  useEffect(() => {
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      setSubject(session?.user.id ?? null)
      if (!session) {
        setApproval(null)
        setSignOutError('')
      }
    }).data.subscription
    return () => subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    if (!subject) return
    const controller = new AbortController()
    void appFetch('/api/auth/me', { signal: controller.signal }).then(
      ({ status }) => { if (!controller.signal.aborted) setApproval({ subject, status }) },
      () => { if (!controller.signal.aborted) setApproval({ subject, status: 503 }) },
    )
    return () => controller.abort()
  }, [subject, attempt])

  async function signOut() {
    setSignOutError('')
    const result = await supabase?.auth.signOut({ scope: 'local' }).catch(() => ({ error: true }))
    if (result?.error) setSignOutError('Could not sign out. Please try again.')
  }

  const status = approval?.subject === subject ? approval?.status : undefined
  if (subject === undefined || (subject && status === undefined)) {
    return <main className="simple-page"><p role="status">Checking your access…</p></main>
  }
  if (subject && status !== 200) {
    const denied = status === 403
    return (
      <main className="simple-page">
        <h1>{denied ? 'Instructor access required' : 'Could not verify your access'}</h1>
        <p>{denied ? 'This account has not been approved. Contact your simulation program coordinator for access.' : 'Try again, or sign out and sign back in.'}</p>
        {!denied && <button type="button" onClick={() => { setApproval(null); setAttempt(attempt + 1) }}>Try again</button>}
        <button type="button" onClick={() => void signOut()}>Sign out</button>
        {signOutError && <p className="error" role="alert">{signOutError}</p>}
      </main>
    )
  }
  if (location.pathname === '/login') {
    const from = location.state?.from
    const destination = typeof from === 'string' && /^\/(cases(?:[/?]|$)|new(?:[/?]|$))/.test(from) ? from : '/cases'
    return subject ? <Navigate to={destination} replace /> : <SignInPage />
  }
  if (!subject) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  }
  return <Layout onSignOut={signOut} signOutError={signOutError}><Outlet /></Layout>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<InstructorRoutes />}>
          <Route path="login" element={null} />
          {/* replace, so Back from /cases doesn't land on / and bounce forward again */}
          <Route index element={<Navigate to="/cases" replace />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="cases/:caseId" element={<CaseDetailPage />} />
          <Route path="new" element={<NewCasePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
