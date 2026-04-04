import React from "react";
import getSupabase from "../../../../utils/supabase/client";

export default function MasterAnalysis() {
  const [rows, setRows] = React.useState<any[]>([]);
  const [q, setQ] = React.useState("");
  const [stats, setStats] = React.useState<{ pending: number }>({ pending: 0 });
  const [running, setRunning] = React.useState(false);
  const [fallbackMode, setFallbackMode] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const isRunningRef = React.useRef(false);

  const load = async () => {
    const supabase = getSupabase();

    const { data: queueRows, error: queueErr } = await supabase
      .from("table_analysis_queue")
      .select("id,case_number,inserted_at")
      .order("inserted_at", { ascending: true })
      .limit(5000);

    if (queueErr) throw queueErr;

    const queue = queueRows || [];
    const caseNumbers = queue.map((r: any) => r.case_number).filter(Boolean);

    setStats({ pending: queue.length });

    if (caseNumbers.length === 0) {
      setRows([]);
      return;
    }

    let casesQ = supabase
      .from("cases")
      .select("case_number,case_title,court_name,judge_1,filing_date,judgment_date,judgement_link,updated_at")
      .in("case_number", caseNumbers);

    if (q.trim()) {
      casesQ = casesQ.ilike("case_title", `%${q.trim()}%`);
    }

    const { data: caseRows, error: caseErr } = await casesQ;
    if (caseErr) throw caseErr;

    const byCaseNumber = new Map((caseRows || []).map((r: any) => [r.case_number, r]));
    // Preserve the queue's insertion order.
    const merged = queue.map((qr: any) => ({
      id: qr.id,
      inserted_at: qr.inserted_at,
      ...(byCaseNumber.get(qr.case_number) || {}),
    }));
    setRows(merged);
  };

  React.useEffect(() => {
    let mounted = true;
    const tick = async () => {
      if (!mounted) return;
      await load();
    };

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, 5000);

    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [q]);

  const runTableAnalysisForPendingQueue = async () => {
    if (running) return;
    setRunning(true);
    setFallbackMode(false);
    isRunningRef.current = true;
    setProgress({ done: 0, total: 0 });
    try {
      const supabase = getSupabase();

      const buildNameIdMap = async (table: "lawyers" | "judges") => {
        const out = new Map<string, string>();
        let from = 0;
        const page = 1000;
        while (true) {
          const { data, error } = await supabase.from(table).select("id,name").range(from, from + page - 1);
          if (error) throw error;
          const rows = data ?? [];
          rows.forEach((r: any) => {
            const key = normalizeName(r?.name);
            const id = String(r?.id ?? "").trim();
            if (key && id && !out.has(key)) out.set(key, id);
          });
          if (rows.length < page) break;
          from += page;
        }
        return out;
      };

      const [lawyerMap, judgeMap] = await Promise.all([
        buildNameIdMap("lawyers"),
        buildNameIdMap("judges"),
      ]);

      const deriveTouchedEntityIdsFromCases = async (caseNums: string[]) => {
        const rows: any[] = [];
        const page = 200;
        for (let i = 0; i < caseNums.length; i += page) {
          const chunk = caseNums.slice(i, i + page);
          const { data, error } = await supabase
            .from("cases_analytics")
            .select("case_number,petitioner_lawyer_1,petitioner_lawyer_2,petitioner_lawyer_3,petitioner_lawyer_4,petitioner_lawyer_5,respondent_lawyer_1,respondent_lawyer_2,respondent_lawyer_3,respondent_lawyer_4,respondent_lawyer_5,judge_1,judge_2,judge_3,judge_4,judge_5,judge_6,judge_7,judge_8,judge_9")
            .in("case_number", chunk);
          if (error) throw error;
          rows.push(...(data ?? []));
        }

        const lawyerIds = new Set<string>();
        const judgeIds = new Set<string>();

        rows.forEach((r: any) => {
          const lawyers = [
            r.petitioner_lawyer_1, r.petitioner_lawyer_2, r.petitioner_lawyer_3, r.petitioner_lawyer_4, r.petitioner_lawyer_5,
            r.respondent_lawyer_1, r.respondent_lawyer_2, r.respondent_lawyer_3, r.respondent_lawyer_4, r.respondent_lawyer_5,
          ];
          lawyers.forEach((raw: string | null | undefined) => {
            const key = normalizeName(raw);
            if (!key) return;
            const id = lawyerMap.get(key);
            if (id) lawyerIds.add(id);
          });

          const judges = [r.judge_1, r.judge_2, r.judge_3, r.judge_4, r.judge_5, r.judge_6, r.judge_7, r.judge_8, r.judge_9];
          judges.forEach((raw: string | null | undefined) => {
            const key = normalizeName(raw);
            if (!key) return;
            const id = judgeMap.get(key);
            if (id) judgeIds.add(id);
          });
        });

        return {
          lawyerIds: Array.from(lawyerIds),
          judgeIds: Array.from(judgeIds),
        };
      };

      const CHUNK_SIZE = 1;

      let doneSoFar = 0;
      let totalSoFar = 0;

      // Keep draining until queue is empty or the tab is closed (loop stops).
      while (isRunningRef.current) {
        // Always pull the oldest N so we don't wait for a big snapshot.
        const { data: pendingRows, error: listErr } = await supabase
          .from("table_analysis_queue")
          .select("id,case_number")
          .order("inserted_at", { ascending: true })
          .limit(CHUNK_SIZE);
        if (listErr) throw listErr;

        const batchRows = pendingRows || [];
        if (batchRows.length === 0) break;

        const batchIds = batchRows.map((r: any) => r.id);
        const batchCaseNumbers = batchRows.map((r: any) => r.case_number).filter(Boolean);
        if (batchCaseNumbers.length === 0) break;

        totalSoFar += batchCaseNumbers.length;
        setProgress({ done: doneSoFar, total: totalSoFar });

        const scopePayload = {
          p_scope: "case_numbers",
          p_case_numbers: batchCaseNumbers,
          p_entity_type: null,
          p_entity_id: null,
        };

        const runWorker = async (rpcName: string, args: any) => {
          const { data, error } = await (supabase as any).rpc(rpcName, args);
          if (error) throw new Error(`RPC ${rpcName} failed: ${error.message || error}`);
          return data;
        };

        await runWorker("admin_cases_analytics_sync", scopePayload);
        await runWorker("admin_cases_analytics_standardize_names", scopePayload);
        await runWorker("admin_cases_analytics_sync_entities", scopePayload);
        let rebuildData: any = null;
        let rebuildTimedOut = false;
        try {
          rebuildData = await runWorker("admin_cases_analytics_rebuild_analytics_4tables", scopePayload);
        } catch (e: any) {
          const msg = String(e?.message || e || "").toLowerCase();
          if (msg.includes("timeout") || msg.includes("statement timeout")) {
            rebuildTimedOut = true;
          } else {
            throw e;
          }
        }

        const touchedLawyerIds = rebuildData?.touched?.lawyer_ids;
        const touchedJudgeIds = rebuildData?.touched?.judge_ids;
        let chartLawyerIds = Array.isArray(touchedLawyerIds) ? touchedLawyerIds.filter(Boolean) : [];
        let chartJudgeIds = Array.isArray(touchedJudgeIds) ? touchedJudgeIds.filter(Boolean) : [];

        if (rebuildTimedOut || (chartLawyerIds.length === 0 && chartJudgeIds.length === 0)) {
          setFallbackMode(true);
          const derived = await deriveTouchedEntityIdsFromCases(batchCaseNumbers);
          chartLawyerIds = chartLawyerIds.length > 0 ? chartLawyerIds : derived.lawyerIds;
          chartJudgeIds = chartJudgeIds.length > 0 ? chartJudgeIds : derived.judgeIds;
        }
        for (const lawyerId of chartLawyerIds) {
          await refreshLawyerChartsClientFallback(supabase, lawyerId);
        }
        for (const judgeId of chartJudgeIds) {
          await refreshJudgeChartsClientFallback(supabase, judgeId);
        }

        doneSoFar += batchCaseNumbers.length;
        setProgress({ done: doneSoFar, total: totalSoFar });

        // Remove each analyzed batch immediately.
        const { error: delErr } = await supabase.from("table_analysis_queue").delete().in("id", batchIds);
        if (delErr) throw delErr;
      }

      alert(`Table analysis completed. Processed ${doneSoFar} case(s).`);
      await load();
    } catch (e: any) {
      // Try to include more debug information if available.
      const message = e?.message || String(e);
      alert(`Table analysis failed: ${message}`);
    } finally {
      setRunning(false);
      isRunningRef.current = false;
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <Stat label="Pending In Queue" value={stats.pending} tone={stats.pending > 0 ? "pending" : "ok"} />
        <Stat label="Queue Clears After Run" value={1} tone="processing" />
        <Stat label="Workers Only Enqueue" value={1} tone="processing" />
      </div>
      <p className="text-xs text-slate-600 max-w-3xl">
        Table analysis queue now runs the worker pipeline per queued batch: sync into <code className="text-slate-800">cases_analytics</code>,
        standardize names, sync entities, rebuild analytics 4 tables incrementally, then refresh
        <code className="text-slate-800">lawyer_analytics.chart_*</code> and <code className="text-slate-800">judge_analytics.chart_*</code>
        using client-side chart computation for touched lawyers and judges.
      </p>

      <div className="rounded-xl border bg-white p-4 flex items-center justify-between gap-3 flex-wrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search case title..."
          className="w-full max-w-sm border rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={runTableAnalysisForPendingQueue}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
          >
            {running ? "Running..." : "Run Table Analysis (Manual)"}
          </button>
          {running && (
            <span className="text-xs text-slate-600 whitespace-nowrap">
              {progress.total > 0 ? `${progress.done}/${progress.total} processed` : "Processing..."}
            </span>
          )}
        </div>
      </div>

      {running && fallbackMode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Rebuild timed out. Continuing with client-side chart refresh for touched judges and lawyers.
        </div>
      )}

      <div className="rounded-xl border bg-white overflow-auto">
        <table className="min-w-[1000px] text-xs">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left">Case #</th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Court</th>
              <th className="px-3 py-2 text-left">Judge</th>
              <th className="px-3 py-2 text-left">Filed</th>
              <th className="px-3 py-2 text-left">Judgment</th>
              <th className="px-3 py-2 text-left">Link</th>
              <th className="px-3 py-2 text-left">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td className="px-4 py-6 text-slate-500" colSpan={8}>No results</td></tr>}
            {rows.map((r: any) => (
              <tr key={r.case_number} className="border-t">
                <td className="px-3 py-2">{r.case_number}</td>
                <td className="px-3 py-2">{r.case_title}</td>
                <td className="px-3 py-2">{r.court_name}</td>
                <td className="px-3 py-2">{r.judge_1}</td>
                <td className="px-3 py-2">{r.filing_date}</td>
                <td className="px-3 py-2">{r.judgment_date}</td>
                <td className="px-3 py-2"><a href={r.judgement_link || "#"} target="_blank" rel="noreferrer" className="text-blue-700 underline">Open</a></td>
                <td className="px-3 py-2">{new Date(r.updated_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const normalizeName = (s: string | null | undefined) => {
  if (!s) return "";
  let x = String(s)
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'");
  x = x.replace(/\([^)]*\)/g, " ");
  x = x
    .replace(/\b(for\s+complainant|for\s+respondent|present\s+for\s+complainant|present\s+for\s+respondent)\b/g, " ")
    .replace(/\b(adv\.?|advocate|ld\.?|mr\.?|mrs\.?|ms\.?|shri|smt|dr\.?|prof\.?|c\.?a\.?|chairperson|maharera)\b/g, " ");
  x = x.replace(/[.,/\\|:;~`"!@#$%^&*_+=\-]+/g, " ");
  return x.replace(/\s+/g, " ").trim();
};

const buildSelfRepresentedLawyerName = (
  courtName: string | null | undefined,
  side: "Complainant" | "Respondent"
) => {
  const court = String(courtName ?? "").trim() || "Unknown Court";
  return `${court} ${side} without a lawyer`;
};

const normalizeOutcomeForAnalytics = (
  outcomeRaw: string | null,
  statusRaw: string | null,
  summaryRaw: string | null
) => {
  const o = (outcomeRaw ?? "").toLowerCase();
  const s = (statusRaw ?? "").toLowerCase();
  const sum = (summaryRaw ?? "").toLowerCase();
  const hay = `${o} ${s} ${sum}`;
  if (/settled|conciliation|compromise/.test(hay)) return "settled" as const;
  if (/(in\s+favor\s+of\s+complainant|complainant\s+win|complainant\s+allowed|allowed\s+complaint)/.test(hay)) {
    return "complainant" as const;
  }
  if (/(in\s+favor\s+of\s+respondent|respondent\s+win|complaint\s+dismissed|rejected)/.test(hay)) {
    return "respondent" as const;
  }
  return "other" as const;
};

const refreshLawyerChartsClientFallback = async (supabase: any, lawyerId: string) => {
  const { data: lawyerRow, error: lawyerError } = await supabase
    .from("lawyers")
    .select("id,name")
    .eq("id", lawyerId)
    .single();
  if (lawyerError) throw lawyerError;

  const targetKey = normalizeName(lawyerRow?.name);
  if (!targetKey) return 0;

  const scopePayload = {
    p_scope: "entity_id",
    p_case_numbers: null,
    p_entity_type: "lawyer",
    p_entity_id: lawyerId,
  };

  const { data: scoped, error: scopedError } = await (supabase as any).rpc("admin_worker_scope_case_numbers", scopePayload);
  if (scopedError) throw scopedError;
  const caseNumbers = (scoped ?? [])
    .map((r: any) => String(r?.case_number ?? "").trim())
    .filter(Boolean);
  if (caseNumbers.length === 0) return 0;

  const rows: any[] = [];
  const page = 200;
  for (let i = 0; i < caseNumbers.length; i += page) {
    const chunk = caseNumbers.slice(i, i + page);
    const { data, error } = await supabase
      .from("cases_analytics")
      .select("case_number,petitioner_name,respondent_name,court_name,total_hearings,outcome,status,summary,petitioner_lawyer_1,petitioner_lawyer_2,petitioner_lawyer_3,petitioner_lawyer_4,petitioner_lawyer_5,respondent_lawyer_1,respondent_lawyer_2,respondent_lawyer_3,respondent_lawyer_4,respondent_lawyer_5,judge_1,judge_2,judge_3,judge_4,judge_5,judge_6,judge_7,judge_8,judge_9")
      .in("case_number", chunk);
    if (error) throw error;
    rows.push(...(data ?? []));
  }

  let repComplainant = 0;
  let repRespondent = 0;
  let hearings1_5 = 0;
  let hearings6_10 = 0;
  let hearings11_15 = 0;
  let hearings16Plus = 0;

  const partyCounts = new Map<string, { name: string; count: number; won: number; lost: number; settled: number }>();
  const oppLawyerCounts = new Map<string, { name: string; count: number; won: number; lost: number; settled: number }>();
  const judgeCounts = new Map<string, { name: string; count: number; won: number; lost: number; settled: number }>();
  const settleCtx = new Map<string, { kind: "opponent_lawyer" | "judge"; name: string; n: number; settled: number }>();

  const bumpNamed = (
    map: Map<string, { name: string; count: number; won: number; lost: number; settled: number }>,
    key: string,
    name: string,
    outcomeKind: "won" | "lost" | "settled" | "other"
  ) => {
    const prev = map.get(key);
    if (prev) {
      prev.count += 1;
      if (outcomeKind === "won") prev.won += 1;
      else if (outcomeKind === "lost") prev.lost += 1;
      else if (outcomeKind === "settled") prev.settled += 1;
    } else {
      map.set(key, {
        name,
        count: 1,
        won: outcomeKind === "won" ? 1 : 0,
        lost: outcomeKind === "lost" ? 1 : 0,
        settled: outcomeKind === "settled" ? 1 : 0,
      });
    }
  };

  const bumpSettle = (kind: "opponent_lawyer" | "judge", rawName: string, wasSettled: boolean) => {
    const nm = String(rawName ?? "").trim();
    if (!nm) return;
    const key = `${kind}|${normalizeName(nm)}`;
    if (key.endsWith("|")) return;
    const prev = settleCtx.get(key);
    if (prev) {
      prev.n += 1;
      if (wasSettled) prev.settled += 1;
    } else {
      settleCtx.set(key, { kind, name: nm, n: 1, settled: wasSettled ? 1 : 0 });
    }
  };

  for (const c of rows) {
    const petitionerLawyers = [
      c.petitioner_lawyer_1, c.petitioner_lawyer_2, c.petitioner_lawyer_3, c.petitioner_lawyer_4, c.petitioner_lawyer_5,
    ].filter(Boolean);
    const respondentLawyers = [
      c.respondent_lawyer_1, c.respondent_lawyer_2, c.respondent_lawyer_3, c.respondent_lawyer_4, c.respondent_lawyer_5,
    ].filter(Boolean);

    const petitionerList = petitionerLawyers.length > 0
      ? petitionerLawyers
      : [buildSelfRepresentedLawyerName(c.court_name, "Complainant")];
    const respondentList = respondentLawyers.length > 0
      ? respondentLawyers
      : [buildSelfRepresentedLawyerName(c.court_name, "Respondent")];

    const appearsPetitioner = petitionerList.some((n: string) => normalizeName(n) === targetKey);
    const appearsRespondent = respondentList.some((n: string) => normalizeName(n) === targetKey);
    if (!appearsPetitioner && !appearsRespondent) continue;

    const hearings = Number(c.total_hearings ?? 0);
    const normOutcome = normalizeOutcomeForAnalytics(c.outcome ?? null, c.status ?? null, c.summary ?? null);
    const wasSettled = normOutcome === "settled";

    const creditSide = (side: "Complainant" | "Respondent") => {
      if (side === "Complainant") repComplainant += 1;
      else repRespondent += 1;

      const outcomeKind: "won" | "lost" | "settled" | "other" =
        normOutcome === "settled"
          ? "settled"
          : (
            (normOutcome === "complainant" && side === "Complainant")
            || (normOutcome === "respondent" && side === "Respondent")
          )
            ? "won"
            : (
              (normOutcome === "complainant" && side === "Respondent")
              || (normOutcome === "respondent" && side === "Complainant")
            )
              ? "lost"
              : "other";

      if (hearings >= 1 && hearings <= 5) hearings1_5 += 1;
      else if (hearings >= 6 && hearings <= 10) hearings6_10 += 1;
      else if (hearings >= 11 && hearings <= 15) hearings11_15 += 1;
      else if (hearings >= 16) hearings16Plus += 1;

      const oppParty = String(
        side === "Complainant" ? (c.respondent_name ?? "(Unknown)") : (c.petitioner_name ?? "(Unknown)")
      ).trim() || "(Unknown)";
      const oppPartyKey = normalizeName(oppParty) || oppParty.toLowerCase();
      bumpNamed(partyCounts, oppPartyKey, oppParty, outcomeKind);

      const oppLawyers = side === "Complainant" ? respondentList : petitionerList;
      oppLawyers.forEach((nm: string) => {
        const key = normalizeName(nm);
        if (!key) return;
        bumpNamed(oppLawyerCounts, key, String(nm).trim(), outcomeKind);
        bumpSettle("opponent_lawyer", nm, wasSettled);
      });

      const judges = [c.judge_1, c.judge_2, c.judge_3, c.judge_4, c.judge_5, c.judge_6, c.judge_7, c.judge_8, c.judge_9].filter(Boolean);
      judges.forEach((nm: string) => {
        const key = normalizeName(nm);
        if (!key) return;
        bumpNamed(judgeCounts, key, String(nm).trim(), outcomeKind);
        bumpSettle("judge", nm, wasSettled);
      });
    };

    if (appearsPetitioner) creditSide("Complainant");
    if (appearsRespondent) creditSide("Respondent");
  }

  const topN = (items: Array<{ name: string; count: number; won: number; lost: number; settled: number }>, n: number) =>
    items
      .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name))
      .slice(0, n);

  const topParties = topN(
    Array.from(partyCounts.values()),
    5
  );
  const topOppLawyers = topN(Array.from(oppLawyerCounts.values()), 5);
  const topJudges = topN(Array.from(judgeCounts.values()), 5);
  const topSettle = Array.from(settleCtx.values())
    .filter((x) => x.n >= 3)
    .map((x) => ({ ...x, pct: Math.round(((x.settled / x.n) * 100 + Number.EPSILON) * 100) / 100 }))
    .sort((a, b) => (b.pct - a.pct) || (b.n - a.n) || a.name.localeCompare(b.name))
    .slice(0, 5);

  const pct = (part: number, total: number) => (total > 0 ? Math.round((part * 10000) / total) / 100 : 0);

  const patch: Record<string, any> = {
    chart_rep_complainant_cases: repComplainant,
    chart_rep_respondent_cases: repRespondent,
    chart_hearings_1_5: hearings1_5,
    chart_hearings_6_10: hearings6_10,
    chart_hearings_11_15: hearings11_15,
    chart_hearings_16_plus: hearings16Plus,
    updated_at: new Date().toISOString(),
  };

  for (let i = 0; i < 5; i += 1) {
    const p = topParties[i];
    patch[`chart_top_party_${i + 1}_name`] = p?.name ?? null;
    patch[`chart_top_party_${i + 1}_cases`] = p?.count ?? 0;
    patch[`chart_top_party_${i + 1}_won`] = p?.won ?? 0;
    patch[`chart_top_party_${i + 1}_lost`] = p?.lost ?? 0;
    patch[`chart_top_party_${i + 1}_settled`] = p?.settled ?? 0;
    const pTotal = Number(p?.count ?? 0);
    patch[`chart_top_party_${i + 1}_win_rate`] = pct(Number(p?.won ?? 0), pTotal);
    patch[`chart_top_party_${i + 1}_loss_rate`] = pct(Number(p?.lost ?? 0), pTotal);
    patch[`chart_top_party_${i + 1}_settlement_rate`] = pct(Number(p?.settled ?? 0), pTotal);

    const o = topOppLawyers[i];
    patch[`chart_top_opp_lawyer_${i + 1}_name`] = o?.name ?? null;
    patch[`chart_top_opp_lawyer_${i + 1}_cases`] = o?.count ?? 0;
    patch[`chart_top_opp_lawyer_${i + 1}_won`] = o?.won ?? 0;
    patch[`chart_top_opp_lawyer_${i + 1}_lost`] = o?.lost ?? 0;
    patch[`chart_top_opp_lawyer_${i + 1}_settled`] = o?.settled ?? 0;
    const oTotal = Number(o?.count ?? 0);
    patch[`chart_top_opp_lawyer_${i + 1}_win_rate`] = pct(Number(o?.won ?? 0), oTotal);
    patch[`chart_top_opp_lawyer_${i + 1}_loss_rate`] = pct(Number(o?.lost ?? 0), oTotal);
    patch[`chart_top_opp_lawyer_${i + 1}_settlement_rate`] = pct(Number(o?.settled ?? 0), oTotal);

    const j = topJudges[i];
    patch[`chart_top_judge_${i + 1}_name`] = j?.name ?? null;
    patch[`chart_top_judge_${i + 1}_cases`] = j?.count ?? 0;
    patch[`chart_top_judge_${i + 1}_won`] = j?.won ?? 0;
    patch[`chart_top_judge_${i + 1}_lost`] = j?.lost ?? 0;
    patch[`chart_top_judge_${i + 1}_settled`] = j?.settled ?? 0;
    const jTotal = Number(j?.count ?? 0);
    patch[`chart_top_judge_${i + 1}_win_rate`] = pct(Number(j?.won ?? 0), jTotal);
    patch[`chart_top_judge_${i + 1}_loss_rate`] = pct(Number(j?.lost ?? 0), jTotal);
    patch[`chart_top_judge_${i + 1}_settlement_rate`] = pct(Number(j?.settled ?? 0), jTotal);

    const s = topSettle[i];
    patch[`chart_settle_${i + 1}_kind`] = s?.kind ?? null;
    patch[`chart_settle_${i + 1}_name`] = s?.name ?? null;
    patch[`chart_settle_${i + 1}_pct`] = s?.pct ?? null;
    patch[`chart_settle_${i + 1}_n`] = s?.n ?? 0;
  }

  const { error: updateError } = await supabase
    .from("lawyer_analytics")
    .update(patch)
    .eq("lawyer_id", lawyerId);
  if (updateError) throw updateError;

  return 1;
};

const refreshJudgeChartsClientFallback = async (supabase: any, judgeId: string) => {
  const { data: judgeRow, error: judgeError } = await supabase
    .from("judges")
    .select("id,name")
    .eq("id", judgeId)
    .single();
  if (judgeError) throw judgeError;

  const targetKey = normalizeName(judgeRow?.name);
  if (!targetKey) return 0;

  const scopePayload = {
    p_scope: "entity_id",
    p_case_numbers: null,
    p_entity_type: "judge",
    p_entity_id: judgeId,
  };

  const { data: scoped, error: scopedError } = await (supabase as any).rpc("admin_worker_scope_case_numbers", scopePayload);
  if (scopedError) throw scopedError;
  const caseNumbers = (scoped ?? [])
    .map((r: any) => String(r?.case_number ?? "").trim())
    .filter(Boolean);
  if (caseNumbers.length === 0) return 0;

  const rows: any[] = [];
  const page = 200;
  for (let i = 0; i < caseNumbers.length; i += page) {
    const chunk = caseNumbers.slice(i, i + page);
    const { data, error } = await supabase
      .from("cases_analytics")
      .select("case_number,case_title,total_hearings,outcome,status,summary,petitioner_lawyer_1,petitioner_lawyer_2,petitioner_lawyer_3,petitioner_lawyer_4,petitioner_lawyer_5,respondent_lawyer_1,respondent_lawyer_2,respondent_lawyer_3,respondent_lawyer_4,respondent_lawyer_5,judge_1,judge_2,judge_3,judge_4,judge_5,judge_6,judge_7,judge_8,judge_9")
      .in("case_number", chunk);
    if (error) throw error;
    rows.push(...(data ?? []));
  }

  const appearsBeforeJudge = (r: any) => [
    r.judge_1, r.judge_2, r.judge_3, r.judge_4, r.judge_5,
    r.judge_6, r.judge_7, r.judge_8, r.judge_9,
  ].some((name: string | null | undefined) => normalizeName(name) === targetKey);

  const scopedRows = rows.filter(appearsBeforeJudge);
  if (scopedRows.length === 0) return 0;

  let hearings1 = 0;
  let hearings2_3 = 0;
  let hearings4_5 = 0;
  let hearings5Plus = 0;

  const lawyerCounts = new Map<string, { name: string; count: number; won: number; lost: number; settled: number }>();
  const respondentCounts = new Map<string, { name: string; count: number; won: number; lost: number; settled: number }>();
  const durationByLawyer = new Map<string, { name: string; totalDays: number; count: number }>();

  const bump = (
    map: Map<string, { name: string; count: number; won: number; lost: number; settled: number }>,
    key: string,
    name: string,
    outcomeKind: "won" | "lost" | "settled" | "other"
  ) => {
    const prev = map.get(key);
    if (prev) {
      prev.count += 1;
      if (outcomeKind === "won") prev.won += 1;
      else if (outcomeKind === "lost") prev.lost += 1;
      else if (outcomeKind === "settled") prev.settled += 1;
    } else {
      map.set(key, {
        name,
        count: 1,
        won: outcomeKind === "won" ? 1 : 0,
        lost: outcomeKind === "lost" ? 1 : 0,
        settled: outcomeKind === "settled" ? 1 : 0,
      });
    }
  };

  const splitRespondents = (title: string) => {
    const parts = title.split(/vs\.?|v\/s\.?|versus/i);
    if (parts.length < 2) return [] as string[];
    return String(parts[1] ?? "")
      .split(/\s*&\s*|\s*,\s*|\s+and\s+/i)
      .map((x) => String(x ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
  };

  const pct = (part: number, total: number) => (total > 0 ? Math.round((part * 10000) / total) / 100 : 0);

  for (const c of scopedRows) {
    const hearings = Number(c.total_hearings ?? 0);
    if (hearings === 1) hearings1 += 1;
    else if (hearings >= 2 && hearings <= 3) hearings2_3 += 1;
    else if (hearings >= 4 && hearings <= 5) hearings4_5 += 1;
    else if (hearings > 5) hearings5Plus += 1;

    const normOutcome = normalizeOutcomeForAnalytics(c.outcome ?? null, c.status ?? null, c.summary ?? null);
    const petitionerLawyers = [
      c.petitioner_lawyer_1, c.petitioner_lawyer_2, c.petitioner_lawyer_3, c.petitioner_lawyer_4, c.petitioner_lawyer_5,
    ].filter(Boolean);
    const respondentLawyers = [
      c.respondent_lawyer_1, c.respondent_lawyer_2, c.respondent_lawyer_3, c.respondent_lawyer_4, c.respondent_lawyer_5,
    ].filter(Boolean);

    const credit = (rawName: string, side: "petitioner" | "respondent") => {
      const key = normalizeName(rawName);
      if (!key) return;
      const outcomeKind: "won" | "lost" | "settled" | "other" =
        normOutcome === "settled"
          ? "settled"
          : (
            (normOutcome === "complainant" && side === "petitioner")
            || (normOutcome === "respondent" && side === "respondent")
          )
            ? "won"
            : (
              (normOutcome === "complainant" && side === "respondent")
              || (normOutcome === "respondent" && side === "petitioner")
            )
              ? "lost"
              : "other";
      bump(lawyerCounts, key, String(rawName).trim(), outcomeKind);
    };

    petitionerLawyers.forEach((nm: string) => credit(nm, "petitioner"));
    respondentLawyers.forEach((nm: string) => credit(nm, "respondent"));

    const respondents = splitRespondents(String(c.case_title ?? ""));
    const respondentOutcome: "won" | "lost" | "settled" | "other" =
      normOutcome === "settled"
        ? "settled"
        : normOutcome === "respondent"
          ? "won"
          : normOutcome === "complainant"
            ? "lost"
            : "other";
    respondents.forEach((name) => {
      const key = normalizeName(name);
      if (!key) return;
      bump(respondentCounts, key, name, respondentOutcome);
    });
  }

  const { data: ljaRows, error: ljaError } = await supabase
    .from("lawyer_judge_analytics")
    .select("lawyer_name,avg_case_duration_days")
    .eq("judge_id", judgeId)
    .order("avg_case_duration_days", { ascending: false })
    .limit(20);
  if (ljaError) throw ljaError;
  (ljaRows ?? []).forEach((r: any) => {
    const name = String(r?.lawyer_name ?? "").trim();
    const avgDays = Number(r?.avg_case_duration_days ?? 0);
    const key = normalizeName(name);
    if (!key || !name || !Number.isFinite(avgDays) || avgDays <= 0) return;
    durationByLawyer.set(key, { name, totalDays: avgDays, count: 1 });
  });

  const topN = (items: Array<{ name: string; count: number; won: number; lost: number; settled: number }>, n: number) =>
    items.sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name)).slice(0, n);

  const topLawyers = topN(Array.from(lawyerCounts.values()), 5);
  const topRespondents = topN(Array.from(respondentCounts.values()), 5);
  const topDurationLawyers = Array.from(durationByLawyer.values())
    .sort((a, b) => b.totalDays - a.totalDays)
    .slice(0, 5);

  const patch: Record<string, any> = {
    chart_hearings_1_cases: hearings1,
    chart_hearings_2_3_cases: hearings2_3,
    chart_hearings_4_5_cases: hearings4_5,
    chart_hearings_5_plus_cases: hearings5Plus,
    updated_at: new Date().toISOString(),
  };

  for (let i = 0; i < 5; i += 1) {
    const l = topLawyers[i];
    patch[`chart_top_lawyer_${i + 1}_name`] = l?.name ?? null;
    patch[`chart_top_lawyer_${i + 1}_cases`] = l?.count ?? 0;
    patch[`chart_top_lawyer_${i + 1}_won`] = l?.won ?? 0;
    patch[`chart_top_lawyer_${i + 1}_lost`] = l?.lost ?? 0;
    patch[`chart_top_lawyer_${i + 1}_settled`] = l?.settled ?? 0;
    const lTotal = Math.max(Number(l?.count ?? 0), Number(l?.won ?? 0) + Number(l?.lost ?? 0) + Number(l?.settled ?? 0));
    patch[`chart_top_lawyer_${i + 1}_win_rate`] = pct(Number(l?.won ?? 0), lTotal);
    patch[`chart_top_lawyer_${i + 1}_loss_rate`] = pct(Number(l?.lost ?? 0), lTotal);
    patch[`chart_top_lawyer_${i + 1}_settlement_rate`] = pct(Number(l?.settled ?? 0), lTotal);

    const r = topRespondents[i];
    patch[`chart_top_respondent_${i + 1}_name`] = r?.name ?? null;
    patch[`chart_top_respondent_${i + 1}_cases`] = r?.count ?? 0;
    patch[`chart_top_respondent_${i + 1}_won`] = r?.won ?? 0;
    patch[`chart_top_respondent_${i + 1}_lost`] = r?.lost ?? 0;
    patch[`chart_top_respondent_${i + 1}_settled`] = r?.settled ?? 0;
    const rTotal = Math.max(Number(r?.count ?? 0), Number(r?.won ?? 0) + Number(r?.lost ?? 0) + Number(r?.settled ?? 0));
    patch[`chart_top_respondent_${i + 1}_win_rate`] = pct(Number(r?.won ?? 0), rTotal);
    patch[`chart_top_respondent_${i + 1}_loss_rate`] = pct(Number(r?.lost ?? 0), rTotal);
    patch[`chart_top_respondent_${i + 1}_settlement_rate`] = pct(Number(r?.settled ?? 0), rTotal);

    const d = topDurationLawyers[i];
    patch[`chart_top_duration_lawyer_${i + 1}_name`] = d?.name ?? null;
    patch[`chart_top_duration_lawyer_${i + 1}_avg_days`] = d ? Math.round(d.totalDays * 100) / 100 : 0;
  }

  const upsertPayload = {
    judge_id: judgeId,
    judge_name: String(judgeRow?.name ?? "").trim() || null,
    ...patch,
  };

  const { error: updateError } = await (supabase.from("judge_analytics") as any)
    .upsert([upsertPayload], { onConflict: "judge_id" });
  if (updateError) {
    const msg = String(updateError?.message || updateError || "").toLowerCase();
    if (msg.includes("schema cache") || msg.includes("could not find the")) {
      throw new Error(
        "Judge chart columns are missing in the DB schema cache. Apply migration supabase/migrations/20260403_add_judge_chart_outcome_breakdown_columns.sql and refresh Supabase schema cache, then rerun master analysis."
      );
    }
    throw updateError;
  }

  return 1;
};

function Stat({ label, value, tone }: { label: string; value: number; tone?: "pending" | "processing" | "ok" }) {
  const cls =
    tone === "ok"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : tone === "processing"
      ? "text-blue-700 bg-blue-50 border-blue-200"
      : "text-amber-700 bg-amber-50 border-amber-200";
  return (
    <div className="rounded-lg border p-3 bg-white">
      <div className="text-xs text-slate-600">{label}</div>
      <div className={`inline-flex mt-1 px-2 py-0.5 rounded-full border text-sm font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

