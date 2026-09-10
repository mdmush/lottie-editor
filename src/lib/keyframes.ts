import type { LottieKeyframe, LottieProperty } from '../types/lottie'

/**
 * Reading and editing animated Lottie properties.
 *
 * Values are always handled in array form — animated keyframe `s` values are
 * arrays even for scalar properties, and static scalars get wrapped on read
 * and unwrapped on write so a file keeps its native shape.
 *
 * Degrade rules (deliberate, documented — never silent corruption):
 * - Spatial position tangents (`ti`/`to`) are ignored for value display
 *   (mid-segment readouts are linear) and removed from a segment when a new
 *   keyframe splits it.
 * - Properties driven by an expression (`x` is a string) read as `null`;
 *   callers render them read-only.
 */

/** True when `k` holds a keyframe array rather than a static value. */
export function isKeyframes(k: unknown): k is LottieKeyframe[] {
  return (
    Array.isArray(k) &&
    k.length > 0 &&
    typeof k[0] === 'object' &&
    k[0] !== null &&
    't' in (k[0] as object)
  )
}

export function isAnimated(prop: LottieProperty): boolean {
  return isKeyframes(prop.k)
}

export function hasExpression(prop: LottieProperty): boolean {
  return typeof prop.x === 'string'
}

function asArray(v: unknown): number[] | null {
  if (typeof v === 'number') return Number.isFinite(v) ? [v] : null
  if (Array.isArray(v) && v.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return v.length > 0 ? [...(v as number[])] : null
  }
  return null
}

/**
 * y-value of the cubic bezier (0,0)-(x1,y1)-(x2,y2)-(1,1) at horizontal
 * position `u` — the easing curve evaluation lottie uses for keyframe
 * interpolation. Solved by bisection; exported for tests.
 */
export function cubicBezierY(u: number, x1: number, y1: number, x2: number, y2: number): number {
  if (u <= 0) return 0
  if (u >= 1) return 1
  const sample = (a: number, b: number, t: number) =>
    ((1 - 3 * b + 3 * a) * t * t + (3 * b - 6 * a) * t + 3 * a) * t
  let lo = 0
  let hi = 1
  let t = u
  for (let i = 0; i < 40; i++) {
    const x = sample(x1, x2, t)
    if (Math.abs(x - u) < 1e-6) break
    if (x < u) lo = t
    else hi = t
    t = (lo + hi) / 2
  }
  return sample(y1, y2, t)
}

/** Per-dimension easing component: arrays index by dimension, scalars apply to all. */
function easingComponent(v: number[] | number | undefined, dim: number, fallback: number): number {
  if (typeof v === 'number') return v
  if (Array.isArray(v)) {
    const c = typeof v[dim] === 'number' ? v[dim] : v[0]
    return typeof c === 'number' ? c : fallback
  }
  return fallback
}

/** Resolve a keyframe's value, falling back to the previous segment's legacy end-value. */
function keyframeValue(kfs: LottieKeyframe[], index: number): number[] | null {
  const own = asArray(kfs[index]?.s)
  if (own) return own
  // Old Bodymovin terminal keyframes are bare {t}; the value lives in the
  // previous keyframe's `e`.
  for (let i = index - 1; i >= 0; i--) {
    const end = asArray(kfs[i]?.e)
    if (end) return end
    const start = asArray(kfs[i]?.s)
    if (start) return start
  }
  return null
}

/**
 * The property's value at `frame`, in array form. Returns null for
 * expression-driven or unreadable properties.
 */
export function valueAtFrame(prop: LottieProperty, frame: number): number[] | null {
  if (hasExpression(prop)) return null
  const k = prop.k
  if (!isKeyframes(k)) return asArray(k)

  const kfs = k
  const first = kfs[0]
  if (typeof first.t === 'number' && frame <= first.t) return keyframeValue(kfs, 0)

  // Find the segment [cur, next] containing `frame`.
  let cur = 0
  for (let i = 0; i < kfs.length; i++) {
    if (typeof kfs[i].t === 'number' && (kfs[i].t as number) <= frame) cur = i
    else break
  }
  if (cur >= kfs.length - 1) return keyframeValue(kfs, kfs.length - 1)

  const kf = kfs[cur]
  const next = kfs[cur + 1]
  const start = keyframeValue(kfs, cur)
  if (!start) return null
  if (kf.h === 1) return start

  const end = asArray(next.s) ?? asArray(kf.e)
  if (!end) return start

  const t0 = kf.t as number
  const t1 = next.t as number
  if (t1 <= t0) return start
  const u = (frame - t0) / (t1 - t0)

  return start.map((sv, d) => {
    const ev = typeof end[d] === 'number' ? end[d] : end[end.length - 1]
    // Missing easing defaults to the linear-equivalent bezier.
    const ox = easingComponent(kf.o?.x, d, 1 / 3)
    const oy = easingComponent(kf.o?.y, d, 1 / 3)
    const ix = easingComponent(kf.i?.x, d, 2 / 3)
    const iy = easingComponent(kf.i?.y, d, 2 / 3)
    return sv + (ev - sv) * cubicBezierY(u, ox, oy, ix, iy)
  })
}

