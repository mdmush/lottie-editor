import { describe, expect, it } from 'vitest'
import type { LottieKeyframe, LottieProperty } from '../../types/lottie'
import {
  cubicBezierY,
  deleteKeyframeAt,
  isAnimated,
  isKeyframes,
  keyframeTimes,
  moveKeyframeT,
  upsertKeyframeAtFrame,
  valueAtFrame,
} from '../keyframes'

const animated = (kfs: LottieKeyframe[]): LottieProperty => ({ a: 1, k: kfs })

describe('isKeyframes / isAnimated', () => {
  it('distinguishes static arrays from keyframe arrays', () => {
    expect(isKeyframes([100, 200])).toBe(false)
    expect(isKeyframes([{ t: 0, s: [1] }])).toBe(true)
    expect(isKeyframes(5)).toBe(false)
    expect(isKeyframes([])).toBe(false)
  })

  it('isAnimated keys off the k shape, not the a flag', () => {
    expect(isAnimated({ a: 0, k: 5 })).toBe(false)
    expect(isAnimated({ k: [{ t: 0, s: [1] }] })).toBe(true)
  })
})

describe('cubicBezierY', () => {
  it('is linear for the linear-equivalent control points', () => {
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      expect(cubicBezierY(u, 1 / 3, 1 / 3, 2 / 3, 2 / 3)).toBeCloseTo(u, 5)
    }
  })

  it('clamps outside [0,1]', () => {
    expect(cubicBezierY(-0.5, 0.3, 0, 0.7, 1)).toBe(0)
    expect(cubicBezierY(1.5, 0.3, 0, 0.7, 1)).toBe(1)
  })

  it('matches a known ease-in-out midpoint', () => {
    // Symmetric curve: midpoint must be exactly 0.5.
    expect(cubicBezierY(0.5, 0.42, 0, 0.58, 1)).toBeCloseTo(0.5, 4)
    // Ease-in: early progress is below linear.
    expect(cubicBezierY(0.25, 0.42, 0, 1, 1)).toBeLessThan(0.25)
  })
})

describe('valueAtFrame', () => {
  it('wraps static scalars and passes static arrays through', () => {
    expect(valueAtFrame({ a: 0, k: 50 }, 10)).toEqual([50])
    expect(valueAtFrame({ a: 0, k: [10, 20] }, 10)).toEqual([10, 20])
  })

  it('returns null for expression-driven properties', () => {
    expect(valueAtFrame({ a: 0, k: 5, x: 'var $bm_rt = 1;' }, 0)).toBeNull()
  })

  it('clamps before the first and after the last keyframe', () => {
    const prop = animated([
      { t: 10, s: [0] },
      { t: 20, s: [100] },
    ])
    expect(valueAtFrame(prop, 0)).toEqual([0])
    expect(valueAtFrame(prop, 30)).toEqual([100])
  })

  it('interpolates linearly with default easing', () => {
    const prop = animated([
      { t: 0, s: [0] },
      { t: 10, s: [100] },
    ])
    expect(valueAtFrame(prop, 5)![0]).toBeCloseTo(50, 3)
    expect(valueAtFrame(prop, 2.5)![0]).toBeCloseTo(25, 3)
  })

  it('interpolates multi-dimensional values', () => {
    const prop = animated([
      { t: 0, s: [0, 100] },
      { t: 10, s: [100, 200] },
    ])
    const v = valueAtFrame(prop, 5)!
    expect(v[0]).toBeCloseTo(50, 3)
    expect(v[1]).toBeCloseTo(150, 3)
  })

  it('respects hold keyframes', () => {
    const prop = animated([
      { t: 0, s: [0], h: 1 },
      { t: 10, s: [100] },
    ])
    expect(valueAtFrame(prop, 9.9)).toEqual([0])
    expect(valueAtFrame(prop, 10)).toEqual([100])
  })

  it('uses legacy e end-values and bare terminal keyframes', () => {
    const prop = animated([
      { t: 0, s: [0], e: [100] },
      { t: 10 },
    ])
    expect(valueAtFrame(prop, 5)![0]).toBeCloseTo(50, 3)
    expect(valueAtFrame(prop, 10)).toEqual([100])
    expect(valueAtFrame(prop, 20)).toEqual([100])
  })

  it('applies bezier easing from i/o handles', () => {
    const prop = animated([
      { t: 0, s: [0], o: { x: [0.42], y: [0] }, i: { x: [0.58], y: [1] } },
      { t: 10, s: [100] },
    ])
    // Symmetric ease-in-out: midpoint exact, quarter below linear.
    expect(valueAtFrame(prop, 5)![0]).toBeCloseTo(50, 2)
    expect(valueAtFrame(prop, 2.5)![0]).toBeLessThan(25)
  })

  it('accepts scalar easing components', () => {
    const prop = animated([
      { t: 0, s: [0], o: { x: 0.42, y: 0 }, i: { x: 0.58, y: 1 } },
      { t: 10, s: [100] },
    ])
    expect(valueAtFrame(prop, 5)![0]).toBeCloseTo(50, 2)
  })
})

