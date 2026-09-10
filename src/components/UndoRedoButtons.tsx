import { useEditorStore } from '../store/editor-store'

/** Undo/redo arrows for the header; disabled states mirror the history stacks. */
export function UndoRedoButtons() {
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const hasDoc = useEditorStore((s) => s.doc !== null)

  if (!hasDoc) return null

  const cls =
    'flex h-8 w-8 items-center justify-center rounded-lg border border-ink-700 text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:pointer-events-none disabled:opacity-40'

  return (
    <div className="flex items-center gap-1">
      <button onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (⌘Z)" className={cls}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6.5 3.5 3 7l3.5 3.5" />
          <path d="M3 7h6a4 4 0 0 1 4 4v1.5" />
        </svg>
      </button>
      <button onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (⇧⌘Z)" className={cls}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9.5 3.5 13 7l-3.5 3.5" />
          <path d="M13 7H7a4 4 0 0 0-4 4v1.5" />
        </svg>
      </button>
    </div>
  )
}
