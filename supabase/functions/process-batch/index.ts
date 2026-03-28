// Supabase Edge Function: process-batch
// POST body: { batch: Array<{ id: string, direct_download_url: string }>, threadConfig: { provider, model, apiKey, prompt } }
// Returns: { results: Array<{ id: string, ok: boolean, json?: any, error?: string }> }
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

async function fetchPdfAsBase64(url: string) {
  const res = await fetch(url, { redirect: "follow" as any });
  if (!res.ok) throw new Error(`PDF fetch failed: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return toBase64(buf);
}

function sanitizeToJson(text: string) {
  // Strip common code fences/backticks and csv/json labels
  let t = text.trim();
  t = t.replace(/```(?:json|csv)?/gi, "").replace(/```/g, "").trim();
  return t;
}

async function callProvider(opts: {
  provider: string;
  model: string;
  apiKey: string;
  prompt: string;
  base64: string;
}) {
  const { provider, model, apiKey, prompt, base64 } = opts;

  // Google (Gemini)
  if (provider.toLowerCase() === "google") {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "application/pdf", data: base64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.0 },
    };
    const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) {
      const errTxt = await r.text().catch(() => "");
      throw new Error(`Google API error: ${r.status} ${errTxt}`);
    }
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return sanitizeToJson(text);
  }

  // Groq (OpenAI compatible)
  if (provider.toLowerCase() === "groq") {
    const endpoint = "https://api.groq.com/openai/v1/chat/completions";
    const body = {
      model,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `PDF (base64) attached:\n${base64.slice(0, 1000)}...` },
      ],
      temperature: 0.0,
    };
    const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
    if (!r.ok) {
      const errTxt = await r.text().catch(() => "");
      throw new Error(`Groq API error: ${r.status} ${errTxt}`);
    }
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content ?? "";
    return sanitizeToJson(text);
  }

  // OpenRouter (DeepSeek/Qwen/free OSS)
  const endpoint = "https://openrouter.ai/api/v1/chat/completions";
  const body = {
    model,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `PDF (base64) attached:\n${base64.slice(0, 1000)}...` },
    ],
    temperature: 0.0,
  };
  const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
  if (!r.ok) {
    const errTxt = await r.text().catch(() => "");
    throw new Error(`OpenRouter API error: ${r.status} ${errTxt}`);
  }
  const j = await r.json();
  const text = j?.choices?.[0]?.message?.content ?? "";
  return sanitizeToJson(text);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const { batch, threadConfig } = await req.json();
    if (!Array.isArray(batch) || !threadConfig?.provider || !threadConfig?.model || !threadConfig?.apiKey || !threadConfig?.prompt) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const results: Array<{ id: string; ok: boolean; error?: string; json?: any }> = [];
    for (const item of batch) {
      const id = String(item?.id ?? "");
      const url = String(item?.direct_download_url ?? "");
      try {
        const base64 = await fetchPdfAsBase64(url);
        const text = await callProvider({
          provider: threadConfig.provider,
          model: threadConfig.model,
          apiKey: threadConfig.apiKey,
          prompt: threadConfig.prompt,
          base64,
        });
        // Expect strict JSON
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          // Last resort: wrap single-object-looking output
          const cleaned = text.trim();
          if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
            parsed = [JSON.parse(cleaned)];
          } else {
            throw e;
          }
        }
        results.push({ id, ok: true, json: parsed });
      } catch (e) {
        results.push({ id, ok: false, error: e instanceof Error ? e.message : "processing error" });
      }
    }

    return new Response(JSON.stringify({ results }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

