// One-time setup for case attachments (#63): makes the Supabase Storage bucket
// private and applies the type and size limits from design.md section 3.3.
// Reads SUPABASE_URL, SUPABASE_SECRET_KEY and optional SUPABASE_STORAGE_BUCKET
// from server/.env. Run: npm run storage:setup --workspace server
import { MAX_ATTACHMENT_BYTES, MEDIA_TYPES } from '../attachments/rules.js'
import { ensurePrivateBucket, storageConfigFromEnv } from '../attachments/storage.js'

async function main() {
  const config = storageConfigFromEnv()
  if (!config) {
    console.error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in server/.env first.')
    process.exitCode = 1
    return
  }
  const mediaTypes = Object.values(MEDIA_TYPES)
  const outcome = await ensurePrivateBucket(config, { maxBytes: MAX_ATTACHMENT_BYTES, mediaTypes })
  console.log(`Bucket "${config.bucket}" ${outcome}: private, at most ${MAX_ATTACHMENT_BYTES} bytes per file, ${mediaTypes.length} file types.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Storage setup failed')
  process.exitCode = 1
})
