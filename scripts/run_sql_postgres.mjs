import fs from 'fs'
import postgres from 'postgres'

function readEnv(key) {
  const path = '.env'
  if (!fs.existsSync(path)) return null
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const line = lines.find(l => l.startsWith(key + '='))
  if (!line) return null
  return line.substring((key + '=').length)
}

(async () => {
  try {
    const conn = process.env.DATABASE_URL || readEnv('DATABASE_URL')
    if (!conn) {
      console.error('DATABASE_URL not found in environment or .env')
      process.exit(2)
    }

    const sqlFile = './supabase/migrations/006_reset_public_and_create_cases_table.sql'
    if (!fs.existsSync(sqlFile)) {
      console.error('Migration file not found:', sqlFile)
      process.exit(2)
    }

    const sqlText = fs.readFileSync(sqlFile, 'utf8')

    const sql = postgres(conn, { max: 1 })
    console.log('Connecting to DB (host hidden) and running migration...')
    try {
      await sql.unsafe(sqlText)
      console.log('Migration executed successfully.')
    } finally {
      await sql.end({ timeout: 5 })
    }
  } catch (err) {
    console.error('Migration failed:', err && err.message ? err.message : err)
    process.exit(1)
  }
})()
