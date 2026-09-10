import { useEffect } from 'react'
import { DropZone } from './components/DropZone'
import { ExportButton } from './components/ExportButton'
import { ExportMp4Button } from './components/ExportMp4Button'
import { ResetButton } from './components/ResetButton'
import { SaveStatus } from './components/SaveStatus'
import { ThemeToggle } from './components/ThemeToggle'
import { LibraryPanel } from './components/library/LibraryPanel'
import { Player } from './components/player/Player'
import { Sidebar } from './components/sidebar/Sidebar'
import { UndoRedoButtons } from './components/UndoRedoButtons'
import { saveNow, useAutoSave } from './hooks/useAutoSave'
import { useEditorHotkeys } from './hooks/useEditorHotkeys'
import { describeNode } from './lib/node-addressing'
import { useEditorStore } from './store/editor-store'
import { useLibraryStore } from './store/library-store'

/** Keyframe diamond on an amber tile — the mark of the app. */
function LogoMark() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" aria-hidden="true">
      <rect width="20" height="20" rx="5" className="fill-accent" />
      <path d="M10 4.8 15.2 10 10 15.2 4.8 10Z" className="fill-on-accent" />
    </svg>
  )
}

/** Amber "Editing · {element}" chip shown while an element is selected. */
function EditingPill() {
  const label = useEditorStore((s) =>
    s.doc && s.selection ? (describeNode(s.doc, s.selection.nodePath)?.label ?? null) : null,
  )
  const clearSelection = useEditorStore((s) => s.clearSelection)

  if (label === null) return null

  return (
    <span className="flex min-w-0 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 py-1 pl-3 pr-1.5 text-xs text-accent-text">
      <span className="shrink-0 font-medium">Editing</span>
      <span className="truncate font-mono text-[11px]">{label}</span>
      <button
        onClick={clearSelection}
        aria-label="Done editing"
        title="Done (Esc)"
        className="rounded-full p-1 transition-colors hover:bg-accent/20"
      >
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </span>
  )
}

export default function App() {
  const hasDoc = useEditorStore((s) => s.doc !== null)
  const fileName = useEditorStore((s) => s.fileName)
  const closeFile = useEditorStore((s) => s.closeFile)
  const hydrateLibrary = useLibraryStore((s) => s.hydrate)

  useEffect(() => {
    void hydrateLibrary()
  }, [hydrateLibrary])

  useAutoSave()
  useEditorHotkeys()

  return (
    <div className="flex h-full flex-col bg-ink-950 font-sans text-ink-100 antialiased">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-ink-800 bg-ink-900 px-4">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <h1 className="font-display text-[13px] font-semibold tracking-wide">Lottie Editor</h1>
        </div>
        {fileName && (
          <span className="flex min-w-0 items-center gap-2 rounded-full border border-ink-700 bg-ink-850 py-1 pl-3 pr-1.5 text-xs text-ink-300">
            <span className="truncate font-mono text-[11px]">{fileName}</span>
            <button
              onClick={() => {
                // Flush pending edits so nothing in the autosave window is lost.
                void saveNow()
                closeFile()
              }}
              aria-label="Close file"
              className="rounded-full p-1 text-ink-400 transition-colors hover:bg-ink-700 hover:text-ink-100"
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </span>
        )}
        <EditingPill />
        <div className="ml-auto flex items-center gap-2">
          <SaveStatus />
          <ThemeToggle />
          <UndoRedoButtons />
          <ResetButton />
          <ExportMp4Button />
          <ExportButton />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <LibraryPanel />
        {hasDoc ? (
          <>
            <main className="min-w-0 flex-1">
              <Player />
            </main>
            <Sidebar />
          </>
        ) : (
          <main className="min-h-0 min-w-0 flex-1">
            <DropZone />
          </main>
        )}
      </div>

      <footer className="flex h-8 shrink-0 items-center justify-center border-t border-ink-800 bg-ink-900 text-[11px] text-ink-400">
        <span>
          Made with <span className="text-red-500">❤︎</span> by{' '}
          <a
            href="https://mdmush.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ink-200 underline decoration-ink-600 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
          >
            Mush
          </a>
        </span>
      </footer>
    </div>
  )
}
