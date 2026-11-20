import { describe, expect, it } from "vitest";
import { kitTextOf, kitToPdf } from "../src/kitPdf";

describe("starter kit as a PDF", () => {
  it("gives the same text back, including non-ASCII", () => {
    const kit = JSON.stringify({ app: "x", name: "Café (A) \\ B", n: [1, 2, 3] });
    const pdf = kitToPdf(kit, "HHSL-starter-kit-rates.json");
    const text = new TextDecoder().decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(kitTextOf(text)).toBe(kit);
  });
  it("passes plain files through and rejects other PDFs", () => {
    expect(kitTextOf('{"a":1}')).toBe('{"a":1}');
    expect(() => kitTextOf("%PDF-1.4 nothing")).toThrow(/not a starter kit/);
  });
});

describe("reading a picked file", () => {
  it("takes the kit from a PDF, from a text file, and from JSON as they are", async () => {
    const { kitTextFromFile } = await import("../src/kitPdf");
    const kit = '{"app":"hhsl-salary-tracker","kind":"rates"}';
    expect(await kitTextFromFile(new File([kitToPdf(kit, "kit.json")], "kit.pdf"))).toBe(kit);
    expect(await kitTextFromFile(new File([kit], "kit.txt"))).toBe(kit);
  });
  it("says the kit is gone when a PDF no longer holds it", async () => {
    const { kitTextFromFile } = await import("../src/kitPdf");
    await expect(kitTextFromFile(new File(["%PDF-1.4 nothing in here"], "kit.pdf"))).rejects.toThrow(/lost the starter kit/);
  });
});
