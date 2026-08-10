import { useEffect, useState } from 'react'
import { saveNow } from '../hooks/useAutoSave'
import { useEditorStore } from '../store/editor-store'

function formatAgo(ts: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - ts) / 1000))
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(ts).toLocaleDateString()
}

/**
 * Header save indicator: "Unsaved" (amber dot) → "Saving…" → "Saved Xm ago",
 * plus a manual Save button for the impatient. Autosave (useAutoSave) does
 * the same write on a debounce.
 */
export function SaveStatus() {
  const hasDoc = useEditorStore((s) => s.doc !== null)
  const unsaved = useEditorStore((s) => s.docRevision !== s.savedRevision)
  const isSaving = useEditorStore((s) => s.isSaving)
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt)

  // Re-render every 10s so the relative "Saved Xm ago" text stays current.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(id)
  }, [])

  if (!hasDoc) return null

  return (
    <span className="flex items-center gap-2">
      <span
        role="status"
        className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-ink-400"
      >
        {isSaving ? (
          'Saving…'
        ) : unsaved ? (
          <>
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
            Unsaved changes
          </>
        ) : lastSavedAt !== null ? (
          `Saved ${formatAgo(lastSavedAt, now)}`
        ) : (
          'Saved'
        )}
      </span>
      <button
        onClick={() => void saveNow()}
        disabled={!unsaved || isSaving}
        className="h-8 rounded-lg border border-ink-700 px-3 text-[13px] font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-300"
      >
        Save
      </button>
    </span>
  )
}
