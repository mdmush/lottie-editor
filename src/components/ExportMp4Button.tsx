import { useEffect, useRef, useState } from 'react'
import { useResolvedExportRange } from '../hooks/useExportRange'
import { usePopoverDismiss } from '../hooks/usePopoverDismiss'
import { downloadBlob, exportBaseName, rangeSuffix } from '../lib/download'
import { canExportMp4, detectTransparency, exportMp4 } from '../lib/export-mp4'
import { useEditorStore } from '../store/editor-store'
import { ExportRangePicker } from './ExportRangePicker'

/**
 * Header button that opens a small export popover. MP4 has no alpha channel,
 * so the popover always offers a background color; when the animation is
 * detected to have transparent regions it says so explicitly. It also asks
 * whether to render the entire timeline or only a frame range.
 */
export function ExportMp4Button() {
  const doc = useEditorStore((s) => s.doc)
  const docRevision = useEditorStore((s) => s.docRevision)
  const fileName = useEditorStore((s) => s.fileName)
  const { range, isAll } = useResolvedExportRange()

  const [open, setOpen] = useState(false)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [isTransparent, setIsTransparent] = useState<boolean | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const exporting = progress !== null

  // Close on outside click / Escape (but never mid-export).
  usePopoverDismiss(rootRef, open, exporting, () => setOpen(false))

  // Check for transparent pixels whenever the popover opens on a fresh doc.
  useEffect(() => {
    if (!open || !doc) return
    let cancelled = false
    setIsTransparent(null)
    detectTransparency(doc)
      .then((result) => {
        if (!cancelled) setIsTransparent(result)
      })
      .catch(() => {
        if (!cancelled) setIsTransparent(true)
      })
    return () => {
      cancelled = true
    }
  }, [open, doc, docRevision])

  const startExport = async () => {
    if (!doc || exporting) return
    setError(null)
    setProgress(0)
    try {
      const blob = await exportMp4(doc, {
        backgroundColor: bgColor,
        range: isAll ? undefined : range,
        onProgress: setProgress,
      })
      downloadBlob(blob, `${exportBaseName(fileName)}${isAll ? '' : rangeSuffix(range)}.mp4`)
      setProgress(null)
      setOpen(false)
    } catch (e) {
      setProgress(null)
      setError(e instanceof Error ? e.message : 'Export failed.')
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        disabled={!doc}
        onClick={() => {
          setError(null)
          setOpen((v) => !v)
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-8 items-center gap-2 rounded-lg border border-ink-700 px-3 text-[13px] font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-300"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M4 3.5A1.5 1.5 0 0 0 2.5 5v10A1.5 1.5 0 0 0 4 16.5h12a1.5 1.5 0 0 0 1.5-1.5V5A1.5 1.5 0 0 0 16 3.5H4ZM4 5h1.5v1.5H4V5Zm10.5 0H16v1.5h-1.5V5ZM4 8.25h1.5v1.5H4v-1.5Zm10.5 0H16v1.5h-1.5v-1.5ZM4 11.5h1.5V13H4v-1.5Zm10.5 0H16V13h-1.5v-1.5ZM4 14h1.5v1H4v-1Zm10.5 0H16v1h-1.5v-1ZM8.75 7.4c0-.58.63-.94 1.13-.65l3.45 2a.75.75 0 0 1 0 1.3l-3.45 2a.75.75 0 0 1-1.13-.65V7.4Z"
            clipRule="evenodd"
          />
        </svg>
        Export MP4
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Export MP4"
          className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
        >
          <h2 className="font-display text-[13px] font-semibold text-ink-100">Export MP4</h2>

          {isTransparent !== false && (
            <p className="mt-2 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2 text-xs leading-relaxed text-ink-300">
              {isTransparent === null ? (
                'Checking background transparency…'
              ) : (
                <>
                  <span className="font-medium text-accent-text">Transparent background detected.</span>{' '}
                  MP4 can’t store transparency — the color below fills it.
                </>
              )}
            </p>
          )}

          <ExportRangePicker disabled={exporting} />

          <label className="mt-3 flex cursor-pointer items-center gap-3">
            <span className="text-xs text-ink-300">Background</span>
            <span className="checkerboard-sm relative ml-auto inline-block h-7 w-7 overflow-hidden rounded-md shadow-[inset_0_0_0_1px_var(--swatch-ring)] focus-within:ring-2 focus-within:ring-accent-text focus-within:ring-offset-2 focus-within:ring-offset-ink-900">
              <input
                type="color"
                value={bgColor}
                disabled={exporting}
                onChange={(e) => setBgColor(e.target.value)}
                className="absolute -inset-1 h-[calc(100%+8px)] w-[calc(100%+8px)] cursor-pointer border-0 p-0"
                aria-label="Video background color"
              />
            </span>
            <span className="font-mono text-xs uppercase text-ink-200">{bgColor}</span>
          </label>

          {error && (
            <p className="mt-3 rounded-lg border border-danger-border bg-danger-surface px-2.5 py-2 text-xs leading-relaxed text-danger-text">
              {error}
            </p>
          )}

          {!canExportMp4() ? (
            <p className="mt-3 text-xs leading-relaxed text-ink-400">
              MP4 export needs a browser with WebCodecs (Chrome, Edge, or Safari 16.4+).
            </p>
          ) : (
            <button
              onClick={startExport}
              disabled={exporting}
              className="mt-4 flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-accent px-3.5 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-bright disabled:opacity-60 disabled:hover:bg-accent"
            >
              {exporting ? (
                <span className="font-mono text-xs tabular-nums">{Math.round((progress ?? 0) * 100)}%</span>
              ) : isAll ? (
                'Export entire timeline'
              ) : (
                `Export frames ${range.start}–${range.end}`
              )}
            </button>
          )}

          {exporting && (
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-ink-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress ?? 0) * 100)}>
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-150"
                style={{ width: `${(progress ?? 0) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
