/** A spreadsheet shared into the app from another app (Android's Share menu). The service worker keeps it, this picks it up. */
const CACHE = "shared-files";
const KEY = "shared-file";

let pending: File | null = null;
const listeners = new Set<() => void>();

/** If the app was opened by a share (?shared=1), fetch the file the service worker kept. True when a file is waiting. */
export async function loadSharedFile(): Promise<boolean> {
  if (typeof window === "undefined" || !new URLSearchParams(window.location.search).has("shared")) return false;
  // The address goes back to normal, so a refresh does not look for the file again.
  const clean = new URL(window.location.href);
  clean.searchParams.delete("shared");
  window.history.replaceState(window.history.state, "", clean.pathname + clean.search + clean.hash);
  try {
    const cache = await caches.open(CACHE);
    const res = await cache.match(KEY);
    if (!res) return false;
    const name = decodeURIComponent(res.headers.get("X-File-Name") ?? "shared.xlsx");
    pending = new File([await res.blob()], name, { type: res.headers.get("Content-Type") ?? "" });
    await cache.delete(KEY);
    listeners.forEach((l) => l());
    return true;
  } catch {
    return false;
  }
}

/** The shared file, once. */
export function takeSharedFile(): File | null {
  const f = pending;
  pending = null;
  return f;
}

export function onSharedFile(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
