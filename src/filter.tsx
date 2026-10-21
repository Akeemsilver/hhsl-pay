import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const KEY = "hhsl-site-filter";

function load(): string | null {
  try { return localStorage.getItem(KEY) || null; } catch { return null; }
}

interface Filter { site: string | null; setSite: (s: string | null) => void }
const Ctx = createContext<Filter>({ site: null, setSite: () => {} });

/** Which location the screens are limited to, if any. Remembered on this phone only. */
export function FilterProvider({ children }: { children: ReactNode }) {
  const [site, set] = useState<string | null>(load);
  const setSite = useCallback((s: string | null) => {
    set(s);
    try { if (s) localStorage.setItem(KEY, s); else localStorage.removeItem(KEY); } catch { /* ignore */ }
  }, []);
  const value = useMemo(() => ({ site, setSite }), [site, setSite]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSiteFilter = () => useContext(Ctx);
