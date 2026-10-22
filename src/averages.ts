import { MONTHS } from "./format";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The average a month, counting from January up to and including month `index` (0 = January).
 * Each month's average only uses the months up to it, so it never changes when later months do:
 * $1,000 in Jan and again in Feb averages $1,000 in both; then $10,000 in Mar averages $4,000 for March.
 */
export function averageThrough(values: number[], index: number): number {
  const upTo = values.slice(0, index + 1);
  return round2(upTo.reduce((s, v) => s + v, 0) / (index + 1));
}

/** "Jan" for January alone, "Jan–Mar" after that. */
export function throughLabel(index: number): string {
  const first = MONTHS[0]!.slice(0, 3);
  return index <= 0 ? first : `${first}–${MONTHS[index]!.slice(0, 3)}`;
}
