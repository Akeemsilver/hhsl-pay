import { newData, type AppData } from "./model";

const DB = "hhsl-salary-tracker";
const STORE = "kv";
const KEY = "app-data";
const TEMPLATE_KEY = "timesheet-template";
const LS_KEY = "hhsl-salary-tracker:data";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string = KEY): Promise<unknown> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(value: unknown, key: string = KEY): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadData(): Promise<AppData> {
  try {
    const stored = await idbGet();
    if (stored) return stored as AppData;
  } catch {
    /* fall through to localStorage */
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as AppData;
  } catch {
    /* ignore */
  }
  return newData();
}

export async function saveData(data: AppData): Promise<void> {
  try {
    await idbSet(data);
    return;
  } catch {
    /* fall back */
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable (private mode / full) */
  }
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** The company's blank time sheet, kept only on this phone and not part of backups. */
export interface StoredTemplate {
  name: string;
  bytes: ArrayBuffer;
}

export async function loadTemplate(): Promise<StoredTemplate | null> {
  try {
    return ((await idbGet(TEMPLATE_KEY)) as StoredTemplate | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function saveTemplate(t: StoredTemplate): Promise<boolean> {
  try {
    await idbSet(t, TEMPLATE_KEY);
    return true;
  } catch {
    return false;
  }
}

export async function clearTemplate(): Promise<void> {
  try {
    await idbSet(null, TEMPLATE_KEY);
  } catch {
    /* nothing stored */
  }
}
