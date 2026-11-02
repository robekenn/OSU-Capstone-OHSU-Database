import { createApp } from './app.js'
import { pool } from './db.js'

const port = Number(process.env.PORT ?? 3000)

// Check the database connection at startup so a bad DATABASE_URL fails right away.
await pool.query('SELECT 1')

createApp().listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})