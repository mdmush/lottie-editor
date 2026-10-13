/**
 * Structure-aware traversal of a Lottie document that finds every color
 * occurrence and can rewrite them in place (inside an immer draft).
 *
 * Colors are grouped by normalized #RRGGBB; alpha never participates in
 * grouping and is preserved verbatim on write.
 */
import type {
  GradientDef,
  LottieDoc,
  LottieKeyframe,
  LottieLayer,
  LottieProperty,
  ShapeItem,
} from '../types/lottie'
import { hexToFloats, isLegacyRange, rgbComponentsToHex } from './color-utils'
import { getAtPath, type JsonPath } from './json-path'

export type ColorRef = (
  /** path → a [r,g,b(,a)] number array */
  | { kind: 'rgbArray'; path: JsonPath }
  /** path → a flattened gradient stop array; color at [4i+1 .. 4i+3] */
  | { kind: 'gradientStop'; path: JsonPath; stopIndex: number }
  /** path → an "#rrggbb" string (solid layer `sc`) */
  | { kind: 'hexString'; path: JsonPath }
) & {
  /**
   * Path to the `o` (opacity, 0–100) property of the fill/stroke/gradient
   * shape that owns this color. Renderers ignore the alpha component of
   * color arrays — this is the property that actually controls how
   * transparent the color draws. Absent for text and solid-layer colors.
   */
  opacityPath?: JsonPath
}

export interface ColorGroup {
  hex: string
  refs: ColorRef[]
}

const isNumberArray = (v: unknown): v is number[] =>
  Array.isArray(v) && v.length >= 3 && v.every((n) => typeof n === 'number')

const isKeyframes = (k: unknown): k is LottieKeyframe[] =>
  Array.isArray(k) && k.length > 0 && typeof k[0] === 'object' && k[0] !== null

type Emit = (ref: ColorRef) => void

/** Emit wrapper that tags every ref with the owning shape's `o` path. */
function withOpacity(emit: Emit, opacityPath: JsonPath | undefined): Emit {
  if (!opacityPath) return emit
  return (ref) => emit({ ...ref, opacityPath })
}

function visitColorProperty(prop: LottieProperty | undefined, path: JsonPath, emit: Emit): void {
  if (!prop || typeof prop !== 'object') return
  const k = prop.k
  if (isKeyframes(k)) {
    k.forEach((kf, j) => {
      if (isNumberArray(kf.s)) emit({ kind: 'rgbArray', path: [...path, 'k', j, 's'] })
      // legacy end-value emitted by old Bodymovin versions
      if (isNumberArray(kf.e)) emit({ kind: 'rgbArray', path: [...path, 'k', j, 'e'] })
    })
  } else if (isNumberArray(k)) {
    emit({ kind: 'rgbArray', path: [...path, 'k'] })
  }
}

function emitGradientStops(arr: unknown, path: JsonPath, stopCount: number | undefined, emit: Emit): void {
  if (!Array.isArray(arr)) return
  // Entries past 4*p are [offset, alpha] pairs — not colors.
  const p = stopCount ?? Math.floor(arr.length / 4)
  for (let i = 0; i < p && 4 * i + 3 < arr.length; i++) {
    emit({ kind: 'gradientStop', path, stopIndex: i })
  }
}

function visitGradient(g: GradientDef | undefined, path: JsonPath, emit: Emit): void {
  if (!g || typeof g !== 'object' || !g.k) return
  const kProp = g.k
  if (isKeyframes(kProp.k)) {
    kProp.k.forEach((kf, j) => {
      if (Array.isArray(kf.s)) emitGradientStops(kf.s, [...path, 'k', 'k', j, 's'], g.p, emit)
    })
  } else if (Array.isArray(kProp.k)) {
    emitGradientStops(kProp.k, [...path, 'k', 'k'], g.p, emit)
  }
}

function walkShapes(items: ShapeItem[] | undefined, basePath: JsonPath, emit: Emit): void {
  if (!Array.isArray(items)) return
  items.forEach((item, i) => {
    if (!item || typeof item !== 'object') return
    const path = [...basePath, i]
    switch (item.ty) {
      case 'gr':
        walkShapes(item.it, [...path, 'it'], emit)
        break
      case 'fl':
      case 'st':
        visitColorProperty(item.c, [...path, 'c'], withOpacity(emit, [...path, 'o']))
        break
      case 'gf':
      case 'gs':
        visitGradient(item.g, [...path, 'g'], withOpacity(emit, [...path, 'o']))
        break
    }
  })
}

