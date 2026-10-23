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
