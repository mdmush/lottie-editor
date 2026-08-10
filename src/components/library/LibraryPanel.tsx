import { useRef } from 'react'
import { useFileDrop } from '../../hooks/useFileDrop'
import { useEditorStore } from '../../store/editor-store'
import { useLibraryStore, type LibraryItem } from '../../store/library-store'

/** Keyframe diamond shown when a thumbnail couldn't be rendered. */
function ThumbnailFallback() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <path d="M10 4.8 15.2 10 10 15.2 4.8 10Z" className="fill-ink-500" />
    </svg>
  )
}

function LibraryRow({ item }: { item: LibraryItem }) {
  const fileName = useEditorStore((s) => s.fileName)
  const isDirty = useEditorStore((s) => s.isDirty)
  const loadFile = useEditorStore((s) => s.loadFile)
  const remove = useLibraryStore((s) => s.remove)

  const isActive = item.name === fileName
  const frames =
    typeof item.doc.op === 'number' && typeof item.doc.ip === 'number'
      ? Math.round(item.doc.op - item.doc.ip)
      : null

  const open = () => {
    if (isActive) return
    if (
      isDirty &&
      !window.confirm('Discard unsaved changes to the current animation?')
    ) {
      return
    }
    loadFile(item.doc, item.name)
  }

  return (
    <div className="group relative">
      <button
        onClick={open}
        aria-current={isActive ? 'true' : undefined}
        className={`flex w-full items-center gap-2.5 rounded-lg py-1.5 pl-2 pr-7 text-left transition-colors ${
          isActive ? 'bg-ink-850' : 'hover:bg-ink-850/60'
        }`}
      >
        <span
          className={`checkerboard-sm flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ${
            isActive ? 'ring-accent' : 'ring-ink-700'
          }`}
        >
          {item.thumbnail ? (
            <img src={item.thumbnail} alt="" className="h-full w-full object-contain" />
          ) : (
            <ThumbnailFallback />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-xs font-medium ${
              isActive ? 'text-ink-100' : 'text-ink-300'
            }`}
          >
            {item.name}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[10px] tabular-nums text-ink-400">
            {typeof item.doc.w === 'number' && typeof item.doc.h === 'number'
              ? `${item.doc.w}×${item.doc.h}`
              : '—'}
            {frames !== null && ` · ${frames}f`}
          </span>
        </span>
      </button>
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-accent"
        />
      )}
      <button
        onClick={() => remove(item.name)}
        aria-label={`Remove ${item.name} from library`}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-400 opacity-0 transition-[opacity,color,background-color] hover:bg-ink-700 hover:text-ink-100 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </div>
  )
}

/**
 * Left rail listing every Lottie loaded so far (persisted in IndexedDB).
 * Clicking an item opens its pristine copy in the editor. Hidden until the
 * first file has been loaded.
 */
export function LibraryPanel() {
  const items = useLibraryStore((s) => s.items)
  const { loadFromFile, error, isDragging, dropHandlers } = useFileDrop()
  const inputRef = useRef<HTMLInputElement>(null)

  if (items.length === 0) return null

  return (
    <aside
      onDrop={dropHandlers.onDrop}
      onDragOver={dropHandlers.onDragOver}
      onDragLeave={(e) => {
        // Ignore dragleave fired when the cursor moves onto a child row.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        dropHandlers.onDragLeave(e)
      }}
      className={`relative flex h-full w-56 shrink-0 flex-col overflow-hidden border-r border-ink-800 transition-colors duration-200 ${
        isDragging ? 'bg-ink-850' : 'bg-ink-900'
      }`}
    >
      <div className="flex items-center justify-between pl-4 pr-2 pb-2 pt-3.5">
        <h2 className="flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
          Library
          <span className="font-mono text-[10px] font-normal tabular-nums tracking-normal text-ink-500">
            {items.length}
          </span>
        </h2>
        <button
          onClick={() => inputRef.current?.click()}
          aria-label="Add a Lottie file to the library"
          title="Add file"
          className="rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-700 hover:text-ink-100"
        >
          <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M7 2.5v9M2.5 7h9" />
          </svg>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          multiple
          className="hidden"
          aria-label="Choose Lottie JSON files"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            void (async () => {
              for (const file of files) await loadFromFile(file)
            })()
            e.target.value = ''
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mx-2 mb-1 rounded-md border border-danger-border bg-danger-surface px-2 py-1.5 text-[11px] leading-snug text-danger-text">
          {error}
        </p>
      )}
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {items.map((item) => (
          <LibraryRow key={item.name} item={item} />
        ))}
      </div>
      {isDragging && (
        <div className="pointer-events-none absolute inset-1.5 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-ink-900/80">
          <p className="font-display text-xs font-semibold text-accent-text">Drop to add</p>
        </div>
      )}
    </aside>
  )
}
