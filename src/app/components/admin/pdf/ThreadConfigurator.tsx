import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Settings, KeyRound, Plus, Trash2 } from "lucide-react";
import { FREE_AI_PROVIDERS } from "../../../../lib/ai-free-tiers";
import getSupabase from "../../../../utils/supabase/client";

export type ProcessingThread = {
  id: string;
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  batchSize: number;
  initialBatchSize: number;
  currentBatchSize: number;
  prompt: string;
  active: boolean;
  consecutiveErrors: number;
  assignedKeyId: string | null;
  assignedKeyPreview: string | null;
  keyStatus: string | null;
  rpmLimit: number;
  rpdLimit: number;
};

type AiKeyRow = {
  id: string;
  provider: string;
  key_value: string;
  status: string;
  cooldown_until: string | null;
  daily_usage_count: number;
};

interface Props {
  threads: ProcessingThread[];
  onChange: (threads: ProcessingThread[]) => void;
}

export default function ThreadConfigurator({ threads, onChange }: Props) {
  type ProviderKey = keyof typeof FREE_AI_PROVIDERS;
  const providerKeys = Object.keys(FREE_AI_PROVIDERS) as ProviderKey[];
  const [keys, setKeys] = useState<AiKeyRow[]>([]);
  const [keyProvider, setKeyProvider] = useState<ProviderKey>(providerKeys[0]);
  const [bulkKeysText, setBulkKeysText] = useState("");
  const [spawnProvider, setSpawnProvider] = useState<ProviderKey>(providerKeys[0]);
  const [model, setModel] = useState<string>(FREE_AI_PROVIDERS[providerKeys[0]].models[0].id);
  const [threadPrefix, setThreadPrefix] = useState("Browser-Worker");
  const [threadsToSpawn, setThreadsToSpawn] = useState<number>(1);
  const [initialBatchSize, setInitialBatchSize] = useState<number>(FREE_AI_PROVIDERS[providerKeys[0]].models[0].recBatch);
  const [rpdLimit, setRpdLimit] = useState<number>(FREE_AI_PROVIDERS[providerKeys[0]].models[0].maxRpd);
  const [busy, setBusy] = useState(false);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [spawnErrorMessage, setSpawnErrorMessage] = useState<string | null>(null);
  const aiKeyLeaseRpcAvailableRef = useRef<boolean | null>(null);
  const activeModel = useMemo(() => {
    const all = FREE_AI_PROVIDERS[spawnProvider].models;
    return all.find((m) => m.id === model) || all[0];
  }, [spawnProvider, model]);
  const [prompt, setPrompt] = useState<string>(`You are a highly accurate legal data extraction AI specializing in Bombay High Court judgments.
Your task is to extract case information into a structured JSON format. You are instructed to take as much time and internal processing as necessary to ensure flawless accuracy. Do not rush.

### CASE TYPE CLASSIFICATION LOGIC (Strict):
Do NOT use the word "Complaint" for case type. Categorize every case into ONE of these specific categories based on the header and body text:
1. **CRIMINAL:** If the header says "CRIMINAL APPELLATE JURISDICTION" or mentions "IPC", "CrPC", "Bail", "Conviction", or "Quashing".
2. **CIVIL:** If the header says "CIVIL APPELLATE JURISDICTION" and it is not property or matrimonial (e.g., money suits, contracts).
3. **PROPERTY:** If the subject involves "Partition", "Possession", "Rent Act", "Eviction", "Land Acquisition", "Mutation", or "S.C.S. (Special Civil Suit)".
4. **MATRIMONIAL:** If the subject involves "Divorce", "Maintenance", "Custody", or "Family Court Appeal (FCA)".
5. **SERVICE:** If the subject involves "Promotion", "Suspension", "Pension", "Termination", or "Writ Petition (Service)".
6. **TAX/COMMERCIAL:** If it involves "Income Tax", "GST", "Arbitration", or "Commercial Suit".

### CRITICAL: BATCH JUDGMENT RULE (Multiple Petitions)
Bombay High Court documents often "club" multiple matters.
1. **IDENTIFY ALL:** Look at the first 2 pages for all Petition/Appeal numbers (e.g., "WP/101/2025 WITH WP/102/2025 AND WP/103/2025").
2. **ITERATE:** You MUST output a separate JSON object for EVERY distinct Petition/Appeal number found.
3. **JUDGES (Up to 9):** Look at the "CORAM" section. Extract all judge names into an array. Include up to 9 judges.
4. **LAWYERS (Up to 5 per side):** Look at the "APPEARANCES" section.
   - Extract up to 5 distinct lawyer names for the Petitioner/Appellant (map to \`petitioner_lawyers\`).
   - Extract up to 5 distinct lawyer names for the Respondent (map to \`respondent_lawyers\`).
   - Do not include "a/w" or "i/b" prefixes; extract only the names.
5. **DATA CONSISTENCY:** Most fields (Judges, Lawyers, Outcome) will be identical for clubbed matters, but the \`complaint_number\` and \`complainant\` (Petitioner) must be specific to each individual case in the list.

### 10X MISSING DATA VERIFICATION PROTOCOL (Strict):
If any piece of data (especially Lawyers or Case Numbers) appears to be missing, you MUST halt and re-read the document specifically looking for that exact data point. You must repeat this targeted re-scan process TEN TIMES (10x). Only if the data cannot be found after ten deliberate, thorough sweeps are you allowed to mark it as null. Process one Judgement at a time. If the output does not have complaint number, retry until it is found.

### RULES FOR "APPEAL_FROM_ORDER":
- CRITICAL: Do NOT put the current case's Neutral Citation or Petition Number in this field.
- IDENTIFY: This field only applies if the current judgment is an Appeal (e.g., First Appeal, Second Appeal, Appeal from Order).
- LOOK FOR: Phrases like "directed against the order dated...", "impugned judgment passed by...", or "challenged the order in Case No...".
- DATA: Extract the case number of the LOWER court/authority being challenged.
- NULL RULE: If the current case is a fresh Writ Petition (WP) or Original Jurisdiction matter not challenging a specific prior case number, set this field to null.

### RULES:
1. FORMAT: Output ONLY a valid, raw JSON array of objects. No conversational text.
2. MULTIPLE MATTERS: If a document contains multiple case numbers (e.g., clubbed Writ Petitions), output one JSON object per case number.
3. TERMINOLOGY MAPPING:
   - "complaint_number" = Extract the Petition/Appeal number and Year. Format as [Number][Year] (e.g., 109512025).
   - "complainant" = Use the Petitioner, Appellant, or Applicant name.
   - "respondent" = Use the Respondent or Opponent name.
   - "judges" = All names from the "CORAM" section, in order, up to 9 (array of strings).
   - "case_type" = Exactly one of: CRIMINAL, CIVIL, PROPERTY, MATRIMONIAL, SERVICE, TAX/COMMERCIAL (per CASE TYPE CLASSIFICATION above; never use the word "Complaint" as the case type value).
   - "petitioner_lawyers" / "respondent_lawyers" = Extract from the "APPEARANCES" section (usually starts with "Mr.", "Ms.", or "Adv.").

### JSON SCHEMA:
Every object MUST follow this structure. Use null for missing strings and [] for missing arrays.
[
  {
    "_missing_data_audit": "List the fields that were missing and confirm you executed the 10X check for them",
    "judgement_link": "INJECT_EXACT_METADATA_URL_HERE",
    "complaint_number": "string (Standardized: e.g. 109512025)",
    "appeal_from_order": "string (Lower-court/authority challenged case number OR null; see rules above)",
    "case_title": "string (Party A vs Party B)",
    "case_type": "string (CRIMINAL | CIVIL | PROPERTY | MATRIMONIAL | SERVICE | TAX/COMMERCIAL)",
    "court_type": "High Court",
    "court": "Bombay High Court",
    "judges": ["string (up to 9 judge names from CORAM)"],
    "petitioner_lawyers": ["string"],
    "respondent_lawyers": ["string"],
    "filing_date": "string",
    "judgement_date": "string (DD/MM/YYYY)",
    "status": "string",
    "outcome": "string",
    "complainant": "string",
    "respondent": "string",
    "total_hearings": "integer"
  }
]

### MAPPING LOGIC:
4. STATUS MAPPING (Strict): Use ONLY:
   - "Complaint disposed"
   - "Withdrawn"
   - "Settlement"
   - "complaint rejected"
5. OUTCOME MAPPING (Strict):
   - "Rule made absolute", "Petition allowed", "Appeal allowed" -> "In favor of Complainant"
   - "Rule discharged", "Dismissed", "Not maintainable", "Rejected" -> "In favor of Respondent"
   - "Withdrawn", "Consent terms", "Settled" -> "Settled"

### SEARCH LOCATIONS:
- CASE NUMBER: Top of page 1.
- LAWYERS: Page 1-2, usually under "APPEARANCES" or "Mr./Ms. [Name] for [Party]".
- JUDGES: Page 1-2, usually under "Coram".
- JUDGMENT DATE: Usually at the very end of the document after the signature or at the top under "DATED".
- OUTCOME: The very last 2-3 paragraphs under the header "ORDER".
`);

  const loadThreads = useCallback(async () => {
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
        assigned_key:ai_keys!assigned_key_id (
          id,
          key_value,
          status
        )
      `)
      .order("created_at", { ascending: false });
    if (!error && data) {
      const rows: ProcessingThread[] = data.map((d: any) => {
        const providerMeta = FREE_AI_PROVIDERS[d.provider as ProviderKey];
        const modelMeta = providerMeta?.models.find((m) => m.id === d.model);
        const keyValue = d.assigned_key?.key_value || d.api_key_secret || "";
        return {
          id: d.id,
          name: d.name,
          provider: d.provider,
          model: d.model,
          apiKey: keyValue,
          batchSize: d.current_batch_size ?? d.batch_size,
          initialBatchSize: d.batch_size,
          currentBatchSize: d.current_batch_size ?? d.batch_size,
          prompt: d.system_prompt,
          active: d.is_active,
          consecutiveErrors: d.consecutive_errors ?? 0,
          assignedKeyId: d.assigned_key_id ?? d.assigned_key?.id ?? null,
          assignedKeyPreview: keyValue ? maskKey(keyValue) : null,
          keyStatus: d.assigned_key?.status ?? null,
          rpmLimit: modelMeta?.maxRpm ?? 5,
          rpdLimit: d.rpd_limit ?? modelMeta?.maxRpd ?? 100,
        };
      });
      onChange(rows);
    }
  }, [onChange]);

  const loadKeys = useCallback(async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("ai_keys")
      .select("id,provider,key_value,status,cooldown_until,daily_usage_count")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setKeys(data as AiKeyRow[]);
    }
  }, []);

  const canUploadKeys = useMemo(() => bulkKeysText.trim().length > 0, [bulkKeysText]);
  const canSpawnThreads = useMemo(
    () => threadPrefix.trim().length > 0 && threadsToSpawn > 0 && initialBatchSize > 0,
    [initialBatchSize, threadPrefix, threadsToSpawn]
  );

  const isMissingRpcError = (error: any) => {
    const code = String(error?.code ?? "").toUpperCase();
    const message = String(error?.message ?? "").toLowerCase();
    return code === "PGRST202" || (message.includes("could not find the function") && message.includes("claim_ai_key_for_thread"));
  };

  const toErrorMessage = (error: any, fallback: string) => {
    if (!error) return fallback;
    if (typeof error === "string") return error;
    const message = error.message || error.details || error.hint;
    return message ? String(message) : fallback;
  };

  const claimThreadKeyLeaseFallback = async (threadId: string, provider: string, excludeKeyId: string | null = null) => {
    const supabase = getSupabase();

    const { data: availableKeys, error: keysError } = await supabase
      .from("ai_keys")
      .select("id,provider,key_value,status,cooldown_until,daily_usage_count")
      .eq("provider", provider)
      .eq("status", "ACTIVE")
      .order("daily_usage_count", { ascending: true })
      .order("created_at", { ascending: true });
    if (keysError) throw keysError;

    const { data: inUseThreads, error: threadsError } = await supabase
      .from("ai_threads")
      .select("assigned_key_id")
      .not("assigned_key_id", "is", null);
    if (threadsError) throw threadsError;

    const excludedIds = new Set<string>();
    for (const row of inUseThreads ?? []) {
      const assignedId = String((row as any)?.assigned_key_id ?? "").trim();
      if (assignedId) excludedIds.add(assignedId);
    }
    if (excludeKeyId) excludedIds.add(excludeKeyId);

    const now = Date.now();
    const candidate = (availableKeys ?? []).find((key) => {
      const keyId = String((key as any).id ?? "");
      if (!keyId || excludedIds.has(keyId)) return false;
      const cooldownUntil = (key as any).cooldown_until;
      if (!cooldownUntil) return true;
      const cooldownTime = new Date(cooldownUntil).getTime();
      return Number.isNaN(cooldownTime) || cooldownTime <= now;
    }) as AiKeyRow | undefined;

    if (!candidate) return null;

    await supabase.from("ai_threads").update({ assigned_key_id: candidate.id }).eq("id", threadId);
    return candidate;
  };

  const claimThreadKeyLease = async (threadId: string, provider: string, excludeKeyId: string | null = null) => {
    const supabase = getSupabase();

    if (aiKeyLeaseRpcAvailableRef.current === false) {
      return claimThreadKeyLeaseFallback(threadId, provider, excludeKeyId);
    }

    const { data, error } = await supabase.rpc("claim_ai_key_for_thread", {
      p_provider: provider,
      p_thread_id: threadId,
      p_exclude_key_id: excludeKeyId,
    });
    if (error) {
      if (isMissingRpcError(error)) {
        aiKeyLeaseRpcAvailableRef.current = false;
        return claimThreadKeyLeaseFallback(threadId, provider, excludeKeyId);
      }
      throw error;
    }
    aiKeyLeaseRpcAvailableRef.current = true;
    return (data ?? null) as AiKeyRow | null;
  };

  const releaseThreadKeyLease = async (threadId: string) => {
    const supabase = getSupabase();

    if (aiKeyLeaseRpcAvailableRef.current === false) {
      const { data: threadRow } = await supabase
        .from("ai_threads")
        .select("assigned_key_id")
        .eq("id", threadId)
        .maybeSingle();

      const assignedKeyId = String((threadRow as any)?.assigned_key_id ?? "").trim();
      if (assignedKeyId) {
        await supabase
          .from("ai_keys")
          .update({ status: "ACTIVE", cooldown_until: null })
          .eq("id", assignedKeyId);
      }
      await supabase
        .from("ai_threads")
        .update({ assigned_key_id: null })
        .eq("id", threadId);
      return;
    }

    const { error } = await supabase.rpc("release_ai_key_for_thread", {
      p_thread_id: threadId,
      p_cooldown_until: null,
    });
    if (error) {
      if (!isMissingRpcError(error)) {
        throw error;
      }

      aiKeyLeaseRpcAvailableRef.current = false;

      const { data: threadRow } = await supabase
        .from("ai_threads")
        .select("assigned_key_id")
        .eq("id", threadId)
        .maybeSingle();

      const assignedKeyId = String((threadRow as any)?.assigned_key_id ?? "").trim();
      if (assignedKeyId) {
        await supabase
          .from("ai_keys")
          .update({ status: "ACTIVE", cooldown_until: null })
          .eq("id", assignedKeyId);
      }
      await supabase
        .from("ai_threads")
        .update({ assigned_key_id: null })
        .eq("id", threadId);
      return;
    }
    aiKeyLeaseRpcAvailableRef.current = true;
  };

  const toggleActive = async (id: string) => {
    const target = threads.find((t) => t.id === id);
    if (!target) return;
    const supabase = getSupabase();
    try {
      if (target.active) {
        await releaseThreadKeyLease(id);
        const { error } = await supabase
          .from("ai_threads")
          .update({ is_active: false, assigned_key_id: null, api_key_secret: "" })
          .eq("id", id);
        if (error) throw error;
        onChange(threads.map((t) => (t.id === id ? { ...t, active: false, assignedKeyId: null, assignedKeyPreview: null, apiKey: "", keyStatus: null } : t)));
      } else {
        const claimedKey = await claimThreadKeyLease(id, target.provider, null);
        if (!claimedKey) {
          throw new Error(`No active ${FREE_AI_PROVIDERS[target.provider as ProviderKey]?.name || target.provider} key is available to activate this thread.`);
        }
        const { error } = await supabase
          .from("ai_threads")
          .update({
            is_active: true,
            assigned_key_id: claimedKey.id,
            api_key_secret: claimedKey.key_value,
          })
          .eq("id", id);
        if (error) {
          await releaseThreadKeyLease(id);
          throw error;
        }
        const keyPreview = maskKey(claimedKey.key_value);
        onChange(
          threads.map((t) =>
            t.id === id
              ? {
                  ...t,
                  active: true,
                  assignedKeyId: claimedKey.id,
                  assignedKeyPreview: keyPreview,
                  apiKey: claimedKey.key_value,
                  keyStatus: claimedKey.status,
                }
              : t
          )
        );
      }
    } catch {
      // soft-fail; this is an admin UI
    }
  };

  const deleteThread = async (id: string) => {
    const target = threads.find((t) => t.id === id);
    if (!target) return;
    const ok = window.confirm(`Delete thread "${target.name}"? This will remove it from the worker pool.`);
    if (!ok) return;

    try {
      setDeletingThreadId(id);
      setBusy(true);
      const supabase = getSupabase();
      const { error } = await supabase.from("ai_threads").delete().eq("id", id);
      if (error) throw error;
      onChange(threads.filter((t) => t.id !== id));
    } catch {
      // soft-fail; we don't throw since this is an admin UI
    } finally {
      setDeletingThreadId(null);
      setBusy(false);
    }
  };

  const uploadKeys = async () => {
    if (!canUploadKeys || busy) return;
    setBusy(true);
    try {
      const values = bulkKeysText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((key) => ({
          provider: keyProvider,
          key_value: key,
          status: "ACTIVE",
          cooldown_until: null,
          daily_usage_count: 0,
        }));
      if (values.length === 0) return;
      const supabase = getSupabase();
      const { error } = await supabase.from("ai_keys").insert(values);
      if (error) throw error;
      setBulkKeysText("");
      await loadKeys();
    } finally {
      setBusy(false);
    }
  };

  const spawnThreads = async () => {
    if (!canSpawnThreads || busy) return;
    setSpawnErrorMessage(null);
    setBusy(true);
    try {
      const supabase = getSupabase();
      const createdThreadIds: string[] = [];
      try {
        for (let index = 0; index < threadsToSpawn; index += 1) {
          const threadName = `${threadPrefix.trim()}-${index + 1}`;
          const { data: inserted, error: insertError } = await supabase
            .from("ai_threads")
            .insert([
              {
                name: threadName,
                provider: spawnProvider,
                model,
                api_key_secret: "",
                batch_size: initialBatchSize,
                current_batch_size: initialBatchSize,
                consecutive_errors: 0,
                assigned_key_id: null,
                rpd_limit: rpdLimit,
                system_prompt: prompt,
                is_active: false,
              },
            ])
            .select("id")
            .single();
          if (insertError) throw insertError;

          const threadId = String(inserted?.id ?? "").trim();
          if (!threadId) throw new Error("Thread creation failed: missing thread id.");
          createdThreadIds.push(threadId);

          const claimedKey = await claimThreadKeyLease(threadId, spawnProvider, null);
          if (!claimedKey) {
            throw new Error(
              `Need ${threadsToSpawn} unused active ${FREE_AI_PROVIDERS[spawnProvider].name} keys, but one could not be reserved.`
            );
          }

          const { error: updateError } = await supabase
            .from("ai_threads")
            .update({
              api_key_secret: claimedKey.key_value,
              assigned_key_id: claimedKey.id,
              is_active: true,
            })
            .eq("id", threadId);
          if (updateError) {
            await releaseThreadKeyLease(threadId);
            throw updateError;
          }
        }
      } catch (spawnError) {
        await Promise.all(
          createdThreadIds.map(async (threadId) => {
            try {
              await releaseThreadKeyLease(threadId);
            } catch {
              // ignore cleanup failures
            }
            await supabase.from("ai_threads").delete().eq("id", threadId);
          })
        );
        throw spawnError;
      }

      await Promise.all([loadThreads(), loadKeys()]);
    } catch (error: any) {
      setSpawnErrorMessage(toErrorMessage(error, "Thread creation failed. Please check key pool and Supabase schema."));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadThreads(), loadKeys()]);
  }, [loadKeys, loadThreads]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white">
        <div className="px-4 py-3 border-b bg-slate-50 text-slate-900 font-semibold flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> Key Pool Manager
        </div>
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">AI Provider</label>
              <select
                value={keyProvider}
                onChange={(e) => setKeyProvider(e.target.value as ProviderKey)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {providerKeys.map((k) => (
                  <option key={k} value={k}>{FREE_AI_PROVIDERS[k].name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bulk Key Uploader</label>
              <textarea
                value={bulkKeysText}
                onChange={(e) => setBulkKeysText(e.target.value)}
                rows={8}
                placeholder="Paste one API key per line"
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <button
              onClick={uploadKeys}
              disabled={!canUploadKeys || busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Upload Keys
            </button>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50 text-sm font-semibold text-slate-900">Key Table</div>
            <div className="max-h-[360px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Provider</th>
                    <th className="px-4 py-2 text-left">Key</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Usage</th>
                    <th className="px-4 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.length === 0 && (
                    <tr><td className="px-4 py-6 text-slate-500" colSpan={5}>No keys uploaded yet.</td></tr>
                  )}
                  {keys.map((key) => (
                    <tr key={key.id} className="border-t">
                      <td className="px-4 py-2">{FREE_AI_PROVIDERS[key.provider as ProviderKey]?.name || key.provider}</td>
                      <td className="px-4 py-2 font-mono">{maskKey(key.key_value)}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${key.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                          {key.status === "COOLDOWN" && key.cooldown_until ? `Cooldown until ${new Date(key.cooldown_until).toLocaleString()}` : key.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">{key.daily_usage_count}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (busy) return;
                            setBusy(true);
                            try {
                              const supabase = getSupabase();
                              await supabase.from("ai_threads").update({ assigned_key_id: null }).eq("assigned_key_id", key.id);
                              const { error } = await supabase.from("ai_keys").delete().eq("id", key.id);
                              if (error) throw error;
                              await Promise.all([loadKeys(), loadThreads()]);
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          disabled={busy}
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white">
        <div className="px-4 py-3 border-b bg-slate-50 text-slate-900 font-semibold flex items-center gap-2">
          <Settings className="w-4 h-4" /> Auto-Provision Threads
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {spawnErrorMessage && (
            <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {spawnErrorMessage}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">AI Provider</label>
            <select
              value={spawnProvider}
              onChange={(e) => {
                const nextProvider = e.target.value as ProviderKey;
                setSpawnProvider(nextProvider);
                const nextModel = FREE_AI_PROVIDERS[nextProvider].models[0];
                setModel(nextModel.id);
                setInitialBatchSize(nextModel.recBatch);
                setRpdLimit(nextModel.maxRpd);
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {providerKeys.map((k) => (
                <option key={k} value={k}>{FREE_AI_PROVIDERS[k].name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Thread Name Prefix</label>
            <input
              value={threadPrefix}
              onChange={(e) => setThreadPrefix(e.target.value)}
              placeholder="Browser-Worker"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Number of Threads to Spawn</label>
            <input
              type="number"
              min={1}
              value={threadsToSpawn}
              onChange={(e) => setThreadsToSpawn(Math.max(1, Number(e.target.value || 1)))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
            <select
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                const m = FREE_AI_PROVIDERS[spawnProvider].models.find(mm => mm.id === e.target.value);
                if (m) {
                  setInitialBatchSize(m.recBatch);
                  setRpdLimit(m.maxRpd);
                }
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {FREE_AI_PROVIDERS[spawnProvider].models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Initial Batch Size</label>
            <input
              value={initialBatchSize}
              onChange={(e) => setInitialBatchSize(Math.max(1, Number(e.target.value || 1)))}
              type="number"
              min={1}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">RPD Limit (per key)</label>
            <input
              value={rpdLimit}
              onChange={(e) => setRpdLimit(Math.max(1, Number(e.target.value || 1)))}
              type="number"
              min={1}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <div className="mt-1 text-xs">
              <div className="text-slate-700">
                Recommended: <span className="font-semibold">{activeModel?.recBatch}</span> • Context: <span className="font-semibold">{activeModel?.context}</span>
              </div>
              <div className="text-slate-600">
                Max RPM: <span className="font-semibold">{activeModel?.maxRpm}</span> • Max RPD: <span className="font-semibold">{activeModel?.maxRpd}</span>
              </div>
              {initialBatchSize > (activeModel?.recBatch ?? 1) && (
                <div className="text-rose-700">Batch size exceeds recommended for this model.</div>
              )}
            </div>
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">Extraction Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={20}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono min-h-[400px]"
            />
            <div className="text-xs text-slate-600 mt-1">
              Expected AI JSON schema should match the downstream ingestion shape exactly. Ensure no leading/trailing prose.
            </div>
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <button
              onClick={spawnThreads}
              disabled={!canSpawnThreads || busy}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
            >
              Create Threads
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50 text-slate-900 font-semibold">Active Threads</div>
        <div className="divide-y">
          {threads.length === 0 && <div className="px-4 py-6 text-sm text-slate-600">No threads configured yet.</div>}
          {threads.map((t) => (
            <div key={t.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900">{t.name}</div>
                <div className="text-sm text-slate-600">
                  Provider: {FREE_AI_PROVIDERS[t.provider as ProviderKey]?.name || t.provider} • Model: {(() => {
                    const prov = t.provider as ProviderKey;
                    const m = FREE_AI_PROVIDERS[prov]?.models.find(mm => mm.id === t.model);
                    return m?.name || t.model;
                  })()} • Batch: {t.currentBatchSize}
                </div>
                <div className="text-xs text-slate-500">
                  Key {t.assignedKeyPreview || "Unassigned"} • Errors {t.consecutiveErrors} • RPD {t.rpdLimit}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full border ${t.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                  {t.active ? "Active" : "Paused"}
                </span>
                <button
                  onClick={() => toggleActive(t.id)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border ${t.active ? "bg-white text-slate-900 hover:bg-slate-50" : "bg-slate-900 text-white"}`}
                >
                  {t.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {t.active ? "Pause" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteThread(t.id)}
                  disabled={busy || deletingThreadId === t.id}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border ${
                    deletingThreadId === t.id ? "bg-rose-50 text-rose-700 border-rose-200 opacity-70" : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function maskKey(value: string) {
  if (!value) return "—";
  if (value.length <= 8) return `${value.slice(0, 2)}****${value.slice(-2)}`;
  return `${value.slice(0, 4)}••••••${value.slice(-4)}`;
}

