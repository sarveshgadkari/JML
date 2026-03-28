import React from "react";
import getSupabase from "../../../../utils/supabase/client";

export default function RankCommandCenter() {
  const [count, setCount] = React.useState<number | null>(null);
  const [done, setDone] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<"Outdated" | "Up-to-Date">("Outdated");

  const start = async () => {
    setBusy(true);
    setDone(0);
    try {
      const supabase = getSupabase();
      // Estimate workload (lawyers in analytics)
      const { count } = await supabase.from("lawyer_analytics").select("lawyer_id", { count: "exact", head: true });
      setCount(count ?? 0);

      // RPC does the heavy lifting in batches
      const batch = 200;
      const loops = Math.ceil(Math.max(1, count ?? 1000) / batch);
      for (let i = 0; i < loops; i++) {
        const { error } = await supabase.rpc("admin_compute_tri_ranks_batch", { p_batch_size: batch, p_offset: i * batch });
        if (error) throw error;
        setDone((d) => d + Math.min(batch, (count ?? 0) - i * batch));
      }
      setStatus("Up-to-Date");
    } catch (e) {
      // ignore, surface minimal UI
    } finally {
      setBusy(false);
    }
  };

  const pct = count && count > 0 ? Math.min(100, Math.round((done / count) * 100)) : 0;

  return (
    <div className="space-y-3 rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-slate-900 font-semibold">Rank Command Center</div>
        <div className={`text-xs px-2 py-1 rounded-full border ${status === "Up-to-Date" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
          Current Rankings: {status}
        </div>
      </div>
      <button
        onClick={start}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50"
      >
        ⚡ TRIGGER GLOBAL RANK RECOMPUTATION
      </button>
      <div className="text-xs text-slate-600">Processing {count ?? 0} Lawyer Ranks...</div>
      <div className="w-full h-2 bg-slate-200 rounded">
        <div className="h-2 bg-indigo-600 rounded transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

