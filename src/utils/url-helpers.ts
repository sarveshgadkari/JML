export function formatOneDriveLinks(rawUrls: string[]) {
  const results: Array<{ originalUrl: string; directDownloadUrl: string }> = [];
  for (const raw of rawUrls) {
    if (!raw) continue;
    const trimmed = String(raw).trim();
    try {
      const u = new URL(trimmed);
      const host = u.host.toLowerCase();
      if (host.includes("sharepoint.com") || host.includes("onedrive.live.com")) {
        // Append or merge download=1 to force a direct stream
        if (u.search) {
          if (!u.searchParams.has("download")) {
            u.searchParams.append("download", "1");
          } else {
            u.searchParams.set("download", "1");
          }
        } else {
          u.search = "download=1";
        }
        results.push({ originalUrl: trimmed, directDownloadUrl: u.toString() });
      } else {
        // Not a OneDrive/SharePoint link; return as-is for both (worker may still try)
        results.push({ originalUrl: trimmed, directDownloadUrl: trimmed });
      }
    } catch {
      // Skip invalid URLs silently
      continue;
    }
  }
  return results;
}

