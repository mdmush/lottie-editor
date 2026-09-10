import { useMemo } from 'react'
import { descriptorsFor } from '../../lib/property-descriptors'
import { useEditorStore } from '../../store/editor-store'
import { PropertyRow } from './PropertyRow'

/** Structured property editor for the selected element. */
export function Inspector() {
  const doc = useEditorStore((s) => s.doc)
  const selection = useEditorStore((s) => s.selection)

  const defs = useMemo(
    () => (doc && selection ? descriptorsFor(doc, selection.nodePath) : []),
    [doc, selection],
  )

  if (!doc || !selection) return null

  if (defs.length === 0) {
    return (
      <p className="px-2 py-2 text-[12px] leading-relaxed text-ink-400">
        No structured properties for this element — edit it in the JSON tab.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {defs.map((def) => (
        <PropertyRow key={def.key} def={def} />
      ))}
    </div>
  )
}
