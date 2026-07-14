import { describe, expect, it } from 'vitest'
import type { LottieDoc } from '../../types/lottie'
import { hexToFloats, normalizeHex, rgbComponentsToHex } from '../color-utils'
import { applyAlphaToRefs, applyColorToRefs, extractColors, readGroupAlpha } from '../lottie-colors'

const RED = [1, 0, 0]
const BLUE = [0, 0, 1]

/** Minimal doc: shape layer with a red fill and a red stroke inside a group. */
function fillAndStrokeDoc(): LottieDoc {
  return {
    v: '5.7.4',
    layers: [
      {
        ty: 4,
        nm: 'shape',
        shapes: [
          {
            ty: 'gr',
            it: [
              { ty: 'fl', c: { a: 0, k: [...RED, 1] } },
              { ty: 'st', c: { a: 0, k: [...RED] } },
            ],
          },
        ],
      },
    ],
  }
}

function animatedFillDoc(): LottieDoc {
  return {
    layers: [
      {
        ty: 4,
        shapes: [
          {
            ty: 'fl',
            c: {
              a: 1,
              k: [
                { t: 0, s: [...RED, 1], e: [...BLUE, 1] },
                { t: 30, s: [...BLUE, 1] },
              ],
            },
          },
        ],
      },
    ],
  }
}

/** Gradient with 2 color stops followed by 2 alpha stops in the flat array. */
function gradientDoc(): LottieDoc {
  return {
    layers: [
      {
        ty: 4,
        shapes: [
          {
            ty: 'gf',
            g: { p: 2, k: { a: 0, k: [0, ...RED, 1, ...BLUE, 0, 0.2, 1, 0.9] } },
          },
        ],
      },
    ],
  }
}

function solidAndTextDoc(): LottieDoc {
  return {
    layers: [
      { ty: 1, nm: 'bg', sc: '#ff0000' },
      {
        ty: 5,
        nm: 'title',
        t: {
          d: { k: [{ t: 0, s: { t: 'Hi', fc: [...RED], sc: [...BLUE] } }] },
          a: [{ a: { fc: { a: 0, k: [...RED, 1] } } }],
        },
      },
    ],
  }
}

function precompDoc(): LottieDoc {
  return {
    layers: [{ ty: 0, refId: 'comp_0' }],
    assets: [
      {
        id: 'comp_0',
        layers: [{ ty: 4, shapes: [{ ty: 'fl', c: { a: 0, k: [...BLUE, 1] } }] }],
      },
    ],
  }
}

function legacyRangeDoc(): LottieDoc {
  return {
    layers: [{ ty: 4, shapes: [{ ty: 'fl', c: { a: 0, k: [255, 0, 0, 255] } }] }],
  }
}

describe('color-utils', () => {
  it('converts 0–1 floats to uppercase hex', () => {
    expect(rgbComponentsToHex([1, 0, 0])).toBe('#FF0000')
    expect(rgbComponentsToHex([0.5, 0.5, 0.5])).toBe('#808080')
  })

  it('detects legacy 0–255 arrays', () => {
    expect(rgbComponentsToHex([255, 128, 0])).toBe('#FF8000')
  })

  it('round-trips hex to floats', () => {
    expect(hexToFloats('#ff0000')).toEqual([1, 0, 0])
    expect(normalizeHex('#abc')).toBe('#AABBCC')
    expect(() => hexToFloats('nope')).toThrow()
  })
})

describe('extractColors', () => {
  it('groups identical fill and stroke colors into one group', () => {
    const groups = extractColors(fillAndStrokeDoc())
    expect(groups).toHaveLength(1)
    expect(groups[0].hex).toBe('#FF0000')
    expect(groups[0].refs).toHaveLength(2)
  })

  it('emits one ref per keyframe value, including legacy e arrays', () => {
    const groups = extractColors(animatedFillDoc())
    const red = groups.find((g) => g.hex === '#FF0000')
    const blue = groups.find((g) => g.hex === '#0000FF')
    expect(red?.refs).toHaveLength(1) // kf0.s
    expect(blue?.refs).toHaveLength(2) // kf0.e + kf1.s
  })

  it('reads gradient color stops but never alpha stop pairs', () => {
    const groups = extractColors(gradientDoc())
    expect(groups.map((g) => g.hex).sort()).toEqual(['#0000FF', '#FF0000'])
    const totalRefs = groups.reduce((n, g) => n + g.refs.length, 0)
    expect(totalRefs).toBe(2) // exactly g.p stops, nothing from the alpha tail
  })

  it('finds solid layer sc and text fill/stroke/animator colors', () => {
    const groups = extractColors(solidAndTextDoc())
    const red = groups.find((g) => g.hex === '#FF0000')
    const blue = groups.find((g) => g.hex === '#0000FF')
    expect(red?.refs).toHaveLength(3) // sc + text fc + animator fc
    expect(blue?.refs).toHaveLength(1) // text sc
  })

  it('recurses into precomp asset layers', () => {
    const groups = extractColors(precompDoc())
    expect(groups).toHaveLength(1)
    expect(groups[0].hex).toBe('#0000FF')
    expect(groups[0].refs[0].path[0]).toBe('assets')
  })

  it('normalizes legacy 0–255 files to the same group key', () => {
    const groups = extractColors(legacyRangeDoc())
    expect(groups[0].hex).toBe('#FF0000')
  })

  it('tolerates empty and malformed documents', () => {
    expect(extractColors({})).toEqual([])
    expect(
      extractColors({
        layers: [{ ty: 4, shapes: [{ ty: 'fl' }, { ty: 'gf', g: {} }, { ty: 'gr' }] }],
      }),
    ).toEqual([])
  })
})

