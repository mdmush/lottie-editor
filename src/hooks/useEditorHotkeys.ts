import { useEffect } from 'react'
import { useEditorStore } from '../store/editor-store'

function isTextTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

/**
 * Editor-mode shortcuts: Esc deselects, Cmd/Ctrl+Z undoes, Shift+Cmd/Ctrl+Z
 * redoes. Playback keys (Space, arrows) stay in Player.tsx.
 */
export function useEditorHotkeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const store = useEditorStore.getState()
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        // Inside a text field the browser's own text undo should win.
        if (isTextTarget(e.target)) return
        e.preventDefault()
        if (e.shiftKey) store.redo()
        else store.undo()
      } else if (e.key === 'Escape') {
        if (isTextTarget(e.target)) {
          ;(e.target as HTMLElement).blur()
          return
        }
        if (store.selectedKeyframe) store.setSelectedKeyframe(null)
        else if (store.selection) store.clearSelection()
      } else if (e.key.toLowerCase() === 'k' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (isTextTarget(e.target)) return
        if (store.focusedProperty) {
          e.preventDefault()
          store.addKeyframeAtPlayhead(store.focusedProperty)
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isTextTarget(e.target)) return
        if (store.selectedKeyframe) {
          e.preventDefault()
          store.removeKeyframe(store.selectedKeyframe.propPath, store.selectedKeyframe.index)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
