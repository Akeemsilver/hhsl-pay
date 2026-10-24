/** A spreadsheet shared into the app from another app (Android's Share menu). The service worker keeps it, this picks it up. */
const CACHE = "shared-files";
const KEY = "shared-file";

let pending: File | null = null;
let notice: { text: string; ok: boolean } | null = null;
const listeners = new Set<() => void>();

/**
 * If the app was opened by a share (?shared=...), fetch the file the service worker kept.
 * "file": a file is waiting; "empty": the share came without a file; "none": the app was not opened by a share.
 */
export async function loadSharedFile(): Promise<"file" | "empty" | "none"> {
  if (typeof window === "undefined") return "none";
  const flag = new URLSearchParams(window.location.search).get("shared");
  if (flag === null) return "none";
  // The address goes back to normal, so a refresh does not look for the file again.
  const clean = new URL(window.location.href);
  clean.searchParams.delete("shared");
  window.history.replaceState(window.history.state, "", clean.pathname + clean.search + clean.hash);
  const empty = () => {
    notice = { text: "The app was opened by a share, but no spreadsheet came with it. In Google Sheets or Drive use Share & export, Send a copy, then Excel, and pick this app. Or use Choose yearly / monthly spreadsheet below.", ok: false };
    listeners.forEach((l) => l());
    return "empty" as const;
  };
  if (flag === "empty") return empty();
  try {
    const cache = await caches.open(CACHE);
    const res = await cache.match(KEY);
    if (!res) return empty();
    const name = decodeURIComponent(res.headers.get("X-File-Name") ?? "shared.xlsx");
    const blob = await res.blob();
    pending = new File([blob], name, { type: res.headers.get("Content-Type") ?? "" });
    notice = { text: `Received “${name}” (${Math.max(1, Math.round(blob.size / 1024))} KB) from the share. Reading it…`, ok: true };
    await cache.delete(KEY);
    listeners.forEach((l) => l());
    return "file";
  } catch {
    return empty();
  }
}

/** The shared file, once. */
export function takeSharedFile(): File | null {
  const f = pending;
  pending = null;
  return f;
}

/** What to tell the person about the share that opened the app, once. */
export function takeSharedNotice(): { text: string; ok: boolean } | null {
  const n = notice;
  notice = null;
  return n;
}

export function onSharedFile(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
