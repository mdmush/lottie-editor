import type { LottieDoc, LottieLayer, ShapeItem } from '../types/lottie'

function stripFromShapes(items: ShapeItem[] | undefined): ShapeItem[] | undefined {
  if (!Array.isArray(items)) return items
  const kept = items.filter((item) => item?.hd !== true)
  for (const item of kept) {
    if (item.ty === 'gr') item.it = stripFromShapes(item.it)
  }
  return kept
}

function stripFromLayers(layers: LottieLayer[] | undefined): void {
  layers?.forEach((layer) => {
    if (layer?.shapes) layer.shapes = stripFromShapes(layer.shapes)
  })
}

/**
 * Remove shape items flagged hidden (`hd: true`) from the document. Layers
 * keep their `hd` flag — every player honors it — but lottie-web ignores
 * `hd` on shape groups, so hidden shape items must be physically absent
 * from anything handed to a player or exported.
 *
 * Mutates and returns `doc` — call it on a clone, never on the store's
 * document (the editor needs the flags to stay toggleable).
 */
export function stripHiddenShapes(doc: LottieDoc): LottieDoc {
  stripFromLayers(doc.layers)
  doc.assets?.forEach((asset) => stripFromLayers(asset?.layers))
  return doc
}
