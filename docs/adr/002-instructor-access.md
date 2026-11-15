# Team-provisioned instructor access

Status: Proposed for review in the login pull request.

The development app is for authorized OHSU instructors, not public
registration. Replace the earlier signup and Owner/Admin proposal with one
application access tier. The team provisions identities in Supabase Auth and
explicitly approves the stable Auth UID in PostgreSQL. A valid Supabase account
alone grants no app access. The application does not create accounts or assign
permissions.

Account provisioning and revocation happen outside the app. This avoids a
public signup path, an in-app account-management surface, and a race for the
first privileged account. Revocation preserves case attribution. The tradeoff
is a manual provisioning step for each instructor; the procedure and hosted
configuration checks are in [Instructor access](../instructor-access.md).

Supabase Auth is the development identity provider, not a decision to replace
the documented OHSU OIDC production target. The temporary shared demo is
local-only and is not an administrative role.
