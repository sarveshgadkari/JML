/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function fetchPdfAsBase64(url: string) {
  const res = await fetch(url, { redirect: "follow" as any });
  if (!res.ok) throw new Error(`PDF fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  // Convert to base64
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(sub) as any);
  }
  return btoa(binary);
}

async function callProvider(opts: {
  provider: string;
  model: string;
  apiKey: string;
  prompt: string;
  base64: string;
  publicViewerUrl?: string;
}) {
  const { provider, model, apiKey, prompt, base64, publicViewerUrl } = opts;
  const sys = publicViewerUrl
    ? `${prompt}\n\n[Metadata]\npublic_viewer_url: ${publicViewerUrl}`
    : prompt;

  // Minimal unified call via OpenRouter/Groq/Google
  if (provider.toLowerCase() === "google") {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: sys },
            { inline_data: { mime_type: "application/pdf", data: base64 } },
          ],
        },
      ],
    };
    const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Google API error: ${r.status}`);
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return text;
  }

  if (provider.toLowerCase() === "groq") {
    const endpoint = "https://api.groq.com/openai/v1/chat/completions";
    const body = {
      model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: [{ type: "input_text", text: "PDF attached" }, { type: "input_audio", audio_url: `data:application/pdf;base64,${base64}` }] },
      ],
    };
    const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Groq API error: ${r.status}`);
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content ?? "";
    return text;
  }

  // OpenRouter (works for DeepSeek/Qwen/free OSS)
  const endpoint = "https://openrouter.ai/api/v1/chat/completions";
  const body = {
    model,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: `PDF (base64): ${base64.slice(0, 1000)}... [truncated]` },
    ],
  };
  const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`OpenRouter API error: ${r.status}`);
  const j = await r.json();
  const text = j?.choices?.[0]?.message?.content ?? "";
  return text;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const batch: Array<any> = body?.batch ?? [];
    const thread: any = body?.threadConfig;
    if (!Array.isArray(batch) || !thread?.provider || !thread?.model || !thread?.apiKey || !thread?.prompt) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });
    }

    const results: Array<{ id: string; ok: boolean; error?: string; json?: any }> = [];
    for (const item of batch) {
      const id = item?.id;
      const directUrl = item?.direct_download_url ?? item?.file_url;
      try {
        const base64 = await fetchPdfAsBase64(directUrl);
        const text = await callProvider({
          provider: thread.provider,
          model: thread.model,
          apiKey: thread.apiKey,
          prompt: thread.prompt,
          base64,
          publicViewerUrl: item?.public_viewer_url,
        });
        // Expect strictly JSON array; attempt to parse
        const parsed = JSON.parse(text);
        results.push({ id, ok: true, json: parsed });
      } catch (e: any) {
        results.push({ id, ok: false, error: e?.message || "processing error" });
      }
    }

    return new Response(JSON.stringify({ results }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "unknown error" }), { status: 500 });
  }
}

