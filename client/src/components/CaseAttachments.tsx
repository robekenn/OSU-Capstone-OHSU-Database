import React from 'react'
import { getDownloadUrl, listAttachments, removeAttachment, uploadAttachment } from '../api/attachments'
import type { Attachment, AttachmentList } from '../api/attachments'
import { ACCEPT, ALLOWED_DESCRIPTION, formatBytes, typeLabel } from '../attachments/rules'

const message = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)

type ListProps = {
  files: Attachment[]
  editable: boolean
  busy: boolean
  onDownload: (file: Attachment) => void
  onRemove: (file: Attachment) => void
}

// The file table. Kept separate from the data loading so it can be tested on its own.
export function AttachmentTable({ files, editable, busy, onDownload, onRemove }: ListProps) {
  if (files.length === 0) return <p>No files are attached to this version.</p>
  return <div className="cases-table-wrap"><table className="cases-table attachments-table">
    <caption>Attached files</caption>
    <thead><tr>
      <th scope="col">Name</th><th scope="col">Type</th><th scope="col">Size</th>
      <th scope="col">Added</th><th scope="col">Actions</th>
    </tr></thead>
    <tbody>{files.map((file) => {
      const added = new Date(file.uploadedAt)
      return <tr key={file.id}>
        <td>{file.filename}</td>
        <td>{typeLabel(file.mediaType)}</td>
        <td>{formatBytes(file.sizeBytes)}</td>
        <td>{Number.isNaN(added.getTime()) ? 'Not available'
          : <time dateTime={file.uploadedAt}>{added.toLocaleDateString()}</time>}</td>
        <td className="attachment-actions">
          <button type="button" disabled={busy} aria-label={'Download ' + file.filename}
            onClick={() => onDownload(file)}>Download</button>
          {editable && <button type="button" disabled={busy} aria-label={'Remove ' + file.filename}
            onClick={() => onRemove(file)}>Remove</button>}
        </td>
      </tr>
    })}</tbody>
  </table></div>
}

// The reminder and the upload control. Separate so the reminder's presence is testable.
export function AttachmentUpload({ busy, onChoose }: { busy: boolean; onChoose: (file: File) => void }) {
  return <div className="attachment-upload">
    <p id="attachment-privacy" className="attachment-privacy">
      <strong>Fictional materials only.</strong> Files must not contain real patient information
      or identify real learners, faculty, staff, or standardized patients.
    </p>
    <label htmlFor="attachment-file">Add a file</label>
    <input id="attachment-file" type="file" accept={ACCEPT} disabled={busy}
      aria-describedby="attachment-privacy attachment-allowed"
      onChange={(event) => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = '' // choosing the same file again still triggers an upload
        if (file) onChoose(file)
      }} />
    <p id="attachment-allowed" className="attachment-hint">{ALLOWED_DESCRIPTION}</p>
  </div>
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; list: AttachmentList }

// "Attachments" section on the case detail page (#63).
export function CaseAttachments({ caseId, versionId }: { caseId: string; versionId: number }) {
  const [state, setState] = React.useState<LoadState>({ kind: 'loading' })
  const [reload, setReload] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    listAttachments(caseId, controller.signal, versionId).then(
      (list) => { if (!controller.signal.aborted) setState({ kind: 'ready', list }) },
      (failure: unknown) => {
        if (!controller.signal.aborted) setState({ kind: 'error', message: message(failure, 'Could not load attachments.') })
      },
    )
    return () => controller.abort()
  }, [caseId, versionId, reload])

  async function run(work: () => Promise<void>) {
    setBusy(true)
    setError('')
    setStatus('')
    try {
      await work()
    } catch (failure) {
      setError(message(failure, 'Something went wrong. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const upload = (file: File) => run(async () => {
    setStatus('Uploading ' + file.name + '…')
    const saved = await uploadAttachment(caseId, file, versionId)
    setState((current) => current.kind === 'ready'
      ? { kind: 'ready', list: { ...current.list, files: [...current.list.files, saved] } }
      : current)
    setStatus(saved.filename + ' was attached.')
  })

  const download = (file: Attachment) => run(async () => {
    window.location.assign(await getDownloadUrl(caseId, file.id))
  })

  const remove = (file: Attachment) => {
    if (!window.confirm('Remove "' + file.filename + '" from this version? Earlier versions keep their copy.')) return
    void run(async () => {
      await removeAttachment(caseId, file.id, versionId)
      setState((current) => current.kind === 'ready'
        ? { kind: 'ready', list: { ...current.list, files: current.list.files.filter((item) => item.id !== file.id) } }
        : current)
      setStatus(file.filename + ' was removed from this version.')
    })
  }

  return <section className="case-attachments" aria-labelledby="attachments-heading">
    <h2 id="attachments-heading">Attachments</h2>
    {state.kind === 'loading' && <p role="status">Loading attachments...</p>}
    {state.kind === 'error' && <>
      <p className="error" role="alert">{state.message}</p>
      <button type="button" onClick={() => setReload((value) => value + 1)}>Try again</button>
    </>}
    {state.kind === 'ready' && <>
      {state.list.editable
        ? <AttachmentUpload busy={busy} onChoose={(file) => { void upload(file) }} />
        : <p>Files can only be added or removed on an active draft.</p>}
      <p role="status">{status}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <AttachmentTable files={state.list.files} editable={state.list.editable} busy={busy}
        onDownload={(file) => { void download(file) }} onRemove={remove} />
    </>}
  </section>
}
