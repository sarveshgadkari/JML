import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import getSupabase from "../../../../utils/supabase/client";
import { dispatchAiBatchExtraction, dispatchAiExtraction, getAiProviderCapabilities } from "../../../../utils/ai-client";
import { buildImportPayloadFromExtractionRows, importCasesPayload } from "./import-utils";

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
  initialBatchSize: number;
  currentBatchSize: number;
  prompt: string;
  rpmLimit?: number; // requests per minute
  rpdLimit?: number; // requests per day
  consecutiveErrors: number;
  assignedKeyId: string | null;
  assignedKeyPreview: string | null;
  keyStatus: string | null;
};

type RuntimeThreadState = {
  currentBatchSize: number;
  consecutiveErrors: number;
  assignedKeyId: string | null;
  apiKey: string;
  assignedKeyPreview: string | null;
  dailyUsageCount: number;
  rpmWindow: number[];
  isWorking: boolean;
  claimedCount: number;
  processedCount: number;
  currentBatchClaimed: number;
};

export default function ProcessingEngine({
  threads,
  popupMode = false,
  popupThreadId,
}: {
  threads: ThreadCfg[];
  popupMode?: boolean;
  popupThreadId?: string;
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [engineConcurrency, setEngineConcurrency] = useState(1);
  const [inFlight, setInFlight] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [runtimeState, setRuntimeState] = useState<Record<string, RuntimeThreadState>>({});
  const runRef = useRef(false);
  const popupRefs = useRef<Record<string, Window | null>>({});

  const log = useCallback((m: string) => {
    setLogs((prev) => [...prev.slice(-400), `[${new Date().toLocaleTimeString()}] ${m}`]);
  }, []);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const activeThreads = useMemo(
    () => threads.filter((thread) => thread.active && (!popupThreadId || thread.id === popupThreadId)),
    [popupThreadId, threads]
  );

  const fileLabel = (row: QueueItem) =>
    row.public_viewer_url?.split("/").pop() ||
    row.direct_download_url?.split("/").pop() ||
    row.file_url?.split("/").pop() ||
    row.id;

  const normalizeQueueStatus = (value: string) =>
    value === "PROCESSING" ? "Processing" : value === "COMPLETED" ? "Completed" : "Pending";

  const threadPrefix = (thread: ThreadCfg, state?: RuntimeThreadState) =>
    `[${thread.name} | ${state?.assignedKeyPreview || thread.assignedKeyPreview || "NoKey"}]`;

  const persistWorkerRuntime = useCallback(async (
    threadId: string,
    patch: Partial<{
      worker_state: string;
      worker_last_seen_at: string;
      worker_claimed_count: number;
      worker_processed_count: number;
      worker_current_batch_count: number;
      worker_popup_id: string | null;
      worker_error: string | null;
    }>
  ) => {
    const supabase = getSupabase();
    await supabase.from("ai_threads").update(patch).eq("id", threadId);
  }, []);

  const resolveDownloadUrl = useCallback(async (row: QueueItem) => {
    const supabase = getSupabase();
    const directUrl = row.direct_download_url?.trim();
    if (directUrl) return directUrl;

    const fileUrl = row.file_url?.trim() || "";
    if (/^https?:\/\//i.test(fileUrl)) return fileUrl;

    if (fileUrl.includes(":")) {
      const [bucket, ...rest] = fileUrl.split(":");
      const path = rest.join(":");
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 30);
      if (error || !data?.signedUrl) {
        throw new Error(error?.message || "Could not create signed URL for queued PDF.");
      }
      return data.signedUrl;
    }

    throw new Error("No downloadable PDF URL found on the queue item.");
  }, []);

  const syncPendingError = useCallback(async (queueId: string, errorMessage: string) => {
    const supabase = getSupabase();
    await supabase
      .from("pdf_queue")
      .update({
        status: "PENDING",
        claimed_by: null,
        claimed_at: null,
        error_log: errorMessage,
      })
      .eq("id", queueId);
  }, []);

  const revertPdfToPending = useCallback(async (queueId: string, errorMessage: string) => {
    const supabase = getSupabase();
    await supabase
      .from("pdf_queue")
      .update({
        status: "PENDING",
        claimed_by: null,
        claimed_at: null,
        error_log: errorMessage,
      })
      .eq("id", queueId);
  }, []);

  const releaseClaimedRows = useCallback(async (queueIds: string[], reason: string) => {
    if (queueIds.length === 0) return;
    const supabase = getSupabase();
    await supabase
      .from("pdf_queue")
      .update({
        status: "PENDING",
        claimed_by: null,
        claimed_at: null,
        error_log: reason,
      })
      .in("id", queueIds);
  }, []);

  const releaseThreadClaims = useCallback(async (threadIds: string[], reason: string) => {
    if (threadIds.length === 0) return;
    const supabase = getSupabase();
    await supabase
      .from("pdf_queue")
      .update({
        status: "PENDING",
        claimed_by: null,
        claimed_at: null,
        error_log: reason,
      })
      .in("claimed_by", threadIds)
      .eq("status", "PROCESSING");
  }, []);

  const releaseThreadKeyLeases = useCallback(async (threadIds: string[], cooldownUntil: string | null = null) => {
    if (threadIds.length === 0) return;
    const supabase = getSupabase();
    for (const threadId of threadIds) {
      await supabase.rpc("release_ai_key_for_thread", {
        p_thread_id: threadId,
        p_cooldown_until: cooldownUntil,
      });
    }
  }, []);
  const updateRuntime = useCallback((threadId: string, updater: (prev: RuntimeThreadState) => RuntimeThreadState) => {
    setRuntimeState((prev) => {
      const current = prev[threadId];
      if (!current) return prev;
      return { ...prev, [threadId]: updater(current) };
    });
  }, []);

  const incrementProcessedCount = useCallback((threadId: string, amount = 1) => {
    setRuntimeState((prev) => {
      const current = prev[threadId];
      if (!current) return prev;
      const nextProcessedCount = current.processedCount + amount;
      void persistWorkerRuntime(threadId, {
        worker_last_seen_at: new Date().toISOString(),
        worker_processed_count: nextProcessedCount,
        worker_error: null,
      });
      return {
        ...prev,
        [threadId]: {
          ...current,
          processedCount: nextProcessedCount,
        },
      };
    });
  }, [persistWorkerRuntime]);

  const persistThreadState = useCallback(async (threadId: string, values: Partial<{
    current_batch_size: number;
    consecutive_errors: number;
    assigned_key_id: string | null;
    api_key_secret: string;
  }>) => {
    const supabase = getSupabase();
    await supabase.from("ai_threads").update(values).eq("id", threadId);
  }, []);

  const fetchReplacementKey = useCallback(async (thread: ThreadCfg) => {
    const supabase = getSupabase();
    const state = runtimeState[thread.id];
    const { data, error } = await supabase.rpc("claim_ai_key_for_thread", {
      p_provider: thread.provider,
      p_thread_id: thread.id,
      p_exclude_key_id: state?.assignedKeyId ?? null,
    });
    if (error) throw error;
    return data as any;
  }, [runtimeState]);

  const rotateThreadKey = useCallback(async (thread: ThreadCfg, reason: string, shouldCooldownCurrentKey: boolean) => {
    const state = runtimeState[thread.id];
    const cooldownUntil = shouldCooldownCurrentKey ? new Date(Date.now() + 3 * 60 * 1000).toISOString() : null;

    // Try to avoid reselecting the same key.
    let replacement = await fetchReplacementKey(thread);
    if (!replacement) {
      throw new Error(`No active replacement key available for ${thread.provider}.`);
    }

    if (state?.assignedKeyId) {
      await releaseThreadKeyLeases([thread.id], cooldownUntil);
    }

    await persistThreadState(thread.id, {
      assigned_key_id: replacement.id,
      api_key_secret: replacement.key_value,
      current_batch_size: thread.batchSize,
      consecutive_errors: 0,
    });

    updateRuntime(thread.id, (prev) => ({
      ...prev,
      assignedKeyId: replacement.id,
      apiKey: replacement.key_value,
      assignedKeyPreview: maskKey(replacement.key_value),
      dailyUsageCount: replacement.daily_usage_count ?? 0,
      consecutiveErrors: 0,
      currentBatchSize: thread.batchSize,
    }));

    log(
      `${threadPrefix(thread, state)} 🚨 Rotating API Key.${shouldCooldownCurrentKey ? " Cool-down initiated for 3m." : ""} ${reason}`
    );
  }, [fetchReplacementKey, log, persistThreadState, releaseThreadKeyLeases, runtimeState, updateRuntime]);

  // Count every AI request/batch attempt towards RPD (per API key).
  const markAiAttempt = useCallback(async (thread: ThreadCfg) => {
    let assignedKeyId: string | null = null;
    let nextUsage = 0;

    // Update UI immediately so popup shows current usage even if the request fails.
    // Compute from the *current* runtime snapshot to avoid stale closure values.
    updateRuntime(thread.id, (prev) => {
      assignedKeyId = prev.assignedKeyId;
      nextUsage = (prev.dailyUsageCount || 0) + 1;
      return {
        ...prev,
        dailyUsageCount: nextUsage,
      };
    });

    if (assignedKeyId) {
      const supabase = getSupabase();
      await supabase
        .from("ai_keys")
        .update({ daily_usage_count: nextUsage })
        .eq("id", assignedKeyId);
    }
  }, [updateRuntime]);

  const reserveProviderSlot = useCallback(async (thread: ThreadCfg, state: RuntimeThreadState) => {
    // Hard cap: at most 10 AI requests per minute per worker thread.
    // (Still honors provider-configured rpmLimit if it's smaller.)
    const rpmLimit = Math.min(10, Math.max(1, thread.rpmLimit ?? 5));
    let rpmWindow = [...state.rpmWindow];

    while (true) {
      const now = Date.now();
      rpmWindow = rpmWindow.filter((stamp) => now - stamp < 60_000);
      if (rpmWindow.length < rpmLimit) break;
      const waitMs = Math.max(1000, 60_000 - (now - rpmWindow[0]));
      log(`${threadPrefix(thread, state)} [RateLimit] RPM cap reached (${rpmLimit}/min). Waiting ${Math.ceil(waitMs / 1000)}s...`);
      await sleep(waitMs);
    }

    rpmWindow.push(Date.now());
    updateRuntime(thread.id, (prev) => ({ ...prev, rpmWindow }));
    return true;
  }, [log, updateRuntime]);

  const enqueueCasesForTableAnalysis = useCallback(async (caseNumbers: string[], threadId: string) => {
    if (!caseNumbers.length) return;
    try {
      const supabase = getSupabase();
      const rows = caseNumbers
        .filter(Boolean)
        .map((case_number) => ({
          case_number,
          added_by_thread_id: threadId,
        }));
      // Upsert avoids duplicate rows while workers are running.
      const { error } = await supabase.from("table_analysis_queue").upsert(rows, { onConflict: "case_number" });
      if (error) throw error;
      log(`[TableAnalysisQueue] Enqueued ${rows.length} case(s) for analysis.`);
    } catch (e: any) {
      const message = e?.message || String(e);
      // Non-fatal: extraction should continue even if queue append fails.
      log(`[TableAnalysisQueue] Enqueue failed (non-fatal): ${message}`);
    }
  }, [log]);

  const markSuccess = useCallback(async (thread: ThreadCfg) => {
    const state = runtimeState[thread.id];
    if (!state) return;
    await persistThreadState(thread.id, {
      consecutive_errors: 0,
      current_batch_size: state.currentBatchSize,
    });
    updateRuntime(thread.id, (prev) => ({
      ...prev,
      consecutiveErrors: 0,
      dailyUsageCount: prev.dailyUsageCount,
    }));
    await persistWorkerRuntime(thread.id, {
      worker_state: "running",
      worker_last_seen_at: new Date().toISOString(),
      worker_error: null,
    });
  }, [persistThreadState, persistWorkerRuntime, runtimeState, updateRuntime]);

  const handleThreadError = useCallback(async (thread: ThreadCfg, error: unknown) => {
    const state = runtimeState[thread.id];
    if (!state) return;
    const message = String((error as any)?.message || error || "Unknown error");
    let nextErrors = 0;
    let usageCount = state.dailyUsageCount;

    setRuntimeState((prev) => {
      const current = prev[thread.id];
      if (!current) return prev;
      nextErrors = current.consecutiveErrors + 1;
      usageCount = current.dailyUsageCount;
      return {
        ...prev,
        [thread.id]: {
          ...current,
          consecutiveErrors: nextErrors,
        },
      };
    });

    await persistThreadState(thread.id, { consecutive_errors: nextErrors });

    const rpdLimit = thread.rpdLimit ?? 100;
    if (usageCount >= rpdLimit) {
      await rotateThreadKey(thread, message, true);
      return;
    }

    // Non-RPD rotations are handled at the AI-call site (rotate on AI errors).
  }, [persistThreadState, rotateThreadKey, runtimeState]);

  const getErrorStatusCode = (error: unknown) => {
    const raw = String((error as any)?.message || error || "");
    const match = raw.match(/\b(4\d\d|5\d\d)\b/);
    return match ? Number(match[1]) : null;
  };

  const isTransientProcessingError = (error: unknown) => {
    const message = String((error as any)?.message || error || "").toLowerCase();
    const statusCode = getErrorStatusCode(error);
    return (
      message.includes("timeout") ||
      message.includes("timed out") ||
      statusCode === 429 ||
      (statusCode !== null && statusCode >= 500 && statusCode <= 599)
    );
  };

  const isPermanentProcessingError = (error: unknown) => {
    const message = String((error as any)?.message || error || "").toLowerCase();
    const statusCode = getErrorStatusCode(error);
    return (
      statusCode === 400 ||
      statusCode === 404 ||
      statusCode === 415 ||
      message.includes("400") ||
      message.includes("404") ||
      message.includes("415") ||
      message.includes("file not found") ||
      message.includes("unsupported media")
    );
  };

  const finalizePdfImport = useCallback(async (
    queueId: string,
    extractedRows: unknown,
    label: string,
    thread: ThreadCfg,
    state: RuntimeThreadState
  ): Promise<string[]> => {
    const payload = buildImportPayloadFromExtractionRows(
      Array.isArray(extractedRows) ? extractedRows as any[] : extractedRows ? [extractedRows] : []
    );
    if (payload.length === 0) {
      throw new Error(`No importable complaint rows returned for ${label}`);
    }

    const caseNumbers = payload.map((r) => r.case_number).filter(Boolean);

    await importCasesPayload(payload);
    const supabase = getSupabase();
    const { error } = await supabase
      .from("pdf_queue")
      .delete()
      .eq("id", queueId);
    if (error) {
      throw new Error(`Queue delete failed: ${error.message}`);
    }
    log(`${threadPrefix(thread, state)} [Import] ${label} imported to master and removed from queue.`);
    return caseNumbers;
  }, [log]);

  const processOnePdf = useCallback(async (thread: ThreadCfg, row: QueueItem) => {
    const state = runtimeState[thread.id];
    if (!state) return;
    const providerCapabilities = getAiProviderCapabilities(thread.provider);
    const label = fileLabel(row);

    try {
      setInFlight((value) => value + 1);
      const resolvedUrl = await resolveDownloadUrl(row);
      log(`${threadPrefix(thread, state)} [Local] Using PDF URL directly: ${label}...`);

      if (state.dailyUsageCount >= (thread.rpdLimit ?? 100)) {
      await rotateThreadKey(thread, "Daily usage limit reached.", true);
      }

      await reserveProviderSlot(thread, state);
      await markAiAttempt(thread);
      log(`${threadPrefix(thread, state)} [AI] Calling ${providerCapabilities.providerLabel} ${thread.model}...`);
      let aiResult: any;
      try {
        aiResult = await dispatchAiExtraction(
          { provider: thread.provider, model: thread.model, apiKey: state.apiKey, prompt: thread.prompt },
          {
            sourceUrl: resolvedUrl,
            publicViewerUrl: row.public_viewer_url || null,
            fileName: label,
            timeoutMs: 120000,
          }
        );
      } catch (aiErr: any) {
        const msg = aiErr?.message || String(aiErr);
        // Rotate key on any AI-provider error (no cooldown unless RPD exceeded).
        await rotateThreadKey(thread, `AI error: ${msg}`, false);
        throw aiErr;
      }

      log(`${threadPrefix(thread, state)} [AI Response] ${label}: ${aiResult.text}`);
      log(`${threadPrefix(thread, state)} [Success] Data received. Importing to master.`);
      const caseNumbers = await finalizePdfImport(row.id, aiResult.json, label, thread, state);
      await enqueueCasesForTableAnalysis(caseNumbers, thread.id);

      await markSuccess(thread);
      incrementProcessedCount(thread.id);
      log(`${threadPrefix(thread, state)} [Success] ${label} completed via ${aiResult.usedTransport}.`);
    } catch (error: any) {
      const message = error?.message || String(error);
      if (isTransientProcessingError(error)) {
        const retryMessage = `Transient Error: Retrying... ${message}`;
        await revertPdfToPending(row.id, retryMessage);
        log(`${threadPrefix(thread, state)} ⚠️ Transient error detected for ${label}: ${message}. Reverting to PENDING for retry.`);
      } else if (isPermanentProcessingError(error)) {
        await syncPendingError(row.id, `Permanent Error: Import/extraction blocked. ${message}`);
        log(`${threadPrefix(thread, state)} ❌ Permanent error on ${label}: ${message}. Keeping it in PENDING for retry/fix.`);
      } else {
        const retryMessage = `Transient Error: Retrying... ${message}`;
        await revertPdfToPending(row.id, retryMessage);
        log(`${threadPrefix(thread, state)} ⚠️ Retryable processing error for ${label}: ${message}. Reverting to PENDING for retry.`);
      }
      await handleThreadError(thread, error);
      log(`${threadPrefix(thread, state)} [Error] ${label}: ${message}`);
    } finally {
      setInFlight((value) => Math.max(0, value - 1));
    }
  }, [enqueueCasesForTableAnalysis, finalizePdfImport, handleThreadError, incrementProcessedCount, markAiAttempt, markSuccess, reserveProviderSlot, resolveDownloadUrl, revertPdfToPending, rotateThreadKey, runtimeState, syncPendingError]);

  const processBatchWithGemini = useCallback(async (thread: ThreadCfg, rows: QueueItem[]) => {
    const state = runtimeState[thread.id];
    if (!state || rows.length === 0) return;
    const docs: Array<{ row: QueueItem; fileName: string; publicViewerUrl?: string | null; sourceUrl?: string }> = [];
    const successfullyFinalizedQueueIds = new Set<string>();

    try {
      setInFlight((value) => value + rows.length);
      for (const row of rows) {
        const label = fileLabel(row);
        const resolvedUrl = await resolveDownloadUrl(row);
        log(`${threadPrefix(thread, state)} [Local] Queuing PDF URL directly: ${label}...`);
        docs.push({
          row,
          fileName: label,
          publicViewerUrl: row.public_viewer_url || null,
          sourceUrl: resolvedUrl,
        });
      }

      await reserveProviderSlot(thread, state);
      await markAiAttempt(thread);
      log(`${threadPrefix(thread, state)} [AI] Calling Google Gemini ${thread.model} with ${docs.length} PDFs in one batch...`);
      let result: any;
      try {
        result = await dispatchAiBatchExtraction(
          { provider: thread.provider, model: thread.model, apiKey: state.apiKey, prompt: thread.prompt },
          docs.map((doc) => ({
            fileName: doc.fileName,
            publicViewerUrl: doc.publicViewerUrl,
            sourceUrl: doc.sourceUrl,
          })),
          180000
        );
      } catch (aiErr: any) {
        const msg = aiErr?.message || String(aiErr);
        await rotateThreadKey(thread, `AI batch error: ${msg}`, false);
        throw aiErr;
      }

      log(`${threadPrefix(thread, state)} [AI Response] Batch raw response: ${result.text}`);
      const batchOutput = Array.isArray(result.json) ? result.json : [];
      const usesWrappedBatchShape = batchOutput.some((item: any) => item && typeof item === "object" && ("file_name" in item || "extracted_data" in item));
      const batchCaseNumbers: string[] = [];
      for (let index = 0; index < docs.length; index += 1) {
        const doc = docs[index];
        const match = usesWrappedBatchShape
          ? batchOutput.find((item: any) => item?.file_name === doc.fileName)
          : batchOutput[index];
        const extracted = usesWrappedBatchShape
          ? Array.isArray(match?.extracted_data)
            ? match.extracted_data
            : match?.extracted_data
              ? [match.extracted_data]
              : []
          : Array.isArray(match)
            ? match
            : match
              ? [match]
              : [];
        const caseNumbers = await finalizePdfImport(doc.row.id, extracted, doc.fileName, thread, state);
        successfullyFinalizedQueueIds.add(doc.row.id);
        batchCaseNumbers.push(...caseNumbers);
        incrementProcessedCount(thread.id);
        log(`${threadPrefix(thread, state)} [Success] ${doc.fileName} completed via direct_url batch.`);
      }

      await markSuccess(thread);
      // Enqueue only after the whole AI batch is processed (prevents listing "one-by-one" while the batch is still running).
      await enqueueCasesForTableAnalysis(batchCaseNumbers, thread.id);
    } catch (error: any) {
      const message = error?.message || String(error);
      log(`${threadPrefix(thread, state)} [BatchError] Batch request failed for ${docs.length} PDF(s): ${message}`);

      // Unclaim anything that wasn't successfully finalized so other workers can take it up.
      const queueIdsToUnclaim = docs
        .map((d) => d.row.id)
        .filter((id) => !successfullyFinalizedQueueIds.has(id));
      await releaseClaimedRows(queueIdsToUnclaim, `Batch failed: ${message}`);

      for (const doc of docs) {
        if (successfullyFinalizedQueueIds.has(doc.row.id)) continue;
        if (isTransientProcessingError(error)) {
          await revertPdfToPending(doc.row.id, `Transient Error: Retrying... ${message}`);
          log(`${threadPrefix(thread, state)} ⚠️ Batch failure affected ${doc.fileName}: ${message}. Reverting to PENDING for retry.`);
        } else {
          await syncPendingError(doc.row.id, `Permanent Error: Import/extraction blocked. ${message}`);
          log(`${threadPrefix(thread, state)} ❌ Batch failure affected ${doc.fileName}: ${message}. Keeping it in PENDING for retry/fix.`);
        }
      }
      await handleThreadError(thread, error);
      await persistWorkerRuntime(thread.id, {
        worker_state: "error",
        worker_last_seen_at: new Date().toISOString(),
        worker_error: error?.message || String(error),
      });
    } finally {
      setInFlight((value) => Math.max(0, value - rows.length));
    }
  }, [enqueueCasesForTableAnalysis, finalizePdfImport, handleThreadError, incrementProcessedCount, log, markAiAttempt, markSuccess, persistWorkerRuntime, releaseClaimedRows, reserveProviderSlot, resolveDownloadUrl, revertPdfToPending, rotateThreadKey, runtimeState, syncPendingError]);

  const runThreadCycle = useCallback(async (thread: ThreadCfg) => {
    const state = runtimeState[thread.id];
    if (!state) return;
    try {
      const supabase = getSupabase();
      while (runRef.current) {
        const current = runtimeState[thread.id] || state;
        if (!current.assignedKeyId || !current.apiKey) {
          await rotateThreadKey(thread, "Thread missing an assigned key.", false);
          await sleep(1000);
          continue;
        }

        const batchSize = Math.max(1, thread.batchSize);
        const { data: claimed, error: claimError } = await supabase.rpc("claim_pdf_batch", {
          p_thread_id: thread.id,
          p_batch_size: batchSize,
        });

        if (claimError) {
          log(`${threadPrefix(thread, current)} Claim failed: ${claimError.message}`);
          await handleThreadError(thread, claimError);
          await sleep(3000);
          continue;
        }

        const queueIds = (claimed as Array<{ queue_id: string }> | null)?.map((item) => item.queue_id) ?? [];
        if (queueIds.length === 0) {
          log(`${threadPrefix(thread, current)} Queue empty. Sleeping for 15s...`);
          await sleep(15000);
          continue;
        }

        const { data: rows, error: rowError } = await supabase
          .from("pdf_queue")
          .select("*")
          .in("id", queueIds);
        if (rowError) {
          await releaseClaimedRows(queueIds, `Row load failed: ${rowError.message}`);
          await handleThreadError(thread, rowError);
          await sleep(3000);
          continue;
        }

        const work = [...((rows as QueueItem[]) || [])];
        updateRuntime(thread.id, (prev) => ({
          ...prev,
          isWorking: true,
          claimedCount: prev.claimedCount + work.length,
          currentBatchClaimed: work.length,
        }));
        await persistWorkerRuntime(thread.id, {
          worker_state: "running",
          worker_last_seen_at: new Date().toISOString(),
          worker_claimed_count: (runtimeState[thread.id]?.claimedCount ?? current.claimedCount) + work.length,
          worker_current_batch_count: work.length,
          worker_popup_id: popupMode ? window.name || `popup-${thread.id}` : null,
          worker_error: null,
        });
        log(`${threadPrefix(thread, current)} [Queue] Claimed ${work.length} PDF(s). Batch size ${batchSize}.`);
        if (thread.provider.toLowerCase().includes("google") && work.length > 1) {
          await processBatchWithGemini(thread, work);
        } else {
          for (const row of work) {
            if (!runRef.current) break;
            await processOnePdf(thread, row);
          }
        }
        updateRuntime(thread.id, (prev) => ({ ...prev, currentBatchClaimed: 0 }));
        await persistWorkerRuntime(thread.id, {
          worker_last_seen_at: new Date().toISOString(),
          worker_current_batch_count: 0,
          worker_state: "idle",
        });
        await sleep(300);
      }
    } finally {
      void persistWorkerRuntime(thread.id, {
        worker_state: "stopped",
        worker_last_seen_at: new Date().toISOString(),
        worker_current_batch_count: 0,
      });
      void releaseThreadKeyLeases([thread.id], null);
      updateRuntime(thread.id, (prev) => ({ ...prev, isWorking: false, currentBatchClaimed: 0 }));
    }
  }, [handleThreadError, log, persistWorkerRuntime, popupMode, processBatchWithGemini, processOnePdf, releaseClaimedRows, releaseThreadKeyLeases, rotateThreadKey, runtimeState, updateRuntime]);

  const startAllWorkers = useCallback(async () => {
    if (activeThreads.length === 0) return;
    runRef.current = true;
    setIsRunning(true);
    const selected = activeThreads.slice(0, Math.max(1, engineConcurrency));
    if (!popupMode) {
      // Manual mode: user opens each worker window via buttons (avoids popup blockers).
      log(`[Control] Manual worker mode enabled. Use the Open Worker Window buttons below.`);
      return;
    }
    log(`[Control] Starting ${selected.length} popup worker(s).`);
    const results = await Promise.allSettled(selected.map((thread) => runThreadCycle(thread)));
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        log(`[${selected[index].name}] Worker stopped unexpectedly: ${String(result.reason)}`);
      }
    });
    setIsRunning(false);
  }, [activeThreads, engineConcurrency, log, persistWorkerRuntime, popupMode, runThreadCycle]);

  const runPreflightCheck = useCallback(async () => {
    if (activeThreads.length === 0 || isTesting) return;

    setIsTesting(true);
    try {
      const thread = activeThreads[0];
      const state = runtimeState[thread.id];
      if (!state?.apiKey) throw new Error("No assigned API key is available for the selected thread.");
      const supabase = getSupabase();
      const { data: rows, error } = await supabase
        .from("pdf_queue")
        .select("*")
        .in("status", ["PENDING", "PROCESSING", "COMPLETED"])
        .order("created_at", { ascending: true })
        .limit(1);

      if (error) throw error;
      const row = (rows as QueueItem[] | null)?.[0];
      if (!row) {
        throw new Error("No PDFs available in the queue for a connection test.");
      }

      const label = fileLabel(row);
      log(`${threadPrefix(thread, state)} [Preflight] Testing direct PDF URL + AI call with ${label}...`);

      const resolvedUrl = await resolveDownloadUrl(row);

      // Ensure preflight also respects the same per-worker AI request rate cap.
      await reserveProviderSlot(thread, state);

      await dispatchAiExtraction(
        {
          provider: thread.provider,
          model: thread.model,
          apiKey: state.apiKey,
          prompt: thread.prompt,
        },
        {
          sourceUrl: resolvedUrl,
          publicViewerUrl: row.public_viewer_url || null,
          fileName: label,
          timeoutMs: 60000,
        }
      );

      log(`${threadPrefix(thread, state)} [Preflight] Success. AI provider accepted the direct PDF URL.`);
    } catch (error: any) {
      log(`[Preflight] Failed: ${error?.message || error}`);
    } finally {
      setIsTesting(false);
    }
  }, [activeThreads, isTesting, log, resolveDownloadUrl, runtimeState]);

  useEffect(() => {
    const nextState = Object.fromEntries(
      activeThreads.map((thread) => [
        thread.id,
        runtimeState[thread.id] || {
          currentBatchSize: thread.currentBatchSize || thread.batchSize,
          consecutiveErrors: thread.consecutiveErrors || 0,
          assignedKeyId: thread.assignedKeyId,
          apiKey: thread.apiKey,
          assignedKeyPreview: thread.assignedKeyPreview,
          dailyUsageCount: 0,
          rpmWindow: [],
          isWorking: false,
          claimedCount: 0,
          processedCount: 0,
          currentBatchClaimed: 0,
        },
      ])
    );
    setRuntimeState(nextState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads]);

  useEffect(() => {
    // Popup windows auto-start their own single bound worker.
    if (!popupMode || activeThreads.length === 0 || runRef.current) return;
    void startAllWorkers();
  }, [activeThreads, popupMode, startAllWorkers]);

  useEffect(() => {
    const handleUnload = () => {
      if (!runRef.current || activeThreads.length === 0) return;
      void releaseThreadClaims(
        activeThreads.map((thread) => thread.id),
        "Session shutdown: reverted claimed PDFs to pending"
      );
      void releaseThreadKeyLeases(activeThreads.map((thread) => thread.id), null);
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      if (runRef.current && activeThreads.length > 0) {
        void releaseThreadClaims(
          activeThreads.map((thread) => thread.id),
          "Session shutdown: reverted claimed PDFs to pending"
        );
        void releaseThreadKeyLeases(activeThreads.map((thread) => thread.id), null);
      }
      runRef.current = false;
    };
  }, [activeThreads, releaseThreadClaims, releaseThreadKeyLeases]);

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-slate-900 font-semibold">{popupMode ? "Popup Worker Processor" : "Popup Worker Launcher"}</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runPreflightCheck}
            disabled={activeThreads.length === 0 || isTesting || (!popupMode && isRunning)}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-800 font-semibold disabled:opacity-50"
          >
            {isTesting ? "Testing..." : "Test Connection"}
          </button>
          <button
            onClick={() => {
              if (isRunning) {
                runRef.current = false;
                setIsRunning(false);
                if (!popupMode) {
                  Object.values(popupRefs.current).forEach((popup) => popup?.close());
                }
                log(popupMode ? "[Control] Worker paused." : "[Control] Popup workers paused by admin.");
                return;
              }
              void startAllWorkers();
            }}
            className={`px-4 py-2 rounded-lg text-white font-semibold ${isRunning ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
            disabled={activeThreads.length === 0}
          >
            {isRunning ? (popupMode ? "Pause Worker" : "Close Worker Windows") : (popupMode ? "Start Worker" : "Enable Manual Worker Launch")}
          </button>
        </div>
      </div>
      <div className="text-sm text-slate-600">
        {activeThreads.length > 0
          ? popupMode
            ? `Popup bound to ${activeThreads[0]?.name || "worker"} and ready for isolated execution.`
            : `${activeThreads.length} active thread(s) ready for popup execution.`
          : "Select/configure at least one active thread first."}
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        {/* @note Ensure that the Supabase Storage bucket CORS policy allows the current Admin domain, and ensure the AI Provider's domain is added to the site's Content Security Policy (CSP). */}
        <div className="font-semibold">{popupMode ? "Popup worker requirements" : "Popup launcher requirements"}</div>
        <div>{popupMode ? "Keep this window open while it is processing. Closing the window releases claimed PDFs back to pending." : "Open each worker window using the buttons below (one click per worker avoids popup blocking)."} </div>
      </div>

      {!popupMode && (
        <div className="rounded-xl border bg-white p-3">
          <div className="text-sm font-semibold text-slate-900 mb-2">Worker Windows</div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {activeThreads.slice(0, Math.max(1, engineConcurrency)).map((thread) => {
              const popupName = `pdf-worker-${thread.id}`;
              const url = `/dashboard/admin?mode=popup-worker&threadId=${encodeURIComponent(thread.id)}`;
              return (
                <div key={thread.id} className="rounded-lg border bg-slate-50 p-3">
                  <div className="font-semibold text-slate-900">{thread.name}</div>
                  <div className="mt-1 text-xs text-slate-600">{thread.provider} • {thread.model} • Batch {thread.batchSize}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const win = window.open(url, popupName);
                        popupRefs.current[thread.id] = win;
                        if (win) {
                          win.focus();
                          void persistWorkerRuntime(thread.id, {
                            worker_state: "launching",
                            worker_last_seen_at: new Date().toISOString(),
                            worker_popup_id: popupName,
                            worker_error: null,
                          });
                          log(`[Control] Opened worker window for ${thread.name}.`);
                        } else {
                          log(`[Control] Popup blocked for ${thread.name}. Allow popups and retry.`);
                        }
                      }}
                      className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Open Worker Window
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        popupRefs.current[thread.id]?.close();
                        popupRefs.current[thread.id] = null;
                        void persistWorkerRuntime(thread.id, {
                          worker_state: "stopped",
                          worker_last_seen_at: new Date().toISOString(),
                          worker_popup_id: null,
                        });
                        log(`[Control] Closed worker window for ${thread.name}.`);
                      }}
                      className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-slate-500">Workers to Run</div>
          <input
            type="number"
            min={1}
            max={Math.max(1, activeThreads.length || 1)}
            value={engineConcurrency}
            onChange={(e) => setEngineConcurrency(Math.max(1, Number(e.target.value || 1)))}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            disabled={isRunning || popupMode}
          />
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-slate-500">Active Threads</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{popupMode ? 1 : activeThreads.length}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-slate-500">Total Assigned Keys</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{activeThreads.filter((thread) => thread.assignedKeyId).length}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-slate-500">In Flight</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{inFlight}</div>
        </div>
      </div>
      <div className="rounded-xl border bg-slate-50 p-3">
        <div className="text-sm font-semibold text-slate-900 mb-2">Thread Runtime Status</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activeThreads.map((thread) => {
            const state = runtimeState[thread.id];
            return (
              <div key={thread.id} className="rounded-lg border bg-white p-3">
                <div className="font-semibold text-slate-900">{thread.name}</div>
                <div className="text-xs text-slate-600 mt-1">
                  Key {state?.assignedKeyPreview || thread.assignedKeyPreview || "Unassigned"} • Batch {state?.currentBatchSize || thread.currentBatchSize} • Errors {state?.consecutiveErrors || 0}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Usage {state?.dailyUsageCount || 0}/{thread.rpdLimit} • {thread.provider} • {thread.model}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded border bg-slate-50 px-2 py-1">
                    <div className="text-slate-500">Claimed</div>
                    <div className="font-semibold text-slate-900">{state?.claimedCount || 0}</div>
                  </div>
                  <div className="rounded border bg-slate-50 px-2 py-1">
                    <div className="text-slate-500">Processed</div>
                    <div className="font-semibold text-slate-900">{state?.processedCount || 0}</div>
                  </div>
                  <div className="rounded border bg-slate-50 px-2 py-1">
                    <div className="text-slate-500">Live Batch</div>
                    <div className="font-semibold text-slate-900">{state?.currentBatchClaimed || 0}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-slate-900 text-green-400 font-mono text-xs p-4 rounded-lg h-64 overflow-y-auto">
        {logs.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}

function maskKey(value: string) {
  if (!value) return "—";
  if (value.length <= 8) return `${value.slice(0, 2)}****${value.slice(-2)}`;
  return `${value.slice(0, 4)}••••••${value.slice(-4)}`;
}

