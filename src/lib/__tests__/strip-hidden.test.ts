import { describe, expect, it } from 'vitest'
import type { LottieDoc } from '../../types/lottie'
import { stripHiddenShapes } from '../strip-hidden'

describe('stripHiddenShapes', () => {
  it('removes hidden shape items and keeps visible siblings', () => {
    const doc: LottieDoc = {
      layers: [
        {
          ty: 4,
          shapes: [
            { ty: 'gr', hd: true, it: [] },
            { ty: 'fl', c: { a: 0, k: [1, 0, 0, 1] } },
          ],
        },
      ],
    }
    stripHiddenShapes(doc)
    expect(doc.layers![0].shapes).toHaveLength(1)
    expect(doc.layers![0].shapes![0].ty).toBe('fl')
  })

  it('removes hidden items nested inside groups', () => {
    const doc: LottieDoc = {
      layers: [
        {
          ty: 4,
          shapes: [
            {
              ty: 'gr',
              it: [
                { ty: 'el' },
                { ty: 'fl', hd: true },
                { ty: 'gr', it: [{ ty: 'st', hd: true }, { ty: 'sh' }] },
              ],
            },
          ],
        },
      ],
    }
    stripHiddenShapes(doc)
    const group = doc.layers![0].shapes![0]
    expect(group.it!.map((s) => s.ty)).toEqual(['el', 'gr'])
    expect(group.it![1].it!.map((s) => s.ty)).toEqual(['sh'])
  })

  it('recurses into precomp asset layers', () => {
    const doc: LottieDoc = {
      layers: [{ ty: 0, refId: 'c0' }],
      assets: [{ id: 'c0', layers: [{ ty: 4, shapes: [{ ty: 'fl', hd: true }] }] }],
    }
    stripHiddenShapes(doc)
    expect(doc.assets![0].layers![0].shapes).toEqual([])
  })

  it('leaves hidden layers in place with their hd flag', () => {
    const doc: LottieDoc = {
      layers: [{ ty: 1, sc: '#ff0000', hd: true }, { ty: 4, shapes: [] }],
    }
    stripHiddenShapes(doc)
    expect(doc.layers).toHaveLength(2)
    expect(doc.layers![0].hd).toBe(true)
  })

  it('tolerates docs without shapes or assets', () => {
    expect(() => stripHiddenShapes({})).not.toThrow()
    expect(() => stripHiddenShapes({ layers: [{ ty: 3 }] })).not.toThrow()
  })
})