function walkLayers(layers: LottieLayer[] | undefined, basePath: JsonPath, emit: Emit): void {
  if (!Array.isArray(layers)) return
  layers.forEach((layer, i) => {
    if (!layer || typeof layer !== 'object') return
    const path = [...basePath, i]
    if (layer.ty === 1 && typeof layer.sc === 'string') {
      emit({ kind: 'hexString', path: [...path, 'sc'] })
    }
    if (layer.t) {
      layer.t.d?.k?.forEach((docKf, j) => {
        const stylePath = [...path, 't', 'd', 'k', j, 's']
        if (isNumberArray(docKf?.s?.fc)) emit({ kind: 'rgbArray', path: [...stylePath, 'fc'] })
        if (isNumberArray(docKf?.s?.sc)) emit({ kind: 'rgbArray', path: [...stylePath, 'sc'] })
      })
      layer.t.a?.forEach((animator, j) => {
        const aPath = [...path, 't', 'a', j, 'a']
        visitColorProperty(animator?.a?.fc, [...aPath, 'fc'], emit)
        visitColorProperty(animator?.a?.sc, [...aPath, 'sc'], emit)
      })
    }
    // TODO(v2): layer effects (ef[]) — Fill (ty 21) / Tint (ty 20) color values.
    walkShapes(layer.shapes, [...path, 'shapes'], emit)
  })
}

function collectRefs(doc: LottieDoc, emit: Emit): void {
  walkLayers(doc.layers, ['layers'], emit)
  doc.assets?.forEach((asset, i) => {
    walkLayers(asset?.layers, ['assets', i, 'layers'], emit)
  })
}

/** Read a ref's current color as a normalized "#RRGGBB" key, or null if unreadable. */
export function readRefHex(doc: LottieDoc, ref: ColorRef): string | null {
  const value = getAtPath(doc, ref.path)
  switch (ref.kind) {
    case 'rgbArray':
      return isNumberArray(value) ? rgbComponentsToHex(value) : null
    case 'gradientStop': {
      if (!Array.isArray(value)) return null
      const base = 4 * ref.stopIndex + 1
      const rgb = value.slice(base, base + 3)
      return isNumberArray([...rgb, 0]) && rgb.length === 3 ? rgbComponentsToHex(rgb) : null
    }
    case 'hexString':
      try {
        return typeof value === 'string' ? rgbComponentsToHex(hexToFloats(value)) : null
      } catch {
        return null
      }
  }
}

/** All unique colors in the document, each with every occurrence it maps to. */
export function extractColors(doc: LottieDoc): ColorGroup[] {
  const groups = new Map<string, ColorRef[]>()
  collectRefs(doc, (ref) => {
    const hex = readRefHex(doc, ref)
    if (!hex) return
    const refs = groups.get(hex)
    if (refs) refs.push(ref)
    else groups.set(hex, [ref])
  })
  return [...groups.entries()].map(([hex, refs]) => ({ hex, refs }))
}

/**
 * Alpha component of a 4-component rgb array. Renderers ignore it, but we
 * keep it in step with the shape opacity so the file stays self-consistent.
 */
