import { useMemo, useRef } from 'react'
import { getAtPath } from '../../lib/json-path'
import { hasExpression, isAnimated, keyframeTimes, valueAtFrame } from '../../lib/keyframes'
import { playerHandle } from '../../lib/player-handle'
import { descriptorsFor, type PropDef } from '../../lib/property-descriptors'
import { useEditorStore } from '../../store/editor-store'
import type { LottieProperty } from '../../types/lottie'

const LABEL_COL = 'w-36'

interface FrameRange {
  ip: number
  op: number
}

const pctOf = (t: number, range: FrameRange) =>
  Math.min(100, Math.max(0, ((t - range.ip) / Math.max(1, range.op - range.ip)) * 100))

function frameFromPointer(e: { clientX: number }, el: HTMLElement, range: FrameRange): number {
  const rect = el.getBoundingClientRect()
  const u = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0
  const frame = Math.round(range.ip + u * (range.op - range.ip))
  return Math.min(range.op, Math.max(range.ip, frame))
}

function TrackRow({ def, range }: { def: PropDef; range: FrameRange }) {
  const prop = useEditorStore((s) =>
    s.doc ? (getAtPath(s.doc, def.propPath) as LottieProperty | undefined) : undefined,
  )
  const playhead = useEditorStore((s) => s.playhead)
  const selectedKeyframe = useEditorStore((s) => s.selectedKeyframe)
  const setSelectedKeyframe = useEditorStore((s) => s.setSelectedKeyframe)
  const setFocusedProperty = useEditorStore((s) => s.setFocusedProperty)
  const previewMoveKeyframe = useEditorStore((s) => s.previewMoveKeyframe)
  const commitMoveKeyframe = useEditorStore((s) => s.commitMoveKeyframe)

  const trackRef = useRef<HTMLDivElement>(null)
  // Set while a diamond is being dragged; suppresses the row-seek behavior.
  const dragRef = useRef<{ index: number; lastT: number; moved: boolean } | null>(null)

  if (!prop || typeof prop !== 'object') return null

  const expression = hasExpression(prop)
  const animated = isAnimated(prop)
  const times = keyframeTimes(prop)
  const value = valueAtFrame(prop, playhead)
  const propKey = def.propPath.join('/')
  const isRowSelected = selectedKeyframe?.propPath.join('/') === propKey

  return (
    <div className="group/track flex h-8 items-stretch border-b border-ink-800/60 last:border-b-0">
      <div
        className={`${LABEL_COL} flex shrink-0 items-center gap-2 overflow-hidden pl-3 pr-2`}
      >
        <span className="min-w-0 truncate text-[11px] text-ink-300" title={def.label}>
          {def.label}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-ink-500">
          {expression ? 'expr' : (value?.slice(0, def.arity).map((n) => Number(n.toFixed(1))).join(', ') ?? '—')}
        </span>
      </div>
      <div
        ref={trackRef}
        className="relative min-w-0 flex-1 cursor-pointer border-l border-ink-800"
        onPointerDown={(e) => {
          // Background press seeks (diamonds stop propagation).
          setFocusedProperty(def.propPath)
          const track = trackRef.current
          if (!track) return
          playerHandle.current?.seek(frameFromPointer(e, track, range) - range.ip)
        }}
        role="presentation"
      >
        {!animated && !expression && (
          <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[10px] text-ink-600">
            static
          </span>
        )}
        {times.map((t, index) => {
          const isSelected = isRowSelected && selectedKeyframe?.index === index
          return (
            <button
              key={`${index}-${t}`}
              aria-label={`${def.label} keyframe at frame ${t}`}
              title={`f ${t}`}
              className="absolute top-1/2 z-10 -ml-2 -mt-2 flex h-4 w-4 items-center justify-center"
              style={{ left: `${pctOf(t, range)}%` }}
              onPointerDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
                ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
                dragRef.current = { index, lastT: t, moved: false }
                setFocusedProperty(def.propPath)
              }}
              onPointerMove={(e) => {
                const drag = dragRef.current
                const track = trackRef.current
                if (!drag || !track || e.buttons === 0) return
                const frame = frameFromPointer(e, track, range)
                if (frame !== drag.lastT) {
                  drag.moved = true
                  drag.lastT = frame
                  previewMoveKeyframe(def.propPath, drag.index, frame)
                }
              }}
              onPointerUp={(e) => {
                const drag = dragRef.current
                dragRef.current = null
                if (!drag) return
                ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
                if (drag.moved) {
                  commitMoveKeyframe(def.propPath, drag.index, drag.lastT)
                } else {
                  setSelectedKeyframe(
                    isSelected ? null : { propPath: def.propPath, index: drag.index },
                  )
                }
              }}
            >
              <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true">
                <path
                  d="M5 0.8 9.2 5 5 9.2 0.8 5Z"
                  className={
                    isSelected
                      ? 'fill-accent stroke-accent-bright'
                      : 'fill-ink-300 stroke-ink-100/40 hover:fill-accent'
                  }
                  strokeWidth="1"
                />
              </svg>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Editor-mode timeline dock: one row per editable property of the selected
 * element, with draggable keyframe diamonds and a shared playhead line.
 */
export function TrackPanel() {
  const doc = useEditorStore((s) => s.doc)
  const selection = useEditorStore((s) => s.selection)
  const playhead = useEditorStore((s) => s.playhead)

  const defs = useMemo(
    () => (doc && selection ? descriptorsFor(doc, selection.nodePath) : []),
    [doc, selection],
  )

  if (!doc || !selection) return null

  const range: FrameRange = {
    ip: typeof doc.ip === 'number' ? doc.ip : 0,
    op: typeof doc.op === 'number' ? doc.op : 60,
  }

  return (
    <div className="max-h-44 shrink-0 overflow-y-auto border-t border-ink-800 bg-ink-900">
      <div className="relative">
        {/* Header: frame range + hints */}
        <div className="flex h-7 items-center border-b border-ink-800 bg-ink-900/95">
          <div className={`${LABEL_COL} flex shrink-0 items-center gap-2 pl-3 pr-2`}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
              Tracks
            </span>
          </div>
          <div className="relative min-w-0 flex-1 self-stretch border-l border-ink-800">
            <div aria-hidden="true" className="ruler-ticks absolute inset-x-0 bottom-0 h-3 opacity-50" />
            <span className="absolute left-1 top-0.5 font-mono text-[9px] tabular-nums text-ink-500">
              {range.ip}
            </span>
            <span className="absolute right-1 top-0.5 font-mono text-[9px] tabular-nums text-ink-500">
              {range.op}
            </span>
          </div>
        </div>

        {defs.length === 0 ? (
          <p className="px-3 py-2 text-[11px] text-ink-400">
            No animatable properties for this element.
          </p>
        ) : (
          defs.map((def) => <TrackRow key={def.key} def={def} range={range} />)
        )}

        {/* Shared playhead line across the track column. */}
        <div className="pointer-events-none absolute inset-y-0 left-36 right-0 border-l border-ink-800/0">
          <div
            className="absolute inset-y-0 w-px bg-accent/80"
            style={{ left: `${pctOf(playhead, range)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
