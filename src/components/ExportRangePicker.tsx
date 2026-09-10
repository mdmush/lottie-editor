import { useState } from 'react'
import { useResolvedExportRange } from '../hooks/useExportRange'
import { useEditorStore } from '../store/editor-store'
import { useExportRangeStore } from '../store/export-range-store'

const fmtSeconds = (frames: number, fps: number) => `${(fps > 0 ? frames / fps : 0).toFixed(2)}s`

function FrameInput({
  value,
  min,
  max,
  onCommit,
  disabled,
  ariaLabel,
}: {
  value: number
  min: number
  max: number
  onCommit: (next: number) => void
  disabled?: boolean
  ariaLabel: string
}) {
  // null = mirror the store value; a string = mid-edit local text.
  const [text, setText] = useState<string | null>(null)
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)))

  const commit = () => {
    if (text === null) return
    const n = Number(text)
    setText(null)
    if (Number.isFinite(n) && clamp(n) !== value) onCommit(clamp(n))
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text ?? String(value)}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit()
          ;(e.target as HTMLInputElement).blur()
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const base = text !== null && Number.isFinite(Number(text)) ? Number(text) : value
          const next = clamp(base + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1))
          setText(null)
          if (next !== value) onCommit(next)
        }
      }}
      className="h-7 w-full min-w-0 rounded-md border border-ink-700 bg-ink-850 px-2 text-right font-mono text-[11px] tabular-nums text-ink-100 transition-colors hover:border-ink-600 focus:border-accent focus:outline-none disabled:opacity-40"
    />
  )
}

/** Small "jump to playhead" control beside a frame field. */
function PlayheadButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-ink-700 text-ink-400 transition-colors hover:bg-ink-800 hover:text-accent-text disabled:pointer-events-none disabled:opacity-40"
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
        <path d="M6 1 11 6 6 11 1 6Z" fill="currentColor" />
      </svg>
    </button>
  )
}

/**
 * "Entire timeline" vs "Frame range" chooser shared by the JSON and MP4
 * export popovers. Frames are shown 0-based like the player readout, with
 * a seconds summary underneath so a time-based cut is easy to sanity check.
 */
export function ExportRangePicker({ disabled }: { disabled?: boolean }) {
  const doc = useEditorStore((s) => s.doc)
  const playhead = useEditorStore((s) => s.playhead)
  const mode = useExportRangeStore((s) => s.mode)
  const setMode = useExportRangeStore((s) => s.setMode)
  const setRange = useExportRangeStore((s) => s.setRange)
  const { range, frameCount } = useResolvedExportRange()

  const fps = typeof doc?.fr === 'number' && doc.fr > 0 ? doc.fr : 30
  const last = Math.max(0, frameCount - 1)
  const ip = typeof doc?.ip === 'number' ? doc.ip : 0
  // Store playhead is in doc-frame space; the picker works in player frames.
  const playheadFrame = Math.min(last, Math.max(0, Math.round(playhead - ip)))
  const isRange = mode === 'range'
  const rangeFrames = range.end - range.start + 1

  const option = (value: 'all' | 'range', label: string) => (
    <label
      className={`flex cursor-pointer items-center gap-2.5 text-xs transition-colors ${
        mode === value ? 'text-ink-100' : 'text-ink-300 hover:text-ink-200'
      } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      <input
        type="radio"
        name="export-range"
        value={value}
        checked={mode === value}
        disabled={disabled}
        onChange={() => setMode(value)}
        className="h-3.5 w-3.5 accent-accent"
      />
      {label}
    </label>
  )

  return (
    <fieldset className="mt-3 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2.5">
      <legend className="px-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">Timeline</legend>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          {option('all', 'Entire timeline')}
          <span className="font-mono text-[11px] tabular-nums text-ink-400">
            {fmtSeconds(frameCount, fps)}
          </span>
        </div>
        {option('range', 'Frame range')}

        {isRange && (
          <div className="mt-0.5 flex flex-col gap-2 pl-6">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1.5">
              <span className="text-[11px] text-ink-400">From</span>
              <FrameInput
                value={range.start}
                min={0}
                max={range.end}
                disabled={disabled}
                ariaLabel="Start frame"
                onCommit={(start) => setRange({ start })}
              />
              <PlayheadButton
                label="Set start to playhead"
                disabled={disabled}
                onClick={() => setRange({ start: Math.min(playheadFrame, range.end) })}
              />
              <span className="text-[11px] text-ink-400">To</span>
              <FrameInput
                value={range.end}
                min={range.start}
                max={last}
                disabled={disabled}
                ariaLabel="End frame"
                onCommit={(end) => setRange({ end })}
              />
              <PlayheadButton
                label="Set end to playhead"
                disabled={disabled}
                onClick={() => setRange({ end: Math.max(playheadFrame, range.start) })}
              />
            </div>
            <p className="font-mono text-[11px] tabular-nums text-ink-400">
              {fmtSeconds(range.start, fps)} – {fmtSeconds(range.end + 1, fps)}
              <span className="text-ink-500"> · {rangeFrames} frame{rangeFrames === 1 ? '' : 's'}</span>
            </p>
          </div>
        )}
      </div>
    </fieldset>
  )
}
