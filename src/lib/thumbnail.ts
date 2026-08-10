import lottie from 'lottie-web'
import type { LottieDoc } from '../types/lottie'

/** Skip storing pathological thumbnails (very complex artwork). */
const MAX_THUMBNAIL_BYTES = 800_000

/**
 * Renders a single mid-animation frame to an SVG data URL for library
 * thumbnails. Uses a detached container — the SVG renderer doesn't need
 * layout. Returns null if anything goes wrong; callers show a placeholder.
 */
export function renderThumbnail(doc: LottieDoc): string | null {
  const container = document.createElement('div')
  try {
    const anim = lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      // lottie-web mutates animationData while parsing — always clone.
      animationData: structuredClone(doc),
    })
    try {
      // ~1/3 in: past intro emptiness, before outro emptiness.
      anim.goToAndStop(Math.floor(anim.totalFrames / 3), true)
      const svg = container.querySelector('svg')
      if (!svg) return null
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
      svg.removeAttribute('width')
      svg.removeAttribute('height')
      const markup = new XMLSerializer().serializeToString(svg)
      if (markup.length > MAX_THUMBNAIL_BYTES) return null
      return `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`
    } finally {
      anim.destroy()
    }
  } catch {
    return null
  }
}