describe('upsertKeyframeAtFrame', () => {
  it('updates static values in native shape', () => {
    const scalar: LottieProperty = { a: 0, k: 5 }
    upsertKeyframeAtFrame(scalar, 10, [42])
    expect(scalar.k).toBe(42)

    const arr: LottieProperty = { a: 0, k: [10, 20] }
    upsertKeyframeAtFrame(arr, 10, [30, 40])
    expect(arr.k).toEqual([30, 40])
  })

  it('converts static to animated only with forceKeyframe', () => {
    const prop: LottieProperty = { a: 0, k: 5 }
    upsertKeyframeAtFrame(prop, 10, [5], { forceKeyframe: true })
    expect(prop.a).toBe(1)
    expect(prop.k).toEqual([{ t: 10, s: [5] }])
  })

  it('overwrites an existing keyframe at the same frame', () => {
    const prop = animated([
      { t: 0, s: [0] },
      { t: 10, s: [100] },
    ])
    upsertKeyframeAtFrame(prop, 10, [60])
    const kfs = prop.k as LottieKeyframe[]
    expect(kfs).toHaveLength(2)
    expect(kfs[1].s).toEqual([60])
  })

  it('mirrors overwrites into the previous legacy e', () => {
    const prop = animated([
      { t: 0, s: [0], e: [100] },
      { t: 10, s: [100] },
    ])
    upsertKeyframeAtFrame(prop, 10, [60])
    const kfs = prop.k as LottieKeyframe[]
    expect(kfs[0].e).toEqual([60])
  })

  it('inserts mid-segment with linear-equivalent easing', () => {
    const prop = animated([
      { t: 0, s: [0] },
      { t: 10, s: [100] },
    ])
    upsertKeyframeAtFrame(prop, 5, [80])
    const kfs = prop.k as LottieKeyframe[]
    expect(kfs.map((kf) => kf.t)).toEqual([0, 5, 10])
    expect(kfs[1].s).toEqual([80])
    expect(kfs[1].o).toEqual({ x: [1 / 3], y: [1 / 3] })
  })

  it('splits legacy e segments consistently', () => {
    const prop = animated([
      { t: 0, s: [0], e: [100] },
      { t: 10 },
    ])
    upsertKeyframeAtFrame(prop, 5, [80])
    const kfs = prop.k as LottieKeyframe[]
    expect(kfs[0].e).toEqual([80])
    expect(kfs[1].e).toEqual([100])
  })

  it('drops spatial tangents from a split segment', () => {
    const prop = animated([
      { t: 0, s: [0, 0], to: [10, 0], ti: [-10, 0] },
      { t: 10, s: [100, 100] },
    ])
    upsertKeyframeAtFrame(prop, 5, [50, 50])
    const kfs = prop.k as LottieKeyframe[]
    expect(kfs[0].to).toBeUndefined()
    expect(kfs[0].ti).toBeUndefined()
  })

  it('inserts before the first and after the last keyframe', () => {
    const prop = animated([
      { t: 10, s: [10] },
      { t: 20, s: [20] },
    ])
    upsertKeyframeAtFrame(prop, 5, [5])
    upsertKeyframeAtFrame(prop, 30, [30])
    expect((prop.k as LottieKeyframe[]).map((kf) => kf.t)).toEqual([5, 10, 20, 30])
  })

  it('rounds fractional frames', () => {
    const prop = animated([
      { t: 0, s: [0] },
      { t: 10, s: [100] },
    ])
    upsertKeyframeAtFrame(prop, 4.6, [50])
    expect((prop.k as LottieKeyframe[])[1].t).toBe(5)
  })
})

describe('moveKeyframeT', () => {
  it('clamps strictly between neighbors', () => {
    const prop = animated([
      { t: 0, s: [0] },
      { t: 10, s: [50] },
      { t: 20, s: [100] },
    ])
    expect(moveKeyframeT(prop, 1, 25)).toBe(19)
    expect(moveKeyframeT(prop, 1, -5)).toBe(1)
    expect(moveKeyframeT(prop, 1, 15)).toBe(15)
  })

  it('moves end keyframes freely outward', () => {
    const prop = animated([
      { t: 0, s: [0] },
      { t: 10, s: [100] },
    ])
    expect(moveKeyframeT(prop, 1, 100)).toBe(100)
    expect(moveKeyframeT(prop, 0, -20)).toBe(-20)
  })

  it('is a no-op on static properties', () => {
    const prop: LottieProperty = { a: 0, k: 5 }
    expect(moveKeyframeT(prop, 0, 10)).toBeNull()
    expect(prop.k).toBe(5)
  })
})

describe('deleteKeyframeAt', () => {
  it('removes a middle keyframe and fixes legacy e', () => {
    const prop = animated([
      { t: 0, s: [0], e: [50] },
      { t: 10, s: [50], e: [100] },
      { t: 20, s: [100] },
    ])
    deleteKeyframeAt(prop, 1)
    const kfs = prop.k as LottieKeyframe[]
    expect(kfs).toHaveLength(2)
    expect(kfs[0].e).toEqual([100])
  })

  it('converts to static when one keyframe remains', () => {
    const prop = animated([
      { t: 0, s: [0] },
      { t: 10, s: [100] },
    ])
    deleteKeyframeAt(prop, 0)
    expect(prop.a).toBe(0)
    expect(prop.k).toBe(100)
  })

  it('keeps multi-dim values as arrays when converting to static', () => {
    const prop = animated([
      { t: 0, s: [0, 0] },
      { t: 10, s: [100, 200] },
    ])
    deleteKeyframeAt(prop, 0)
    expect(prop.k).toEqual([100, 200])
  })
})

describe('keyframeTimes', () => {
  it('lists rounded times and returns [] for static', () => {
    expect(keyframeTimes({ a: 0, k: 5 })).toEqual([])
    expect(
      keyframeTimes(animated([{ t: 0.4, s: [0] }, { t: 10, s: [1] }])),
    ).toEqual([0, 10])
  })
})
