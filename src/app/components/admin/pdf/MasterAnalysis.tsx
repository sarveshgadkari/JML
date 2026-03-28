import React from "react";
import getSupabase from "../../../../utils/supabase/client";

export default function MasterAnalysis() {
  const [rows, setRows] = React.useState<any[]>([]);
  const [q, setQ] = React.useState("");
  const [stats, setStats] = React.useState<{ total: number; lawyers: number; recent: number }>({ total: 0, lawyers: 0, recent: 0 });

  const load = async () => {
    const supabase = getSupabase();
    const [{ data, error }, totalC, recentC] = await Promise.all([
      supabase
        .from("cases")
        .select("case_number,case_title,court_name,judge_1,filing_date,judgment_date,judgement_link,updated_at")
        .ilike("case_title", `%${q}%`)
        .order("updated_at", { ascending: false })
        .limit(300),
      supabase.from("cases").select("id", { count: "exact", head: true }),
      supabase.from("cases").select("id", { count: "exact", head: true }).gte("updated_at", new Date(Date.now() - 24*60*60*1000).toISOString()),
    ]);
    if (!error && data) setRows(data);
    const total = totalC.count || 0;
    const recent = recentC.count || 0;

    const lawyersCountRes = await supabase
      .from("cases")
      .select("petitioner_lawyer_1,petitioner_lawyer_2,petitioner_lawyer_3,petitioner_lawyer_4,petitioner_lawyer_5,respondent_lawyer_1,respondent_lawyer_2,respondent_lawyer_3,respondent_lawyer_4,respondent_lawyer_5")
      .limit(5000);
    const setLawyers = new Set<string>();
    (lawyersCountRes.data || []).forEach((r: any) => {
      [r.petitioner_lawyer_1,r.petitioner_lawyer_2,r.petitioner_lawyer_3,r.petitioner_lawyer_4,r.petitioner_lawyer_5,
       r.respondent_lawyer_1,r.respondent_lawyer_2,r.respondent_lawyer_3,r.respondent_lawyer_4,r.respondent_lawyer_5
      ].filter(Boolean).forEach((n: string) => setLawyers.add(n));
    });
    setStats({ total, lawyers: setLawyers.size, recent });
  };

  React.useEffect(() => { void load(); }, [q]);

  const downloadCsv = () => {
    const headers = ["case_number","case_title","court_name","judge_1","filing_date","judgment_date","judgement_link","updated_at"];
    const csv = [headers.join(",")].concat(
      rows.map((r: any) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "master_cases.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <Stat label="Total Live Cases" value={stats.total} tone="ok" />
        <Stat label="Unique Lawyers Indexed" value={stats.lawyers} tone="processing" />
        <Stat label="Recent Uploads (Last 24h)" value={stats.recent} tone="pending" />
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
            onClick={async () => {
              try {
                const supabase = getSupabase();
                // Prefer wide canonical batch if available; fall back if needed
                const { error } = await supabase.rpc("admin_recalculate_analytics_wide_canon", { p_batch_size: 50, p_offset: 0 });
                if (error) throw error;
                alert("Master analysis started. Check analytics tables shortly.");
              } catch (e: any) {
                alert(`Master analysis failed: ${e?.message || e}`);
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            Run Master Analysis
          </button>
          <button onClick={downloadCsv} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-white text-sm font-semibold">
            Download Master CSV
          </button>
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

