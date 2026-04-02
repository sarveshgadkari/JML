import React, { useRef } from "react";
import { Upload, AlertCircle, Loader2, Terminal, ExternalLink, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import getSupabase from "../../../../utils/supabase/client";
import { formatOneDriveLinks } from "../../../../utils/url-helpers";

type QueueRow = {
  id: string;
  filename: string;
  uploadedAt: string;
  status: "Pending" | "Processing" | "Completed";
  claimedBy?: string | null;
};

const normalizeQueueStatus = (value: string): QueueRow["status"] =>
  value === "PROCESSING"
    ? "Processing"
    : value === "COMPLETED" || value === "ARCHIVED"
      ? "Completed"
      : "Pending";

interface Props {
  queue: QueueRow[];
  onUpdateQueue: (rows: QueueRow[]) => void;
}

export default function QueueManager({ queue, onUpdateQueue }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [urlsText, setUrlsText] = useState<string>("");
  const [urlBusy, setUrlBusy] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [pasteText, setPasteText] = useState<string>("");
  const [uploadTotal, setUploadTotal] = useState<number>(0);
  const [uploadDone, setUploadDone] = useState<number>(0);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: File[] = [];
    Array.from(files).forEach((f) => {
      if (f.name.toLowerCase().endsWith(".pdf")) next.push(f);
    });
    if (next.length) setSelectedFiles((prev) => [...prev, ...next]);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles?.length) {
      const pdfs = acceptedFiles.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
      if (pdfs.length) setSelectedFiles((prev) => [...prev, ...pdfs]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: { "application/pdf": [".pdf"] },
    noClick: true
  });

  const removeFile = (name: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const refreshQueue = async () => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("pdf_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows: QueueRow[] = (data ?? []).map((r: any) => ({
        id: r.id,
        filename:
          String(r.file_url || "").split("/").pop() ||
          String(r.direct_download_url || "").split("/").pop() ||
          String(r.public_viewer_url || "").split("/").pop() ||
          r.file_url ||
          r.direct_download_url ||
          r.public_viewer_url ||
          "unknown.pdf",
        uploadedAt: r.created_at,
        status: normalizeQueueStatus(r.status),
        claimedBy: r.claimed_by || null
      }));
      onUpdateQueue(rows);
    } catch {
      // ignore UI refresh errors
    }
  };

  // Realtime: blink-in changes without reload
  React.useEffect(() => {
    void refreshQueue();
    const supabase = getSupabase();
    const ch = supabase
      .channel("pdf_queue_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pdf_queue" },
        () => {
          void refreshQueue();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bulk URL importer for OneDrive/SharePoint
  const addUrlsToQueue = async () => {
    const lines = urlsText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (!lines.length) return;
    setUrlBusy(true);
    try {
      const mapped = formatOneDriveLinks(lines);
      const supabase = getSupabase();
      const rows = mapped.map((m) => ({
        public_viewer_url: m.originalUrl,
        direct_download_url: m.directDownloadUrl,
        status: "PENDING",
      }));
      // Insert in chunks
      const chunk = 200;
      for (let i = 0; i < rows.length; i += chunk) {
        const slice = rows.slice(i, i + chunk);
        const { error } = await supabase.from("pdf_queue").insert(slice);
        if (error) throw error;
      }
      setUrlsText("");
      await refreshQueue();
    } catch {
      // soft-fail; UI remains usable
    } finally {
      setUrlBusy(false);
    }
  };

  // Copy-to-clipboard: Client-side scraper injection (Zero-CORS)
  const copyScraperSnippet = async () => {
    const PROJECT = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
    const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    if (!PROJECT || !ANON) return;
    const SUPABASE_URL = `https://${PROJECT}.supabase.co`;
    // Inline converters for Drive/OneDrive/SharePoint direct-download
    const snippet =
`(()=>{try{const A='${SUPABASE_URL}';const K='${ANON}';const as=Array.from(document.querySelectorAll('a'));const H=as.map(a=>a.href).filter(Boolean);const F=H.filter(h=>h.includes('onedrive.live.com')||h.includes('sharepoint.com')||h.includes('drive.google.com'));const L=F.filter(h=>h.includes('.pdf')||h.includes('/file/d/'));const folderName=document.title||'Unknown Folder';const conv=(u)=>{try{const x=new URL(u);const host=x.host.toLowerCase();if(host.includes('drive.google.com')&&/\\/file\\/d\\//.test(x.pathname)){const m=x.pathname.match(/\\/file\\/d\\/([^/]+)\\//);if(m&&m[1]){const id=m[1];return 'https://drive.google.com/uc?export=download&id='+id;}}if(host.includes('onedrive.live.com')||host.includes('sharepoint.com')){if(x.search){x.searchParams.set('download','1');}else{x.search='download=1';}return x.toString();}return u;}catch{return u;}};const rows=L.map(link=>({public_viewer_url:link,direct_download_url:conv(link),status:'PENDING',source:'browser_injection',metadata:{source_folder:folderName}}));fetch(A+'/rest/v1/pdf_queue',{method:'POST',headers:{'apikey':K,'Authorization':'Bearer '+K,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(rows)}).then(()=>alert('Successfully synced '+rows.length+' PDFs to Judge My Lawyer Queue!')).catch(e=>alert('Sync failed: '+e?.message||e));}catch(e){alert('Script error: '+(e?.message||e));}})();`;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(()=>setCopied(false),1500);
    } catch {
      // ignore
    }
  };

  // Parse messy paste (no-code fallback)
  const parseMessyText = (text: string): string[] => {
    const urls = new Set<string>();
    const re = /(https?:\/\/[^\s"'<>]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const u = m[1];
      if (
        (u.includes("onedrive.live.com") || u.includes("sharepoint.com") || u.includes("drive.google.com")) &&
        (u.toLowerCase().includes(".pdf") || u.includes("/file/d/"))
      ) {
        urls.add(u);
      }
    }
    return Array.from(urls);
  };

  const extractFromPasteAndQueue = async () => {
    const links = parseMessyText(pasteText);
    if (links.length === 0) return;
    setUrlBusy(true);
    try {
      const mapped = formatOneDriveLinks(links);
      const supabase = getSupabase();
      const folderName = "Manual Paste";
      const rows = mapped.map((m) => ({
        public_viewer_url: m.originalUrl,
        direct_download_url: m.directDownloadUrl,
        status: "PENDING",
        source: "manual_paste",
        metadata: { source_folder: folderName },
      }));
      const chunk = 200;
      for (let i = 0; i < rows.length; i += chunk) {
        const slice = rows.slice(i, i + chunk);
        const { error } = await supabase.from("pdf_queue").insert(slice);
        if (error) throw error;
      }
      setPasteText("");
      await refreshQueue();
    } catch {
      // ignore
    } finally {
      setUrlBusy(false);
    }
  };

  const uploadAndQueue = async () => {
    if (!selectedFiles.length || uploading) return;
    setUploading(true);
    setUploadTotal(selectedFiles.length);
    setUploadDone(0);
    try {
      const supabase = getSupabase();
      const bucket = "pdf-judgments";
      const uploadSingle = async (file: File) => {
        const ext = file.name.toLowerCase().endsWith(".pdf") ? ".pdf" : "";
        const path = `uploads/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}_${file.name.replace(/\s+/g, "_")}${ext}`;
        try {
          const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
          if (upErr) {
            await supabase.from("pdf_queue").insert({
              file_url: `${bucket}:${path}`,
              status: "PENDING",
              error_log: `storage upload failed: ${upErr.message}`
            });
            return;
          }
          const { error: insErr } = await supabase.from("pdf_queue").insert({
            file_url: `${bucket}:${path}`,
            status: "PENDING"
          });
          if (insErr) {
            await supabase.from("pdf_queue").insert({
              file_url: `${bucket}:${path}`,
              status: "PENDING",
              error_log: `queue insert failed: ${insErr.message}`
            });
          }
        } finally {
          setUploadDone((n) => n + 1);
        }
      };
      // Process in batches of 5
      const batchSize = 5;
      for (let i = 0; i < selectedFiles.length; i += batchSize) {
        const batch = selectedFiles.slice(i, i + batchSize);
        await Promise.allSettled(batch.map((f) => uploadSingle(f)));
      }
      setSelectedFiles([]);
      await refreshQueue();
    } catch {
      // swallow
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* High-Volume Folder Sync (Zero-CORS) */}
      <div className="rounded-xl border bg-white p-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-slate-900 font-semibold">High-Volume Folder Sync</div>
          <a
            href="https://support.google.com/webmasters/answer/7451184?hl=en"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-slate-600 hover:underline inline-flex items-center gap-1"
          >
            Learn more <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border-dashed border p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-slate-800 text-white text-xs">1</span>
              <span className="font-medium text-slate-900">Copy Scraper Script</span>
            </div>
            <p className="text-sm text-slate-600 mb-3">
              Copy a small, safe script. Open your OneDrive/Drive folder and paste it into the browser console. Zero CORS issues.
            </p>
            <button
              type="button"
              onClick={copyScraperSnippet}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white text-sm font-semibold"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "1. Copy Scraper Script"}
            </button>
            <div className="mt-3 text-xs text-slate-600">
              Steps:
              <ol className="list-decimal ml-5 mt-1 space-y-1">
                <li>Open your OneDrive or Google Drive folder in a new tab.</li>
                <li>Press F12 → Console → paste the script → Enter.</li>
                <li>Done. PDFs will appear here in real-time.</li>
              </ol>
            </div>
          </div>
          <div className="rounded-lg border-dashed border p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-slate-800 text-white text-xs">2</span>
              <span className="font-medium text-slate-900">Option 2: Manual Page Paste</span>
            </div>
            <p className="text-sm text-slate-600 mb-2">
              No console? Select all (Ctrl+A) on the folder page, copy (Ctrl+C), and paste below. We’ll detect PDF links locally.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              placeholder="Paste full page text here..."
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
            />
            <div className="mt-2">
              <button
                type="button"
                onClick={extractFromPasteAndQueue}
                disabled={urlBusy || pasteText.trim().length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white text-sm font-semibold disabled:opacity-50"
              >
                Extract & Queue from Paste
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Folder URL fetcher (stateless scraper) */}
      <div className="rounded-xl border bg-white p-6">
        <div className="mb-2 text-slate-900 font-semibold">Fetch Folder Links</div>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="url"
            placeholder="Paste OneDrive/Google Drive folder URL"
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
          />
          <button
            type="button"
            onClick={async () => {
              const folder = urlsText.trim();
              if (!folder) return;
              setUrlBusy(true);
              setIsFetching(true);
              setStatusMessage("Initializing Headless Browser...");
              try {
                // optional global toast (dynamically imported)
                let toast: any = null;
                try {
                  // @ts-ignore
                  const mod = await import('sonner');
                  toast = (mod as any)?.toast;
                } catch {}
                // Call Supabase Edge Function instead of local Next.js API (this is a Vite app)
                const supa = getSupabase();
                const promise = supa.functions.invoke("extract-links", { body: { folderUrl: folder } });
                if (toast?.promise) {
                  // Wrap with global toast feedback if available
                  await toast.promise(promise, { loading: "Scraping folder...", success: "Scrape complete", error: "Scrape failed" });
                }
                const { data, error: invokeErr } = await promise;
                if (invokeErr) throw invokeErr;
                const links: string[] = data?.links ?? [];
                const totalFound = data?.totalFound ?? links.length;
                setStatusMessage(`Found ${totalFound} PDFs. Syncing to Supabase...`);
                if (links.length === 0) {
                  setStatusMessage("No PDFs found. Check if the folder is public.");
                  return;
                }
                const mapped = formatOneDriveLinks(links);
                const supabase = getSupabase();
                const rows = mapped.map((m) => ({
                  public_viewer_url: m.originalUrl,
                  direct_download_url: m.directDownloadUrl,
                  status: "PENDING",
                }));
                const chunk = 200;
                for (let i = 0; i < rows.length; i += chunk) {
                  const slice = rows.slice(i, i + chunk);
                  const { error } = await supabase.from("pdf_queue").insert(slice);
                  if (error) throw error;
                }
                await refreshQueue();
              } catch {
                // absorb
              } finally {
                setUrlBusy(false);
                setIsFetching(false);
                setStatusMessage("");
              }
            }}
            disabled={isFetching || urlBusy || urlsText.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white text-sm font-semibold disabled:opacity-50"
          >
            {isFetching ? (<><Loader2 className="w-4 h-4 animate-spin" /> Scraping Folder...</>) : "Fetch Links"}
          </button>
        </div>
        {/* Scraper Console */}
        <div className="mt-3 bg-slate-900 text-green-400 font-mono text-xs p-3 rounded-md border border-slate-700 min-h-[100px] max-h-[200px] overflow-y-auto">
          <div className="flex items-center gap-2 text-green-300 mb-1">
            <Terminal className="w-4 h-4" /> <span>Scraper Console</span>
          </div>
          <div>{statusMessage}</div>
        </div>
      </div>

      {/* Bulk URL Importer */}
      <div className="rounded-xl border bg-white p-6">
        <div className="mb-2 text-slate-900 font-semibold">Bulk URL Importer (OneDrive/SharePoint)</div>
        <textarea
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          placeholder="Paste OneDrive Share Links here, one per line"
          rows={6}
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
        />
        <div className="mt-2 text-sm rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          💡 Paste standard OneDrive Share Links here. The system will automatically convert them into direct-download streams for the AI worker.
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={addUrlsToQueue}
            disabled={urlBusy || urlsText.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white text-sm font-semibold disabled:opacity-50"
          >
            {urlBusy ? "Adding URLs..." : "Add URLs to Queue"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6" {...getRootProps()}>
        <div className={`border-2 border-dashed rounded-xl p-8 ${isDragActive ? "bg-slate-100" : "bg-slate-50"} text-center transition`}>
          <Upload className="mx-auto w-10 h-10 text-slate-500 mb-3" />
          <div className="font-medium text-slate-900">Step 1: Drag & drop PDFs here</div>
          <div className="text-sm text-slate-600">These will be staged locally before upload.</div>
          <input {...getInputProps()} />
          <div className="mt-3">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                inputRef.current?.click();
              }}
              className="rounded-lg border px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
            >
              Or choose files
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <p className="text-sm">
            Queue is persistent. If processing is interrupted, PDFs remain in <strong>Pending</strong> state until a
            thread restarts.
          </p>
        </div>
        {/* Selected files list */}
        {selectedFiles.length > 0 && (
          <div className="mt-4 rounded-lg border p-3">
            <div className="text-sm font-semibold text-slate-900 mb-2">Staged Files</div>
            <ul className="space-y-1">
              {selectedFiles.map((f) => (
                <li key={f.name} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(f.name)}
                    className="text-rose-700 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            {/* Upload progress */}
            {uploading && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                  <span>Uploading...</span>
                  <span>{uploadDone}/{uploadTotal} ({uploadTotal > 0 ? Math.round((uploadDone / uploadTotal) * 100) : 0}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded">
                  <div
                    className="h-2 bg-slate-700 rounded transition-all"
                    style={{ width: `${uploadTotal > 0 ? Math.round((uploadDone / uploadTotal) * 100) : 0}%` }}
                  />
                </div>
              </div>
            )}
            <div className="mt-3">
              <button
                type="button"
                onClick={uploadAndQueue}
                disabled={uploading || selectedFiles.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white text-sm font-semibold disabled:opacity-50"
              >
                {uploading ? "Uploading to Storage..." : `Upload & Add to Queue (${selectedFiles.length} files)`}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50 text-slate-900 font-semibold">Central Queue</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-2 text-left">Filename</th>
                <th className="px-4 py-2 text-left">Upload Date</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Claimed By</th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={4}>
                    No PDFs in the queue.
                  </td>
                </tr>
              )}
              {queue.map((row) => {
                const color =
                  row.status === "Completed"
                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                    : row.status === "Processing"
                    ? "text-blue-700 bg-blue-50 border-blue-200"
                    : "text-slate-700 bg-slate-50 border-slate-200";
                return (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-2">{row.filename}</td>
                    <td className="px-4 py-2">{new Date(row.uploadedAt).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">{row.claimedBy ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

