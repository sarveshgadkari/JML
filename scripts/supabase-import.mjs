#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import process from 'process';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

// Load env from .env if present
dotenv.config();

// If dotenv didn't populate required keys (for example the repo's `.env` uses
// PowerShell style lines like `$env:KEY='value'`), try a small fallback parser
// that reads `.env` and extracts those assignments.
try {
  const tryFiles = ['.env', '.env.local'];
  for (const f of tryFiles) {
    if (fs.existsSync(f)) {
      const raw = fs.readFileSync(f, 'utf8');
      // PowerShell style: $env:KEY='value'
      const re = /^\s*\$env:([A-Za-z0-9_]+)\s*=\s*['"]?(.*?)['"]?\s*$/gm;
      let m;
      while ((m = re.exec(raw)) !== null) {
        const k = m[1];
        const v = m[2];
        if (!process.env[k]) process.env[k] = v;
      }
      // KEY=VALUE style
      const re2 = /^\s*([A-Za-z0-9_]+)\s*=\s*['"]?(.*?)['"]?\s*$/gm;
      while ((m = re2.exec(raw)) !== null) {
        const k = m[1];
        const v = m[2];
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
} catch (e) {
  // ignore - this is a best-effort convenience only
}

// Allow NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY to be used as a fallback (user
// added service key to .env.local under NEXT_PUBLIC_*). Do not log the key.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
}

const argv = process.argv.slice(2);
function usageAndExit() {
  console.log(`Usage: node supabase-import.mjs --file <path> --table <table> [--mode insert|upsert] [--key <upsert_key>] [--skip <n>] [--dry]

Options:
  --file   Path to .xlsx or .csv
  --table  Supabase target table
  --mode   insert (default) or upsert
  --key    primary key column for upsert (required for upsert)
  --skip   skip first N parsed rows (useful for resume)
  --dry    dry-run only (no writes)
`);
  process.exit(1);
}

if (!argv.length) usageAndExit();

const args = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--file') args.file = argv[++i];
  else if (a === '--table') args.table = argv[++i];
  else if (a === '--mode') args.mode = argv[++i];
  else if (a === '--key') args.key = argv[++i];
  else if (a === '--skip') args.skip = Number(argv[++i] || 0);
  else if (a === '--dry') args.dry = true;
  else {
    console.log('Unknown arg', a);
    usageAndExit();
  }
}

if (!args.file || !args.table) usageAndExit();
if (args.mode === 'upsert' && !args.key) { console.error('--key required for upsert'); process.exit(1); }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment before running.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function normalizeAnalyticsStatus(v) {
  if (!v) return 'pending';
  const s = String(v).trim().toLowerCase();
  if (['pending', 'disposed', 'withdrawn'].includes(s)) return s;
  return 'pending';
}

function normalizeAnalyticsOutcome(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (s.includes('settl')) return 'Settled';
  if (s.includes('dismiss')) return 'Dismissed';
  if (s.includes('withdraw')) return 'Withdrawn';
  if (s.includes('partial') || s.includes('partly')) return 'Partially Granted';
  if (s.includes('favor of complainant') || s.includes('in favour of complainant') || s.includes('favor of petitioner') || s.includes('favor of plaintiff') || s === 'won' || s.includes('allow')) return 'In favor of Complainant';
  if (s.includes('favor of respondent') || s.includes('in favour of respondent') || s === 'lost' || s.includes('reject')) return 'In favor of Respondent';
  if (['settled', 'dismissed', 'withdrawn'].includes(s)) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return null;
}

async function detectCasesSchemaVariant() {
  // Try a cheap metadata probe by selecting known columns from each variant.
  const legacyProbe = await supabase.from('cases').select('complainant').limit(1);
  if (!legacyProbe.error) return 'legacy';

  const resetProbe = await supabase.from('cases').select('title').limit(1);
  if (!resetProbe.error) return 'reset';

  const analyticsProbe = await supabase.from('cases').select('case_number').limit(1);
  if (!analyticsProbe.error) return 'analytics';

  return 'unknown';
}

function readFileRows(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    // Use xlsx parser for CSV too; it correctly handles quoted commas/newlines.
    const wb = XLSX.readFile(filePath, { raw: false });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(ws, { defval: null });
  }

  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(ws, { defval: null });
  return json;
}

function stripColumn(rows, columnName) {
  return rows.map((row) => {
    const next = { ...row };
    delete next[columnName];
    return next;
  });
}

function excelSerialToISODate(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n)) return null;
  // Excel serial date system (1900-based with leap-year bug adjustment).
  const wholeDays = Math.floor(n);
  const utcDays = wholeDays > 59 ? wholeDays - 1 : wholeDays;
  const ms = utcDays * 86400000;
  const base = Date.UTC(1899, 11, 31);
  const d = new Date(base + ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toISODate(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    // Treat plausible Excel serials as dates (roughly years 1954-2173).
    if (value >= 20000 && value <= 100000) return excelSerialToISODate(value);
    return null;
  }

  const s = String(value).trim();
  if (!s) return null;

  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n >= 20000 && n <= 100000) return excelSerialToISODate(n);
  }

  const ddmmyyyy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]);
    const year = Number(ddmmyyyy[3]);
    const d = new Date(Date.UTC(year, month - 1, day));
    if (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month - 1 &&
      d.getUTCDate() === day
    ) {
      return d.toISOString().slice(0, 10);
    }
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function looksLikeDateValue(value) {
  return !!toISODate(value);
}

