/** The mobile guide PDF, built on every deploy and served next to the app. */
export const GUIDE_FILE = "HHSL-pay-app-mobile-guide.pdf";

/**
 * The guide's address carries the app version, so a copy kept on the phone is used until the app itself updates.
 * The guide is never downloaded on its own: only when someone opens it or shares it.
 */
export const guideUrl = () => `${import.meta.env.BASE_URL}${GUIDE_FILE}?v=${encodeURIComponent(typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev")}`;

let inMemory: Uint8Array | null = null;

/** True when the guide is already on this phone, so opening it downloads nothing. */
export async function isGuideKept(): Promise<boolean> {
  if (inMemory) return true;
  try { return !!(await caches.match(guideUrl())); } catch { return false; }
}

/** The guide's bytes: from this phone when kept, otherwise downloaded now (and kept). Only call this after the person has said yes. */
export async function loadGuide(): Promise<Uint8Array> {
  if (inMemory) return inMemory;
  const res = await fetch(guideUrl());
  if (!res.ok) throw new Error("guide");
  inMemory = new Uint8Array(await res.arrayBuffer());
  return inMemory;
}
