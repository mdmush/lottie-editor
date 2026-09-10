import { describe, expect, it } from 'vitest'
import type { LottieDoc } from '../../types/lottie'
import { clampRange, docFrameCount, isFullRange, trimDoc } from '../trim'

describe('docFrameCount', () => {
  it('is op - ip, floored', () => {
    expect(docFrameCount({ ip: 0, op: 60 })).toBe(60)
    expect(docFrameCount({ ip: 10, op: 60.7 })).toBe(50)
    expect(docFrameCount({})).toBe(0)
  })
})

describe('clampRange', () => {
  it('clamps to the document bounds and keeps start <= end', () => {
    expect(clampRange({ start: -5, end: 200 }, 60)).toEqual({ start: 0, end: 59 })
    expect(clampRange({ start: 40, end: 10 }, 60)).toEqual({ start: 40, end: 40 })
    expect(clampRange({ start: 3.6, end: 9.2 }, 60)).toEqual({ start: 4, end: 9 })
  })
})

describe('trimDoc', () => {
  it('rebases the timeline to start at frame 0', () => {
    const doc: LottieDoc = {
      ip: 0,
      op: 60,
      layers: [{ ty: 4, ip: 0, op: 60, st: 0 }],
    }
    trimDoc(doc, { start: 10, end: 29 })
    expect(doc.ip).toBe(0)
    expect(doc.op).toBe(20)
    expect(doc.layers![0]).toMatchObject({ ip: -10, op: 50, st: -10 })
  })

  it('accounts for a non-zero document ip', () => {
    const doc: LottieDoc = {
      ip: 20,
      op: 80,
      layers: [{ ty: 4, ip: 20, op: 80, st: 5 }],
    }
    trimDoc(doc, { start: 10, end: 19 })
    expect(doc.op).toBe(10)
    // Range frame 10 is doc frame 30; everything shifts by 30.
    expect(doc.layers![0]).toMatchObject({ ip: -10, op: 50, st: -25 })
  })

  it('shifts keyframe times in transforms, shapes, text, and time remap', () => {
    const doc: LottieDoc = {
      ip: 0,
      op: 60,
      layers: [
        {
          ty: 4,
          ip: 0,
          op: 60,
          st: 0,
          ks: { p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 59, s: [10, 10] }] } },
          shapes: [
            { ty: 'gr', it: [{ ty: 'fl', c: { a: 1, k: [{ t: 20, s: [1, 0, 0, 1] }, { t: 40, s: [0, 0, 1, 1] }] } }] },
          ],
        },
        { ty: 5, ip: 0, op: 60, st: 0, t: { d: { k: [{ t: 0, s: { t: 'a' } }, { t: 30, s: { t: 'b' } }] } } },
        { ty: 0, refId: 'c0', ip: 0, op: 60, st: 0, tm: { a: 1, k: [{ t: 0, s: [0] }, { t: 59, s: [2] }] } },
      ],
    }
    trimDoc(doc, { start: 10, end: 29 })
    const [shape, text, pre] = doc.layers!
    expect((shape.ks!.p!.k as { t: number }[]).map((k) => k.t)).toEqual([-10, 49])
    expect((shape.shapes![0].it![0].c!.k as { t: number }[]).map((k) => k.t)).toEqual([10, 30])
    expect(text.t!.d!.k!.map((k) => k.t)).toEqual([-10, 20])
    expect(((pre.tm as { k: { t: number; s: number[] }[] }).k).map((k) => [k.t, k.s[0]])).toEqual([
      [-10, 0],
      [49, 2],
    ])
  })

  it('leaves static values and non-keyframe arrays alone', () => {
    const doc: LottieDoc = {
      ip: 0,
      op: 60,
      layers: [{ ty: 4, ip: 0, op: 60, st: 0, ks: { p: { a: 0, k: [5, 5] } }, shapes: [{ ty: 'fl', c: { a: 0, k: [1, 0, 0, 1] } }] }],
    }
    trimDoc(doc, { start: 10, end: 29 })
    expect(doc.layers![0].ks!.p!.k).toEqual([5, 5])
    expect(doc.layers![0].shapes![0].c!.k).toEqual([1, 0, 0, 1])
  })

  it('leaves precomp asset layers alone', () => {
    const doc: LottieDoc = {
      ip: 0,
      op: 60,
      layers: [{ ty: 0, refId: 'c0', ip: 0, op: 60, st: 0 }],
      assets: [
        { id: 'c0', layers: [{ ty: 4, ip: 0, op: 60, st: 0, ks: { p: { a: 1, k: [{ t: 0, s: [0] }, { t: 59, s: [1] }] } } }] },
      ],
    }
    trimDoc(doc, { start: 30, end: 59 })
    expect(doc.assets![0].layers![0]).toMatchObject({ ip: 0, op: 60, st: 0 })
    expect((doc.assets![0].layers![0].ks!.p!.k as { t: number }[]).map((k) => k.t)).toEqual([0, 59])
  })

  it('shifts markers and drops those outside the range', () => {
    const doc: LottieDoc = {
      ip: 0,
      op: 60,
      markers: [
        { tm: 5, cm: 'before', dr: 0 },
        { tm: 15, cm: 'inside', dr: 0 },
        { tm: 40, cm: 'after', dr: 0 },
      ],
    }
    trimDoc(doc, { start: 10, end: 29 })
    expect(doc.markers).toEqual([{ tm: 5, cm: 'inside', dr: 0 }])
  })

  it('is a no-op for the full range', () => {
    const doc: LottieDoc = { ip: 0, op: 60, layers: [{ ty: 4, ip: 0, op: 60, st: 0 }] }
    trimDoc(doc, { start: 0, end: 59 })
    expect(doc).toEqual({ ip: 0, op: 60, layers: [{ ty: 4, ip: 0, op: 60, st: 0 }] })
  })
})

describe('isFullRange', () => {
  it('detects a range covering every frame', () => {
    expect(isFullRange({ start: 0, end: 59 }, 60)).toBe(true)
    expect(isFullRange({ start: 1, end: 59 }, 60)).toBe(false)
    expect(isFullRange({ start: 0, end: 58 }, 60)).toBe(false)
  })
})
