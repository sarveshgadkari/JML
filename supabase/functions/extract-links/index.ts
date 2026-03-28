// Deno Deploy (Supabase Edge Function): extract-links
// POST { folderUrl: string } → { totalFound: number, links: string[] }
// Scrapes public OneDrive/Google Drive folder HTML for PDF links and viewer links
// Converts Drive /view → /uc?export=download&id=... and appends &download=1 for OneDrive/SharePoint.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

function formatGoogleDriveLink(u: URL): string {
  const m = u.pathname.match(/\/file\/d\/([^/]+)\//);
  if (m && m[1]) {
    const id = m[1];
    const out = new URL("https://drive.google.com/uc");
    out.searchParams.set("export", "download");
    out.searchParams.set("id", id);
    return out.toString();
  }
  return u.toString();
}

function formatOneDriveLink(u: URL): string {
  if (u.search) {
    if (!u.searchParams.has("download")) u.searchParams.append("download", "1");
    else u.searchParams.set("download", "1");
  } else {
    u.search = "download=1";
  }
  return u.toString();
}

serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    // Be permissive to accommodate supabase-js/X-Client-Info headers
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const body = await req.json().catch(() => ({}));
    const folderUrlRaw: string | undefined = body?.folderUrl;
    if (!folderUrlRaw) {
      return new Response(JSON.stringify({ error: "folderUrl required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    let res: Response;
    try {
      res = await fetch(folderUrlRaw, { redirect: "follow" as any });
    } catch (e) {
      return new Response(JSON.stringify({ error: `Fetch error: ${e instanceof Error ? e.message : "unknown"}` }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!res.ok) {
      const status = res.status;
      if (status === 401 || status === 403) {
        return new Response(JSON.stringify({ error: "Folder is private or unauthorized (401/403)" }), { status, headers: { ...cors, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: `Fetch failed: ${status}` }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const html = await res.text();
    const hrefs = Array.from(html.matchAll(/href="([^"]+)"/gi)).map((m) => m[1]);
    const out: string[] = [];
    for (const h of hrefs) {
      try {
        const u = new URL(h, folderUrlRaw);
        const host = u.host.toLowerCase();
        const path = u.pathname.toLowerCase();
        if (path.endsWith(".pdf")) {
          out.push(u.toString());
          continue;
        }
        if (host.includes("drive.google.com") && /\/file\/d\/.+\/view/.test(u.pathname)) {
          out.push(formatGoogleDriveLink(u));
          continue;
        }
        if (host.includes("onedrive.live.com") || host.includes("sharepoint.com")) {
          out.push(formatOneDriveLink(u));
          continue;
        }
      } catch {
        // skip
      }
    }
    const unique = Array.from(new Set(out));
    return new Response(JSON.stringify({ totalFound: unique.length, links: unique }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

