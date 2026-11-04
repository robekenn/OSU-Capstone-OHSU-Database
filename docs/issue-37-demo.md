# Cases list — issue #37

## Scope and integration

`/cases` reads the existing `GET /api/cases` endpoint and shows Title, Status,
and Last updated. Loading, request errors, an empty list, and retry/refresh
are explicit. Status is text; the table has a caption and column headers.
Requests are aborted when leaving the page. No database, storage, deployment,
or authorization changes are included.

The small navigation in `App.tsx` makes `/new` and `/cases` reachable and
redirects `/` to `/cases`, using the already installed React Router. Coordinate
this shared entry point with issue #35; that task can replace the shell while
retaining both page components. The new-case form is unchanged. Search is an
optional stretch goal in #37 and is deferred.

The API returns an array of `{ id, title, status, updatedAt }`. Status and time
may be null for a case without a current version. They display as "Not available".
Times use the browser's locale and timezone. The existing backend uses the current
version's creation time as `updatedAt`; this UI does not redefine that contract.
Unexpected response shapes produce an error rather than a misleading empty list.

## Checks without PostgreSQL

Use Node 22.12+ or a compatible newer version (Node 24 recommended).
From the repository root:

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

The client tests use Node's test runner, the existing tsx tool, synthetic mocked
HTTP responses, and React server rendering. They check the list contract, HTTP
and malformed-response failures, table semantics, escaping, nullable fields,
and the empty state. They do not prove live database integration or browser
navigation. The server currently permits running with no application tests.

## Connected demo after PostgreSQL is ready

Use the existing project database setup and local server configuration. Never
commit credentials. Do not load the schema into a database that already contains
tables without first checking its state. Start the backend and frontend in separate
terminals:

```sh
npm run dev --workspace server
npm run dev --workspace client
```

1. Open the Vite URL at `/cases`. An empty database shows "No cases yet".
2. Visit `/new`. Save a case titled `[TEST] Synthetic list demonstration` using
   fictional content only. Wait for the success message.
3. Visit `/cases`. Confirm the title, `draft` status, and timestamp appear.
4. Reload `/cases` directly and use browser Back/Forward to verify navigation.
5. Stop the API and click Refresh cases: an error must appear, not an empty list.
   Restart the API and refresh to recover.
6. With browser network throttling, verify "Loading cases..." appears.
7. Use Tab to reach the skip link, navigation, and refresh button; focus is visible.

Without a configured database, the page should show an error. It never falls back
to synthetic records. Leaving `/new` discards an unsaved form as before; save before
navigating during the demo. Existing authentication limitations remain unchanged.
