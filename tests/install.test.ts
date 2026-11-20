import { describe, expect, it, vi } from "vitest";

describe("install offer", () => {
  it("is hidden when the app already runs installed", async () => {
    vi.stubGlobal("window", { matchMedia: (q: string) => ({ matches: q.includes("standalone") }), navigator: { userAgent: "Android" }, addEventListener: () => {} });
    const { isInstalledApp } = await import("../src/install");
    expect(isInstalledApp()).toBe(true);
    vi.unstubAllGlobals();
  });
  it("is not installed in a normal browser tab", async () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), navigator: { userAgent: "Android" }, addEventListener: () => {} });
    const { isInstalledApp } = await import("../src/install");
    expect(isInstalledApp()).toBe(false);
    vi.unstubAllGlobals();
  });

  it("points an Android browser that is not Chrome to Chrome, and leaves Chrome, iPhone and desktop alone", async () => {
    const { needsChromeToInstall } = await import("../src/install");
    const chrome = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    expect(needsChromeToInstall(chrome)).toBe(false);
    expect(needsChromeToInstall("Mozilla/5.0 (Linux; Android 13; SM-A135F Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0 Mobile Safari/537.36")).toBe(true);
    expect(needsChromeToInstall("Mozilla/5.0 (Android 13; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0")).toBe(true);
    expect(needsChromeToInstall(chrome + " EdgA/120.0.0.0")).toBe(true);
    expect(needsChromeToInstall("Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/115.0 Mobile Safari/537.36 SamsungBrowser/23.0")).toBe(true);
    expect(needsChromeToInstall(chrome + " Instagram 300.0")).toBe(true);
    expect(needsChromeToInstall("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1")).toBe(false);
    expect(needsChromeToInstall("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36")).toBe(false);
  });
  it("treats a link opened from another app as needing the real Chrome, even when it looks like Chrome", async () => {
    const { needsChromeToInstall } = await import("../src/install");
    const chrome = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    expect(needsChromeToInstall(chrome, "android-app://com.google.android.gm")).toBe(true);
    expect(needsChromeToInstall(chrome, "https://example.com/")).toBe(false);
  });
  it("builds a link that opens the page in Chrome, falling back to the plain address", async () => {
    const { chromeIntentUrl } = await import("../src/install");
    const u = chromeIntentUrl("https://akeemsilver.github.io/hhsl-pay/?shared=1");
    expect(u.startsWith("intent://akeemsilver.github.io/hhsl-pay/?shared=1#Intent;scheme=https;package=com.android.chrome;")).toBe(true);
    expect(u).toContain("S.browser_fallback_url=https%3A%2F%2Fakeemsilver.github.io%2Fhhsl-pay%2F%3Fshared%3D1;end");
  });
});
