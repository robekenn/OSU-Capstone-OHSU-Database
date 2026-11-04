import type { CaseContent } from '../templates/caseTemplate'
import { authenticatedFetch } from './http'

export async function createCase(title: string, content: CaseContent): Promise<{ id: number; versionId: number }> {
  const response = await authenticatedFetch('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  })
  if (!response.ok) {
    throw new Error('Could not save the case (status ' + response.status + ').')
  }
  return response.json()
}
