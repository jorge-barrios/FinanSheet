// services/currencyService.ts
// CurrencyService: fetch rates from mindicador.cl, cache in IndexedDB for 24h,
// background refresh, error fallbacks, and a small pub/sub for UI updates.

export type CurrencyMap = {
  CLP: number; // base in CLP for 1 unit of each indicator
  USD?: number;
  EUR?: number;
  UF?: number;
  UTM?: number;
};

export type CurrencySnapshot = {
  rates: CurrencyMap;
  updatedAt: number; // epoch ms
};

const DB_NAME = 'finansheet';
const STORE_NAME = 'currency_rates_store';
const DB_VERSION = 1;
const CACHE_KEY = 'latest_rates';
const TTL_MS = 6 * 60 * 60 * 1000; // 6h (reduced from 24h)

// Helper to check if a snapshot is from a previous calendar day
function isDifferentDay(updatedAt: number): boolean {
  const date = new Date(updatedAt);
  const today = new Date();
  return date.getDate() !== today.getDate() ||
    date.getMonth() !== today.getMonth() ||
    date.getFullYear() !== today.getFullYear();
}

// Very small IndexedDB helper
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value as any, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Map from API indicator code to our keys
const indicatorMap: Record<string, keyof CurrencyMap> = {
  dolar: 'USD',
  euro: 'EUR',
  uf: 'UF',
  utm: 'UTM',
};

async function fetchAllFromMindicador(): Promise<CurrencySnapshot> {
  const url = 'https://mindicador.cl/api';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`mindicador.cl error ${res.status}`);
  const json = await res.json();

  // json.<indicator>.valor is the current value in CLP
  const rates: CurrencyMap = { CLP: 1 };
  for (const apiKey of Object.keys(indicatorMap)) {
    const key = indicatorMap[apiKey];
    const node = json[apiKey];
    if (node && typeof node.valor === 'number') {
      (rates as any)[key] = node.valor;
    }
  }
  // CLP baseline
  rates.CLP = 1;

  return { rates, updatedAt: Date.now() };
}

function isExpired(snap?: CurrencySnapshot): boolean {
  if (!snap) return true;
  const now = Date.now();
  // Expire if > TTL OR if it's a new calendar day
  return (now - snap.updatedAt > TTL_MS) || isDifferentDay(snap.updatedAt);
}

// Pub/Sub
type Listener = (snap: CurrencySnapshot) => void;
const listeners = new Set<Listener>();
function notify(snap: CurrencySnapshot) {
  for (const l of listeners) {
    try { l(snap); } catch { /* noop */ }
  }
}

let currentSnapshot: CurrencySnapshot | undefined;
let refreshing = false;

async function loadFromCache(): Promise<CurrencySnapshot | undefined> {
  try {
    const cached = await idbGet<CurrencySnapshot>(CACHE_KEY);
    if (cached) currentSnapshot = cached;
    return cached;
  } catch {
    return undefined;
  }
}

async function saveToCache(snap: CurrencySnapshot) {
  try {
    await idbSet(CACHE_KEY, snap);
  } catch {
    // ignore cache write errors
  }
}

async function refreshInBackground(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  try {
    const fresh = await fetchAllFromMindicador();
    currentSnapshot = fresh;
    await saveToCache(fresh);
    notify(fresh);
  } catch (e) {
    // keep old values, UI fallbacks will handle
    console.warn('CurrencyService background refresh failed', e);
  } finally {
    refreshing = false;
  }
}

export const CurrencyService = {
  // Initialize service: load cache and kick off background refresh if expired
  async init(): Promise<CurrencySnapshot> {
    const cached = await loadFromCache();
    if (!cached || isExpired(cached)) {
      // Return cached if any, but trigger background update
      refreshInBackground();
    }
    // If no cache at all, try fetch once but swallow errors
    if (!cached) {
      try {
        const fresh = await fetchAllFromMindicador();
        currentSnapshot = fresh;
        await saveToCache(fresh);
        return fresh;
      } catch {
        const fallback: CurrencySnapshot = { rates: { CLP: 1 }, updatedAt: Date.now() };
        currentSnapshot = fallback;
        return fallback;
      }
    }
    return currentSnapshot!;
  },

  getSnapshot(): CurrencySnapshot | undefined {
    return currentSnapshot;
  },

  // Force manual refresh (e.g., button). Returns latest snapshot.
  async refresh(): Promise<CurrencySnapshot> {
    await refreshInBackground();
    return currentSnapshot!;
  },

  // Subscribe to rate updates.
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    // push current immediately if available
    if (currentSnapshot) fn(currentSnapshot);
    return () => listeners.delete(fn);
  },

  // Helpers
  // Convert amountInClp (CLP) into any unit; or convert from unit to CLP.
  toUnit(amountInClp: number, unit: keyof CurrencyMap): number {
    const snap = currentSnapshot;
    const value = snap?.rates?.[unit] ?? 0; // CLP per unit
    if (!value) return 0;
    return amountInClp / value;
  },
  fromUnit(amount: number, unit: keyof CurrencyMap): number {
    const snap = currentSnapshot;
    const value = snap?.rates?.[unit] ?? 0;
    if (!value) return 0;
    return amount * value; // CLP
  },

  // Last updated label
  lastUpdated(): Date | undefined {
    return currentSnapshot ? new Date(currentSnapshot.updatedAt) : undefined;
  }
};

export default CurrencyService;
