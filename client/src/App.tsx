import NewCasePage from './pages/NewCasePage'
import CasesPage from './pages/CasesPage'
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import './pages/CasesPage.css'

export default function App() {
  return (
    <BrowserRouter>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <nav className="case-nav" aria-label="Main navigation">
        <NavLink to="/cases">Cases</NavLink>
        <NavLink to="/new">New case</NavLink>
      </nav>
      <main id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Navigate to="/cases" replace />} />
          <Route path="/cases" element={<CasesPage />} />
          <Route path="/new" element={<NewCasePage />} />
          <Route path="*" element={<h1>Page not found</h1>} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

