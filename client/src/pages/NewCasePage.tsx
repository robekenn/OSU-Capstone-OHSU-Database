import { createCase } from '../api/cases'
import { useLookups } from '../api/useLookups'
import CaseForm from '../components/CaseForm'
import { displayCopy, toCaseLinks } from '../templates/caseLinks'
import { cleanContent } from '../templates/cleanContent'

export default function NewCasePage() {
  // Campuses and courses other cases already use, offered as suggestions while typing.
  const suggestions = useLookups()
  return <CaseForm suggestions={suggestions} onSave={async (title, content, _touched, choices) => {
    // The typed campus, courses and outcomes go to the API beside the content, which saves
    // them so the Cases page filters can offer them. A readable copy of the campus and
    // courses also goes into General information so the case details page shows them.
    const copy = displayCopy(choices)
    const withCopy = { ...content, generalInformation: { ...content.generalInformation, ...copy } }
    await createCase(title, cleanContent(withCopy), toCaseLinks(choices, content))
  }} />
}