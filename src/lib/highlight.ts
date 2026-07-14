import type { AnimationItem } from 'lottie-web'

/**
 * Addresses one rendered element inside the lottie-web instance.
 *
 * `layers` is the chain of layer indices from the root composition down
 * through nested precomps. `shapes` indexes into the *rendered* shapes/it
 * arrays — i.e. after hidden shapes were stripped from the preview clone —
 * which is why the tree computes these separately from the doc paths.
 */
export interface HighlightTarget {
  layers: number[]
  shapes: number[]
}

/* lottie-web keeps `renderer.elements` parallel to the layers array (comp
 * elements nest the same way), and SVGShapeElement's `itemsData` parallel to
 * the shapes array. These are internals, so everything below is defensive —
 * any miss just means "no highlight". */
interface RendererElement {
  elements?: (RendererElement | undefined)[]
  layerElement?: SVGGraphicsElement
  itemsData?: (ShapeItemData | undefined)[]
}

interface ShapeItemData {
  /** group container element (ty 'gr') */
  gr?: SVGGraphicsElement
  it?: (ShapeItemData | undefined)[]
  /** style items (fl/st/gf/gs) render through this path element */
  style?: { pElem?: SVGGraphicsElement }
  /** geometry items (sh/rc/el/sr): shape property + per-style path caches */
  sh?: unknown
  caches?: string[]
  styles?: { pElem?: SVGGraphicsElement }[]
}

export type HighlightResolution =
  /** A node with its own DOM element — outline it directly. */
  | { kind: 'element'; el: SVGGraphicsElement }
  /**
   * A geometry item (Path/Rect/Ellipse/Polystar). It has no DOM element of
   * its own — lottie merges its path data into each style's element — but
   * `caches[0]` holds this geometry's path string in the coordinate space
   * of `stylePElem`, so a dedicated outline path can be drawn beside it.
   */
  | { kind: 'geometry'; item: { caches: string[] }; stylePElem: SVGGraphicsElement }

export function resolveHighlight(
  anim: AnimationItem,
  target: HighlightTarget,
): HighlightResolution | null {
  let comp = (anim as unknown as { renderer?: RendererElement }).renderer
  let layerEl: RendererElement | undefined
  for (const idx of target.layers) {
    layerEl = comp?.elements?.[idx]
    if (!layerEl) return null
    comp = layerEl
  }
  if (!layerEl) return null
  const asElement = (el: SVGGraphicsElement | null) => (el ? { kind: 'element' as const, el } : null)
  if (target.shapes.length === 0) return asElement(layerEl.layerElement ?? null)

  // Transforms and modifiers have no DOM element of their own — fall back
  // to the closest enclosing group.
  let fallback = layerEl.layerElement ?? null
  let items = layerEl.itemsData
  let node: ShapeItemData | undefined
  for (const idx of target.shapes) {
    node = items?.[idx]
    if (!node) return null
    if (node.gr) fallback = node.gr
    items = node.it
  }
  if (!node) return null
  if (node.gr) return asElement(node.gr)
  if (node.style?.pElem) return asElement(node.style.pElem)
  if (node.sh && Array.isArray(node.caches)) {
    const stylePElem = node.styles?.[0]?.pElem
    // Unstyled geometry draws nothing — outline the enclosing group instead.
    if (stylePElem) return { kind: 'geometry', item: node as { caches: string[] }, stylePElem }
  }
  return asElement(fallback)
}
