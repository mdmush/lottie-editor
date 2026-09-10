import type { HighlightTarget } from './highlight'
import type { JsonPath } from './json-path'
import type { LottieDoc, LottieLayer, ShapeItem } from '../types/lottie'

export const LAYER_TYPE_LABELS: Record<number, string> = {
  0: 'Precomp',
  1: 'Solid',
  2: 'Image',
  3: 'Null',
  4: 'Shape',
  5: 'Text',
}

export const SHAPE_TYPE_LABELS: Record<string, string> = {
  gr: 'Group',
  fl: 'Fill',
  st: 'Stroke',
  gf: 'Gradient Fill',
  gs: 'Gradient Stroke',
  sh: 'Path',
  rc: 'Rectangle',
  el: 'Ellipse',
  sr: 'Polystar',
  tr: 'Transform',
  tm: 'Trim Paths',
  rp: 'Repeater',
  rd: 'Round Corners',
  mm: 'Merge Paths',
}

/**
 * One addressable node in the document: a layer (possibly inside a precomp
 * asset) or a shape item. Carries both addressing schemes side by side —
 * `path` in doc coordinates for mutation, `target` in *rendered* indices
 * for looking up the live SVG element (hidden shape siblings are stripped
 * before rendering, so the two diverge).
 */
export interface DocNode {
  id: string
  /** 'layer' for layers; the shape item's `ty` ('gr', 'fl', 'tm', …) otherwise. */
  kind: string
  label: string
  badge?: string
  path: JsonPath
  /** Rendered-index address; null when this node or an ancestor is hidden. */
  target: HighlightTarget | null
  hidden: boolean
  /** Whether the eye toggle applies (transforms aren't hideable). */
  hideable: boolean
  children: DocNode[]
}

/**
 * The highlight chain uses *rendered* indices — the preview strips hidden
 * shapes before handing the doc to lottie-web, so hidden siblings don't
 * count, and hidden nodes (or nodes under a hidden ancestor) get no
 * highlight target at all.
 */
function shapeChildren(
  items: ShapeItem[],
  idPrefix: string,
  basePath: JsonPath,
  parentTarget: HighlightTarget | null,
): DocNode[] {
  let renderIndex = 0
  return items.map((item, i) => {
    const visible = item?.hd !== true
    const target =
      parentTarget && visible
        ? { layers: parentTarget.layers, shapes: [...parentTarget.shapes, renderIndex] }
        : null
    if (visible) renderIndex++
    return shapeNode(item, `${idPrefix}${i}`, [...basePath, i], target)
  })
}

function shapeNode(
  shape: ShapeItem,
  id: string,
  path: JsonPath,
  target: HighlightTarget | null,
): DocNode {
  return {
    id,
    kind: shape.ty ?? 'shape',
    label: shape.nm || SHAPE_TYPE_LABELS[shape.ty ?? ''] || shape.ty || 'Shape',
    badge: shape.nm ? SHAPE_TYPE_LABELS[shape.ty ?? ''] : undefined,
    children:
      shape.ty === 'gr' ? shapeChildren(shape.it ?? [], `${id}.`, [...path, 'it'], target) : [],
    path,
    // Transforms aren't hideable — hiding a group's transform isn't a
    // meaningful operation (AE shows no eye on them either).
    hideable: shape.ty !== 'tr',
    hidden: shape.hd === true,
    target,
  }
}

function layerNode(
  layer: LottieLayer,
  id: string,
  doc: LottieDoc,
  depth: number,
  layerPath: JsonPath,
  layerChain: number[],
): DocNode {
  const target: HighlightTarget | null =
    layer.hd === true ? null : { layers: layerChain, shapes: [] }
  const children: DocNode[] = shapeChildren(
    layer.shapes ?? [],
    `${id}.s`,
    [...layerPath, 'shapes'],
    target,
  )

  // Precomp layers expand into their referenced asset's layers (depth-capped
  // to guard against circular refIds in malformed files).
  if (layer.ty === 0 && layer.refId && depth < 16) {
    const assetIndex = doc.assets?.findIndex((a) => a.id === layer.refId) ?? -1
    if (assetIndex >= 0) {
      doc.assets![assetIndex].layers?.forEach((l, i) =>
        children.push(
          layerNode(l, `${id}.a${i}`, doc, depth + 1, ['assets', assetIndex, 'layers', i], [
            ...layerChain,
            i,
          ]),
        ),
      )
    }
  }

  return {
    id,
    kind: 'layer',
    label: layer.nm || `Layer`,
    badge: LAYER_TYPE_LABELS[layer.ty ?? -1] ?? 'Layer',
    children,
    path: layerPath,
    hideable: true,
    hidden: layer.hd === true,
    target,
  }
}

export function buildDocTree(doc: LottieDoc): DocNode[] {
  return (doc.layers ?? []).map((layer, i) => layerNode(layer, `L${i}`, doc, 0, ['layers', i], [i]))
}

export function pathsEqual(a: JsonPath, b: JsonPath): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i])
}

/** DFS lookup of a node by its doc path. O(doc size) — fine at click/render frequency. */
export function findDocNode(doc: LottieDoc, path: JsonPath): DocNode | null {
  const stack = buildDocTree(doc)
  while (stack.length > 0) {
    const node = stack.pop()!
    if (pathsEqual(node.path, path)) return node
    stack.push(...node.children)
  }
  return null
}

/**
 * Doc path → rendered-index address for the live SVG lookup. Must be
 * re-derived (never stored) — rendered indices shift whenever visibility
 * changes or the doc is undone.
 */
export function docPathToRenderedTarget(doc: LottieDoc, path: JsonPath): HighlightTarget | null {
  return findDocNode(doc, path)?.target ?? null
}

export function describeNode(
  doc: LottieDoc,
  path: JsonPath,
): { kind: string; label: string; badge?: string } | null {
  const node = findDocNode(doc, path)
  return node ? { kind: node.kind, label: node.label, badge: node.badge } : null
}
