import type { LottieDoc } from '../types/lottie'
import { stripHiddenShapes } from './strip-hidden'

/**
 * Serialize and download the document as a .json file. Minified output,
 * matching what Bodymovin emits; key order is preserved by JSON semantics,
 * so only edited values differ from the imported file. Shape items toggled
 * hidden in the editor are omitted entirely (players don't reliably honor
 * `hd` on shapes); hidden layers keep their `hd: true` flag instead.
 */
export function downloadLottie(doc: LottieDoc, originalFileName: string | null): void {
  const base = (originalFileName ?? 'animation.json').replace(/\.json$/i, '')
  const cleaned = stripHiddenShapes(structuredClone(doc))
  const blob = new Blob([JSON.stringify(cleaned)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = `${base}-edited.json`
    a.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
