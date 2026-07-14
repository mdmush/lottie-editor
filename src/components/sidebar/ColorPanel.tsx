import { useEditorStore } from '../../store/editor-store'
import { ColorSwatch } from './ColorSwatch'

export function ColorPanel() {
  const colorGroups = useEditorStore((s) => s.colorGroups)

  if (colorGroups.length === 0) {
    return <p className="px-2 py-1 text-[13px] text-ink-400">No editable colors in this file.</p>
  }

  return (
    <div className="flex flex-col gap-0.5">
      {colorGroups.map((group) => (
        // Key by hex: after a commit the groups rebuild and the swatch
        // remounts with its new defaultValue.
        <ColorSwatch key={group.hex} group={group} />
      ))}
    </div>
  )
}
