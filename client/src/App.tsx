import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import AdminPage from './pages/AdminPage'
import AuthPage from './pages/AuthPage'
import NewCasePage from './pages/NewCasePage'
import './App.css'

function ProtectedRoute() {
  const { loading, session } = useAuth()
  if (loading) return <p className="page-status" role="status">Loading your account…</p>
  return session ? <Outlet /> : <Navigate to="/login" replace />
}

function AdminRoute() {
  const { profile } = useAuth()
  return profile?.systemRole === 'admin' || profile?.systemRole === 'owner'
    ? <AdminPage />
    : <Navigate to="/cases/new" replace />
}

function AppShell() {
  const { profile, signOut } = useAuth()
  const isAdministrator = profile?.systemRole === 'admin' || profile?.systemRole === 'owner'
  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink className="brand" to="/cases/new">OHSU Simulation Library</NavLink>
        <nav aria-label="Primary navigation">
          <NavLink to="/cases/new">New case</NavLink>
          {isAdministrator && <NavLink to="/admin">Admin</NavLink>}
          <button className="link-button" type="button" onClick={() => void signOut()}>Sign out</button>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/cases/new" element={<NewCasePage />} />
          <Route path="/admin" element={<AdminRoute />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/cases/new" replace />} />
    </Routes>
  )
}

