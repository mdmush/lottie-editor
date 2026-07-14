import { useMemo } from 'react'
import type { HighlightTarget } from '../../lib/highlight'
import type { JsonPath } from '../../lib/json-path'
import type { LottieDoc, LottieLayer, ShapeItem } from '../../types/lottie'
import { useEditorStore } from '../../store/editor-store'
import { TreeNode, type TreeNodeData } from './TreeNode'

const LAYER_TYPE_LABELS: Record<number, string> = {
  0: 'Precomp',
  1: 'Solid',
  2: 'Image',
  3: 'Null',
  4: 'Shape',
  5: 'Text',
}

const SHAPE_TYPE_LABELS: Record<string, string> = {
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
 * Builds the child nodes for a shapes/it array. The highlight chain uses
 * *rendered* indices — the preview strips hidden shapes before handing the
 * doc to lottie-web, so hidden siblings don't count, and hidden nodes (or
 * nodes under a hidden ancestor) get no highlight target at all.
 */
function shapeChildren(
  items: ShapeItem[],
  idPrefix: string,
  basePath: JsonPath,
  parentTarget: HighlightTarget | null,
): TreeNodeData[] {
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
): TreeNodeData {
  return {
    id,
    label: shape.nm || SHAPE_TYPE_LABELS[shape.ty ?? ''] || shape.ty || 'Shape',
    badge: shape.nm ? SHAPE_TYPE_LABELS[shape.ty ?? ''] : undefined,
    children:
      shape.ty === 'gr' ? shapeChildren(shape.it ?? [], `${id}.`, [...path, 'it'], target) : [],
    // Transforms aren't hideable — hiding a group's transform isn't a
    // meaningful operation (AE shows no eye on them either).
    nodePath: shape.ty === 'tr' ? undefined : path,
    hidden: shape.hd === true,
    highlightTarget: target,
  }
}

function layerNode(
  layer: LottieLayer,
  id: string,
  doc: LottieDoc,
  depth: number,
  layerPath: JsonPath,
  layerChain: number[],
): TreeNodeData {
  const target: HighlightTarget | null =
    layer.hd === true ? null : { layers: layerChain, shapes: [] }
  const children: TreeNodeData[] = shapeChildren(
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
    label: layer.nm || `Layer`,
    badge: LAYER_TYPE_LABELS[layer.ty ?? -1] ?? 'Layer',
    children,
    nodePath: layerPath,
    hidden: layer.hd === true,
    highlightTarget: target,
  }
}

export function LayerTree() {
  const doc = useEditorStore((s) => s.doc)

  const nodes = useMemo(() => {
    if (!doc) return []
    return (doc.layers ?? []).map((layer, i) =>
      layerNode(layer, `L${i}`, doc, 0, ['layers', i], [i]),
    )
  }, [doc])

  if (nodes.length === 0) {
    return <p className="px-2 py-1 text-[13px] text-ink-400">No layers in this file.</p>
  }

  return (
    <div className="flex flex-col">
      {nodes.map((node) => (
        <TreeNode key={node.id} node={node} depth={0} />
      ))}
    </div>
  )
}
