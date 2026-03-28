import React from "react";
import getSupabase from "../../../../utils/supabase/client";

export default function ResultsQueue() {
  const [rows, setRows] = React.useState<Array<{ id: string; file_url: string | null; created_at: string; extracted_data: any }>>([]);
  const [busy, setBusy] = React.useState(false);

  const load = async () => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("pdf_queue")
        .select("id,file_url,created_at,extracted_data")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!error && data) setRows(data as any);
    } catch {}
  };

  React.useEffect(() => {
    void load();
    const supabase = getSupabase();
    const ch = supabase
      .channel("pdf_results_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "pdf_queue" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const sendToUploadCases = async (id: string, payload: any) => {
    if (!payload) return;
    setBusy(true);
    try {
      const supabase = getSupabase();
      // Expecting an array of case objects per our schema; if a single object, wrap it
      const rows = Array.isArray(payload) ? payload : [payload];
      // For safety, cap batch to a reasonable size
      const chunk = 100;
      for (let i = 0; i < rows.length; i += chunk) {
        const slice = rows.slice(i, i + chunk);
        const { error } = await supabase.rpc("admin_import_cases_json_skip_sync", {
          p_rows: slice,
          p_replace_existing: false,
          p_skip_sync: i + chunk < rows.length, // only sync on last batch
        });
        if (error) throw error;
      }
    } catch {}
    setBusy(false);
  };

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="px-4 py-3 border-b bg-slate-50 text-slate-900 font-semibold">Results Review (Queued JSON)</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-2 text-left">File</th>
              <th className="px-4 py-2 text-left">Uploaded</th>
              <th className="px-4 py-2 text-left">Has JSON</th>
              <th className="px-4 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={4}>No extracted results yet.</td></tr>
            )}
            {rows.map(r => {
              const fname = String(r.file_url || "").split("/").pop() || r.file_url || "unknown";
              const hasJson = r.extracted_data && (Array.isArray(r.extracted_data) ? r.extracted_data.length > 0 : true);
              return (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">{fname}</td>
                  <td className="px-4 py-2">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">{hasJson ? "Yes" : "No"}</td>
                  <td className="px-4 py-2">
                    <button
                      disabled={!hasJson || busy}
                      onClick={() => sendToUploadCases(r.id, r.extracted_data)}
                      className="rounded-lg border px-3 py-1 text-xs font-semibold disabled:opacity-50"
                    >
                      Send to Upload Cases
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

