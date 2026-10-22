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
});
