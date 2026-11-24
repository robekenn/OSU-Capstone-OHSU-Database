import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getCase, saveCaseVersion } from '../api/cases'
import type { CaseDetail } from '../api/cases'
import CaseForm from '../components/CaseForm'
import { draftChanges, editableDraft } from '../templates/editContent'
import { casesReturnTo } from './caseFilters'

export default function EditCasePage() {
  const { caseId = '' } = useParams()
  return <EditCase key={caseId} caseId={caseId} />
}

function EditCase({ caseId }: { caseId: string }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<CaseDetail | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const detailUrl = '/cases/' + encodeURIComponent(caseId) + '?returnTo=' + encodeURIComponent(casesReturnTo(params.get('returnTo')))

  useEffect(() => {
    const controller = new AbortController()
    void getCase(caseId, controller.signal).then(
      (saved) => { if (!controller.signal.aborted) setDetail(saved) },
      (failure: unknown) => {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load the draft.')
      },
    )
    return () => controller.abort()
  }, [caseId, attempt])

  const version = detail?.currentVersion
  if (detail && !detail.archived && version?.status === 'draft') {
    const { content, readOnlyFields } = editableDraft(version.content)
    return <CaseForm initialTitle={detail.title} initialContent={content} readOnlyFields={readOnlyFields} cancelTo={detailUrl}
      onSave={async (title, _content, touched) => {
        await saveCaseVersion(caseId, version.id, title, draftChanges(touched))
        navigate(detailUrl, { replace: true })
      }} />
  }

  return <section>
    <h1>Edit draft</h1>
    {error ? <><p role="alert">{error}</p><button type="button" onClick={() => {
      setError('')
      setAttempt((value) => value + 1)
    }}>Try again</button></> : detail
      ? <p>Only an active draft can be edited.</p>
      : <p role="status">Loading draft...</p>}
    <Link to={detailUrl}>Back to case</Link>
  </section>
}
