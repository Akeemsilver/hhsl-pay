import { useCallback, useState, useSyncExternalStore } from "react";

/** Values kept only while the app stays open. Closing and reopening the app starts fresh. */
const memory = new Map<string, unknown>();

/** Like useState, but the value is remembered when you leave the screen and come back, until the app is closed. */
export function useSessionState<T>(key: string, initial: T): [T, (next: T) => void] {
  const [value, set] = useState<T>(() => (memory.has(key) ? (memory.get(key) as T) : initial));
  const update = useCallback((next: T) => { memory.set(key, next); set(next); }, [key]);
  return [value, update];
}

/** Forget a remembered value, so the next screen that asks for it starts from its own default. */
export function clearSessionState(key: string): void {
  memory.delete(key);
}

/**
 * The date tapped on Home or Month (the yellow highlight). One shared value, forgotten when you switch tabs or leave
 * the app, so every visit to a calendar starts with no date selected.
 */
let selectedDate: string | null = null;
const listeners = new Set<() => void>();

export function setSelectedDate(next: string | null): void {
  if (next === selectedDate) return;
  selectedDate = next;
  listeners.forEach((l) => l());
}

export function useSelectedDate(): [string | null, (next: string | null) => void] {
  const value = useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => selectedDate,
  );
  return [value, setSelectedDate];
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") setSelectedDate(null); });
}
