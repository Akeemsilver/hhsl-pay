import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { loadData, requestPersistence, saveData } from "./storage";
import { newData, type AppData } from "./model";

interface Store {
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
  replace: (d: AppData) => void;
  persistent: boolean;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [persistent, setPersistent] = useState(false);
  const latest = useRef<AppData | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    loadData().then((d) => {
      latest.current = d;
      setData(d);
    });
    requestPersistence().then(setPersistent);
  }, []);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    if (latest.current) void saveData(latest.current);
  }, []);

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [flush]);

  const replace = useCallback((d: AppData) => {
    latest.current = d;
    setData(d);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 250);
  }, [flush]);

  const update = useCallback((fn: (d: AppData) => AppData) => {
    replace(fn(latest.current ?? newData()));
  }, [replace]);

  if (!data) return <div className="loading">Loading…</div>;
  return <Ctx.Provider value={{ data, update, replace, persistent }}>{children}</Ctx.Provider>;
}
