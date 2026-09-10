import { useEffect, type RefObject } from 'react'

/**
 * Close a popover on outside pointer-down or Escape. `locked` keeps it open
 * (used while an export is running so the progress bar can't be dismissed).
 */
export function usePopoverDismiss(
  rootRef: RefObject<HTMLElement | null>,
  open: boolean,
  locked: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!locked && !rootRef.current?.contains(e.target as Node)) onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (!locked && e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [rootRef, open, locked, onClose])
}
