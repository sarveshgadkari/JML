import { useEffect, useMemo, useRef, useState } from 'react';
import { Users, Scale, Building2, TrendingUp, Upload, Database, Edit2, Save, Trash2, X, ClipboardList } from 'lucide-react';
import * as XLSX from 'xlsx';
import getSupabase from '../../utils/supabase/client';
import PdfExtractionDashboard from './admin/pdf/PdfExtractionDashboard';

export default function AdminDashboard({ onSwitchToLawyer }: { onSwitchToLawyer?: () => void }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'data-tools' | 'manage-lawyers' | 'manage-judges' | 'manage-courts' | 'manage-cases' | 'manage-claims'>('overview');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [loadingTable, setLoadingTable] = useState(false);
  const [search, setSearch] = useState('');
  const [lawyers, setLawyers] = useState<any[]>([]);
  const [judges, setJudges] = useState<any[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [editing, setEditing] = useState<{ table: 'lawyers' | 'judges' | 'courts' | 'cases'; row: any } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergeDialog, setMergeDialog] = useState<{ table: 'lawyers' | 'judges' | 'courts' | 'cases' } | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeFinalName, setMergeFinalName] = useState('');
  const [mergePreviewLoading, setMergePreviewLoading] = useState(false);
  const [mergePreview, setMergePreview] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({
    lawyers: 0,
    judges: 0,
    courts: 0,
    cases: 0,
  });
  const [cardClaims, setCardClaims] = useState<any[]>([]);
  const [caseClaims, setCaseClaims] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      const supabase = getSupabase();
      const [l, j, c, cs] = await Promise.all([
        supabase.from('lawyers').select('id', { count: 'exact', head: true }),
        supabase.from('judges').select('id', { count: 'exact', head: true }),
        supabase.from('courts').select('id', { count: 'exact', head: true }),
        supabase.from('cases').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        lawyers: l.count || 0,
        judges: j.count || 0,
        courts: c.count || 0,
        cases: cs.count || 0,
      });
    } catch {
      // keep defaults
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await fetchStats();
      } catch {
        // keep defaults
      }
    })();
    return () => {
      mounted = false;
    };
  }, [message]);

  const loadTableData = async (tab: 'manage-lawyers' | 'manage-judges' | 'manage-courts' | 'manage-cases' | 'manage-claims') => {
    setLoadingTable(true);
    setMessage('');
    try {
      const supabase = getSupabase();
      if (tab === 'manage-lawyers') {
        let q = supabase.from('lawyers').select('id,name,email,phone,is_admin,is_verified,created_at').order('created_at', { ascending: false }).limit(300);
        if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
        const { data, error } = await q;
        if (error) throw error;
        setLawyers(data ?? []);
        setSelectedIds([]);
      } else if (tab === 'manage-judges') {
        let q = supabase.from('judges').select('id,name,designation,created_at').order('created_at', { ascending: false }).limit(300);
        if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
        const { data, error } = await q;
        if (error) throw error;
        setJudges(data ?? []);
        setSelectedIds([]);
      } else if (tab === 'manage-courts') {
        let q = supabase.from('courts').select('id,name,type,created_at').order('created_at', { ascending: false }).limit(300);
        if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
        const { data, error } = await q;
        if (error) throw error;
        setCourts(data ?? []);
        setSelectedIds([]);
      } else if (tab === 'manage-cases') {
        let q = supabase
          .from('cases')
          .select('id,case_number,case_title,case_type,court_name,status,outcome,filing_date,judgment_date,total_hearings,judge_1,judge_2,judge_3,judge_4,judge_5,judge_6,judge_7,judge_8,judge_9,petitioner_lawyer_1,petitioner_lawyer_2,petitioner_lawyer_3,petitioner_lawyer_4,petitioner_lawyer_5,respondent_lawyer_1,respondent_lawyer_2,respondent_lawyer_3,respondent_lawyer_4,respondent_lawyer_5')
          .order('updated_at', { ascending: false })
          .limit(300);
        if (search.trim()) q = q.or(`case_number.ilike.%${search.trim()}%,case_title.ilike.%${search.trim()}%`);
        const { data, error } = await q;
        if (error) throw error;
        setCases(data ?? []);
        setSelectedIds([]);
      } else if (tab === 'manage-claims') {
        // Load both card and case claims
        const [cc, jc] = await Promise.all([
          supabase
            .from('card_claims')
            .select('id,lawyer_id,claimed_names,preferred_name,bar_registration_number,notes,status,created_at')
            .order('created_at', { ascending: false })
            .limit(300),
          supabase
            .from('case_claims')
            .select('id,lawyer_id,case_id,case_number,role,vakaalatnama_url,client_name,notes,status,created_at')
            .order('created_at', { ascending: false })
            .limit(300),
        ]);
        if (cc.error) throw cc.error;
        if (jc.error) throw jc.error;
        setCardClaims(cc.data ?? []);
        setCaseClaims(jc.data ?? []);
      }
    } catch (e: any) {
      setMessage(`Load failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'manage-lawyers' || activeTab === 'manage-judges' || activeTab === 'manage-courts' || activeTab === 'manage-cases' || activeTab === 'manage-claims') {
      loadTableData(activeTab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const parseDate = (value: any): string | null => {
    if (value === null || value === undefined || value === '') return null;
    const s = String(value).trim();
    if (!s) return null;
    const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (dmy) {
      const day = Number(dmy[1]);
      const month = Number(dmy[2]);
      const year = Number(dmy[3]);
      const dt = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    }
    const n = Number(s);
    if (Number.isFinite(n) && n >= 20000 && n <= 100000) {
      const wholeDays = Math.floor(n);
      const utcDays = wholeDays > 59 ? wholeDays - 1 : wholeDays;
      const base = Date.UTC(1899, 11, 31);
      const d = new Date(base + utcDays * 86400000);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    return null;
  };

  const rowsToPayload = async (f: File) => {
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, any>[];

    const findFirstByKeyRegex = (row: Record<string, any>, keyRegexes: RegExp[]) => {
      const keys = Object.keys(row);
      for (const k of keys) {
        const norm = k.toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (keyRegexes.some((re) => re.test(norm))) return row[k];
      }
      return null;
    };

    const collectByKeyRegexWithIndex = (
      row: Record<string, any>,
      keyRegex: RegExp,
      maxCount: number
    ) => {
      const entries = Object.entries(row)
        .map(([k, v]) => {
          const norm = k.toLowerCase();
          if (!keyRegex.test(norm)) return null;
          const m = norm.match(/(\d+)/);
          const idx = m ? Number(m[1]) : 0;
          return { idx, value: v };
        })
        .filter(Boolean) as Array<{ idx: number; value: any }>;

      entries.sort((a, b) => a.idx - b.idx);
      return entries
        .map((e) => (e.value === null || e.value === undefined ? null : String(e.value).trim()))
        .filter((v) => !!v && v !== '0' && v.toLowerCase() !== 'nan')
        .slice(0, maxCount);
    };

    const payload = rows.map((r) => {
      const caseNumber = findFirstByKeyRegex(r, [/compla/i, /complaint/i, /case number/i, /case_number/i]);
      const caseTitle = findFirstByKeyRegex(r, [/case title/i, /case ti/i, /case titl/i]) ?? 'Untitled case';
      const caseType = findFirstByKeyRegex(r, [/case type/i, /case ty/i, /case type/i]) ?? 'Complaint';
      const courtName = findFirstByKeyRegex(r, [/court/i]) ?? 'Unknown Court';
      const outcomeRaw = findFirstByKeyRegex(r, [/outcome/i]);

      // Excel headers vary: some use "judge 1..9", some "Judgem", etc. We collect by regex + index.
      const judges = collectByKeyRegexWithIndex(r, /^judge\s*\d+|^judge\d+/i, 9);
      const pLawyers = collectByKeyRegexWithIndex(r, /^(petitioner\s*lawyer|petition)\s*\d+|^(petitioner\s*lawyer|petition)\d+/i, 5);
      const rLawyers = collectByKeyRegexWithIndex(r, /^(respondent\s*lawyer|respond)\s*\d+|^(respondent\s*lawyer|respond)\d+/i, 5);

      const summaryValues = collectByKeyRegexWithIndex(r, /^summary\s*\d+|^summary\d+/i, 50);
      const summaries = summaryValues.length ? summaryValues : [];

      const petitioner_lawyers = pLawyers.length ? pLawyers : ['Complainant without a lawyer'];
      const respondent_lawyers = rLawyers.length ? rLawyers : ['Respondent without a Lawyer'];
      const judges_final = judges.length ? judges : ['Unknown Judge'];

      const j = (i: number) => judges_final[i] ?? null;
      const pl = (i: number) => petitioner_lawyers[i] ?? null;
      const rl = (i: number) => respondent_lawyers[i] ?? null;

      return {
        case_number: caseNumber ? String(caseNumber).trim() : null,
        case_title: String(caseTitle),
        case_type: String(caseType),
        court_name: String(courtName),
        petitioner_name: findFirstByKeyRegex(r, [/complainant/i, /petitioner_name/i, /petition$/i]) ?? null,
        respondent_name: findFirstByKeyRegex(r, [/respondent/i, /respondent_name/i, /respond$/i]) ?? null,

        // Wide schema: up to 9 judges
        judge_1: j(0),
        judge_2: j(1),
        judge_3: j(2),
        judge_4: j(3),
        judge_5: j(4),
        judge_6: j(5),
        judge_7: j(6),
        judge_8: j(7),
        judge_9: j(8),

        // Wide schema: up to 5 lawyers per side
        petitioner_lawyer_1: pl(0),
        petitioner_lawyer_2: pl(1),
        petitioner_lawyer_3: pl(2),
        petitioner_lawyer_4: pl(3),
        petitioner_lawyer_5: pl(4),

        respondent_lawyer_1: rl(0),
        respondent_lawyer_2: rl(1),
        respondent_lawyer_3: rl(2),
        respondent_lawyer_4: rl(3),
        respondent_lawyer_5: rl(4),

        filing_date: parseDate(r['Filing Date'] || r['filing date'] || r['FilingDate']),
        judgment_date: parseDate(r['Judgement Date'] || r['Judgment Date'] || r['judgement_date'] || r['judgment_date']),
        total_hearings:
          Number(
            findFirstByKeyRegex(r, [/total number of hearings/i, /hearings/i])
          ) || Number(r['total_hearings'] ?? 0) || 0,
        status: (() => {
          const statusRaw = findFirstByKeyRegex(r, [/status/i, /disposal/i]);
          const s = String(statusRaw ?? 'pending').toLowerCase();
          return s.includes('dispose') || s.includes('disposed') ? 'disposed' : 'pending';
        })(),
        outcome: outcomeRaw ? String(outcomeRaw).trim() : null,
        summary: summaries.join('\n') || null,
        data_source: 'csv_import',
        verified: false,
      };
    }).filter((x) => x.case_number);

    return payload;
  };

  const resetAllData = async () => {
    setBusy(true);
    setMessage('');
    try {
      const supabase = getSupabase();
      const { error } = await supabase.rpc('admin_reset_data', { p_delete_cases: true });
      if (error) throw error;
      setMessage('All data reset complete. You can upload fresh cases now.');
      await fetchStats();
      setLawyers([]);
      setJudges([]);
      setCourts([]);
      setCases([]);
    } catch (e: any) {
      setMessage(`Reset failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const uploadCases = async () => {
    if (!file) {
      setMessage('Please choose a CSV/XLSX file first.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const payload = await rowsToPayload(file);
      const supabase = getSupabase();

      // Batch the RPC calls to avoid overwhelming PostgREST / DB on large Excel files.
      // Also skip expensive reference-sync during intermediate batches.
      const batchSize = 100;
      let processed = 0;
      for (let i = 0; i < payload.length; i += batchSize) {
        const batch = payload.slice(i, i + batchSize);
        const isLast = i + batchSize >= payload.length;
        setMessage(`Uploading batch ${Math.floor(i / batchSize) + 1}... rows ${i + 1}-${i + batch.length}`);
        const { error } = await supabase.rpc('admin_import_cases_json_skip_sync', {
          p_rows: batch,
          p_replace_existing: false,
          p_skip_sync: !isLast,
        });
        if (error) throw error;
        processed += batch.length;
      }

      setMessage(`Upload complete. Processed ${processed} rows.`);
      await fetchStats();
    } catch (e: any) {
      setMessage(`Upload failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleUploadButtonClick = () => {
    if (!file) {
      fileInputRef.current?.click();
      return;
    }
    void uploadCases();
  };

  const runMasterTableAnalysis = async () => {
    setBusy(true);
    setMessage('');
    try {
      const supabase = getSupabase();

      // Run client-side wide rebuild deterministically (no server paging reliance)
      setMessage('Running master analysis (client-wide rebuild)…');
      await rebuildLawyerAnalyticsClientWide();

      // Recompute tri-factor ranks on refreshed analytics
      const { error: triErr } = await supabase.rpc('admin_compute_tri_ranks_all', { p_batch_size: 200 });
      if (triErr) throw triErr;

      // Summarize from lawyer_analytics after rebuild
      const { count: lawyerCount } = await supabase.from('lawyer_analytics').select('lawyer_id', { count: 'exact', head: true });
      setMessage(`Master analysis complete. Updated analytics for ${lawyerCount ?? 0} lawyers and recomputed tri‑factor ranks.`);
    } catch (e: any) {
      setMessage(`Master analysis failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const normalizeName = (s: string | null | undefined) => {
    if (!s) return '';
    let x = String(s)
      .toLowerCase()
      .replace(/[\u2018\u2019\u201C\u201D]/g, "'");
    // remove anything in parentheses
    x = x.replace(/\([^)]*\)/g, ' ');
    // strip role phrases
    x = x
      .replace(/\b(for\s+complainant|for\s+respondent|present\s+for\s+complainant|present\s+for\s+respondent)\b/g, ' ');
    // strip common titles/honorifics/legal prefixes
    x = x.replace(/\b(adv\.?|advocate|ld\.?|mr\.?|mrs\.?|ms\.?|shri|smt|dr\.?|prof\.?|c\.?a\.?)\b/g, ' ');
    // punctuation and stray symbols
    x = x.replace(/[.,/\\|:;~`"!@#$%^&*_+=\-]+/g, ' ');
    // collapse whitespace
    x = x.replace(/\s+/g, ' ').trim();
    return x;
  };

  const rebuildLawyerAnalyticsClientWide = async () => {
    const supabase = getSupabase();
    setMessage('Rebuilding lawyer analytics (wide) ...');

    const normalizeOutcome = (outcomeRaw: string | null, statusRaw: string | null, summaryRaw: string | null) => {
      const o = (outcomeRaw ?? '').toLowerCase();
      const s = (statusRaw ?? '').toLowerCase();
      const sum = (summaryRaw ?? '').toLowerCase();
      const hay = `${o} ${s} ${sum}`;
      if (/settled|conciliation|compromise/.test(hay)) return 'settled';
      if (/(in\s+favor\s+of\s+complainant|complainant\s+win|complainant\s+allowed|allowed\s+complaint)/.test(hay)) return 'complainant';
      if (/(in\s+favor\s+of\s+respondent|respondent\s+win|complaint\s+dismissed|rejected)/.test(hay)) return 'respondent';
      return 'other';
    };

    // Build lawyer lookup by canonical name
    const lawyersMap = new Map<string, { id: string; name: string }>();
    {
      let from = 0;
      const page = 1000;
      while (true) {
        const { data, error } = await supabase.from('lawyers').select('id,name').range(from, from + page - 1);
        if (error) throw error;
        (data ?? []).forEach((l: any) => {
          const k = normalizeName(l.name);
          if (k) lawyersMap.set(k, { id: l.id, name: l.name });
        });
        if (!data || data.length < page) break;
        from += page;
      }
    }

    type Acc = {
      lawyer_id: string;
      lawyer_name: string;
      cases: Set<string>;
      won: number;
      lost: number;
      settled: number;
      durationSum: number;
      durationCount: number;
    };
    const accByLawyerId = new Map<string, Acc>();

    const credit = (rawName: string | null, caseNumber: string, side: 'Complainant' | 'Respondent', normOutcome: 'complainant' | 'respondent' | 'settled' | 'other', filing: string | null, judgment: string | null) => {
      const keyName = normalizeName(rawName);
      if (!keyName) return;
      const lawyer = lawyersMap.get(keyName);
      if (!lawyer) return;
      let acc = accByLawyerId.get(lawyer.id);
      if (!acc) {
        acc = { lawyer_id: lawyer.id, lawyer_name: lawyer.name, cases: new Set(), won: 0, lost: 0, settled: 0, durationSum: 0, durationCount: 0 };
        accByLawyerId.set(lawyer.id, acc);
      }
      if (!acc.cases.has(caseNumber)) acc.cases.add(caseNumber); // Always count appearances to reflect experience
      // Only outcome-specific tallies require explicit normalization
      if (normOutcome === 'settled') acc.settled += 1;
      else if (normOutcome === 'complainant') {
        if (side === 'Complainant') acc.won += 1;
        else acc.lost += 1;
      } else if (normOutcome === 'respondent') {
        if (side === 'Respondent') acc.won += 1;
        else acc.lost += 1;
      }
      // Duration analysis can still proceed independently when dates exist
      if (filing && judgment) {
        const d = (new Date(judgment).getTime() - new Date(filing).getTime()) / 86400000;
        if (Number.isFinite(d) && d >= 0) {
          acc.durationSum += Math.round(d);
          acc.durationCount += 1;
        }
      }
    };

    // Stream cases in batches
    {
      let from = 0;
      const page = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('cases')
          .select('case_number,outcome,status,summary,filing_date,judgment_date,petitioner_lawyer_1,petitioner_lawyer_2,petitioner_lawyer_3,petitioner_lawyer_4,petitioner_lawyer_5,respondent_lawyer_1,respondent_lawyer_2,respondent_lawyer_3,respondent_lawyer_4,respondent_lawyer_5')
          .order('updated_at', { ascending: false })
          .range(from, from + page - 1);
        if (error) throw error;
        (data ?? []).forEach((c: any) => {
          const cn = String(c.case_number ?? '').trim();
          const norm = normalizeOutcome(c.outcome ?? null, c.status ?? null, c.summary ?? null) as 'complainant' | 'respondent' | 'settled' | 'other';
          const fd = c.filing_date ?? null;
          const jd = c.judgment_date ?? null;
          const pets = [c.petitioner_lawyer_1, c.petitioner_lawyer_2, c.petitioner_lawyer_3, c.petitioner_lawyer_4, c.petitioner_lawyer_5];
          const ress = [c.respondent_lawyer_1, c.respondent_lawyer_2, c.respondent_lawyer_3, c.respondent_lawyer_4, c.respondent_lawyer_5];
          pets.filter(Boolean).forEach((n: string) => credit(n, cn, 'Complainant', norm, fd, jd));
          ress.filter(Boolean).forEach((n: string) => credit(n, cn, 'Respondent', norm, fd, jd));
        });
        if (!data || data.length < page) break;
        from += page;
        setMessage(`Rebuilding lawyer analytics (wide) ... processed ${from} cases`);
      }
    }

    // Prepare upserts
    const rows = Array.from(accByLawyerId.values()).map((a) => {
      const total = a.cases.size;
      const win_rate = total > 0 ? Math.round(((a.won / total) * 100 + Number.EPSILON) * 100) / 100 : 0;
      const loss_rate = total > 0 ? Math.round(((a.lost / total) * 100 + Number.EPSILON) * 100) / 100 : 0;
      const settlement_rate = total > 0 ? Math.round(((a.settled / total) * 100 + Number.EPSILON) * 100) / 100 : 0;
      const avg_case_duration_days = a.durationCount > 0 ? Math.round((a.durationSum / a.durationCount + Number.EPSILON) * 100) / 100 : 0;
      return {
        lawyer_id: a.lawyer_id,
        lawyer_name: a.lawyer_name,
        total_cases: total,
        won_cases: a.won,
        lost_cases: a.lost,
        settled_cases: a.settled,
        duration_count: a.durationCount,
        duration_sum_days: a.durationSum,
        win_rate,
        loss_rate,
        settlement_rate,
        avg_case_duration_days,
        updated_at: new Date().toISOString(),
      };
    });

    // Upsert in chunks
    const chunk = 200;
    for (let i = 0; i < rows.length; i += chunk) {
      const slice = rows.slice(i, i + chunk);
      const { error } = await supabase.from('lawyer_analytics').upsert(slice, { onConflict: 'lawyer_id' });
      if (error) throw error;
      setMessage(`Rebuilding lawyer analytics (wide) ... upserted ${Math.min(i + chunk, rows.length)} / ${rows.length}`);
    }
    setMessage(`Rebuilding lawyer analytics (wide) ... completed for ${rows.length} lawyers`);
  };

  const currentRows =
    activeTab === 'manage-lawyers'
      ? lawyers
      : activeTab === 'manage-judges'
        ? judges
        : activeTab === 'manage-courts'
          ? courts
          : activeTab === 'manage-cases'
            ? cases
            : [];
  const currentTable =
    activeTab === 'manage-lawyers'
      ? 'lawyers'
      : activeTab === 'manage-judges'
        ? 'judges'
        : activeTab === 'manage-courts'
          ? 'courts'
          : 'cases';

  const removeRow = async (table: 'lawyers' | 'judges' | 'courts' | 'cases', id: string) => {
    setBusy(true);
    setMessage('');
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      setMessage(`Deleted 1 row from ${table}.`);
      await fetchStats();
      if (activeTab === 'manage-lawyers' || activeTab === 'manage-judges' || activeTab === 'manage-courts' || activeTab === 'manage-cases') {
        await loadTableData(activeTab);
      }
    } catch (e: any) {
      setMessage(`Delete failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    setMessage('');
    try {
      const supabase = getSupabase();
      const { table, row } = editing;
      const id = row.id;
      const payload = { ...row };
      delete payload.id;
      const { error } = await supabase.from(table).update(payload).eq('id', id);
      if (error) throw error;
      setEditing(null);
      setMessage('Row updated successfully.');
      if (activeTab === 'manage-lawyers' || activeTab === 'manage-judges' || activeTab === 'manage-courts' || activeTab === 'manage-cases') {
        await loadTableData(activeTab);
      }
    } catch (e: any) {
      setMessage(`Update failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const mergeRows = async () => {
    if (!mergeDialog) return;
    if (selectedIds.length < 2) {
      setMessage('Select at least 2 records to merge.');
      return;
    }
    if (!mergeTargetId || !selectedIds.includes(mergeTargetId)) {
      setMessage('Choose one selected record as target.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const supabase = getSupabase();
      const { table } = mergeDialog;
      const targetId = mergeTargetId;
      const sourceIds = selectedIds.filter((id) => id !== targetId);

      if (table === 'lawyers') {
        const target = lawyers.find((x) => x.id === targetId);
        await supabase.from('cases').update({ lawyer_id: targetId, lawyer_name: mergeFinalName || target?.name || null }).in('lawyer_id', sourceIds);
        await supabase.from('saved_lawyers').update({ lawyer_id: targetId }).in('lawyer_id', sourceIds);
        await supabase.from('consultation_requests').update({ lawyer_id: targetId }).in('lawyer_id', sourceIds);
        await supabase.from('card_claims').update({ lawyer_id: targetId }).in('lawyer_id', sourceIds);
        await supabase.from('card_claims').update({ reviewed_by: targetId }).in('reviewed_by', sourceIds);
        await supabase.from('case_claims').update({ lawyer_id: targetId }).in('lawyer_id', sourceIds);
        await supabase.from('case_claims').update({ reviewed_by: targetId }).in('reviewed_by', sourceIds);
        await supabase.from('lawyers').update({ name: mergeFinalName || target?.name || null }).eq('id', targetId);
      } else if (table === 'judges') {
        const target = judges.find((x) => x.id === targetId);
        await supabase.from('cases').update({ judge_id: targetId, judge_name: mergeFinalName || target?.name || null }).in('judge_id', sourceIds);
        await supabase.from('judges').update({ name: mergeFinalName || target?.name || null }).eq('id', targetId);
      } else if (table === 'courts') {
        const target = courts.find((x) => x.id === targetId);
        await supabase.from('cases').update({ court_id: targetId, court_name: mergeFinalName || target?.name || null }).in('court_id', sourceIds);
        await supabase.from('courts').update({ name: mergeFinalName || target?.name || null }).eq('id', targetId);
      } else {
        const targetCase = cases.find((x) => x.id === targetId);
        if (targetCase?.case_number) {
          await supabase.from('case_claims').update({ case_id: targetId, case_number: targetCase.case_number }).in('case_id', sourceIds);
        }
        await supabase.from('cases').update({ case_title: mergeFinalName || targetCase?.case_title || null }).eq('id', targetId);
      }

      const { error: delError } = await supabase.from(table).delete().in('id', sourceIds);
      if (delError) throw delError;

      setMergeDialog(null);
      setMergeTargetId('');
      setMergeFinalName('');
      setSelectedIds([]);
      setMessage(`Merged ${sourceIds.length + 1} ${table} records successfully.`);
      await fetchStats();
      if (activeTab === 'manage-lawyers' || activeTab === 'manage-judges' || activeTab === 'manage-courts' || activeTab === 'manage-cases') {
        await loadTableData(activeTab);
      }
    } catch (e: any) {
      setMessage(`Merge failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const loadMergePreview = async () => {
    if (!mergeDialog || selectedIds.length < 2) {
      setMergePreview({});
      return;
    }
    const sourceIds = selectedIds.filter((id) => id !== mergeTargetId);
    if (!sourceIds.length) {
      setMergePreview({});
      return;
    }

    setMergePreviewLoading(true);
    try {
      const supabase = getSupabase();
      if (mergeDialog.table === 'lawyers') {
        const [casesC, savedC, reqC, cardClaimC, caseClaimC] = await Promise.all([
          supabase.from('cases').select('id', { count: 'exact', head: true }).in('lawyer_id', sourceIds),
          supabase.from('saved_lawyers').select('id', { count: 'exact', head: true }).in('lawyer_id', sourceIds),
          supabase.from('consultation_requests').select('id', { count: 'exact', head: true }).in('lawyer_id', sourceIds),
          supabase.from('card_claims').select('id', { count: 'exact', head: true }).in('lawyer_id', sourceIds),
          supabase.from('case_claims').select('id', { count: 'exact', head: true }).in('lawyer_id', sourceIds),
        ]);
        setMergePreview({
          cases: casesC.count || 0,
          saved_lawyers: savedC.count || 0,
          consultation_requests: reqC.count || 0,
          card_claims: cardClaimC.count || 0,
          case_claims: caseClaimC.count || 0,
        });
      } else if (mergeDialog.table === 'judges') {
        const { count } = await supabase.from('cases').select('id', { count: 'exact', head: true }).in('judge_id', sourceIds);
        setMergePreview({ cases: count || 0 });
      } else if (mergeDialog.table === 'courts') {
        const { count } = await supabase.from('cases').select('id', { count: 'exact', head: true }).in('court_id', sourceIds);
        setMergePreview({ cases: count || 0 });
      } else {
        const { count } = await supabase.from('case_claims').select('id', { count: 'exact', head: true }).in('case_id', sourceIds);
        setMergePreview({ case_claims: count || 0 });
      }
    } catch {
      setMergePreview({});
    } finally {
      setMergePreviewLoading(false);
    }
  };

  useEffect(() => {
    if (mergeDialog) loadMergePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergeDialog, mergeTargetId, selectedIds.join(',')]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">Manage platform data, verify profiles, and monitor system activity</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSwitchToLawyer && onSwitchToLawyer()}
              className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Switch to Lawyer Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
        <div className="flex flex-wrap border-b border-gray-200">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all border-b-2 ${
              activeTab === 'overview'
                ? 'border-[#1e3a8a] text-[#1e3a8a] bg-blue-50'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('manage-lawyers')}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all border-b-2 ${
              activeTab === 'manage-lawyers'
                ? 'border-[#1e3a8a] text-[#1e3a8a] bg-blue-50'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Users className="w-5 h-5" />
            Manage Lawyers
          </button>
          <button
            onClick={() => setActiveTab('manage-judges')}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all border-b-2 ${
              activeTab === 'manage-judges'
                ? 'border-[#1e3a8a] text-[#1e3a8a] bg-blue-50'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Scale className="w-5 h-5" />
            Manage Judges
          </button>
          <button
            onClick={() => setActiveTab('manage-cases')}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all border-b-2 ${
              activeTab === 'manage-cases'
                ? 'border-[#1e3a8a] text-[#1e3a8a] bg-blue-50'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Building2 className="w-5 h-5" />
            Manage Cases
          </button>
          <button
            onClick={() => setActiveTab('manage-courts')}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all border-b-2 ${
              activeTab === 'manage-courts'
                ? 'border-[#1e3a8a] text-[#1e3a8a] bg-blue-50'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Building2 className="w-5 h-5" />
            Manage Courts
          </button>
          <button
            onClick={() => setActiveTab('manage-claims')}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all border-b-2 ${
              activeTab === 'manage-claims'
                ? 'border-[#1e3a8a] text-[#1e3a8a] bg-blue-50'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            Manage Claims
          </button>
          <button
            onClick={() => setActiveTab('data-tools')}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all border-b-2 ${
              activeTab === 'data-tools'
                ? 'border-[#1e3a8a] text-[#1e3a8a] bg-blue-50'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Database className="w-5 h-5" />
            Data Tools
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Stats Overview */}
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-600">Total Lawyers</span>
              </div>
              <p className="text-3xl font-bold text-blue-600">{stats.lawyers}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="w-5 h-5 text-purple-600" />
                <span className="text-sm text-gray-600">Total Judges</span>
              </div>
              <p className="text-3xl font-bold text-purple-600">{stats.judges}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-600">Total Courts</span>
              </div>
              <p className="text-3xl font-bold text-green-600">{stats.courts}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                <span className="text-sm text-gray-600">Total Cases</span>
              </div>
              <p className="text-3xl font-bold text-orange-600">{stats.cases.toLocaleString()}</p>
            </div>
          </div>

          {/* Upload (Prominent) */}
          <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Upload Cases (CSV/XLSX)</h3>
                <p className="text-sm text-gray-600">
                  Upload master case data. Related lawyer/judge/court records are auto-synced.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('data-tools')}
                className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Open Data Tools
              </button>
            </div>
            <div className="mt-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const f = e.dataTransfer.files?.[0];
                  if (f) setFile(f);
                }}
                className="mb-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700"
              >
                <div className="font-semibold text-slate-900">Drag & drop a CSV/XLSX here</div>
                <div className="text-slate-600">or use the file picker below.</div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mb-3 block w-full text-sm"
              />
              <button
                onClick={handleUploadButtonClick}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {busy ? 'Uploading...' : file ? 'Upload Cases' : 'Choose File and Upload'}
                          </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <button className="bg-blue-600 text-white p-6 rounded-lg hover:bg-blue-700 transition text-left">
              <Users className="w-8 h-8 mb-2" />
              <h3 className="font-semibold mb-1">Manage Lawyers</h3>
              <p className="text-sm text-blue-100">View and manage all lawyer profiles</p>
            </button>

            <button className="bg-purple-600 text-white p-6 rounded-lg hover:bg-purple-700 transition text-left">
              <Scale className="w-8 h-8 mb-2" />
              <h3 className="font-semibold mb-1">Manage Judges</h3>
              <p className="text-sm text-purple-100">View and manage all judge profiles</p>
            </button>

            <button
              onClick={() => setActiveTab('manage-cases')}
              className="bg-indigo-600 text-white p-6 rounded-lg hover:bg-indigo-700 transition text-left"
            >
              <Building2 className="w-8 h-8 mb-2" />
              <h3 className="font-semibold mb-1">Manage Cases</h3>
              <p className="text-sm text-indigo-100">Modify individual case records</p>
            </button>

            <button 
              onClick={() => setActiveTab('data-tools')}
              className="bg-green-600 text-white p-6 rounded-lg hover:bg-green-700 transition text-left"
            >
              <Database className="w-8 h-8 mb-2" />
              <h3 className="font-semibold mb-1">Data Tools</h3>
              <p className="text-sm text-green-100">Delete existing data and upload cases</p>
            </button>
          </div>

          {/* System Status */}
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-green-900 mb-1">System Status: All Systems Operational</h3>
                <p className="text-sm text-green-700">
                  Admin data tools are active. Counts above are from live Supabase tables.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'data-tools' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <h3 className="text-lg font-semibold text-red-900 mb-2">Danger Zone</h3>
            <p className="text-sm text-red-700 mb-4">
              Deletes existing platform data (including cases) and keeps only account-level auth users.
            </p>
            <button
              onClick={resetAllData}
              disabled={busy}
              className="rounded-lg bg-red-600 px-4 py-2 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? 'Working...' : 'Delete Existing Data'}
            </button>
          </div>

          {/* PDF Judgment Extraction Engine */}
          <div className="rounded-lg border bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">PDF Judgment Extraction Engine</h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload judgments in PDF, configure AI processing threads, and monitor extraction progress.
            </p>
            <PdfExtractionDashboard />
          </div>

          <div className="rounded-lg border bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Cases (CSV/XLSX)</h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload master case data. Related lawyer/judge/court records are auto-synced.
            </p>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const f = e.dataTransfer.files?.[0];
                if (f) setFile(f);
              }}
              className="mb-4 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700"
            >
              <div className="font-semibold text-slate-900">Drag & drop a CSV/XLSX here</div>
              <div className="text-slate-600">or use the file picker below.</div>
            </div>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mb-4 block w-full text-sm"
            />
            <button
              onClick={handleUploadButtonClick}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {busy ? 'Uploading...' : file ? 'Upload Cases' : 'Choose File and Upload'}
            </button>
          </div>

          <div className="rounded-lg border bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Master Table Analysis</h3>
            <p className="text-sm text-gray-600 mb-4">
              Runs outcome quality analysis and recalculates lawyer/judge/court + lawyer-vs-judge analytics from `cases` in batches.
            </p>
            <button
              onClick={runMasterTableAnalysis}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? 'Working...' : 'Run Master Analysis'}
            </button>
          </div>

          <div className="rounded-lg border bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Compute Rankings (Tri‑Factor)</h3>
            <p className="text-sm text-gray-600 mb-4">
              Precomputes Win Rate / Experience / Speed scores for all lawyers in batches and stores them in `lawyer_analytics`.
            </p>
            <button
              onClick={async () => {
                try {
                  setBusy(true);
                  setMessage('Starting tri‑factor ranking computation...');
                  const supabase = getSupabase();
                  const { data, error } = await supabase.rpc('admin_compute_tri_ranks_all', { p_batch_size: 200 });
                  if (error) throw error;
                  setMessage(`Tri‑factor ranking complete. Updated rows: ${data ?? 0}.`);
                } catch (e: any) {
                  setMessage(`Tri‑factor ranking failed: ${e?.message || e}`);
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Working...' : 'Compute Rankings (Tri‑Factor)'}
            </button>
          </div>

          {message && (
            <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
              {message}
            </div>
          )}
        </div>
      )}

      {activeTab === 'manage-claims' && (
        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Card Claims</h3>
              <button onClick={() => loadTableData('manage-claims')} className="rounded-lg border px-3 py-1.5 text-sm font-semibold">Refresh</button>
            </div>
            {loadingTable ? (
              <p className="text-sm text-gray-600">Loading...</p>
            ) : cardClaims.length === 0 ? (
              <p className="text-sm text-gray-600">No card claims found.</p>
            ) : (
              <div className="space-y-2">
                {cardClaims.map((c) => (
                  <div key={c.id} className="rounded border p-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">
                      <div className="font-semibold text-gray-900">#{c.id} • Status: <span className="uppercase">{c.status}</span></div>
                      <div className="text-gray-700">Lawyer: {c.lawyer_id}</div>
                      <div className="text-gray-700">Claimed Names: {(c.claimed_names || []).join(', ')}</div>
                      <div className="text-gray-700">Preferred Name: {c.preferred_name || '—'}</div>
                      <div className="text-gray-700">Bar Reg No: {c.bar_registration_number || '—'}</div>
                      <div className="text-gray-700">Notes: {c.notes || '—'}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          const supabase = getSupabase();
                          const { error } = await supabase.from('card_claims').update({ status: 'approved' }).eq('id', c.id);
                          if (error) setMessage(`Approve failed: ${error.message}`); else loadTableData('manage-claims');
                        }}
                        className="rounded bg-green-600 px-3 py-1.5 text-white text-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          const supabase = getSupabase();
                          const { error } = await supabase.from('card_claims').update({ status: 'rejected' }).eq('id', c.id);
                          if (error) setMessage(`Reject failed: ${error.message}`); else loadTableData('manage-claims');
                        }}
                        className="rounded bg-red-600 px-3 py-1.5 text-white text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Case Claims</h3>
              <button onClick={() => loadTableData('manage-claims')} className="rounded-lg border px-3 py-1.5 text-sm font-semibold">Refresh</button>
            </div>
            {loadingTable ? (
              <p className="text-sm text-gray-600">Loading...</p>
            ) : caseClaims.length === 0 ? (
              <p className="text-sm text-gray-600">No case claims found.</p>
            ) : (
              <div className="space-y-2">
                {caseClaims.map((c) => (
                  <div key={c.id} className="rounded border p-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">
                      <div className="font-semibold text-gray-900">#{c.id} • Status: <span className="uppercase">{c.status}</span></div>
                      <div className="text-gray-700">Lawyer: {c.lawyer_id}</div>
                      <div className="text-gray-700">Case: {c.case_number || c.case_id}</div>
                      <div className="text-gray-700">Role: {c.role}</div>
                      <div className="text-gray-700">Client: {c.client_name || '—'}</div>
                      <div className="text-gray-700">Vakaalatnama: {c.vakaalatnama_url ? <a className="text-blue-600 underline" href={c.vakaalatnama_url} target="_blank" rel="noreferrer">Open</a> : '—'}</div>
                      <div className="text-gray-700">Notes: {c.notes || '—'}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          const supabase = getSupabase();
                          const { error } = await supabase.from('case_claims').update({ status: 'approved' }).eq('id', c.id);
                          if (error) setMessage(`Approve failed: ${error.message}`); else loadTableData('manage-claims');
                        }}
                        className="rounded bg-green-600 px-3 py-1.5 text-white text-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          const supabase = getSupabase();
                          const { error } = await supabase.from('case_claims').update({ status: 'rejected' }).eq('id', c.id);
                          if (error) setMessage(`Reject failed: ${error.message}`); else loadTableData('manage-claims');
                        }}
                        className="rounded bg-red-600 px-3 py-1.5 text-white text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {(activeTab === 'manage-lawyers' || activeTab === 'manage-judges' || activeTab === 'manage-courts' || activeTab === 'manage-cases') && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={activeTab === 'manage-cases' ? 'Search by case number/title' : 'Search by name'}
                className="flex-1 min-w-[260px] rounded-lg border px-3 py-2 text-sm"
              />
              <button
                onClick={() => loadTableData(activeTab)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Search
              </button>
              <button
                onClick={() => {
                  if (selectedIds.length < 2) {
                    setMessage('Select at least 2 rows to merge.');
                    return;
                  }
                  const target = currentRows.find((r: any) => r.id === selectedIds[0]);
                  setMergeTargetId(selectedIds[0]);
                  setMergeFinalName(target?.name || target?.case_title || '');
                  setMergeDialog({ table: currentTable as any });
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Merge Selected ({selectedIds.length})
              </button>
              <button
                onClick={() => {
                  if (selectedIds.length === currentRows.length) setSelectedIds([]);
                  else setSelectedIds(currentRows.map((r: any) => r.id));
                }}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                {selectedIds.length === currentRows.length && currentRows.length > 0 ? 'Unselect All' : 'Select All'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4">
            {loadingTable ? (
              <p className="text-sm text-gray-600">Loading...</p>
            ) : activeTab === 'manage-lawyers' ? (
              <div className="space-y-2">
                {lawyers.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                          )
                        }
                        className="mt-1"
                      />
                      <div>
                      <div className="font-semibold">{r.name || 'Unnamed'}</div>
                      <div className="text-xs text-gray-600">{r.email || 'No email'} {r.is_admin ? '• Admin' : ''}</div>
                    </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditing({ table: 'lawyers', row: { ...r } })} className="rounded border px-3 py-1 text-sm"><Edit2 className="w-4 h-4 inline" /> Edit</button>
                      <button onClick={() => removeRow('lawyers', r.id)} className="rounded border border-red-300 px-3 py-1 text-sm text-red-700"><Trash2 className="w-4 h-4 inline" /> Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : activeTab === 'manage-judges' ? (
              <div className="space-y-2">
                {judges.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                          )
                        }
                        className="mt-1"
                      />
                      <div>
                      <div className="font-semibold">{r.name || 'Unnamed'}</div>
                      <div className="text-xs text-gray-600">{r.designation || 'No designation'}</div>
                    </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditing({ table: 'judges', row: { ...r } })} className="rounded border px-3 py-1 text-sm"><Edit2 className="w-4 h-4 inline" /> Edit</button>
                      <button onClick={() => removeRow('judges', r.id)} className="rounded border border-red-300 px-3 py-1 text-sm text-red-700"><Trash2 className="w-4 h-4 inline" /> Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : activeTab === 'manage-courts' ? (
              <div className="space-y-2">
                {courts.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                          )
                        }
                        className="mt-1"
                      />
                      <div>
                      <div className="font-semibold">{r.name || 'Unnamed'}</div>
                      <div className="text-xs text-gray-600">{r.type || 'No type'}</div>
                    </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditing({ table: 'courts', row: { ...r } })} className="rounded border px-3 py-1 text-sm"><Edit2 className="w-4 h-4 inline" /> Edit</button>
                      <button onClick={() => removeRow('courts', r.id)} className="rounded border border-red-300 px-3 py-1 text-sm text-red-700"><Trash2 className="w-4 h-4 inline" /> Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {cases.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                          )
                        }
                        className="mt-1"
                      />
                      <div>
                      <div className="font-semibold">{r.case_number} • {r.case_title}</div>
                      <div className="text-xs text-gray-600">{r.court_name} • {r.judge_name} • {r.lawyer_name}</div>
                    </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditing({ table: 'cases', row: { ...r } })} className="rounded border px-3 py-1 text-sm"><Edit2 className="w-4 h-4 inline" /> Edit</button>
                      <button onClick={() => removeRow('cases', r.id)} className="rounded border border-red-300 px-3 py-1 text-sm text-red-700"><Trash2 className="w-4 h-4 inline" /> Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'manage-lawyers' && !loadingTable && lawyers.length > 0 && (
        <div className="mt-2 text-xs text-gray-600">Tip: use Merge to combine duplicate lawyer cards.</div>
      )}
      {activeTab === 'manage-judges' && !loadingTable && judges.length > 0 && (
        <div className="mt-2 text-xs text-gray-600">Tip: use Merge to combine duplicate judge cards.</div>
      )}
      {activeTab === 'manage-courts' && !loadingTable && courts.length > 0 && (
        <div className="mt-2 text-xs text-gray-600">Tip: use Merge to combine duplicate court cards.</div>
      )}
      {activeTab === 'manage-cases' && !loadingTable && cases.length > 0 && (
        <div className="mt-2 text-xs text-gray-600">Tip: use Merge to combine duplicate case records.</div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit {editing.table.slice(0, -1)}</h3>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-auto">
              {Object.entries(editing.row).map(([k, v]) =>
                k === 'id' ? null : (
                  <label key={k} className="text-sm">
                    <div className="mb-1 font-medium text-gray-700">{k}</div>
                    <input
                      value={v ?? ''}
                      onChange={(e) =>
                        setEditing((prev) => (prev ? { ...prev, row: { ...prev.row, [k]: e.target.value } } : prev))
                      }
                      className="w-full rounded border px-3 py-2"
                    />
                  </label>
                )
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded border px-4 py-2">Cancel</button>
              <button onClick={saveEdit} className="rounded bg-green-600 px-4 py-2 text-white"><Save className="w-4 h-4 inline" /> Save</button>
            </div>
          </div>
        </div>
      )}

      {mergeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Merge {mergeDialog.table.slice(0, -1)} cards</h3>
              <button onClick={() => { setMergeDialog(null); setMergeTargetId(''); setMergeFinalName(''); }}><X className="w-5 h-5" /></button>
            </div>
            <p className="mb-3 text-sm text-gray-600">Selected cards will merge into one final card. Non-target selected rows will be removed.</p>
            <div className="mb-4 rounded border p-3 text-sm">
              <div className="font-semibold">Selected count: {selectedIds.length}</div>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Keep this target record</label>
            <select
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Select target</option>
              {(mergeDialog.table === 'lawyers' ? lawyers : mergeDialog.table === 'judges' ? judges : mergeDialog.table === 'courts' ? courts : cases)
                .filter((x: any) => selectedIds.includes(x.id))
                .map((x: any) => (
                  <option key={x.id} value={x.id}>
                    {x.name || x.case_number || x.case_title || x.id}
                  </option>
                ))}
            </select>
            <label className="mt-4 block text-sm font-medium text-gray-700 mb-2">Final card name</label>
            <input
              value={mergeFinalName}
              onChange={(e) => setMergeFinalName(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder={mergeDialog.table === 'cases' ? 'Final case title' : 'Final card name'}
            />
            <div className="mt-4 rounded border bg-slate-50 p-3">
              <div className="mb-1 text-sm font-semibold text-slate-800">Impact preview</div>
              {mergePreviewLoading ? (
                <div className="text-sm text-slate-600">Calculating impact...</div>
              ) : (
                <div className="text-sm text-slate-700 space-y-1">
                  <div>Rows to be removed: {Math.max(0, selectedIds.length - 1)}</div>
                  {Object.keys(mergePreview).length === 0 ? (
                    <div>No linked records detected.</div>
                  ) : (
                    Object.entries(mergePreview).map(([k, v]) => (
                      <div key={k}>
                        {k.replace(/_/g, ' ')} reassigned: <span className="font-semibold">{v}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => { setMergeDialog(null); setMergeTargetId(''); setMergeFinalName(''); }} className="rounded border px-4 py-2">Cancel</button>
              <button onClick={mergeRows} disabled={busy || !mergeTargetId} className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">Merge</button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="mt-4 rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
          {message}
        </div>
      )}
    </div>
  );
}