(async () => {
  try {
    const rows = readFileRows(args.file);
    console.log(`Read ${rows.length} rows from ${args.file}`);
    if (!rows.length) return;

    // Normalize rows: aggregate judgeX, petitioner lawyerX, respondent lawyerX, Summary X into arrays
    function normalizeRow(r) {
      const MAX_JUDGES = 9;
      const MAX_LAWYERS = 5;
      const judges = [];
      const petitioner_lawyers = [];
      const respondent_lawyers = [];
      const summaries = [];

      for (const k of Object.keys(r)) {
        const rawVal = r[k];
        const val = rawVal === null ? null : String(rawVal).trim();
        const lower = k.toLowerCase();
        if (/^judge\s*\d+/i.test(k) || /^judge\s*\d+/i.test(lower) || /^judge\.?\s*\d*/i.test(lower)) {
          if (val && !looksLikeDateValue(rawVal)) judges.push(val);
          continue;
        }
        if (/^petitioner lawyer\s*\d+/i.test(k) || /^petitioner lawyer\s*\d+/i.test(lower)) {
          if (val) petitioner_lawyers.push(val);
          continue;
        }
        if (/^respondent lawyer\s*\d+/i.test(k) || /^respondent lawyer\s*\d+/i.test(lower)) {
          if (val) respondent_lawyers.push(val);
          continue;
        }
        if (/^summary\s*\d+/i.test(k) || /^summary\s*\d+/i.test(lower)) {
          if (val) summaries.push(val);
          continue;
        }
      }

      // Enforce known maximums and warn if exceeded
      if (judges.length > MAX_JUDGES) {
        console.warn(`Warning: found ${judges.length} judges for complaint ${r['Complaint Number'] || r['complaint number'] || ''}, truncating to ${MAX_JUDGES}`);
      }
      if (petitioner_lawyers.length > MAX_LAWYERS) {
        console.warn(`Warning: found ${petitioner_lawyers.length} petitioner lawyers for complaint ${r['Complaint Number'] || r['complaint number'] || ''}, truncating to ${MAX_LAWYERS}`);
      }
      if (respondent_lawyers.length > MAX_LAWYERS) {
        console.warn(`Warning: found ${respondent_lawyers.length} respondent lawyers for complaint ${r['Complaint Number'] || r['complaint number'] || ''}, truncating to ${MAX_LAWYERS}`);
      }

      const finalJudges = judges.slice(0, MAX_JUDGES);
      const finalPetitioners = petitioner_lawyers.slice(0, MAX_LAWYERS);
      const finalRespondents = respondent_lawyers.slice(0, MAX_LAWYERS);

      return {
        complaint_number: r['Complaint Number'] || r['complaint number'] || r['ComplaintNumber'] || r['Complaint No'] || null,
        case_title: r['Case Title'] || r['case title'] || null,
        case_type: r['Case Type'] || r['case type'] || null,
        court: r['court'] || r['Court'] || null,
        judges: finalJudges.length ? finalJudges : null,
        petitioner_lawyers: finalPetitioners.length ? finalPetitioners : null,
        respondent_lawyers: finalRespondents.length ? finalRespondents : null,
        filing_date: toISODate(r['Filing Date'] || r['filing date'] || r['FilingDate']),
        judgement_date: toISODate(r['Judgement Date'] || r['judgement date'] || r['JudgementDate'] || r['Judgment Date'] || r['JudgmentDate']),
        status: r['Status'] || r['status'] || null,
        outcome: r['Outcome'] || r['outcome'] || null,
        complainant: r['Complainant'] || r['complainant'] || null,
        respondent: r['Respondent'] || r['respondent'] || null,
        total_hearings: (() => { const v = r['Total number of hearings'] || r['Total number of hearings'] || r['total number of hearings'] || r['Total Hearings'] || null; const n = Number(v); return Number.isFinite(n) ? n : null })(),
        summaries: summaries.length ? summaries : null,
        raw_data: r
      };
    }

    const skip = Number.isFinite(args.skip) && args.skip > 0 ? args.skip : 0;
    const sourceRows = skip ? rows.slice(skip) : rows;
    if (skip) console.log(`Skipping first ${skip} source rows`);

    const normalized = sourceRows.map(normalizeRow);
    console.log('Sample normalized row:', JSON.stringify(normalized[0], null, 2));
    const headers = Object.keys(rows[0]);
    console.log('Detected headers:', headers.join(', '));

    let payload = normalized;
    let casesVariant = null;
    if (args.table === 'cases') {
      const variant = await detectCasesSchemaVariant();
      casesVariant = variant;
      console.log(`Detected cases schema variant: ${variant}`);

      if (variant === 'reset') {
        payload = normalized.map((row) => ({
          complaint_number: row.complaint_number,
          title: row.case_title,
          case_type: row.case_type,
          court_name: row.court,
          judges: row.judges,
          petitioner_lawyers: row.petitioner_lawyers,
          respondent_lawyers: row.respondent_lawyers,
          filing_date: row.filing_date,
          judgment_date: row.judgement_date,
          status: row.status,
          outcome: row.outcome,
          hearings: row.total_hearings,
          summaries: row.summaries,
          raw_data: row.raw_data,
        }));
      } else if (variant === 'analytics') {
        payload = normalized.map((row) => {
          const petitionerLawyer = Array.isArray(row.petitioner_lawyers) && row.petitioner_lawyers.length
            ? row.petitioner_lawyers[0]
            : null;
          const respondentLawyer = Array.isArray(row.respondent_lawyers) && row.respondent_lawyers.length
            ? row.respondent_lawyers[0]
            : null;
          const judge = Array.isArray(row.judges) && row.judges.length ? row.judges[0] : null;
          const filingDate = row.filing_date || row.judgement_date || '2000-01-01';

          return {
            case_number: row.complaint_number,
            case_title: row.case_title || 'Untitled case',
            case_type: row.case_type || 'Complaint',
            court_name: row.court || 'Unknown Court',
            lawyer_name: petitionerLawyer || respondentLawyer || 'Unknown Lawyer',
            lawyer_side: petitionerLawyer ? 'Petitioner' : (respondentLawyer ? 'Respondent' : null),
            judge_name: judge || 'Unknown Judge',
            filing_date: filingDate,
            judgment_date: row.judgement_date,
            total_hearings: row.total_hearings,
            status: normalizeAnalyticsStatus(row.status),
            outcome: normalizeAnalyticsOutcome(row.outcome),
            petitioner_name: row.complainant,
            respondent_name: row.respondent,
            summary: Array.isArray(row.summaries) ? row.summaries.join('\n') : null,
            data_source: 'csv_import',
            verified: false,
          };
        }).filter((row) => row.case_number);
      } else if (variant === 'unknown') {
        console.warn('Warning: could not confidently detect cases table variant; using legacy payload.');
      }
    }

    if (args.dry) { console.log('Dry run - exiting'); return; }

    // Batch insert/upsert in groups of 200
    const batchSize = 200;
    let activePayload = payload;
    for (let i = 0; i < payload.length; i += batchSize) {
      let batch = activePayload.slice(i, i + batchSize);
      console.log(`Processing rows ${i + 1}..${i + batch.length}`);

      while (true) {
        let res;
        if (args.mode === 'upsert') {
          const conflict =
            args.key ||
            (args.table === 'cases' && casesVariant === 'analytics'
              ? 'case_number'
              : 'complaint_number');
          res = await supabase.from(args.table).upsert(batch, { onConflict: conflict });
        } else {
          res = await supabase.from(args.table).insert(batch);
        }

        if (!res.error) {
          console.log(`Batch OK: ${batch.length} rows`);
          break;
        }

        const msg = String(res.error.message || res.error);
        const missing = msg.match(/Could not find the '([^']+)' column/i);
        if (missing && missing[1]) {
          const missingCol = missing[1];
          console.warn(`Schema mismatch: dropping unsupported column '${missingCol}' and retrying...`);
          activePayload = stripColumn(activePayload, missingCol);
          batch = activePayload.slice(i, i + batchSize);
          continue;
        }

        console.error('Supabase error:', msg);
        process.exit(1);
      }
    }

    if (args.table === 'cases') {
      const { error: syncError } = await supabase.rpc('sync_reference_tables_from_cases', { p_cleanup_demo: false });
      if (syncError) {
        console.warn('Post-import reference sync skipped:', syncError.message || syncError);
      } else {
        console.log('Post-import reference sync completed');
      }
    }

    console.log('Import complete');
  } catch (err) {
    console.error('Import failed:', err.message || err);
    process.exit(1);
  }
})();
