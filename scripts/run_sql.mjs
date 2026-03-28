import fs from 'fs';
import { Client } from 'pg';

function readEnv(key) {
  const content = fs.readFileSync('.env.local', 'utf8');
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const line = lines.find(l => l.startsWith(key + '='));
  if (!line) return null;
  return line.substring((key + '=').length).trim();
}

(async () => {
  try {
    const conn = process.env.NEXT_PUBLIC_PSQL || readEnv('NEXT_PUBLIC_PSQL');
    if (!conn) {
      console.error('NEXT_PUBLIC_PSQL not found in environment or .env.local');
      process.exit(2);
    }

    const sql = fs.readFileSync('./supabase/migrations/006_reset_public_and_create_cases_table.sql', 'utf8');
    console.log('Connecting to Postgres...');
    const client = new Client({ connectionString: conn });
    await client.connect();
    console.log('Connected. Running SQL...');

    await client.query(sql);

    console.log('SQL executed successfully.');
    await client.end();
  } catch (err) {
    console.error('Error running SQL:', err.stack || err.message || err);
    process.exit(1);
  }
})();
