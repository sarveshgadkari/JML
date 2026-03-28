const fs = require('fs');
const { Client } = require('pg');

function readEnv(key) {
  const content = fs.readFileSync('.env.local', 'utf8');
  const line = content.split(/\r?\n/).find(l => l.startsWith(key + '='));
  if (!line) return null;
  return line.replace(key + '=', '');
}

(async () => {
  try {
    const conn = readEnv('NEXT_PUBLIC_PSQL');
    if (!conn) {
      console.error('NEXT_PUBLIC_PSQL not found in .env.local');
      process.exit(2);
    }

    const sql = fs.readFileSync('./supabase/migrations/006_reset_public_and_create_cases_table.sql', 'utf8');
    console.log('Connecting to Postgres...');
    const client = new Client({ connectionString: conn });
    await client.connect();
    console.log('Connected. Running SQL...');

    // Run as a single query; if file contains multiple statements, use simple query
    await client.query(sql);

    console.log('SQL executed successfully.');
    await client.end();
  } catch (err) {
    console.error('Error running SQL:', err.message || err);
    process.exit(1);
  }
})();
