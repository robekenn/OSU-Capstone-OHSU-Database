import type { CaseContent } from '../templates/caseTemplate'

export type CaseSummary = {
  id: number
  title: string
  status: string | null
  updatedAt: string | null
}

export async function listCases(signal?: AbortSignal): Promise<CaseSummary[]> {
  const response = await fetch('/api/cases', { signal })
  if (!response.ok) {
    throw new Error('Could not load cases (status ' + response.status + ').')
  }
  const data: unknown = await response.json()
  if (!Array.isArray(data) || !data.every((item: unknown) => {
    if (typeof item !== 'object' || item === null) return false
    const row = item as Record<string, unknown>
    return typeof row.id === 'number' && typeof row.title === 'string'
      && (row.status === null || typeof row.status === 'string')
      && (row.updatedAt === null || typeof row.updatedAt === 'string')
  })) {
    throw new Error('The server returned an unexpected case list.')
  }
  return data as CaseSummary[]
}

export async function createCase(title: string, content: CaseContent): Promise<{ id: number; versionId: number }> {
  const response = await fetch('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  })
  if (!response.ok) {
    throw new Error('Could not save the case (status ' + response.status + ').')
  }
  return response.json()
}
