import React, { useCallback, useEffect, useRef, useState } from "react";
import getSupabase from "../../../../utils/supabase/client";

type QueueItem = {
  id: string;
  file_url?: string | null;
  public_viewer_url?: string | null;
  direct_download_url?: string | null;
};

type ThreadCfg = {
  id: string;
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  batchSize: number;
  prompt: string;
  rpmLimit?: number; // requests per minute
};

export default function ProcessingEngine({ activeThread }: { activeThread: ThreadCfg | null }) {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const runRef = useRef(false);

  const log = useCallback((m: string) => {
    setLogs((prev) => [...prev.slice(-400), `[${new Date().toLocaleTimeString()}] ${m}`]);
  }, []);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const processNextBatch = useCallback(async () => {
    if (!runRef.current || !activeThread) return;
    try {
      const supabase = getSupabase();
      // Step 1: claim a batch
      const { data: claimed, error: clErr } = await supabase.rpc("claim_pdf_batch", {
        p_thread_id: activeThread.id,
        p_batch_size: activeThread.batchSize,
      });
      if (clErr) {
        log(`Claim failed: ${clErr.message}`);
        await sleep(3000);
        if (runRef.current) processNextBatch();
        return;
      }
      if (!claimed || claimed.length === 0) {
        log("Queue empty. Sleeping for 60s...");
        await sleep(60000);
        if (runRef.current) processNextBatch();
        return;
      }

      // Fetch full rows for URLs
      const ids = (claimed as Array<{ queue_id: string }>).map((c) => c.queue_id);
      const { data: rows, error: selErr } = await supabase
        .from("pdf_queue")
        .select("id,file_url")
        .in("id", ids);
      if (selErr) {
        log(`Failed loading batch rows: ${selErr.message}`);
        await sleep(3000);
        if (runRef.current) processNextBatch();
        return;
      }

      // Resolve actual download URLs (signed URLs for storage paths)
      const resolved = await Promise.all(
        (rows || []).map(async (r: any) => {
          const fu: string = r.file_url || "";
          // Expect format "bucket:path"
          if (fu.includes(":")) {
            const [bucket, ...rest] = fu.split(":");
            const path = rest.join(":");
            try {
              const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 30); // 30 min
              if (signed?.signedUrl) return { ...r, _resolved_url: signed.signedUrl };
            } catch {
              // ignore
            }
          }
          return { ...r, _resolved_url: null };
        })
      );
      const missing = resolved.filter((r) => !r._resolved_url).length;
      if (missing > 0) {
        log(`Warning: ${missing} item(s) have no resolvable URL and will be skipped.`);
      }
      const toProcess = resolved.filter((r) => r._resolved_url);
      if (toProcess.length === 0) {
        // Nothing processable; sleep briefly and retry
        await sleep(3000);
        if (runRef.current) processNextBatch();
        return;
      }

      // Step 3: call AI via Supabase Edge Function to bypass CORS and handle keys
      const { data: fnData, error: fnErr } = await supabase.functions.invoke("process-batch", {
        body: {
          batch: toProcess.map((r: any) => ({
            id: r.id,
            direct_download_url: r._resolved_url,
          })),
          threadConfig: {
            provider: activeThread.provider,
            model: activeThread.model,
            apiKey: activeThread.apiKey,
            prompt: activeThread.prompt,
          },
        }
      });
      if (fnErr) {
        const msg = fnErr.message || String(fnErr);
        log(`process-batch error: ${msg}`);
        // Mark items failed
        await supabase.from("pdf_queue").update({ status: "FAILED", error_log: `process-batch invoke error: ${msg}` }).in("id", ids);
      } else {
        const results: Array<{ id: string; ok: boolean; json?: any; error?: string }> = (fnData as any)?.results ?? [];
        for (const r of results) {
          if (r.ok) {
            await supabase
              .from("pdf_queue")
              .update({ status: "COMPLETED", extracted_data: r.json, error_log: null })
              .eq("id", r.id);
            log(`Completed ${r.id}`);
          } else {
            await supabase
              .from("pdf_queue")
              .update({ status: "FAILED", error_log: r.error || "unknown" })
              .eq("id", r.id);
            log(`Failed ${r.id}: ${r.error}`);
          }
        }
      }

      // Step 5: rate limit
      const rpm = activeThread.rpmLimit ?? 5;
      const delayPerReqMs = Math.ceil((60_000 / Math.max(1, rpm)) * Math.max(1, ids.length));
      await sleep(delayPerReqMs);

      if (runRef.current) processNextBatch();
    } catch (e: any) {
      log(`Engine error: ${e?.message || e}`);
      await sleep(5000);
      if (runRef.current) processNextBatch();
    }
  }, [activeThread, log]);

  useEffect(() => {
    return () => {
      runRef.current = false;
    };
  }, []);

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-slate-900 font-semibold">Browser-Orchestrated Processor</div>
        <button
          onClick={() => {
            if (!activeThread) return;
            if (isRunning) {
              runRef.current = false;
              setIsRunning(false);
              return;
            }
            runRef.current = true;
            setIsRunning(true);
            processNextBatch();
          }}
          className={`px-4 py-2 rounded-lg text-white font-semibold ${isRunning ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
          disabled={!activeThread}
        >
          {isRunning ? "⏸ PAUSE PROCESSING" : "▶ START PROCESSING QUEUE"}
        </button>
      </div>
      <div className="text-sm text-slate-600">
        {activeThread ? `Active thread: ${activeThread.name} (${activeThread.provider} • ${activeThread.model})` : "Select/configure a thread first."}
      </div>
      <div className="bg-slate-900 text-green-400 font-mono text-xs p-4 rounded-lg h-64 overflow-y-auto">
        {logs.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}