const defaultEasing = (dims: number) => ({
  o: { x: Array(dims).fill(1 / 3), y: Array(dims).fill(1 / 3) },
  i: { x: Array(dims).fill(2 / 3), y: Array(dims).fill(2 / 3) },
})

/** Write a static value back in the property's native shape (scalar stays scalar). */
function writeStatic(prop: LottieProperty, value: number[]) {
  prop.k = typeof prop.k === 'number' && value.length === 1 ? value[0] : [...value]
}

/**
 * Set the property's value at `frame` (rounded to an integer).
 *
 * - Static property: updates `k` in place — no keyframe is created unless
 *   `forceKeyframe` is set, which converts it to a single-keyframe animation.
 * - Animated, keyframe exactly at `frame`: overwrites its `s` (and mirrors
 *   into the previous keyframe's legacy `e` when present).
 * - Animated, between/outside keyframes: inserts a new keyframe with
 *   linear-equivalent easing; a split segment loses its spatial tangents.
 */
export function upsertKeyframeAtFrame(
  prop: LottieProperty,
  frame: number,
  value: number[],
  opts?: { forceKeyframe?: boolean },
): void {
  const t = Math.round(frame)
  if (!isKeyframes(prop.k)) {
    if (opts?.forceKeyframe) {
      prop.a = 1
      prop.k = [{ t, s: [...value] }]
    } else {
      writeStatic(prop, value)
    }
    return
  }

  const kfs = prop.k
  const exact = kfs.findIndex((kf) => typeof kf.t === 'number' && Math.round(kf.t) === t)
  if (exact >= 0) {
    kfs[exact].s = [...value]
    const prev = kfs[exact - 1]
    if (prev && prev.e !== undefined) prev.e = [...value]
    return
  }

  const insertAt = kfs.findIndex((kf) => typeof kf.t === 'number' && (kf.t as number) > t)
  const newKf: LottieKeyframe = { t, s: [...value], ...defaultEasing(value.length) }

  if (insertAt === 0) {
    kfs.unshift(newKf)
    return
  }
  if (insertAt < 0) {
    kfs.push(newKf)
    return
  }

  // Splitting the segment prev → kfs[insertAt].
  const prev = kfs[insertAt - 1]
  if (prev.ti || prev.to) {
    // Spatial curve degrades to linear across the split — documented rule.
    delete prev.ti
    delete prev.to
  }
  if (prev.e !== undefined) {
    // Legacy end-value chain: prev now ends at the new keyframe, which ends
    // at the old segment end.
    newKf.e = prev.e
    prev.e = [...value]
  }
  kfs.splice(insertAt, 0, newKf)
}

/**
 * Retime a keyframe, clamped strictly between its neighbors (integer
 * frames). Returns the applied t.
 */
export function moveKeyframeT(prop: LottieProperty, index: number, newT: number): number | null {
  if (!isKeyframes(prop.k)) return null
  const kfs = prop.k
  const kf = kfs[index]
  if (!kf || typeof kf.t !== 'number') return null
  const prev = kfs[index - 1]
  const next = kfs[index + 1]
  const min = prev && typeof prev.t === 'number' ? prev.t + 1 : -Infinity
  const max = next && typeof next.t === 'number' ? next.t - 1 : Infinity
  if (min > max) return kf.t
  const clamped = Math.min(max, Math.max(min, Math.round(newT)))
  kf.t = clamped
  return clamped
}

/**
 * Delete a keyframe. When only one keyframe remains afterwards the property
 * converts back to static, keeping the remaining value.
 */
export function deleteKeyframeAt(prop: LottieProperty, index: number): void {
  if (!isKeyframes(prop.k)) return
  const kfs = prop.k
  if (index < 0 || index >= kfs.length) return
  // The removed keyframe's segment disappears with it; the previous
  // keyframe's legacy end-value must now point at the next start.
  const prev = kfs[index - 1]
  kfs.splice(index, 1)
  if (prev && prev.e !== undefined) {
    const nextStart = kfs[index] ? asArray(kfs[index].s) : null
    if (nextStart) prev.e = nextStart
  }
  if (kfs.length === 1) {
    const remaining = keyframeValue(kfs, 0)
    if (remaining) {
      prop.a = 0
      prop.k = remaining.length === 1 ? remaining[0] : remaining
    }
  } else if (kfs.length === 0) {
    // Shouldn't happen (UI converts at 1), but never leave `k` empty.
    prop.k = 0
  }
}

/** Frames (rounded) at which the property has keyframes; [] when static. */
export function keyframeTimes(prop: LottieProperty): number[] {
  if (!isKeyframes(prop.k)) return []
  return prop.k
    .map((kf) => (typeof kf.t === 'number' ? Math.round(kf.t) : null))
    .filter((t): t is number => t !== null)
}