function alphaArrayForRef(doc: LottieDoc, ref: ColorRef): number[] | null {
  if (ref.kind !== 'rgbArray') return null
  const value = getAtPath(doc, ref.path)
  return isNumberArray(value) && value.length >= 4 ? value : null
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Avoid float noise like 79.99999 in the saved JSON. */
const roundPercent = (n: number) => Math.round(n * 1000) / 1000

/**
 * Peak value of a shape's `o` property on its native 0–100 scale: the
 * static value, or the highest keyframe of an animated one so a fade's
 * fully-visible level is what the slider reports. Missing `o` means fully
 * opaque. Null when the property is unreadable (e.g. an expression).
 */
function readOpacityPercent(doc: LottieDoc, opacityPath: JsonPath): number | null {
  const prop = getAtPath(doc, opacityPath) as LottieProperty | undefined
  if (prop === undefined) return 100
  if (!prop || typeof prop !== 'object') return null
  const k = prop.k
  if (typeof k === 'number') return k
  if (isKeyframes(k)) {
    let peak: number | null = null
    for (const kf of k) {
      const v = Array.isArray(kf.s) ? kf.s[0] : kf.s
      if (typeof v === 'number') peak = peak === null ? v : Math.max(peak, v)
    }
    return peak
  }
  return null
}

/**
 * Write a shape's `o` to `percent`. Animated opacities are scaled so their
 * peak lands on `percent` and the fade keeps its shape; a flat-zero
 * animation is set outright since there is nothing to scale.
 */
function writeOpacityPercent(doc: LottieDoc, opacityPath: JsonPath, percent: number): void {
  const owner = getAtPath(doc, opacityPath.slice(0, -1))
  if (!owner || typeof owner !== 'object') return
  const key = opacityPath[opacityPath.length - 1]
  const prop = (owner as Record<string | number, unknown>)[key] as LottieProperty | undefined
  if (prop === undefined) {
    ;(owner as Record<string | number, unknown>)[key] = { a: 0, k: percent }
    return
  }
  if (!prop || typeof prop !== 'object') return
  const k = prop.k
  if (typeof k === 'number') {
    prop.k = percent
    return
  }
  if (!isKeyframes(k)) return
  const peak = readOpacityPercent(doc, opacityPath)
  const scale = peak && peak > 0 ? percent / peak : null
  const rewrite = (v: unknown): unknown => {
    if (typeof v !== 'number') return v
    return roundPercent(scale === null ? percent : v * scale)
  }
  for (const kf of k) {
    if (Array.isArray(kf.s)) kf.s[0] = rewrite(kf.s[0])
    else if (typeof kf.s === 'number') kf.s = rewrite(kf.s)
    if (Array.isArray(kf.e)) kf.e[0] = rewrite(kf.e[0])
    else if (typeof kf.e === 'number') kf.e = rewrite(kf.e)
  }
}

/** Unique `o` paths across a group — several refs (e.g. color keyframes) share one shape. */
function uniqueOpacityPaths(refs: readonly ColorRef[]): JsonPath[] {
  const seen = new Set<string>()
  const out: JsonPath[] = []
  for (const ref of refs) {
    if (!ref.opacityPath) continue
    const key = ref.opacityPath.join('\u0000')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(ref.opacityPath)
  }
  return out
}

/**
 * The group's current opacity as a 0–1 float, read from the first
 * fill/stroke/gradient shape in the group. Null when nothing in the group
 * has a shape opacity to drive (text, solid layers).
 */
export function readGroupAlpha(doc: LottieDoc, refs: readonly ColorRef[]): number | null {
  for (const opacityPath of uniqueOpacityPaths(refs)) {
    const pct = readOpacityPercent(doc, opacityPath)
    if (pct !== null) return clamp01(pct / 100)
  }
  return null
}

/**
 * Set the opacity of every fill/stroke/gradient shape in the group via its
 * `o` property, and mirror it into any 4-component color arrays so the
 * file stays self-consistent. Mutates `doc` — call on an immer draft.
 */
export function applyAlphaToRefs(doc: LottieDoc, refs: readonly ColorRef[], alpha: number): void {
  const a = clamp01(alpha)
  const percent = roundPercent(a * 100)
  for (const opacityPath of uniqueOpacityPaths(refs)) {
    writeOpacityPercent(doc, opacityPath, percent)
  }
  for (const ref of refs) {
    if (!ref.opacityPath) continue
    const arr = alphaArrayForRef(doc, ref)
    if (!arr) continue
    if (arr[3] > 1) {
      // Values ≤ 1 would flip the scale heuristic on the next read, so snap
      // sub-1% legacy alphas straight to 0.
      const byte = Math.round(a * 255)
      arr[3] = byte < 2 ? 0 : byte
    } else {
      arr[3] = a
    }
  }
}

/**
 * Rewrite every ref to `newHex`, preserving alpha components, gradient
 * offsets, and each array's native value scale. Mutates `doc` — call on an
 * immer draft.
 */
export function applyColorToRefs(doc: LottieDoc, refs: readonly ColorRef[], newHex: string): void {
  const floats = hexToFloats(newHex)
  for (const ref of refs) {
    const value = getAtPath(doc, ref.path)
    switch (ref.kind) {
      case 'rgbArray': {
        if (!isNumberArray(value)) break
        const legacy = isLegacyRange(value)
        for (let c = 0; c < 3; c++) value[c] = legacy ? Math.round(floats[c] * 255) : floats[c]
        break
      }
      case 'gradientStop': {
        if (!Array.isArray(value)) break
        const base = 4 * ref.stopIndex + 1
        if (base + 2 >= value.length) break
        const legacy = isLegacyRange(value.slice(base, base + 3) as number[])
        for (let c = 0; c < 3; c++) value[base + c] = legacy ? Math.round(floats[c] * 255) : floats[c]
        break
      }
      case 'hexString': {
        const parent = getAtPath(doc, ref.path.slice(0, -1))
        if (parent && typeof parent === 'object') {
          // Bodymovin emits lowercase hex for solid layers.
          ;(parent as Record<string | number, unknown>)[ref.path[ref.path.length - 1]] =
            newHex.toLowerCase()
        }
        break
      }
    }
  }
}
