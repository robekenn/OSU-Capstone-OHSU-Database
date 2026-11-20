import React from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getCase, setCaseArchived } from '../api/cases'
import type { CaseDetail } from '../api/cases'
import { CaseAttachments } from '../components/CaseAttachments'
import { CaseContentView } from '../components/CaseContentView'
import { casesReturnTo } from './caseFilters'

type DetailState =
  | { kind: 'loading' }
  | { kind: 'ready'; caseId: string; detail: CaseDetail }
  | { kind: 'error'; caseId: string; message: string }

export default function CaseDetailPage() {
  const { caseId = '' } = useParams()
  return <CaseDetailContent key={caseId} caseId={caseId} />
}

function CaseDetailContent({ caseId }: { caseId: string }) {
  const [params] = useSearchParams()
  const [state, setState] = React.useState<DetailState>({ kind: 'loading' })
  const [reload, setReload] = React.useState(0)
  const [saving, setSaving] = React.useState(false)
  const [archiveError, setArchiveError] = React.useState('')
  const [archiveNotice, setArchiveNotice] = React.useState('')
  React.useEffect(() => {
    const controller = new AbortController()
    getCase(caseId, controller.signal).then(
      (detail) => { if (!controller.signal.aborted) setState({ kind: 'ready', caseId, detail }) },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ kind: 'error', caseId,
          message: error instanceof Error ? error.message : 'Could not load the case.' })
      },
    )
    return () => controller.abort()
  }, [caseId, reload])

  const current = state.kind !== 'loading' && state.caseId === caseId ? state : null
  const detail = current?.kind === 'ready' ? current.detail : null
  const version = detail?.currentVersion
  const date = version ? new Date(version.createdAt) : null
  const returnTo = casesReturnTo(params.get('returnTo'))
  const canEdit = !detail?.archived && version?.status === 'draft'

  async function changeArchive(archived: boolean) {
    if (archived && !window.confirm('Archive this case? It will leave active results. Its versions and files will be kept.')) return
    setSaving(true)
    setArchiveError('')
    setArchiveNotice('')
    try {
      await setCaseArchived(caseId, archived)
      setState((saved) => saved.kind === 'ready' ? { ...saved, detail: { ...saved.detail, archived } } : saved)
      setArchiveNotice(archived ? 'Case archived.' : 'Case restored to active cases.')
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : 'Could not update the case.')
    } finally {
      setSaving(false)
    }
  }

  return <article className="case-detail">
    <Link to={returnTo}>Back to cases</Link>
    <h1>{detail?.title ?? 'Case details'}</h1>
    {!current && <p role="status">Loading case...</p>}
    {current?.kind === 'error' && <>
      <p role="alert">{current.message}</p>
      <button type="button" onClick={() => { setState({ kind: 'loading' }); setReload((value) => value + 1) }}>Try again</button>
    </>}
    {detail?.archived && <p>This case is archived.</p>}
    {detail && (canEdit || detail.archived) && <div className="case-actions">
      {canEdit && !saving && <Link to={`/cases/${detail.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}>Edit draft</Link>}
      <button type="button" disabled={saving} onClick={() => void changeArchive(!detail.archived)}>
        {detail.archived ? 'Restore case' : 'Archive case'}
      </button>
    </div>}
    {archiveError && <p role="alert">{archiveError}</p>}
    {archiveNotice && <p role="status">{archiveNotice}</p>}
    {detail && (version ? <>
      <p>Status: {version.status} · Version: {version.versionNumber}</p>
      <p>Saved: {date && !Number.isNaN(date.getTime()) ? <time dateTime={version.createdAt}>{date.toLocaleString()}</time> : 'Not available'}</p>
      <CaseContentView content={version.content} />
      <CaseAttachments key={version.id + ':' + detail.archived} caseId={String(detail.id)} versionId={version.id} />
    </> : <p>No current version is available for this case.</p>)}
  </article>
}
