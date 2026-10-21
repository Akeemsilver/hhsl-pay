export const PAGE_W = 595.28;
export const PAGE_H = 841.89;

export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function usd(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}$${abs}`;
}

/** Colours used on the documents; the same meanings as in the app. */
export const INK = "#16202a";
export const MUTED = "#5b6672";
export const LINE = "#d9e0e7";
export const BAND = "#f1f5f9";
export const BRAND = "#0f766e";
export const GROSS = "#1c5cab";
export const NET = "#006b00";
export const PAYE = "#b42318";
export const NIS = "#4a3aa7";
export const SURCHARGE = "#8a5a00";
