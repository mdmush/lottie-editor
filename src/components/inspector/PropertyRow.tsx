import { useState } from 'react'
import { getAtPath } from '../../lib/json-path'
import { hasExpression, isAnimated, keyframeTimes, valueAtFrame } from '../../lib/keyframes'
import type { PropDef } from '../../lib/property-descriptors'
import { useEditorStore } from '../../store/editor-store'
import type { LottieProperty } from '../../types/lottie'

const fmt = (n: number) => String(Number(n.toFixed(2)))

function NumberField({
  value,
  onCommit,
  min,
  max,
  step = 1,
  disabled,
  ariaLabel,
  onFocus,
}: {
  value: number
  onCommit: (next: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  ariaLabel: string
  onFocus?: () => void
}) {
  // null = mirror the external value; a string = mid-edit local text.
  const [text, setText] = useState<string | null>(null)

  const clamp = (n: number) =>
    Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))

  const commit = () => {
    if (text === null) return
    const n = Number(text)
    setText(null)
    if (Number.isFinite(n) && clamp(n) !== value) onCommit(clamp(n))
  }

  const nudge = (dir: 1 | -1, big: boolean) => {
    const base = text !== null && Number.isFinite(Number(text)) ? Number(text) : value
    const next = clamp(base + dir * step * (big ? 10 : 1))
    setText(null)
    if (next !== value) onCommit(next)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text ?? fmt(value)}
      disabled={disabled}
      aria-label={ariaLabel}
      onFocus={onFocus}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit()
          ;(e.target as HTMLInputElement).blur()
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          nudge(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey)
        }
      }}
      className="h-7 w-full min-w-0 rounded-md border border-ink-700 bg-ink-850 px-2 text-right font-mono text-[11px] tabular-nums text-ink-100 transition-colors hover:border-ink-600 focus:border-accent focus:outline-none disabled:opacity-40"
    />
  )
}

/** Rotated-square keyframe toggle: amber when a keyframe sits at the playhead. */
function KeyframeDiamond({
  animated,
  atPlayhead,
  onClick,
  disabled,
}: {
  animated: boolean
  atPlayhead: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={atPlayhead ? 'Remove keyframe at playhead' : 'Add keyframe at playhead'}
      aria-pressed={atPlayhead}
      title={atPlayhead ? 'Remove keyframe' : 'Add keyframe at playhead'}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors hover:bg-ink-700 disabled:pointer-events-none disabled:opacity-30 ${
        atPlayhead ? 'text-accent-text' : animated ? 'text-ink-300' : 'text-ink-500'
      }`}
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
        <path
          d="M6 1 11 6 6 11 1 6Z"
          fill={atPlayhead ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    </button>
  )
}

export function PropertyRow({ def }: { def: PropDef }) {
  const prop = useEditorStore((s) =>
    s.doc ? (getAtPath(s.doc, def.propPath) as LottieProperty | undefined) : undefined,
  )
  const playhead = useEditorStore((s) => s.playhead)
  const updateProperty = useEditorStore((s) => s.updateProperty)
  const addKeyframeAtPlayhead = useEditorStore((s) => s.addKeyframeAtPlayhead)
  const removeKeyframe = useEditorStore((s) => s.removeKeyframe)
  const setFocusedProperty = useEditorStore((s) => s.setFocusedProperty)

  if (!prop || typeof prop !== 'object') return null

  const expression = hasExpression(prop)
  const animated = isAnimated(prop)
  const value = valueAtFrame(prop, playhead)
  const times = keyframeTimes(prop)
  const kfIndex = times.indexOf(playhead)

  return (
    <div className="flex items-center gap-1.5 rounded-md px-1 py-0.5">
      <span className="w-[74px] shrink-0 truncate text-[12px] text-ink-300" title={def.label}>
        {def.label}
      </span>
      <KeyframeDiamond
        animated={animated}
        atPlayhead={kfIndex >= 0}
        disabled={expression || value === null}
        onClick={() => {
          if (kfIndex >= 0) removeKeyframe(def.propPath, kfIndex)
          else addKeyframeAtPlayhead(def.propPath)
        }}
      />
      {expression || value === null ? (
        <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-ink-400">
          {expression ? 'expression' : 'unreadable'}
        </span>
      ) : (
        Array.from({ length: def.arity }, (_, d) => (
          <NumberField
            key={d}
            value={value[d] ?? value[value.length - 1] ?? 0}
            min={def.min}
            max={def.max}
            step={def.step}
            ariaLabel={`${def.label}${def.arity > 1 ? ` ${['X', 'Y', 'Z'][d]}` : ''}`}
            onFocus={() => setFocusedProperty(def.propPath)}
            onCommit={(n) => {
              const next = value.slice(0, Math.max(def.arity, value.length))
              next[d] = n
              updateProperty(def.propPath, next)
            }}
          />
        ))
      )}
    </div>
  )
}
