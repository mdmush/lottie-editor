/**
 * Pure 2D matrix/point helpers for the canvas selection overlay. Works on a
 * structural `Mat2D` (which `DOMMatrix` satisfies) so everything is unit
 * testable without a DOM.
 */

export interface Pt {
  x: number
  y: number
}

/** Row-major 2D affine matrix, matching DOMMatrix's a–f layout. */
export interface Mat2D {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

/** Project a point through the full affine matrix. */
export function applyMatrix(m: Mat2D, p: Pt): Pt {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }
}

/** Apply only the linear part (rotation/scale/skew) — for direction vectors and deltas. */
export function applyLinear(m: Mat2D, v: Pt): Pt {
  return { x: m.a * v.x + m.c * v.y, y: m.b * v.x + m.d * v.y }
}

/** Invert an affine matrix; null when singular (degenerate transform). */
export function invertMatrix(m: Mat2D): Mat2D | null {
  const det = m.a * m.d - m.b * m.c
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null
  const a = m.d / det
  const b = -m.b / det
  const c = -m.c / det
  const d = m.a / det
  return {
    a,
    b,
    c,
    d,
    e: -(a * m.e + c * m.f),
    f: -(b * m.e + d * m.f),
  }
}

/**
 * Per-axis scale ratios of `current` vs `start` relative to `anchor`, all in
 * the same (element-local) space. Axes where the start offset is ~zero keep
 * ratio 1 — scaling against a zero baseline is undefined.
 */
export function scaleFactors(anchor: Pt, start: Pt, current: Pt): { sx: number; sy: number } {
  const baseX = start.x - anchor.x
  const baseY = start.y - anchor.y
  return {
    sx: Math.abs(baseX) < 1e-6 ? 1 : (current.x - anchor.x) / baseX,
    sy: Math.abs(baseY) < 1e-6 ? 1 : (current.y - anchor.y) / baseY,
  }
}

/** Signed angle (degrees, normalized to (-180, 180]) from anchor→start to anchor→current. */
export function rotationDeltaDeg(anchor: Pt, start: Pt, current: Pt): number {
  const a0 = Math.atan2(start.y - anchor.y, start.x - anchor.x)
  const a1 = Math.atan2(current.y - anchor.y, current.x - anchor.x)
  let deg = ((a1 - a0) * 180) / Math.PI
  while (deg <= -180) deg += 360
  while (deg > 180) deg -= 360
  return deg
}
