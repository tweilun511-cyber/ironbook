import type { AppData } from '../types';

/**
 * Storage boundary. The app only talks to a Repository, so a cloud-backed
 * implementation (e.g. Supabase/Firebase with auth) can replace or wrap the
 * local one later without touching UI code. Records carry ids, updatedAt and
 * tombstones (AppData.deleted) so a sync layer can merge per record.
 */
export interface Repository {
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
  /** Synchronous best-effort save for page unload. */
  saveNow?(data: AppData): void;
  describe(): string;
}

interface Envelope { savedAt: number; data: AppData }

const DB_NAME = 'ironbook';
const STORE = 'kv';
const KEY = 'appdata';
const LS_KEY = 'ironbook.appdata.v1';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** IndexedDB primary + localStorage mirror. Load picks whichever is newer. */
export class LocalRepository implements Repository {
  private dbp: Promise<IDBDatabase> | null = null;
  idbOk = false;
  lsOk = false;

  private db() {
    if (!this.dbp) this.dbp = openDb();
    return this.dbp;
  }

  async load(): Promise<AppData | null> {
    let idb: Envelope | null = null;
    let ls: Envelope | null = null;
    try {
      const db = await this.db();
      idb = await new Promise<Envelope | null>((res, rej) => {
        const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
        r.onsuccess = () => res((r.result as Envelope) ?? null);
        r.onerror = () => rej(r.error);
      });
      this.idbOk = true;
    } catch { /* IndexedDB unavailable */ }
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) ls = JSON.parse(raw) as Envelope;
      this.lsOk = true;
    } catch { /* localStorage unavailable */ }
    const best = [idb, ls].filter(Boolean).sort((a, b) => b!.savedAt - a!.savedAt)[0];
    return best ? best.data : null;
  }

  async save(data: AppData): Promise<void> {
    const env: Envelope = { savedAt: Date.now(), data };
    this.saveLs(env);
    try {
      const db = await this.db();
      await new Promise<void>((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(env, KEY);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      this.idbOk = true;
    } catch {
      this.idbOk = false;
    }
  }

  saveNow(data: AppData) {
    this.saveLs({ savedAt: Date.now(), data });
  }

  private saveLs(env: Envelope) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(env));
      this.lsOk = true;
    } catch {
      this.lsOk = false;
    }
  }

  describe() {
    const parts = [];
    if (this.idbOk) parts.push('IndexedDB');
    if (this.lsOk) parts.push('localStorage backup');
    return parts.length ? parts.join(' + ') : 'Memory only (storage blocked)';
  }
}

export const repo = new LocalRepository();

export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted?.()) return true;
      return await navigator.storage.persist();
    }
  } catch { /* ignore */ }
  return null;
}
