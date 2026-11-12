# Instructor access

Only OHSU instructors explicitly provisioned by the team can use the app. All
approved accounts have the same application access; there is no Owner/Admin
hierarchy, signup route, or first-user promotion. The app still records who
created a case and its first version.

## Before enabling a hosted environment

1. Use a dedicated Supabase project for each environment that needs its own data.
   In Supabase Auth, turn off **Allow new users to sign up** and anonymous sign-ins.
   Leave email/password sign-in enabled and use the project's strong password policy.
2. Disable the Supabase **Data API** for this app's database; the Express server
   connects directly over PostgreSQL. On existing app databases, apply
   [the RLS migration](../db/migrations/002_restrict_app_tables.sql).
   Fresh databases already get these protections in `db/schema.sql`. The Express
   database role must own the tables or have approved access. Verify the browser
   cannot reach data directly and an unapproved identity gets HTTP 403 via Express.
3. Configure the client and server's Auth URL and public key from the same
   Supabase project; see the example environment files. Do not use production
   data or credentials in previews. If the sign-in screen itself must not be
   publicly reachable, configure deployment-level access protection separately.

## Provision or revoke an instructor

1. In Supabase **Authentication → Users**, create the verified instructor's
   account with an individual strong password. Share credentials only through
   the team's approved private channel. Do not grant access based on an email
   suffix alone or use a shared password on hosted deployments.
2. Copy the Auth user's UID. In the app database, add the approved user's UID
   as `oidc_subject` with the exact role `instructor`. Replace these placeholders
   locally; don't paste actual instructor records into a PR or chat.

   ```sql
   INSERT INTO public.app_user (oidc_subject, name, email, role)
   VALUES ('<AUTH_USER_UID>', '<APPROVED_NAME>', '<APPROVED_EMAIL>', 'instructor');
   ```

   For an existing application row, verify the Auth UID before updating that row;
   don't create a duplicate. Old Owner/Admin values, if the earlier migration
   was applied, are ignored and do not confer access. To revoke application
   access, change the approved row's role away from `instructor` rather than
   deleting it; case attribution is preserved.

## Local-only team demo

Use a disposable [local Supabase stack](https://supabase.com/docs/guides/local-development)
with Docker and its default API port 54321 and database port 54322. Never link it
to a hosted project for this demo. Load `db/schema.sql` once into that local
database, using `psql` with the local DB URL. Turn off local self-signup
(`auth.enable_signup = false` in the local Supabase CLI config). Configure the
app using the local stack URL and public key. Set `DATABASE_URL` for the server to
the local stack DB URL as well.

From the repository root after `npm ci`, run the following in Bash. Enter the
local DB URL and local legacy service-role key shown by the Supabase CLI, then
the temporary demo password agreed with the team. These values aren't echoed
or written to the repository.

```bash
(
  read -rsp 'Local database URL: ' LOCAL_DEMO_DATABASE_URL; printf '\n'
  read -rsp 'Local service-role key: ' LOCAL_DEMO_SERVICE_ROLE_KEY; printf '\n'
  read -rsp 'Local demo password: ' OHSU_DEMO_PASSWORD; printf '\n'
  export LOCAL_DEMO_DATABASE_URL LOCAL_DEMO_SERVICE_ROLE_KEY
  printf '%s' "$OHSU_DEMO_PASSWORD" | node server/scripts/provision-local-demo.mjs
)
```

Start the app with the normal workspace commands and sign in as `Admin`.
That username is a Vite-development-only alias for the synthetic account and
has no special privileges. The script only connects to loopback and imports
the password as a bcrypt hash without lowering any hosted password policy.
Use synthetic data only; do not forward the local ports or deploy this account.
