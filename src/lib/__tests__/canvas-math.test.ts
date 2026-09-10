import { describe, expect, it } from 'vitest'
import {
  applyLinear,
  applyMatrix,
  invertMatrix,
  rotationDeltaDeg,
  scaleFactors,
  type Mat2D,
} from '../canvas-math'

const IDENTITY: Mat2D = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
// translate(10, 20) scale(2, 3)
const TS: Mat2D = { a: 2, b: 0, c: 0, d: 3, e: 10, f: 20 }
// rotate(90deg): x→y, y→-x
const ROT90: Mat2D = { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 }

describe('applyMatrix / applyLinear', () => {
  it('applies translation and scale', () => {
    expect(applyMatrix(TS, { x: 1, y: 1 })).toEqual({ x: 12, y: 23 })
    expect(applyLinear(TS, { x: 1, y: 1 })).toEqual({ x: 2, y: 3 })
  })

  it('rotates vectors', () => {
    const v = applyLinear(ROT90, { x: 1, y: 0 })
    expect(v.x).toBeCloseTo(0)
    expect(v.y).toBeCloseTo(1)
  })
})

describe('invertMatrix', () => {
  it('round-trips points through inverse', () => {
    const inv = invertMatrix(TS)!
    const p = { x: 42, y: -7 }
    const back = applyMatrix(inv, applyMatrix(TS, p))
    expect(back.x).toBeCloseTo(p.x)
    expect(back.y).toBeCloseTo(p.y)
  })

  it('inverts rotation', () => {
    const inv = invertMatrix(ROT90)!
    const back = applyMatrix(inv, { x: 0, y: 1 })
    expect(back.x).toBeCloseTo(1)
    expect(back.y).toBeCloseTo(0)
  })

  it('returns null for singular matrices', () => {
    expect(invertMatrix({ a: 0, b: 0, c: 0, d: 0, e: 5, f: 5 })).toBeNull()
    const inv = invertMatrix(IDENTITY)!
    for (const k of ['a', 'b', 'c', 'd', 'e', 'f'] as const) {
      expect(inv[k]).toBeCloseTo(IDENTITY[k])
    }
  })
})

describe('scaleFactors', () => {
  it('computes per-axis ratios around the anchor', () => {
    const { sx, sy } = scaleFactors({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 5 })
    expect(sx).toBeCloseTo(2)
    expect(sy).toBeCloseTo(0.5)
  })

  it('keeps ratio 1 on a zero baseline axis', () => {
    const { sx, sy } = scaleFactors({ x: 5, y: 0 }, { x: 5, y: 10 }, { x: 50, y: 20 })
    expect(sx).toBe(1)
    expect(sy).toBeCloseTo(2)
  })

  it('supports negative (flip) ratios', () => {
    const { sx } = scaleFactors({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: -10, y: 0 })
    expect(sx).toBeCloseTo(-1)
  })
})

describe('rotationDeltaDeg', () => {
  it('measures signed angle around the anchor', () => {
    const anchor = { x: 0, y: 0 }
    expect(rotationDeltaDeg(anchor, { x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90)
    expect(rotationDeltaDeg(anchor, { x: 0, y: 1 }, { x: 1, y: 0 })).toBeCloseTo(-90)
  })

  it('normalizes across the ±180 boundary', () => {
    const anchor = { x: 0, y: 0 }
    const d = rotationDeltaDeg(anchor, { x: -1, y: -0.01 }, { x: -1, y: 0.01 })
    expect(Math.abs(d)).toBeLessThan(5)
  })
})
