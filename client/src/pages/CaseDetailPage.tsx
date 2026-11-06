import React from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getCase } from '../api/cases'
import type { CaseDetail } from '../api/cases'
import { CaseContentView } from '../components/CaseContentView'
import { casesReturnTo } from './caseFilters'

type DetailState =
  | { kind: 'loading' }
  | { kind: 'ready'; caseId: string; detail: CaseDetail }
  | { kind: 'error'; caseId: string; message: string }

export default function CaseDetailPage() {
  const { caseId = '' } = useParams()
  const [params] = useSearchParams()
  const [state, setState] = React.useState<DetailState>({ kind: 'loading' })
  const [reload, setReload] = React.useState(0)
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
  return <article className="case-detail">
    <Link to={casesReturnTo(params.get('returnTo'))}>Back to cases</Link>
    <h1>{detail?.title ?? 'Case details'}</h1>
    {!current && <p role="status">Loading case...</p>}
    {current?.kind === 'error' && <>
      <p role="alert">{current.message}</p>
      <button type="button" onClick={() => { setState({ kind: 'loading' }); setReload((value) => value + 1) }}>Try again</button>
    </>}
    {detail && (version ? <>
      <p>Status: {version.status} · Version: {version.versionNumber}</p>
      <p>Saved: {date && !Number.isNaN(date.getTime()) ? <time dateTime={version.createdAt}>{date.toLocaleString()}</time> : 'Not available'}</p>
      <CaseContentView content={version.content} />
    </> : <p>No current version is available for this case.</p>)}
  </article>
}
