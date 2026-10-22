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

const isIos = () => {
  const n = window.navigator;
  // iPadOS reports itself as a Mac, so a Mac with a touch screen is an iPad.
  return /iphone|ipad|ipod/i.test(n.userAgent) || (n.platform === "MacIntel" && n.maxTouchPoints > 1);
};

export type InstallState = "hidden" | "ready" | "ios";

/** What the Home screen should show: an Install button, iPhone instructions, or nothing (installed or not possible). */
export function useInstall(): { state: InstallState; install: () => Promise<void> } {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const state: InstallState = installed || isInstalledApp() ? "hidden" : deferred ? "ready" : isIos() ? "ios" : "hidden";

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
