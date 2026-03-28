import React, { useMemo, useState } from "react";
import { Play, Pause, Settings } from "lucide-react";
import { FREE_AI_PROVIDERS } from "../../../../lib/ai-free-tiers";
import getSupabase from "../../../../utils/supabase/client";

export type ProcessingThread = {
  id: string;
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  batchSize: number;
  prompt: string;
  active: boolean;
};

interface Props {
  threads: ProcessingThread[];
  onChange: (threads: ProcessingThread[]) => void;
}

export default function ThreadConfigurator({ threads, onChange }: Props) {
  const [name, setName] = useState("");
  type ProviderKey = keyof typeof FREE_AI_PROVIDERS;
  const providerKeys = Object.keys(FREE_AI_PROVIDERS) as ProviderKey[];
  const [provider, setProvider] = useState<ProviderKey>(providerKeys[0]);
  const modelsForProvider = FREE_AI_PROVIDERS[provider].models;
  const [model, setModel] = useState<string>(modelsForProvider[0].id);
  const [apiKey, setApiKey] = useState("");
  const activeModel = useMemo(() => {
    const all = FREE_AI_PROVIDERS[provider].models;
    return all.find((m) => m.id === model) || all[0];
  }, [provider, model]);
  const [batchSize, setBatchSize] = useState<number>(activeModel.recBatch);
  const [prompt, setPrompt] = useState<string>(`You are a highly accurate legal data extraction AI specializing in case judgments. 
Your task is to extract case information into a structured JSON format. You are instructed to take as much time and internal processing as necessary to ensure flawless accuracy. Do not rush the extraction.

RULES:
1. FORMAT: Output ONLY a valid, raw JSON array of objects. Do not include markdown formatting, backticks (\\\`\\\`\\\`), or any conversational text.
2. 3X MISSING DATA VERIFICATION PROTOCOL: If any piece of data appears to be missing, you MUST halt and re-read the document specifically looking for that exact data point. You must repeat this targeted re-scan process THREE TIMES (3x). Only if the data cannot be found after three deliberate, thorough sweeps are you allowed to mark it as null.
3. MULTIPLE COMPLAINTS: If a document contains multiple complaint numbers (e.g., CC123, CC124), output one JSON object per complaint inside the main array.

4. OUTCOME MAPPING (Strict):
   - "Complaint allowed", "Refund ordered", "Interest ordered" -> "In favor of Complainant"
   - "Dismissed", "Not maintainable", "Dismissed for default" -> "In favor of Respondent"
   - "Settlement", "Consent terms", "Withdrawn" -> "Settled"

5. STATUS MAPPING (Strict): You must classify the final status of the complaint using ONLY one of the following four exact phrases:
   - "Complaint disposed" (Use for general disposals/final orders)
   - "Withdrawn" (Use if the complainant withdrew the case)
   - "Settlement" (Use if resolved via mutual consent terms or settlement)
   - "complaint rejected" (Use if the case was dismissed, rejected, or not maintainable)

6. JSON SCHEMA: Every object in your output array MUST strictly follow this structure. If data is still missing after the 3X check, use null for strings and [] for arrays. Also:
   - "judgement_link": YOU MUST INJECT THE EXACT 'public_viewer_url' PROVIDED IN THE API METADATA HERE.
[
  {
    "_missing_data_audit": "List the fields that were missing and confirm you executed the 3X check for them",
    "judgement_link": "YOU MUST INJECT THE EXACT 'public_viewer_url' PROVIDED IN THE API METADATA HERE",
    "complaint_number": "string",
    "case_title": "string",
    "court_type": "string",
    "court": "string",
    "judge": "string",
    "petitioner_lawyers": ["string"],
    "respondent_lawyers": ["string"],
    "filing_date": "string",
    "judgement_date": "string",
    "status": "string",
    "outcome": "string",
    "complainant": "string",
    "respondent": "string",
    "total_hearings": "integer"
  }
]`);

  const canAdd = useMemo(
    () => name.trim().length > 0 && apiKey.trim().length > 0 && batchSize > 0,
    [name, apiKey, batchSize]
  );

  const addThread = async () => {
    if (!canAdd) return;
    const supabase = getSupabase();
    const payload = {
      name: name.trim(),
      provider,
      model,
      api_key_secret: apiKey.trim(),
      batch_size: batchSize,
      system_prompt: prompt,
      is_active: true,
    };
    const { data, error } = await supabase.from("ai_threads").insert(payload).select("id,name,provider,model,api_key_secret,batch_size,system_prompt,is_active").single();
    if (!error && data) {
      const next: ProcessingThread = {
        id: data.id,
        name: data.name,
        provider: data.provider,
        model: data.model,
        apiKey: data.api_key_secret,
        batchSize: data.batch_size,
        prompt: data.system_prompt,
        active: data.is_active,
      };
      onChange([next, ...threads]);
      setName("");
      setApiKey("");
      setBatchSize(activeModel.recBatch);
    }
  };

  const toggleActive = async (id: string) => {
    const target = threads.find((t) => t.id === id);
    if (!target) return;
    const supabase = getSupabase();
    const { error } = await supabase.from("ai_threads").update({ is_active: !target.active }).eq("id", id);
    if (!error) {
      onChange(threads.map((t) => (t.id === id ? { ...t, active: !t.active } : t)));
    }
  };

  // Load existing threads from Supabase on mount
  React.useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("ai_threads")
          .select("id,name,provider,model,api_key_secret,batch_size,system_prompt,is_active")
          .order("created_at", { ascending: false });
        if (!error && data) {
          const rows: ProcessingThread[] = data.map((d: any) => ({
            id: d.id,
            name: d.name,
            provider: d.provider,
            model: d.model,
            apiKey: d.api_key_secret,
            batchSize: d.batch_size,
            prompt: d.system_prompt,
            active: d.is_active,
          }));
          onChange(rows);
        }
      } catch {
        // ignore
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white">
        <div className="px-4 py-3 border-b bg-slate-50 text-slate-900 font-semibold flex items-center gap-2">
          <Settings className="w-4 h-4" /> Add Processing Thread
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Thread Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Claude-Opus-Worker-1"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">AI Provider</label>
            <select
              value={provider}
              onChange={(e) => {
                const p = e.target.value as ProviderKey;
                setProvider(p);
                const first = FREE_AI_PROVIDERS[p].models[0]?.id || "";
                setModel(first);
                const rec = FREE_AI_PROVIDERS[p].models[0]?.recBatch || 1;
                setBatchSize(rec);
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {providerKeys.map((k) => (
                <option key={k} value={k}>{FREE_AI_PROVIDERS[k].name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
            <select
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                const m = FREE_AI_PROVIDERS[provider].models.find(mm => mm.id === e.target.value);
                if (m) setBatchSize(m.recBatch);
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {FREE_AI_PROVIDERS[provider].models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              placeholder="••••••••••••••"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Batch Size</label>
            <input
              value={batchSize}
              onChange={(e) => {
                const v = Number(e.target.value || 0);
                setBatchSize(v);
              }}
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
              {batchSize > (activeModel?.recBatch ?? 1) && (
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
              onClick={addThread}
              disabled={!canAdd}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
            >
              Add Thread
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
                  })()} • Batch: {t.batchSize}
                </div>
                <div className="text-xs text-slate-500">
                  {(() => {
                    const prov = t.provider as ProviderKey;
                    const m = FREE_AI_PROVIDERS[prov]?.models.find(mm => mm.id === t.model);
                    return m ? `Context ${m.context} • MaxRPM ${m.maxRpm} • MaxRPD ${m.maxRpd}` : '';
                  })()}
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
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

