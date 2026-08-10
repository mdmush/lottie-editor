import type { LottieDoc } from '../types/lottie'

/**
 * Best-effort IndexedDB persistence for the library panel. Lottie files can
 * run to several MB, so localStorage is out. Every call swallows failures —
 * a broken/blocked IndexedDB degrades to a session-only library.
 */

export interface LibraryRecord {
  /** File name doubles as the record key; re-loading a name replaces it. */
  name: string
  doc: LottieDoc
  /** SVG data URL of a mid-animation frame, or null if rendering failed. */
  thumbnail: string | null
  addedAt: number
  /** Last time edits were saved into this record. Absent in pre-autosave records. */
  savedAt?: number
}

const DB_NAME = 'lottie-editor'
const STORE = 'library'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'name' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error as Error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error as Error)
    })
  } finally {
    db.close()
  }
}

export async function getAllRecords(): Promise<LibraryRecord[]> {
  try {
    return await withStore('readonly', (s) => s.getAll() as IDBRequest<LibraryRecord[]>)
  } catch {
    return []
  }
}

export async function putRecord(record: LibraryRecord): Promise<void> {
  try {
    await withStore('readwrite', (s) => s.put(record))
  } catch {
    /* session-only */
  }
}

export async function deleteRecord(name: string): Promise<void> {
  try {
    await withStore('readwrite', (s) => s.delete(name))
  } catch {
    /* session-only */
  }
}
