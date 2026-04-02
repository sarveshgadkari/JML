import React from "react";
import getSupabase from "../../../../utils/supabase/client";
import ProcessingEngine from "./ProcessingEngine";
import type { ProcessingThread } from "./ThreadConfigurator";

export default function PopupWorkerShell({ threadId }: { threadId: string }) {
  const [thread, setThread] = React.useState<ProcessingThread | null>(null);
  const [error, setError] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    const loadThread = async () => {
      setLoading(true);
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("ai_threads")
          .select(`
            id,
            name,
            provider,
            model,
            api_key_secret,
            batch_size,
            current_batch_size,
            consecutive_errors,
            assigned_key_id,
            rpd_limit,
            system_prompt,
            is_active,
            worker_state,
            worker_last_seen_at,
            worker_claimed_count,
            worker_processed_count,
            worker_current_batch_count,
            worker_popup_id,
            worker_error,
            assigned_key:ai_keys!assigned_key_id (
              id,
              key_value,
              status
            )
          `)
          .eq("id", threadId)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Popup worker thread not found.");
        if (!mounted) return;
        const keyValue = data.assigned_key?.key_value || data.api_key_secret || "";
        setThread({
          id: data.id,
          name: data.name,
          provider: data.provider,
          model: data.model,
          apiKey: keyValue,
          batchSize: data.current_batch_size ?? data.batch_size,
          initialBatchSize: data.batch_size,
          currentBatchSize: data.current_batch_size ?? data.batch_size,
          prompt: data.system_prompt,
          active: data.is_active,
          consecutiveErrors: data.consecutive_errors ?? 0,
          assignedKeyId: data.assigned_key_id ?? data.assigned_key?.id ?? null,
          assignedKeyPreview: keyValue ? maskKey(keyValue) : null,
          keyStatus: data.assigned_key?.status ?? null,
          rpmLimit: 5,
          rpdLimit: data.rpd_limit ?? 100,
        });
        setError("");
      } catch (err: any) {
        if (mounted) setError(err?.message || "Failed to load worker thread.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void loadThread();
    return () => {
      mounted = false;
    };
  }, [threadId]);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-lg font-semibold text-slate-900">Popup PDF Worker</div>
          <div className="mt-1 text-sm text-slate-600">This window runs a single isolated worker thread and syncs status back to Supabase.</div>
        </div>
        {loading && <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">Loading worker configuration...</div>}
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        {thread && (
          <>
            <div className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Worker Thread Config</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {thread.name} • {thread.provider} • {thread.model} • Batch {thread.batchSize}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-sm font-semibold text-slate-900">Prompt Used</div>
              <div className="mt-2 rounded-lg border bg-slate-50 p-3">
                <pre className="whitespace-pre-wrap break-words text-xs leading-5 max-h-80 overflow-y-auto text-slate-800">
                  {thread.prompt}
                </pre>
              </div>
            </div>

            <ProcessingEngine threads={[thread]} popupMode popupThreadId={thread.id} />
          </>
        )}
      </div>
    </div>
  );
}

function maskKey(value: string) {
  if (!value) return "—";
  if (value.length <= 8) return `${value.slice(0, 2)}****${value.slice(-2)}`;
  return `${value.slice(0, 4)}••••••${value.slice(-4)}`;
}