describe('applyColorToRefs', () => {
  it('rewrites rgb and preserves the alpha component', () => {
    const doc = fillAndStrokeDoc()
    const [group] = extractColors(doc)
    applyColorToRefs(doc, group.refs, '#00ff00')
    const fill = (doc as any).layers[0].shapes[0].it[0].c.k
    const stroke = (doc as any).layers[0].shapes[0].it[1].c.k
    expect(fill).toEqual([0, 1, 0, 1])
    expect(stroke).toEqual([0, 1, 0])
  })

  it('rewrites only the targeted gradient stop, keeping offsets and alpha tail', () => {
    const doc = gradientDoc()
    const red = extractColors(doc).find((g) => g.hex === '#FF0000')!
    applyColorToRefs(doc, red.refs, '#00ff00')
    const arr = (doc as any).layers[0].shapes[0].g.k.k
    expect(arr).toEqual([0, 0, 1, 0, 1, 0, 0, 1, 0, 0.2, 1, 0.9])
  })

  it('writes solid layer hex lowercase and keeps legacy files in 0–255', () => {
    const solid = solidAndTextDoc()
    const red = extractColors(solid).find((g) => g.hex === '#FF0000')!
    applyColorToRefs(solid, red.refs, '#00FF00')
    expect((solid as any).layers[0].sc).toBe('#00ff00')

    const legacy = legacyRangeDoc()
    const [group] = extractColors(legacy)
    applyColorToRefs(legacy, group.refs, '#0000ff')
    expect((legacy as any).layers[0].shapes[0].c.k).toEqual([0, 0, 255, 255])
  })

  it('leaves other color groups untouched', () => {
    const doc = animatedFillDoc()
    const before = structuredClone(doc)
    const red = extractColors(doc).find((g) => g.hex === '#FF0000')!
    applyColorToRefs(doc, red.refs, '#123456')
    const blueKf = (doc as any).layers[0].shapes[0].c.k
    expect(blueKf[0].e).toEqual((before as any).layers[0].shapes[0].c.k[0].e)
    expect(blueKf[1].s).toEqual((before as any).layers[0].shapes[0].c.k[1].s)
  })

  it('round-trips: apply then extract reports the new color with the same ref count', () => {
    const doc = fillAndStrokeDoc()
    const [group] = extractColors(doc)
    applyColorToRefs(doc, group.refs, '#336699')
    const after = extractColors(doc)
    expect(after).toHaveLength(1)
    expect(after[0].hex).toBe('#336699')
    expect(after[0].refs).toHaveLength(group.refs.length)
  })

  it('applying a color to its own value is a no-op', () => {
    const doc = gradientDoc()
    const before = structuredClone(doc)
    const red = extractColors(doc).find((g) => g.hex === '#FF0000')!
    applyColorToRefs(doc, red.refs, '#ff0000')
    expect(doc).toEqual(before)
  })
})

describe('group alpha', () => {
  it('reads alpha from the first 4-component rgb ref', () => {
    const doc = fillAndStrokeDoc()
    const [group] = extractColors(doc)
    expect(readGroupAlpha(doc, group.refs)).toBe(1)
    ;(doc as any).layers[0].shapes[0].it[0].c.k[3] = 0.5
    expect(readGroupAlpha(doc, group.refs)).toBe(0.5)
  })

  it('returns null when no ref carries an alpha channel', () => {
    const doc = gradientDoc()
    const red = extractColors(doc).find((g) => g.hex === '#FF0000')!
    expect(readGroupAlpha(doc, red.refs)).toBeNull()

    const solid: LottieDoc = { layers: [{ ty: 1, sc: '#ff0000' }] }
    const [group] = extractColors(solid)
    expect(readGroupAlpha(solid, group.refs)).toBeNull()
  })

  it('writes alpha to 4-component arrays and skips 3-component ones', () => {
    const doc = fillAndStrokeDoc()
    const [group] = extractColors(doc)
    applyAlphaToRefs(doc, group.refs, 0.25)
    expect((doc as any).layers[0].shapes[0].it[0].c.k).toEqual([1, 0, 0, 0.25])
    expect((doc as any).layers[0].shapes[0].it[1].c.k).toEqual([1, 0, 0])
  })

  it('keeps legacy 0–255 alpha scale and snaps ambiguous sub-1% values to 0', () => {
    const doc = legacyRangeDoc()
    const [group] = extractColors(doc)
    applyAlphaToRefs(doc, group.refs, 0.5)
    expect((doc as any).layers[0].shapes[0].c.k[3]).toBe(128)
    expect(readGroupAlpha(doc, group.refs)).toBeCloseTo(128 / 255, 5)

    applyAlphaToRefs(doc, group.refs, 0.001)
    expect((doc as any).layers[0].shapes[0].c.k[3]).toBe(0)
  })

  it('never touches gradient stop arrays', () => {
    const doc = gradientDoc()
    const before = structuredClone(doc)
    const red = extractColors(doc).find((g) => g.hex === '#FF0000')!
    applyAlphaToRefs(doc, red.refs, 0.1)
    expect(doc).toEqual(before)
  })
})
