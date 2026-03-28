#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
let file;
let outPath;
for (let i=0;i<argv.length;i++){
  if(argv[i]==='--file') file=argv[++i];
  if(argv[i]==='--out') outPath=argv[++i];
}
if(!file){
  console.error('Usage: node normalize-dry.mjs --file <path> [--out <out.json>]');
  process.exit(1);
}

function readFileRows(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    const txt = fs.readFileSync(filePath, 'utf8');
    const lines = txt.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      // naive CSV split (works for simple CSVs without quoted commas)
      const cols = line.split(',');
      const obj = {};
      headers.forEach((h, i) => obj[h] = cols[i] ? cols[i].trim() : null);
      return obj;
    });
  }
  console.error('Only CSV supported for this quick dry-run');
  process.exit(1);
}

function normalizeRow(r) {
  const MAX_JUDGES = 9;
  const MAX_LAWYERS = 5;
  const judges = [];
  const petitioner_lawyers = [];
  const respondent_lawyers = [];
  const summaries = [];

  for (const k of Object.keys(r)) {
    const val = r[k] === null ? null : String(r[k]).trim();
    const lower = k.toLowerCase();
    if (/^judge\s*\d+/i.test(k) || /^judge\s*\d+/i.test(lower) || /^judge\.?\s*\d*/i.test(lower)) {
      if (val) judges.push(val);
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
  // Enforce known maximums and log if exceeded
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

  const mapDate = (s) => {
    if (!s) return null;
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0,10);
    return null;
  };

  return {
    complaint_number: r['Complaint Number'] || r['complaint number'] || r['ComplaintNumber'] || r['Complaint No'] || null,
    case_title: r['Case Title'] || r['case title'] || null,
    case_type: r['Case Type'] || r['case type'] || null,
    court: r['court'] || r['Court'] || null,
    judges: finalJudges.length ? finalJudges : null,
    petitioner_lawyers: finalPetitioners.length ? finalPetitioners : null,
    respondent_lawyers: finalRespondents.length ? finalRespondents : null,
    filing_date: mapDate(r['Filing Date'] || r['filing date'] || r['FilingDate']),
    judgement_date: mapDate(r['Judgement Date'] || r['judgement date'] || r['JudgementDate'] || r['Judgment Date'] || r['JudgmentDate']),
    status: r['Status'] || r['status'] || null,
    outcome: r['Outcome'] || r['outcome'] || null,
    complainant: r['Complainant'] || r['complainant'] || null,
    respondent: r['Respondent'] || r['respondent'] || null,
    total_hearings: (() => { const v = r['Total number of hearings'] || r['total number of hearings'] || r['Total Hearings'] || null; const n = Number(v); return Number.isFinite(n) ? n : null })(),
    summaries: summaries.length ? summaries : null,
    raw_data: r
  };
}

try{
  const rows = readFileRows(file);
  console.log(`Read ${rows.length} rows from ${file}`);
  if(!rows.length) process.exit(0);
  const normalized = rows.map(normalizeRow);
  const detected = Object.keys(rows[0]).join(', ');
  const sample = normalized[0];
  if (outPath) {
    const out = { detected_headers: detected, sample_normalized_row: sample, count: rows.length };
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  }
  console.log('Detected headers:', detected);
  console.log('Sample normalized row:\n', JSON.stringify(sample, null, 2));
} catch(err){
  console.error('Failed:', err.message || err);
  process.exit(1);
}
