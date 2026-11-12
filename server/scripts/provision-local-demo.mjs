import { readFileSync } from 'node:fs'
import pg from 'pg'

const email = 'admin@example.com'
const endpoint = 'http://127.0.0.1:54321/auth/v1/admin/users'

async function provision() {
  const connectionString = process.env.LOCAL_DEMO_DATABASE_URL
  const serviceRole = process.env.LOCAL_DEMO_SERVICE_ROLE_KEY
  if (!connectionString || !serviceRole) throw new Error('Set the two LOCAL_DEMO variables in the setup guide.')
  const database = new URL(connectionString)
  if (process.env.VERCEL || process.env.NODE_ENV === 'production'
    || !['postgres:', 'postgresql:'].includes(database.protocol)
    || database.hostname !== '127.0.0.1' || database.port !== '54322'
    || database.pathname !== '/postgres' || database.search || database.hash) {
    throw new Error('The demo is only for the default local Supabase stack.')
  }
  if (process.stdin.isTTY) throw new Error('Supply the local demo password through standard input.')
  const password = readFileSync(0, 'utf8').replace(/\r?\n$/, '')
  if (!password) throw new Error('No demo password was provided.')

  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    // Fail before creating the Auth user if the app schema has not been loaded.
    const existing = await client.query(
      'SELECT 1 FROM public.app_user WHERE email = $1 UNION ALL SELECT 1 FROM auth.users WHERE email = $1',
      [email],
    )
    if (existing.rowCount) throw new Error('The demo email already exists; this script will not overwrite an account.')

    // Import a bcrypt hash through Auth's administrative API, rather than
    // weakening password rules even on the local test project.
    const { rows: [{ hash }] } = await client.query(
      "SELECT extensions.crypt($1, extensions.gen_salt('bf', 10)) AS hash",
      [password],
    )
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password_hash: hash, email_confirm: true }),
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new Error(`Local Supabase Auth rejected the demo (HTTP ${response.status}).`)
    const { id } = await response.json()
    // Match the local Auth row by stable ID and email before granting access.
    const added = await client.query(
      `INSERT INTO public.app_user (oidc_subject, name, email, role)
       SELECT id::text, 'Synthetic Demo Instructor', email, 'instructor'
       FROM auth.users WHERE id = $1::uuid AND email = $2`,
      [id, email],
    )
    if (added.rowCount !== 1) throw new Error('Local Auth and the local database did not match.')
    console.log('Local demo account provisioned. Sign in as Admin in the local Vite dev server.')
  } finally {
    await client.end()
  }
}

try {
  await provision()
} catch (error) {
  // Don't log raw PostgreSQL or HTTP errors: those may include inputs.
  const message = error instanceof Error && /^(Set the two|The demo|Supply|No demo|Local Supabase Auth rejected|Local Auth and)/.test(error.message)
    ? error.message : 'Local provisioning failed. Check that Supabase is running and the app schema is loaded.'
  console.error(message)
  process.exitCode = 1
}
