/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";

// NOTE: This route is intended to run in the Node.js runtime (not edge)
export const dynamic = "force-dynamic";

function formatGoogleDriveLink(url: URL): string {
  // Convert https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  // to https://drive.google.com/uc?export=download&id=FILE_ID
  const pathname = url.pathname;
  const m = pathname.match(/\/file\/d\/([^/]+)\//);
  if (m && m[1]) {
    const id = m[1];
    const out = new URL("https://drive.google.com/uc");
    out.searchParams.set("export", "download");
    out.searchParams.set("id", id);
    return out.toString();
  }
  // Fallback: if it already has 'uc' params, keep as is
  return url.toString();
}

function formatOneDriveLink(url: URL): string {
  if (url.search) {
    if (!url.searchParams.has("download")) {
      url.searchParams.append("download", "1");
    } else {
      url.searchParams.set("download", "1");
    }
  } else {
    url.search = "download=1";
  }
  return url.toString();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const folderUrlRaw: string | undefined = body?.folderUrl;
    if (!folderUrlRaw) {
      return new Response(JSON.stringify({ error: "folderUrl required" }), { status: 400 });
    }

    // Lightweight fetch + regex approach to avoid full browser if possible
    // If site blocks CORS, this server route can still fetch HTML
    const res = await fetch(folderUrlRaw, { redirect: "follow" as any });
    if (!res.ok) {
      const status = res.status;
      if (status === 401 || status === 403) {
        return new Response(JSON.stringify({ error: "Folder is private or unauthorized (401/403)" }), { status });
      }
      return new Response(JSON.stringify({ error: `Fetch failed: ${status}` }), { status: 500 });
    }
    const html = await res.text();

    // Scrape hrefs
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
        // Google Drive viewer pages
        if (host.includes("drive.google.com") && /\/file\/d\/.+\/view/.test(u.pathname)) {
          out.push(formatGoogleDriveLink(u));
          continue;
        }
        // OneDrive/SharePoint links
        if (host.includes("onedrive.live.com") || host.includes("sharepoint.com")) {
          out.push(formatOneDriveLink(u));
          continue;
        }
      } catch {
        // ignore bad URLs
      }
    }

    // If few/no links found, try robust fallback with puppeteer-core (if executable path available)
    let unique = Array.from(new Set(out));
    if (unique.length < 1) {
      try {
        // Use an explicit Chrome/Chromium path via env for reliability
        const exe = process.env.PUPPETEER_EXECUTABLE_PATH;
        if (!exe) throw new Error("PUPPETEER_EXECUTABLE_PATH not set");
        const puppeteer = await import("puppeteer-core");
        const browser = await puppeteer.launch({ executablePath: exe, headless: "new" as any, args: ["--no-sandbox","--disable-setuid-sandbox"] });
        try {
          const page = await browser.newPage();
          await page.goto(folderUrlRaw, { waitUntil: "networkidle2", timeout: 60000 });
          // Scroll to bottom multiple times to trigger lazy loading
          for (let i = 0; i < 10; i++) {
            await page.evaluate(async () => {
              window.scrollBy(0, window.innerHeight);
              await new Promise(r => setTimeout(r, 500));
            });
          }
          const links = await page.$$eval("a", (as) => as.map((a: any) => a.href).filter(Boolean));
          const norm: string[] = [];
          for (const h of links) {
            try {
              const u = new URL(h, folderUrlRaw);
              const host = u.host.toLowerCase();
              const path = u.pathname.toLowerCase();
              if (path.endsWith(".pdf")) {
                norm.push(u.toString());
                continue;
              }
              if (host.includes("drive.google.com") && /\/file\/d\/.+\/view/.test(u.pathname)) {
                norm.push(formatGoogleDriveLink(u));
                continue;
              }
              if (host.includes("onedrive.live.com") || host.includes("sharepoint.com")) {
                norm.push(formatOneDriveLink(u));
                continue;
              }
            } catch {}
          }
          unique = Array.from(new Set(norm));
        } finally {
          await browser.close();
        }
      } catch (e: any) {
        // Fallback failed; return what we have (likely none) with a hint
      }
    }

    return new Response(JSON.stringify({ totalFound: unique.length, links: unique }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "unknown error" }), { status: 500 });
  }
}

