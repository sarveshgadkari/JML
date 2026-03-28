Quick import steps for MahaRERA complaints data

1. Place your Excel file into `scripts/data/` (or provide path to file).
2. Create a local `.env` file in the repo root with:

SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

Do NOT commit service_role keys. Keep them local.

3. Create the `cases` table in Supabase with the SQL migration `supabase/migrations/002_create_cases_table.sql` (use Supabase SQL editor or psql).

4. Install dependencies (if not done already):

npm install

5. Dry-run the import to preview detected headers and a sample row:

node ./scripts/supabase-import.mjs --file "./scripts/data/yourfile.xlsx" --table cases --dry

6. If the sample/mapping looks good, run import:

# for insert (append)
node ./scripts/supabase-import.mjs --file "./scripts/data/yourfile.xlsx" --table cases

# for upsert (update existing rows by complaint_number)
node ./scripts/supabase-import.mjs --file "./scripts/data/yourfile.xlsx" --table cases --mode upsert --key complaint_number

7. After import, verify rows in Supabase Studio or with the repo's Supabase client.

If your file has different header names or you'd like a custom mapping, paste the first row (headers) here and I will adapt the script.
