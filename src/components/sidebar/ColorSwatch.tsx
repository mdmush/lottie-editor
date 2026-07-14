import { useEffect, useRef, useState } from 'react'
import { readGroupAlpha, type ColorGroup } from '../../lib/lottie-colors'
import { useEditorStore } from '../../store/editor-store'

export function ColorSwatch({ group }: { group: ColorGroup }) {
  const previewColor = useEditorStore((s) => s.previewColor)
  const commitColor = useEditorStore((s) => s.commitColor)
  const previewAlpha = useEditorStore((s) => s.previewAlpha)
  const commitAlpha = useEditorStore((s) => s.commitAlpha)
  const storeAlpha = useEditorStore((s) => (s.doc ? readGroupAlpha(s.doc, group.refs) : null))
  const inputRef = useRef<HTMLInputElement>(null)

  // Local value while the slider is being dragged; the store's (throttled)
  // value takes over again on release so external changes (reset) show up.
  const [dragAlpha, setDragAlpha] = useState<number | null>(null)
  const alphaPercent = dragAlpha ?? (storeAlpha !== null ? Math.round(storeAlpha * 100) : null)

  // React's onChange fires on every input while dragging (preview); the
  // native `change` event fires once when the picker is dismissed (commit).
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const onNativeChange = () => commitColor(group.hex, input.value)
    input.addEventListener('change', onNativeChange)
    return () => input.removeEventListener('change', onNativeChange)
  }, [group.hex, commitColor])

  return (
    <div className="rounded-lg px-2 py-1.5 transition-colors hover:bg-ink-800">
      <label className="flex cursor-pointer items-center gap-3">
        <span className="checkerboard-sm relative inline-block h-7 w-7 overflow-hidden rounded-md shadow-[inset_0_0_0_1px_var(--swatch-ring)] focus-within:ring-2 focus-within:ring-accent-text focus-within:ring-offset-2 focus-within:ring-offset-ink-900">
          <input
            ref={inputRef}
            type="color"
            defaultValue={group.hex.toLowerCase()}
            onChange={(e) => previewColor(group.hex, e.target.value)}
            className="absolute -inset-1 h-[calc(100%+8px)] w-[calc(100%+8px)] cursor-pointer border-0 p-0"
            style={alphaPercent !== null ? { opacity: alphaPercent / 100 } : undefined}
            aria-label={`Change color ${group.hex}`}
          />
        </span>
        <span className="font-mono text-xs uppercase text-ink-200">{group.hex}</span>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-400">
          ×{group.refs.length}
        </span>
      </label>
      {alphaPercent !== null && (
        <div className="mt-1 flex items-center gap-2 pl-10">
          <input
            type="range"
            min={0}
            max={100}
            value={alphaPercent}
            onChange={(e) => {
              const pct = Number(e.target.value)
              setDragAlpha(pct)
              previewAlpha(group.hex, pct / 100)
            }}
            onPointerUp={() => {
              if (dragAlpha !== null) commitAlpha(group.hex, dragAlpha / 100)
              setDragAlpha(null)
            }}
            onKeyUp={() => {
              if (dragAlpha !== null) commitAlpha(group.hex, dragAlpha / 100)
              setDragAlpha(null)
            }}
            className="slim-range min-w-0 flex-1 cursor-pointer"
            aria-label={`Opacity for ${group.hex}`}
          />
          <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-ink-400">
            {alphaPercent}%
          </span>
        </div>
      )}
    </div>
  )
}
