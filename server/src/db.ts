import pg from 'pg'

// Read the connection string from the environment. It lives in server/.env, never in code.
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is required. Copy server/.env.example to server/.env.')
}

// A pool keeps a few connections open and reuses them for each request.
export const pool = new pg.Pool({ connectionString })

// Runs several queries as one all-or-nothing unit.
// If anything inside throws, nothing is saved.
export async function withTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}