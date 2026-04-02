type ProviderKind = "google" | "groq" | "openrouter" | "unknown";

export type AiDispatchThread = {
  provider: string;
  model: string;
  apiKey: string;
  prompt: string;
};

export type AiDispatchInput = {
  pdfBase64?: string;
  pdfMimeType?: string;
  sourceUrl?: string;
  publicViewerUrl?: string | null;
  fileName?: string;
  timeoutMs?: number;
};

export type AiDispatchResult = {
  raw: unknown;
  text: string;
  json: unknown;
  usedTransport: "inline_data" | "direct_url";
  statusCode?: number;
};

export type AiBatchDocument = {
  fileName: string;
  publicViewerUrl?: string | null;
  sourceUrl?: string;
  pdfBase64?: string;
  pdfMimeType?: string;
};

function normalizeProvider(provider: string): ProviderKind {
  const value = provider.toLowerCase();
  if (value.includes("google")) return "google";
  if (value.includes("groq")) return "groq";
  if (value.includes("openrouter")) return "openrouter";
  if (value.includes("chinese_openrouter")) return "openrouter";
  if (value.includes("western")) return "openrouter";
  return "unknown";
}

function providerLabel(provider: string): string {
  const normalized = normalizeProvider(provider);
  if (normalized === "google") return "Google Gemini";
  if (normalized === "groq") return "Groq";
  if (normalized === "openrouter") return "OpenRouter";
  return provider;
}

function providerSupportsDirectUrl(provider: string): boolean {
  const normalized = normalizeProvider(provider);
  return normalized === "google";
}

function providerSupportsInlinePdf(provider: string): boolean {
  return normalizeProvider(provider) === "google";
}

function parseJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (!match) {
      throw new Error("AI response did not contain valid JSON.");
    }
    return JSON.parse(match[1]);
  }
}

export function isContextOrPayloadError(error: unknown) {
  const message = String((error as any)?.message || error || "").toLowerCase();
  return (
    message.includes("413") ||
    message.includes("payload too large") ||
    message.includes("request too large") ||
    message.includes("token limit") ||
    message.includes("context") ||
    message.includes("400")
  );
}

async function callGemini(thread: AiDispatchThread, input: AiDispatchInput): Promise<AiDispatchResult> {
  const transport: "inline_data" | "direct_url" =
    providerSupportsDirectUrl(thread.provider) && input.sourceUrl ? "direct_url" : "inline_data";

  if (transport === "inline_data" && !input.pdfBase64) {
    throw new Error("Gemini inline PDF mode requires Base64 PDF data.");
  }

  const metadataText = [
    "PDF metadata:",
    `- file_name: ${input.fileName || "unknown.pdf"}`,
    `- public_viewer_url: ${input.publicViewerUrl || "N/A"}`,
    `- source_url: ${input.sourceUrl || "N/A"}`,
  ].join("\n");

  const parts =
    transport === "direct_url"
      ? [{ text: `${thread.prompt}\n\n${metadataText}\n\nDirect PDF URL: ${input.sourceUrl}` }]
      : [
          { text: `${thread.prompt}\n\n${metadataText}` },
          {
            inline_data: {
              mime_type: input.pdfMimeType || "application/pdf",
              data: input.pdfBase64!,
            },
          },
        ];

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), input.timeoutMs ?? 120000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(thread.model)}:generateContent?key=${encodeURIComponent(thread.apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts,
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown provider error");
      throw new Error(`Gemini request failed (${response.status}): ${errorText}`);
    }

    const raw = await response.json();
    const text = Array.isArray(raw?.candidates)
      ? raw.candidates
          .flatMap((candidate: any) => candidate?.content?.parts || [])
          .map((part: any) => part?.text || "")
          .join("\n")
      : "";

    if (!text.trim()) {
      throw new Error("Gemini returned no text content.");
    }

    return {
      raw,
      text,
      json: parseJsonFromText(text),
      usedTransport: transport,
      statusCode: 200,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function callGeminiBatch(
  thread: AiDispatchThread,
  documents: AiBatchDocument[],
  timeoutMs = 120000
): Promise<AiDispatchResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  const linkListText = documents
    .map((doc, index) => `Link ${index + 1}: ${doc.sourceUrl || "N/A"}`)
    .join("\n");

  const instructions = [
    linkListText,
    "",
    thread.prompt,
  ].join("\n");

  const useInlineData = documents.some((doc) => !!doc.pdfBase64);
  const parts: Array<any> = [
    {
      text: instructions,
    },
  ];

  if (useInlineData) {
    for (const doc of documents) {
      if (!doc.pdfBase64) {
        throw new Error(`Missing Base64 PDF data for ${doc.fileName}.`);
      }
      parts.push({
        inline_data: {
          mime_type: doc.pdfMimeType || "application/pdf",
          data: doc.pdfBase64,
        },
      });
    }
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(thread.model)}:generateContent?key=${encodeURIComponent(thread.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown provider error");
      throw new Error(`Gemini batch request failed (${response.status}): ${errorText}`);
    }

    const raw = await response.json();
    const text = Array.isArray(raw?.candidates)
      ? raw.candidates.flatMap((candidate: any) => candidate?.content?.parts || []).map((part: any) => part?.text || "").join("\n")
      : "";

    if (!text.trim()) {
      throw new Error("Gemini batch returned no text content.");
    }

    return {
      raw,
      text,
      json: parseJsonFromText(text),
      usedTransport: useInlineData ? "inline_data" : "direct_url",
      statusCode: 200,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function dispatchAiExtraction(
  thread: AiDispatchThread,
  input: AiDispatchInput
): Promise<AiDispatchResult> {
  const provider = normalizeProvider(thread.provider);

  if (!thread.apiKey?.trim()) {
    throw new Error("Missing API key on the active thread.");
  }

  if (provider === "google") {
    return callGemini(thread, input);
  }

  if (provider === "groq" || provider === "openrouter") {
    if (!providerSupportsInlinePdf(thread.provider)) {
      throw new Error(
        `${providerLabel(thread.provider)} models in this dashboard do not support raw PDF binary dispatch from the browser. Use Google Gemini for inline PDF extraction or add a provider-specific text/PDF upload adapter first.`
      );
    }
  }

  throw new Error(
    `Unsupported frontend PDF provider: ${providerLabel(thread.provider)}. Add a browser-safe dispatcher before enabling this thread.`
  );
}

export async function dispatchAiBatchExtraction(
  thread: AiDispatchThread,
  documents: AiBatchDocument[],
  timeoutMs?: number
): Promise<AiDispatchResult> {
  const provider = normalizeProvider(thread.provider);
  if (provider !== "google") {
    throw new Error(`${providerLabel(thread.provider)} does not support batch PDF dispatch in this dashboard yet.`);
  }
  if (!documents.length) {
    throw new Error("No documents provided for batch extraction.");
  }
  return callGeminiBatch(thread, documents, timeoutMs);
}

export function getAiProviderCapabilities(provider: string) {
  return {
    providerLabel: providerLabel(provider),
    supportsDirectUrl: providerSupportsDirectUrl(provider),
    supportsInlinePdf: providerSupportsInlinePdf(provider),
  };
}
