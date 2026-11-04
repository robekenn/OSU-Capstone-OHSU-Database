import { createApp } from './app.js'
import { pool } from './db.js'

const port = Number(process.env.PORT ?? 3000)

async function start() {
  // Check the database connection at startup so a bad connection fails right away.
  await pool.query('SELECT 1')

  createApp().listen(port, () => {
    console.log(`API listening on http://localhost:${port}`)
  })
}

void start()
