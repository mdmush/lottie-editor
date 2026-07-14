import { useEditorStore } from '../store/editor-store'

export function ResetButton() {
  const isDirty = useEditorStore((s) => s.isDirty)
  const resetDoc = useEditorStore((s) => s.resetDoc)

  return (
    <button
      onClick={() => {
        if (window.confirm('Discard all edits and restore the original file?')) resetDoc()
      }}
      disabled={!isDirty}
      className="h-8 rounded-lg border border-ink-700 px-3 text-[13px] font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-300"
    >
      Reset
    </button>
  )
}
