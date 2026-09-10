import { useEffect, useState } from 'react'
import { getAtPath } from '../../lib/json-path'
import { useEditorStore } from '../../store/editor-store'

/**
 * Raw JSON editor for the selected element's subtree. Mount keyed by the
 * selection path — a selection switch remounts and discards local edits.
 */
export function JsonView() {
  const node = useEditorStore((s) =>
    s.doc && s.selection ? getAtPath(s.doc, s.selection.nodePath) : undefined,
  )
  const selection = useEditorStore((s) => s.selection)
  const applyJsonEdit = useEditorStore((s) => s.applyJsonEdit)

  const [text, setText] = useState('')
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serialized = node !== undefined ? JSON.stringify(node, null, 2) : ''

  // Track outside edits (undo, canvas drags) unless the user is mid-edit.
  useEffect(() => {
    if (!dirty) setText(serialized)
  }, [serialized, dirty])

  if (!selection || node === undefined) return null

  const apply = () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON')
      return
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError('The element must be a JSON object.')
      return
    }
    const currentTy = (node as { ty?: unknown }).ty
    const nextTy = (parsed as { ty?: unknown }).ty
    if (currentTy !== undefined && nextTy !== currentTy) {
      setError(`"ty" must stay ${JSON.stringify(currentTy)} — changing the element type breaks its addressing.`)
      return
    }
    if (!applyJsonEdit(selection.nodePath, parsed)) {
      setError('This element no longer exists in the document.')
      return
    }
    setDirty(false)
    setError(null)
  }

  const revert = () => {
    setText(serialized)
    setDirty(false)
    setError(null)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <textarea
        value={text}
        spellCheck={false}
        aria-label="Element JSON"
        onChange={(e) => {
          setText(e.target.value)
          setDirty(true)
          setError(null)
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            apply()
          }
        }}
        className="min-h-0 flex-1 resize-none rounded-lg border border-ink-700 bg-ink-950 p-2.5 font-mono text-[11px] leading-relaxed text-ink-200 focus:border-accent focus:outline-none"
      />
      {error && (
        <p role="alert" className="rounded-md border border-danger-border bg-danger-surface px-2.5 py-1.5 text-[11px] leading-snug text-danger-text">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={apply}
          disabled={!dirty}
          className="h-8 rounded-lg bg-accent px-3.5 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-bright disabled:pointer-events-none disabled:opacity-40"
        >
          Apply
        </button>
        <button
          onClick={revert}
          disabled={!dirty}
          className="h-8 rounded-lg border border-ink-700 px-3 text-[13px] font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:pointer-events-none disabled:opacity-40"
        >
          Revert
        </button>
        <span className="ml-auto hidden items-center gap-1 text-[11px] text-ink-400 sm:flex">
          <kbd>⌘</kbd>
          <kbd>↵</kbd> apply
        </span>
      </div>
    </div>
  )
}
