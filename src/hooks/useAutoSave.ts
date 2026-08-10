import { useEffect } from 'react'
import { useEditorStore } from '../store/editor-store'
import { useLibraryStore } from '../store/library-store'

/** Quiet period after the last edit before the doc is written to the library. */
const AUTOSAVE_DELAY_MS = 1200

/**
 * Persist the current edits into the open file's library record. No-op when
 * nothing is unsaved, so it's safe to call as a flush before switching or
 * closing files. The doc snapshot is captured synchronously.
 */
export function saveNow(): Promise<void> {
  const { doc, fileName, docRevision, savedRevision, markSaving } = useEditorStore.getState()
  if (!doc || !fileName || docRevision === savedRevision) return Promise.resolve()
  markSaving()
  // The store's doc is immer-frozen; clone it into a plain persistable copy.
  const snapshot = structuredClone(doc)
  return useLibraryStore
    .getState()
    .saveDoc(fileName, snapshot)
    .then(() => {
      const current = useEditorStore.getState()
      // The user may have switched files while the write was in flight.
      if (current.fileName === fileName) current.markSaved(docRevision, Date.now())
    })
}

/**
 * Debounced autosave: whenever the doc drifts from its last-saved revision,
 * wait for a quiet period and write it back to the library. Rapid edits
 * (color-picker drags) keep pushing the timer out.
 */
export function useAutoSave() {
  const hasDoc = useEditorStore((s) => s.doc !== null)
  const docRevision = useEditorStore((s) => s.docRevision)
  const savedRevision = useEditorStore((s) => s.savedRevision)

  useEffect(() => {
    if (!hasDoc || docRevision === savedRevision) return
    const timer = setTimeout(() => void saveNow(), AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [hasDoc, docRevision, savedRevision])
}
