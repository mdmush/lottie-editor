import { getAtPath, type JsonPath } from './json-path'
import { findDocNode } from './node-addressing'
import type { LottieDoc, LottiePositionProperty, ShapeItem } from '../types/lottie'

/** One editable animated property of the selected element. */
export interface PropDef {
  /** Stable key within the element (row keys, focus tracking). */
  key: string
  label: string
  /** Absolute doc path of the LottieProperty object. */
  propPath: JsonPath
  /** Number of value dimensions shown (position = 2, opacity = 1, …). */
  arity: 1 | 2 | 3
  kind: 'number' | 'percent' | 'angle' | 'px'
  min?: number
  max?: number
  step?: number
}

interface Candidate {
  key: string
  label: string
  rel: JsonPath
  arity: 1 | 2 | 3
  kind: PropDef['kind']
  min?: number
  max?: number
  step?: number
}

const OPACITY: Omit<Candidate, 'rel'> = {
  key: 'o',
  label: 'Opacity',
  arity: 1,
  kind: 'percent',
  min: 0,
  max: 100,
}

/**
 * Transform property rows relative to a transform container (`layer.ks` or a
 * `tr` shape item). Split positions expand into separate X/Y scalar rows.
 */
function transformCandidates(doc: LottieDoc, base: JsonPath): Candidate[] {
  const out: Candidate[] = [
    { key: 'a', label: 'Anchor', rel: ['a'], arity: 2, kind: 'px' },
  ]
  const p = getAtPath(doc, [...base, 'p']) as LottiePositionProperty | undefined
  if (p && p.s === true) {
    out.push(
      { key: 'px', label: 'Position X', rel: ['p', 'x'], arity: 1, kind: 'px' },
      { key: 'py', label: 'Position Y', rel: ['p', 'y'], arity: 1, kind: 'px' },
    )
  } else {
    out.push({ key: 'p', label: 'Position', rel: ['p'], arity: 2, kind: 'px' })
  }
  out.push(
    { key: 's', label: 'Scale', rel: ['s'], arity: 2, kind: 'percent', step: 1 },
    { key: 'r', label: 'Rotation', rel: ['r'], arity: 1, kind: 'angle' },
    { key: 'o', label: 'Opacity', rel: ['o'], arity: 1, kind: 'percent', min: 0, max: 100 },
  )
  return out
}

const SHAPE_CANDIDATES: Record<string, Candidate[]> = {
  tm: [
    { key: 's', label: 'Start', rel: ['s'], arity: 1, kind: 'percent', min: 0, max: 100 },
    { key: 'e', label: 'End', rel: ['e'], arity: 1, kind: 'percent', min: 0, max: 100 },
    { key: 'o', label: 'Offset', rel: ['o'], arity: 1, kind: 'angle' },
  ],
  fl: [{ ...OPACITY, rel: ['o'] }],
  gf: [{ ...OPACITY, rel: ['o'] }],
  st: [
    { key: 'w', label: 'Width', rel: ['w'], arity: 1, kind: 'px', min: 0 },
    { ...OPACITY, rel: ['o'] },
  ],
  gs: [
    { key: 'w', label: 'Width', rel: ['w'], arity: 1, kind: 'px', min: 0 },
    { ...OPACITY, rel: ['o'] },
  ],
  rc: [
    { key: 's', label: 'Size', rel: ['s'], arity: 2, kind: 'px', min: 0 },
    { key: 'p', label: 'Position', rel: ['p'], arity: 2, kind: 'px' },
    { key: 'r', label: 'Roundness', rel: ['r'], arity: 1, kind: 'px', min: 0 },
  ],
  el: [
    { key: 's', label: 'Size', rel: ['s'], arity: 2, kind: 'px', min: 0 },
    { key: 'p', label: 'Position', rel: ['p'], arity: 2, kind: 'px' },
  ],
  sr: [
    { key: 'pt', label: 'Points', rel: ['pt'], arity: 1, kind: 'number', min: 3, step: 1 },
    { key: 'or', label: 'Outer Radius', rel: ['or'], arity: 1, kind: 'px', min: 0 },
    { key: 'ir', label: 'Inner Radius', rel: ['ir'], arity: 1, kind: 'px', min: 0 },
    { key: 'os', label: 'Outer Round', rel: ['os'], arity: 1, kind: 'percent' },
    { key: 'is', label: 'Inner Round', rel: ['is'], arity: 1, kind: 'percent' },
    { key: 'r', label: 'Rotation', rel: ['r'], arity: 1, kind: 'angle' },
    { key: 'p', label: 'Position', rel: ['p'], arity: 2, kind: 'px' },
  ],
  rp: [
    { key: 'c', label: 'Copies', rel: ['c'], arity: 1, kind: 'number', min: 0, step: 1 },
    { key: 'o', label: 'Offset', rel: ['o'], arity: 1, kind: 'number' },
  ],
  rd: [{ key: 'r', label: 'Radius', rel: ['r'], arity: 1, kind: 'px', min: 0 }],
}

function materialize(doc: LottieDoc, base: JsonPath, candidates: Candidate[]): PropDef[] {
  const defs: PropDef[] = []
  for (const c of candidates) {
    const propPath = [...base, ...c.rel]
    const prop = getAtPath(doc, propPath)
    // Only offer properties that exist and look like {a?, k} objects.
    if (prop && typeof prop === 'object' && 'k' in (prop as object)) {
      defs.push({
        key: c.key,
        label: c.label,
        propPath,
        arity: c.arity,
        kind: c.kind,
        min: c.min,
        max: c.max,
        step: c.step,
      })
    }
  }
  return defs
}

/**
 * The editable property rows for the element at `nodePath`. Layers edit
 * their `ks` transform; groups edit their nested `tr` item; shape items
 * edit their own animated fields. Unsupported kinds return [] — the JSON
 * tab is the fallback surface.
 */
export function descriptorsFor(doc: LottieDoc, nodePath: JsonPath): PropDef[] {
  const node = findDocNode(doc, nodePath)
  if (!node) return []

  if (node.kind === 'layer') {
    return materialize(doc, [...nodePath, 'ks'], transformCandidates(doc, [...nodePath, 'ks']))
  }
  if (node.kind === 'tr') {
    return materialize(doc, nodePath, transformCandidates(doc, nodePath))
  }
  if (node.kind === 'gr') {
    // A group's transform lives in its `it` list as the `tr` item.
    const items = (getAtPath(doc, [...nodePath, 'it']) as ShapeItem[] | undefined) ?? []
    const trIndex = items.findIndex((it) => it?.ty === 'tr')
    if (trIndex < 0) return []
    const base = [...nodePath, 'it', trIndex]
    return materialize(doc, base, transformCandidates(doc, base))
  }
  const candidates = SHAPE_CANDIDATES[node.kind]
  return candidates ? materialize(doc, nodePath, candidates) : []
}
