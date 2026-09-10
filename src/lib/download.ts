import type { LottieDoc } from '../types/lottie'
import { stripHiddenShapes } from './strip-hidden'
import { docFrameCount, isFullRange, trimDoc, type FrameRange } from './trim'

/**
 * Serialize and download the document as a .json file. Minified output,
 * matching what Bodymovin emits; key order is preserved by JSON semantics,
 * so only edited values differ from the imported file. Shape items toggled
 * hidden in the editor are omitted entirely (players don't reliably honor
 * `hd` on shapes); hidden layers keep their `hd: true` flag instead.
 *
 * With a `range` that doesn't cover the whole timeline, the clip is cut to
 * those frames and rebased to start at 0.
 */
export function downloadLottie(doc: LottieDoc, originalFileName: string | null, range?: FrameRange): void {
  const cleaned = prepareForExport(doc, range)
  const blob = new Blob([JSON.stringify(cleaned)], { type: 'application/json' })
  const suffix = range && !isFullRange(range, docFrameCount(doc)) ? rangeSuffix(range) : '-edited'
  downloadBlob(blob, `${exportBaseName(originalFileName)}${suffix}.json`)
}

/** Clone the document with hidden shapes stripped and (optionally) trimmed to `range`. */
export function prepareForExport(doc: LottieDoc, range?: FrameRange): LottieDoc {
  const cleaned = stripHiddenShapes(structuredClone(doc))
  return range && !isFullRange(range, docFrameCount(doc)) ? trimDoc(cleaned, range) : cleaned
}

/** File name stem shared by all exports: original name minus its extension. */
export function exportBaseName(originalFileName: string | null): string {
  return (originalFileName ?? 'animation.json').replace(/\.json$/i, '')
}

/** `-f10-29` — appended to trimmed exports so the cut is visible in the file name. */
export function rangeSuffix(range: FrameRange): string {
  return `-f${range.start}-${range.end}`
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
