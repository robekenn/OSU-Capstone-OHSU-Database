import { createCase } from '../api/cases'
import CaseForm from '../components/CaseForm'
import { cleanContent } from '../templates/cleanContent'

export default function NewCasePage() {
  return <CaseForm onSave={async (title, content) => {
    await createCase(title, cleanContent(content))
  }} />
}
