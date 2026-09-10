import { clampRange, docFrameCount, type FrameRange } from '../lib/trim'
import { useEditorStore } from '../store/editor-store'
import { useExportRangeStore } from '../store/export-range-store'

/**
 * The range both export popovers resolve to: the full timeline in "all"
 * mode, otherwise the stored range clamped to the open document.
 */
export function useResolvedExportRange(): { range: FrameRange; isAll: boolean; frameCount: number } {
  const doc = useEditorStore((s) => s.doc)
  const mode = useExportRangeStore((s) => s.mode)
  const start = useExportRangeStore((s) => s.start)
  const end = useExportRangeStore((s) => s.end)
  const frameCount = doc ? docFrameCount(doc) : 0
  const last = Math.max(0, frameCount - 1)
  const isAll = mode === 'all'
  const range = isAll ? { start: 0, end: last } : clampRange({ start, end: end ?? last }, frameCount)
  return { range, isAll, frameCount }
}
