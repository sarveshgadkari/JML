import React from "react";
import getSupabase from "../../../../utils/supabase/client";

export default function MasterAnalysis() {
  const [rows, setRows] = React.useState<any[]>([]);
  const [q, setQ] = React.useState("");
  const [stats, setStats] = React.useState<{ pending: number }>({ pending: 0 });
  const [running, setRunning] = React.useState(false);
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
    isRunningRef.current = true;
    setProgress({ done: 0, total: 0 });
    try {
      const supabase = getSupabase();

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

        const { data: rpcData, error } = await supabase.rpc("admin_run_table_analysis_wide_light", {
          p_case_numbers: batchCaseNumbers,
        });
        if (error) {
          throw new Error(`RPC admin_run_table_analysis_wide_light failed: ${error.message || error}`);
        }

        const processed = rpcData?.analytics_4tables?.processed ?? batchCaseNumbers.length;
        doneSoFar += processed;
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

