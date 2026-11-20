import { useEffect, useState } from "react";

/** The browser's "install this app" offer, kept from the moment it arrives so the Home screen can show a button for it. */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** True when the app is already running as an installed app (home screen icon). */
export function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches || window.matchMedia?.("(display-mode: fullscreen)").matches || nav.standalone === true;
}

/** Start listening as early as possible: the browser fires the install offer once, soon after the page loads. */
export function watchInstall(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    notify();
  });
}

export const isIos = () => {
  const n = window.navigator;
  // iPadOS reports itself as a Mac, so a Mac with a touch screen is an iPad.
  return /iphone|ipad|ipod/i.test(n.userAgent) || (n.platform === "MacIntel" && n.maxTouchPoints > 1);
};

/**
 * True on an Android phone whose browser is not Chrome (Firefox, a browser inside WhatsApp, Gmail, Facebook, Instagram and so on, or another
 * browser), where the install offer usually never comes. The person is then pointed to Chrome.
 */
export function needsChromeToInstall(ua: string, referrer = ""): boolean {
  if (!/android/i.test(ua)) return false;
  // A link tapped inside another app (Gmail, WhatsApp) opens in a small Chrome window that looks like Chrome but cannot install the app.
  if (referrer.startsWith("android-app://")) return true;
  const other = /; wv\)|\bwv\b|Firefox\/|EdgA\/|OPR\/|OPT\/|SamsungBrowser\/|Vivaldi|DuckDuckGo|YaBrowser|UCBrowser|MiuiBrowser|HeyTap|Brave|FBAN|FBAV|FB_IAB|Instagram|Line\/|GSA\/|WhatsApp|Snapchat|Twitter|MicroMessenger|Messenger|TikTok|musical_ly|Telegram|LinkedInApp|Pinterest/i.test(ua);
  return other || !/Chrome\/\d/.test(ua);
}

/** A link that opens this page in Chrome on Android (it falls back to the normal address if Chrome is not there). */
export function chromeIntentUrl(href: string): string {
  const u = new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
}

export type InstallState = "hidden" | "ready" | "ios" | "chrome";

/** What the Home screen should show: an Install button, iPhone instructions, or nothing (installed or not possible). */
export function useInstall(): { state: InstallState; install: () => Promise<void> } {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  // The browser's install offer arrives a moment after the page loads, so "open it in Chrome" is only said once it has had time to come.
  const [waited, setWaited] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setWaited(true), 2500); return () => window.clearTimeout(t); }, []);
  const state: InstallState = installed || isInstalledApp() ? "hidden" : deferred ? "ready" : isIos() ? "ios" : waited && needsChromeToInstall(window.navigator.userAgent, document.referrer) ? "chrome" : "hidden";

  const install = async () => {
    if (!deferred) return;
    const offer = deferred;
    await offer.prompt();
    const choice = await offer.userChoice;
    // The offer can only be used once. If they accepted, the app is installed; otherwise the browser may offer it again later.
    deferred = null;
    if (choice.outcome === "accepted") installed = true;
    notify();
  };
  return { state, install };
}
