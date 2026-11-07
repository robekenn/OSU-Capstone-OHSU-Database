import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import CasesPage from './pages/CasesPage'
import CaseDetailPage from './pages/CaseDetailPage'
import NewCasePage from './pages/NewCasePage'
import NotFoundPage from './pages/NotFoundPage'
// Imported here, not inside CasesPage.tsx, because the client tests load
// CasesPage.tsx directly in Node, which can't import a .css file.
import './pages/CasesPage.css'
import './pages/CaseDetailPage.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
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
