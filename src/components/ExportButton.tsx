import { useRef, useState } from 'react'
import { useResolvedExportRange } from '../hooks/useExportRange'
import { usePopoverDismiss } from '../hooks/usePopoverDismiss'
import { downloadLottie } from '../lib/download'
import { useEditorStore } from '../store/editor-store'
import { ExportRangePicker } from './ExportRangePicker'

/**
 * Header button that opens a small export popover asking whether to export
 * the entire timeline or a frame range before downloading the JSON.
 */
export function ExportButton() {
  const doc = useEditorStore((s) => s.doc)
  const fileName = useEditorStore((s) => s.fileName)
  const { range, isAll } = useResolvedExportRange()

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  usePopoverDismiss(rootRef, open, false, () => setOpen(false))

  const startExport = () => {
    if (!doc) return
    downloadLottie(doc, fileName, isAll ? undefined : range)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        disabled={!doc}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-8 items-center gap-2 rounded-lg bg-accent px-3.5 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-bright disabled:opacity-40 disabled:hover:bg-accent"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
          <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
        </svg>
        Export JSON
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Export JSON"
          className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
        >
          <h2 className="font-display text-[13px] font-semibold text-ink-100">Export JSON</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            Export the whole animation, or cut it to a frame range that starts at frame 0.
          </p>

          <ExportRangePicker />

          <button
            onClick={startExport}
            className="mt-4 flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-accent px-3.5 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-bright"
          >
            {isAll ? 'Export entire timeline' : `Export frames ${range.start}–${range.end}`}
          </button>
        </div>
      )}
    </div>
  )
}
