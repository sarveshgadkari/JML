import React from "react";
import { Server, Trash2 } from "lucide-react";
import type { ProcessingThread } from "./ThreadConfigurator";
import getSupabase from "../../../../utils/supabase/client";

export type QueueStats = {
  total: number;
  pending: number;
  processing: number;
  extracted: number;
  reclaimed?: number;
};

type QueueRow = {
  id: string;
  filename: string;
  uploadedAt: string;
  status: "Pending" | "Processing" | "Completed";
  claimedBy?: string | null;
};

interface Props {
  stats: QueueStats;
  threads: ProcessingThread[];
  queue: QueueRow[];
  onSyncQueue: (rows: QueueRow[]) => void;
}

export default function ProcessingDashboard({ stats, threads, queue, onSyncQueue }: Props) {
  const [rows, setRows] = React.useState<Array<{ id: string; file_url: string | null; public_viewer_url?: string | null; direct_download_url?: string | null; status: string; created_at: string; error_log?: string | null; reclaimed_count?: number | null }>>([]);
  const [busyDelAll, setBusyDelAll] = React.useState(false);
  const [busyFetchAll, setBusyFetchAll] = React.useState(false);
  const [workerRuntime, setWorkerRuntime] = React.useState<Record<string, {
    worker_state?: string | null;
    worker_last_seen_at?: string | null;
    worker_claimed_count?: number | null;
    worker_processed_count?: number | null;
    worker_current_batch_count?: number | null;
    worker_popup_id?: string | null;
    worker_error?: string | null;
  }>>({});

  const loadRows = React.useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("pdf_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!error && data) {
        setRows(data as any);
        const syncedRows: QueueRow[] = (data ?? []).map((r: any) => ({
          id: r.id,
          filename:
            String(r.file_url || "").split("/").pop() ||
            String(r.direct_download_url || "").split("/").pop() ||
            String(r.public_viewer_url || "").split("/").pop() ||
            r.file_url ||
            r.direct_download_url ||
            r.public_viewer_url ||
            "unknown.pdf",
          uploadedAt: r.created_at,
          status:
            r.status === "PROCESSING"
              ? "Processing"
              : r.status === "COMPLETED" || r.status === "ARCHIVED"
              ? "Completed"
              : "Pending",
          claimedBy: r.claimed_by || null,
        }));
        onSyncQueue(syncedRows);
      }
    } catch {
      // ignore
    }
  }, [onSyncQueue]);

  React.useEffect(() => {
    void loadRows();
    const supabase = getSupabase();

    // Realtime can occasionally miss events (network/tab focus). Polling keeps UI consistent.
    const intervalId = window.setInterval(() => {
      void loadRows();
    }, 5000);

    const ch = supabase
      .channel("pdf_queue_stream_proc")
      .on("postgres_changes", { event: "*", schema: "public", table: "pdf_queue" }, () => {
        void loadRows();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
      window.clearInterval(intervalId);
    };
  }, [loadRows]);

  React.useEffect(() => {
    const loadWorkerRuntime = async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("ai_threads")
        .select("id,worker_state,worker_last_seen_at,worker_claimed_count,worker_processed_count,worker_current_batch_count,worker_popup_id,worker_error");
      if (!error && data) {
        setWorkerRuntime(Object.fromEntries((data as any[]).map((row) => [row.id, row])));
      }
    };
    void loadWorkerRuntime();
    const supabase = getSupabase();
    const channel = supabase
      .channel("ai_thread_runtime_stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_threads" }, () => {
        void loadWorkerRuntime();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const deleteOne = async (id: string) => {
    try {
      const supabase = getSupabase();
      await supabase.from("pdf_queue").delete().eq("id", id);
      setRows((r) => r.filter((x) => x.id !== id));
    } catch {
      // ignore
    }
  };

  const deleteAll = async () => {
    setBusyDelAll(true);
    try {
      const supabase = getSupabase();
      await supabase.from("pdf_queue").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // delete all
      setRows([]);
    } catch {
      // ignore
    } finally {
      setBusyDelAll(false);
    }
  };

  const perThread = threads
    .filter(t => t.active)
    .map((t) => {
      const runtime = workerRuntime[t.id] || {};
      const liveBatch = Number(runtime.worker_current_batch_count || 0);
      const status = runtime.worker_state || (liveBatch > 0 ? "running" : "idle");
      const batchLabel = liveBatch > 0 ? `Processing ${liveBatch} PDF${liveBatch > 1 ? "s" : ""}` : "—";
      return {
        id: t.id,
        name: t.name,
        provider: t.provider,
        model: t.model,
        status,
        batchLabel,
        claimedCount: Number(runtime.worker_claimed_count || 0),
        processedCount: Number(runtime.worker_processed_count || 0),
        popupOpen: !!runtime.worker_popup_id,
        lastSeenAt: runtime.worker_last_seen_at || null,
        workerError: runtime.worker_error || null,
      };
    });

  const reclaimedCount = React.useMemo(
    () => rows.filter((row) => Number(row.reclaimed_count || 0) > 0).length,
    [rows]
  );

  const processingBacklogCount = React.useMemo(() => {
    const pending = rows.filter((r) => r.status === "PENDING").length;
    const processing = rows.filter((r) => r.status === "PROCESSING").length;
    return pending + processing;
  }, [rows]);

  const visibleUploadedRows = React.useMemo(
    () => rows.filter((r) => r.status !== "COMPLETED" && r.status !== "ARCHIVED"),
    [rows]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <StatCard label="Total PDFs" value={stats.total} />
          <StatCard label="Pending" value={stats.pending} tone="pending" />
          <StatCard label="Processing" value={stats.processing} tone="processing" />
          <StatCard label="Extracted" value={stats.extracted} tone="ok" />
          <StatCard label="Stale/Reclaimed" value={reclaimedCount} tone="pending" />
          <StatCard label="For Processing" value={processingBacklogCount} tone="processing" />
        </div>
      </div>

      <div className="rounded-xl border bg-white">
        <div className="px-4 py-3 border-b bg-slate-50 text-slate-900 font-semibold">Active Workers</div>
        {perThread.length === 0 && <div className="px-4 py-6 text-sm text-slate-600">No active threads.</div>}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {perThread.map((w) => (
            <div key={w.id} className="border rounded-lg p-4 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-slate-900">{w.name}</div>
                <span className="text-xs px-2 py-1 rounded-full border bg-slate-50 text-slate-700 border-slate-200">{w.provider} • {w.model}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700 mb-1">
                <Server className="w-4 h-4 text-slate-600" />
                <span className="font-medium">Status:</span>
                <span>{w.status}</span>
              </div>
              <div className="text-sm text-slate-700">
                <span className="font-medium">Current Batch:</span> {w.batchLabel}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                <div className="rounded border bg-slate-50 px-2 py-1">
                  <div className="text-slate-500">Claimed</div>
                  <div className="font-semibold text-slate-900">{w.claimedCount}</div>
                </div>
                <div className="rounded border bg-slate-50 px-2 py-1">
                  <div className="text-slate-500">Processed</div>
                  <div className="font-semibold text-slate-900">{w.processedCount}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Popup {w.popupOpen ? "connected" : "not connected"}{w.lastSeenAt ? ` • Last seen ${new Date(w.lastSeenAt).toLocaleTimeString()}` : ""}
              </div>
              {w.workerError && <div className="mt-2 text-xs text-rose-700">{w.workerError}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Uploaded PDFs table */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50 text-slate-900 font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>Uploaded PDFs</div>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
              {visibleUploadedRows.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setBusyFetchAll(true);
                try {
                  await loadRows();
                } finally {
                  setBusyFetchAll(false);
                }
              }}
              disabled={busyFetchAll}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-900 text-sm font-semibold disabled:opacity-50"
            >
              {busyFetchAll ? "Fetching..." : "Fetch All"}
            </button>
            <button
              onClick={deleteAll}
              disabled={busyDelAll || rows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-white text-sm font-semibold disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Delete All
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-2 text-left">File</th>
                <th className="px-4 py-2 text-left">Uploaded</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleUploadedRows.length === 0 && (
                <tr><td className="px-4 py-6 text-slate-500" colSpan={4}>No PDFs found.</td></tr>
              )}
              {visibleUploadedRows.map(r => {
                const color =
                  r.status === "COMPLETED" || r.status === "ARCHIVED"
                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                    : r.status === "PROCESSING"
                    ? "text-blue-700 bg-blue-50 border-blue-200"
                    : "text-slate-700 bg-slate-50 border-slate-200";
                const fname =
                  String(r.file_url || "").split("/").pop() ||
                  String(r.direct_download_url || "").split("/").pop() ||
                  String(r.public_viewer_url || "").split("/").pop() ||
                  r.file_url ||
                  r.direct_download_url ||
                  r.public_viewer_url ||
                  "unknown";
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2">{fname}</td>
                    <td className="px-4 py-2">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-2">
                      <button onClick={() => deleteOne(r.id)} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Backend mechanism notes (important for implementers) */}
      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm text-slate-900 font-semibold mb-2">Backend Queue Claiming Mechanism (Design Notes)</div>
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li>There is ONLY ONE central queue (e.g., table <code className="font-mono">public.pdf_queue</code>).</li>
          <li>Each thread atomically claims a batch of size <code className="font-mono">X</code> using a single SQL transaction.</li>
          <li>Suggested SQL: <code className="font-mono">UPDATE ... SET status='processing', claimed_by=$thread WHERE id IN (SELECT id FROM pdf_queue WHERE status='pending' ORDER BY created_at ASC LIMIT X FOR UPDATE SKIP LOCKED) RETURNING *</code></li>
          <li>Workers stream PDF text → call AI → validate JSON → write to <code className="font-mono">pdf_extractions</code> table → mark queue rows <code className="font-mono">completed</code> (or <code className="font-mono">failed</code> with error).</li>
        </ul>
        <div className="mt-3 text-sm text-slate-900 font-semibold">Expected AI JSON Payload</div>
        <pre className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs overflow-x-auto">
{`{
  "case_number": "CC006000000479902",
  "court": "MahaRERA",
  "bench": "Member A",
  "parties": {
    "petitioner": "Homebuyer Name",
    "respondent": "Builder/Promoter Name"
  },
  "dates": {
    "filed": "2024-10-04",
    "judgment": "2026-12-02"
  },
  "disposition": "In favor of Complainant",
  "citations": ["2026 SCC OnLine 1234"],
  "sections": ["RERA s.18", "RERA s.19"]
}`}
        </pre>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "pending" | "processing" | "ok" }) {
  const cls =
    tone === "ok"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : tone === "processing"
      ? "text-blue-700 bg-blue-50 border-blue-200"
      : tone === "pending"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-slate-700 bg-slate-50 border-slate-200";
  return (
    <div className="rounded-lg border p-3 bg-white">
      <div className="text-xs text-slate-600">{label}</div>
      <div className={`inline-flex mt-1 px-2 py-0.5 rounded-full border text-sm font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

