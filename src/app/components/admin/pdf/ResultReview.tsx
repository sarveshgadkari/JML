import React from "react";
import getSupabase from "../../../../utils/supabase/client";

type ReviewRow = {
  id: string;
  created_at: string;
  file_url: string | null;
  extracted_data: any;
  verified?: boolean;
};

export default function ResultReview() {
  const [rows, setRows] = React.useState<ReviewRow[]>([]);
  const [busy, setBusy] = React.useState(false);

  const load = async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("pdf_queue")
      .select("id,created_at,file_url,extracted_data")
      .eq("status", "COMPLETED")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error && data) {
      const mapped: ReviewRow[] = (data as any).map((d: any) => ({
        id: d.id,
        created_at: d.created_at,
        file_url: d.file_url,
        extracted_data: Array.isArray(d.extracted_data) ? d.extracted_data : (d.extracted_data ? [d.extracted_data] : []),
        verified: false,
      }));
      setRows(mapped);
    }
  };

  React.useEffect(() => {
    void load();
    const supabase = getSupabase();
    const ch = supabase
      .channel("pdf_results_review_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "pdf_queue" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const updateCell = (rowId: string, idx: number, key: string, value: any) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const arr = [...r.extracted_data];
      const obj = { ...(arr[idx] || {}) };
      obj[key] = value;
      arr[idx] = obj;
      return { ...r, extracted_data: arr };
    }));
  };

  const toggleVerified = (rowId: string, val: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, verified: val } : r)));
  };

  const uploadVerifiedToMaster = async () => {
    setBusy(true);
    try {
      const supabase = getSupabase();
      // Collect verified rows, flatten arrays
      const payload: any[] = [];
      rows.filter((r) => r.verified).forEach((r) => {
        (r.extracted_data || []).forEach((obj: any) => {
          const stripTicks = (s: any) => (typeof s === "string" ? s.replace(/^`+|`+$/g, "") : s);
          const toArr = (v: any) => {
            if (Array.isArray(v)) return v.map(stripTicks);
            if (typeof v === "string") {
              try {
                const p = JSON.parse(v);
                return Array.isArray(p) ? p.map(stripTicks) : [];
              } catch { return []; }
            }
            return [];
          };
          payload.push({
            complaint_number: stripTicks(obj.complaint_number),
            case_title: stripTicks(obj.case_title),
            judge: stripTicks(obj.judge),
            court: stripTicks(obj.court),
            court_type: stripTicks(obj.court_type),
            outcome: stripTicks(obj.outcome),
            status: stripTicks(obj.status),
            filing_date: stripTicks(obj.filing_date),
            judgement_date: stripTicks(obj.judgement_date),
            petitioner_lawyers: toArr(obj.petitioner_lawyers),
            respondent_lawyers: toArr(obj.respondent_lawyers),
            total_hearings: obj.total_hearings ?? null,
            judgement_link: stripTicks(obj.judgement_link),
            data_source: "pdf_ai",
          });
        });
      });
      if (payload.length === 0) return;

      // Upsert into cases via existing RPC
      const chunk = 100;
      for (let i = 0; i < payload.length; i += chunk) {
        const slice = payload.slice(i, i + chunk);
        const { error } = await supabase.rpc("admin_import_cases_json_skip_sync", {
          p_rows: slice,
          p_replace_existing: false,
          p_skip_sync: i + chunk < payload.length,
        });
        if (error) throw error;
      }

      // Archive processed pdf_queue rows
      const verifiedIds = rows.filter((r) => r.verified).map((r) => r.id);
      if (verifiedIds.length > 0) {
        await supabase.from("pdf_queue").update({ status: "ARCHIVED" as any }).in("id", verifiedIds);
      }

      alert(`Uploaded ${payload.length} records to master and archived source rows.`);
      void load();
    } catch (e: any) {
      alert(`Upload failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  // Columns we expect in JSON
  const columns = [
    "complaint_number","case_title","judge","court","court_type",
    "outcome","status","filing_date","judgement_date",
    "petitioner_lawyers","respondent_lawyers","total_hearings","judgement_link"
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4 flex items-center justify-between">
        <div className="font-semibold text-slate-900">Result Review & Upload</div>
        <button
          onClick={uploadVerifiedToMaster}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white text-sm font-semibold disabled:opacity-50"
        >
          🚀 UPLOAD VERIFIED TO MASTER
        </button>
      </div>

      <div className="rounded-xl border bg-white overflow-auto">
        <table className="min-w-[1200px] text-xs">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left">Verify</th>
              <th className="px-3 py-2 text-left">File</th>
              {columns.map((c) => (
                <th key={c} className="px-3 py-2 text-left">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={columns.length + 2}>No completed items to review.</td></tr>
            )}
            {rows.map((r) => {
              const fname = String(r.file_url || "").split("/").pop() || r.file_url || "unknown";
              return (r.extracted_data || []).map((obj: any, idx: number) => (
                <tr key={`${r.id}_${idx}`} className="border-t align-top">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={!!r.verified} onChange={(e) => toggleVerified(r.id, e.target.checked)} />
                  </td>
                  <td className="px-3 py-2">{fname}</td>
                  {columns.map((c) => (
                    <td key={c} className="px-2 py-1 min-w-[180px]">
                      <input
                        value={typeof obj?.[c] === "string" ? obj[c] : Array.isArray(obj?.[c]) ? JSON.stringify(obj[c]) : obj?.[c] ?? ""}
                        onChange={(e) => updateCell(r.id, idx, c, e.target.value)}
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>
                  ))}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

