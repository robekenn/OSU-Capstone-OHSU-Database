# Database schema documentation

`OHSU Database Schema.docx` explains the tables and columns in [`db/schema.sql`](../../db/schema.sql) in plain language, one table at a time: what each line does and why it is there.

`db/schema.sql` is the source of truth. If the two disagree, the SQL file is correct and this document needs updating. When a pull request changes `db/schema.sql`, update the matching table in the document in the same pull request (see CONTRIBUTING.md, Definition of Done).

Notes on reading it:

- The `role` column on `app_user` is free text. The API grants access only to the exact value `instructor`, and every approved instructor has the same access; there is no Owner/Admin hierarchy (see [Instructor access](../instructor-access.md)). Permissions are enforced by the API on the server, not by which screens and buttons appear (see [AGENTS.md](../../AGENTS.md#security-and-authorization) and [design.md](../design.md) §3.2).
- [`erd.md`](../erd.md) has a diagram of how the tables relate.
- The tests in [`db/tests/`](../../db/tests/) show the schema's actual behavior, such as which inserts are rejected.
