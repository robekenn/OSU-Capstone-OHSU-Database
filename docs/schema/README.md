# Database schema documentation

`OHSU Database Schema.docx` explains the tables and columns in [`db/schema.sql`](../../db/schema.sql) in plain language, one table at a time: what each line does and why it is there.

`db/schema.sql` is the source of truth. If the two disagree, the SQL file is correct and this document needs updating. When a pull request changes `db/schema.sql`, update the matching table in the document in the same pull request (see CONTRIBUTING.md, Definition of Done).

Notes on reading it:

- The `role` column on `app_user` lists the planned roles, but it is free text for now and is not an authorization rule. The design calls for the API to enforce permissions on the server, not just to decide which screens and buttons appear (see [AGENTS.md](../../AGENTS.md#security-and-authorization) and [design.md](../design.md) §3.2).
- The tests in [`db/tests/`](../../db/tests/) show the schema's actual behavior, such as which inserts are rejected.
