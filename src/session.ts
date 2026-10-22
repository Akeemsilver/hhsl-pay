import { useCallback, useState } from "react";

/** Values kept only while the app stays open. Closing and reopening the app starts fresh. */
const memory = new Map<string, unknown>();

/** Like useState, but the value is remembered when you leave the screen and come back, until the app is closed. */
export function useSessionState<T>(key: string, initial: T): [T, (next: T) => void] {
  const [value, set] = useState<T>(() => (memory.has(key) ? (memory.get(key) as T) : initial));
  const update = useCallback((next: T) => { memory.set(key, next); set(next); }, [key]);
  return [value, update];
}
