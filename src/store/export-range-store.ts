import { create } from 'zustand'
import type { FrameRange } from '../lib/trim'
import { useEditorStore } from './editor-store'

/**
 * Time range shared by the JSON and MP4 export popovers, so a range set for
 * one carries over to the other. Stored in player-frame space (0 = doc.ip,
 * inclusive end); `end: null` means "the last frame" until the user edits
 * it, so a shorter file loaded later still defaults to its full length.
 */
interface ExportRangeState {
  mode: 'all' | 'range'
  start: number
  end: number | null
  setMode: (mode: 'all' | 'range') => void
  setRange: (range: Partial<FrameRange>) => void
  reset: () => void
}

export const useExportRangeStore = create<ExportRangeState>()((set) => ({
  mode: 'all',
  start: 0,
  end: null,
  setMode: (mode) => set({ mode }),
  setRange: (range) => set((s) => ({ start: range.start ?? s.start, end: range.end ?? s.end })),
  reset: () => set({ mode: 'all', start: 0, end: null }),
}))

// A different file means a different timeline — start fresh.
useEditorStore.subscribe((state, prev) => {
  if (state.fileName !== prev.fileName) useExportRangeStore.getState().reset()
})
