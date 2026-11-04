import React from 'react'
import { listCases } from '../api/cases'
import type { CaseSummary } from '../api/cases'

export function CasesTable({ cases }: { cases: CaseSummary[] }) {
  if (cases.length === 0) return <p role="status">No cases yet</p>

  return (
    <div className="cases-table-wrap">
      <table className="cases-table">
        <caption>Simulation cases</caption>
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Status</th>
            <th scope="col">Last updated</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((item) => {
            const date = item.updatedAt ? new Date(item.updatedAt) : null
            return (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{item.status || 'Not available'}</td>
                <td>{date && !Number.isNaN(date.getTime()) ? (
                  <time dateTime={item.updatedAt ?? undefined}>{date.toLocaleString()}</time>
                ) : 'Not available'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; cases: CaseSummary[] }

export default function CasesPage() {
  const [state, setState] = React.useState<ListState>({ kind: 'loading' })
  const [reload, setReload] = React.useState(0)

  React.useEffect(() => {
    const controller = new AbortController()
    listCases(controller.signal).then(
      (cases) => { if (!controller.signal.aborted) setState({ kind: 'ready', cases }) },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load cases.' })
        }
      },
    )
    return () => controller.abort()
  }, [reload])

  return (
    <section className="cases-page">
      <h1>Cases</h1>
      <button type="button" disabled={state.kind === 'loading'} onClick={() => {
        setState({ kind: 'loading' })
        setReload((value) => value + 1)
      }}>
        Refresh cases
      </button>
      {state.kind === 'loading' && <p role="status">Loading cases...</p>}
      {state.kind === 'error' && <p role="alert">{state.message} Use Refresh cases to try again.</p>}
      {state.kind === 'ready' && <CasesTable cases={state.cases} />}
    </section>
  )
}

