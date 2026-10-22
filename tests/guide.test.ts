import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const decode = (t: string) => t.replace(/&amp;/g, "&");
const guide = decode(readFileSync("guide/build_guide.py", "utf8"));

describe("the mobile guide", () => {
  it("covers every Settings menu item", () => {
    const hub = readFileSync("src/screens/SettingsHub.tsx", "utf8");
    const titles = [...hub.matchAll(/<strong>([^<]+)<\/strong><small>/g)].map((m) => decode(m[1]!));
    expect(titles.length).toBeGreaterThan(4);
    for (const t of titles) expect(guide, `The guide does not mention the Settings item "${t}". Add it to guide/build_guide.py.`).toContain(t);
  });

  it("covers the main tabs", () => {
    for (const t of ["Home", "Calendar", "Year", "Charts"]) expect(guide).toContain(t);
  });

  it("is shipped with the app", () => {
    expect(existsSync("public/HHSL-pay-app-mobile-guide.pdf")).toBe(true);
    expect(existsSync("guide/assets/logo.png")).toBe(true);
  });
});
