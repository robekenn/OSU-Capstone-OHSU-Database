# Read a saved case

Issue #48 adds `/cases/:caseId` and the read-only `GET /api/cases/:caseId` endpoint.
Click a title in Cases to open the current version. Back to cases keeps the search
and filters used to find it. The page shows loading, request errors, missing cases,
and cases with no current version. It supports keyboard links and the shared layout.

This is a first implementation, not a claim of full partner-template coverage.
It displays saved content; it cannot recover fields that were never collected.
Unknown and legacy saved fields remain readable. Old records are not rewritten.
Editing, deletion, version selection, attachments, and export are outside this task.
The existing login/permission gap remains; verify locally with synthetic data only.

## Verification

Run the root `lint`, `typecheck`, `test`, and `build` scripts using Node 24.
Detail API tests use a mocked database to check requests, response shape, missing
records, and error handling. The database integration suite also checks real
create → list → detail requests, current-version selection, preserved history,
new role details, and legacy content. It requires a dedicated `TEST_DATABASE_URL`
whose database name ends in `_test`; it is skipped when that variable is absent.
The suite resets that test database's public schema. Never point it at a database
that contains development or partner records. Browser checks below remain separate.

With a configured local development database:

1. Create a fictional case with multiline text, selections, a list, and a table.
2. Find it with a search, open its title, and check all entered values.
3. Reload the detail URL, then use Back to cases and check the original filters.
4. Open an ID that does not exist and an invalid ID; check the messages.
5. Stop the backend and reload: show an error, never substitute fake content.
6. Open a legacy synthetic record; confirm old fields remain visible.

Never load the schema into an existing data-bearing database just to run this demo.

## Role fields (#44)

Each role in the three Roles groups has a checkbox and its own labelled text
input. Counts accept text such as `6-10`. Other groups accept role descriptions
or assignments. Selected roles can be saved without details; the detail page
shows "Not filled in". Unchecked roles are excluded when saving. Their text is
kept only in the unsaved form so it can be restored by rechecking. After a
successful save, the form is cleared as before.

Test two roles with different details and one selected role with no detail.
Uncheck a filled role, save, and verify that it is absent from the detail page.
Check an older synthetic case with string-array roles and a shared count; the
original content must still be readable without edits or inferred per-role counts.
