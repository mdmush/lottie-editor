import { create } from 'zustand'
import type { LottieDoc } from '../types/lottie'
import {
  deleteRecord,
  getAllRecords,
  putRecord,
  type LibraryRecord,
} from '../lib/library-db'
import { renderThumbnail } from '../lib/thumbnail'

export type LibraryItem = LibraryRecord

interface LibraryState {
  items: LibraryItem[]
  /** Load persisted items from IndexedDB. Called once on app mount. */
  hydrate: () => Promise<void>
  /**
   * Add a freshly loaded file (or replace the record sharing its name) and
   * persist it. `doc` is the pristine parse — edits never touch the library.
   */
  upsert: (doc: LottieDoc, name: string) => void
  remove: (name: string) => void
}

let hydrated = false

export const useLibraryStore = create<LibraryState>()((set) => ({
  items: [],

  hydrate: async () => {
    if (hydrated) return
    hydrated = true
    const records = await getAllRecords()
    if (records.length === 0) return
    records.sort((a, b) => b.addedAt - a.addedAt)
    // Files added while the read was in flight stay at the top.
    set((state) => {
      const fresh = new Set(state.items.map((i) => i.name))
      return { items: [...state.items, ...records.filter((r) => !fresh.has(r.name))] }
    })
  },

  upsert: (doc, name) => {
    const item: LibraryItem = {
      name,
      doc: structuredClone(doc),
      thumbnail: renderThumbnail(doc),
      addedAt: Date.now(),
    }
    set((state) => ({ items: [item, ...state.items.filter((i) => i.name !== name)] }))
    void putRecord(item)
  },

  remove: (name) => {
    set((state) => ({ items: state.items.filter((i) => i.name !== name) }))
    void deleteRecord(name)
  },
}))
