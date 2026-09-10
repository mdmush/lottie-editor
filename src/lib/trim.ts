import type { LottieDoc } from '../types/lottie'

/**
 * A slice of the timeline in player-frame space: 0 is the document's `ip`
 * and both ends are inclusive, matching the "f 12 / 59" readout under the
 * player. `end` is the last frame that renders.
 */
export interface FrameRange {
  start: number
  end: number
}

/** Number of frames a document plays: `op - ip`, floored like lottie-web. */
export function docFrameCount(doc: LottieDoc): number {
  const ip = typeof doc.ip === 'number' ? doc.ip : 0
  const op = typeof doc.op === 'number' ? doc.op : ip
  return Math.max(0, Math.floor(op - ip))
}

/** Clamp a range to `[0, frameCount - 1]` with `start <= end`, integer frames. */
export function clampRange(range: FrameRange, frameCount: number): FrameRange {
  const last = Math.max(0, frameCount - 1)
  const start = Math.min(last, Math.max(0, Math.round(range.start)))
  const end = Math.min(last, Math.max(start, Math.round(range.end)))
  return { start, end }
}

/** An array of `{ t: number, ... }` objects — the shape of every Lottie keyframe list. */
function isKeyframeList(value: unknown): value is { t: number }[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((kf) => typeof kf === 'object' && kf !== null && typeof (kf as { t?: unknown }).t === 'number')
  )
}

/**
 * Subtract `offset` from every keyframe time reachable under `node`:
 * transform, shape, mask, effect, text-animator, text-document, and
 * time-remap keyframes all live in composition time. Nested `layers`
 * (precomp contents) are not reachable from a root layer, so nothing in
 * precomp-local time is touched.
 */
function shiftKeyframeTimes(node: unknown, offset: number): void {
  if (Array.isArray(node)) {
    if (isKeyframeList(node)) {
      for (const kf of node) kf.t -= offset
    } else {
      for (const item of node) shiftKeyframeTimes(item, offset)
    }
  } else if (typeof node === 'object' && node !== null) {
    for (const value of Object.values(node)) shiftKeyframeTimes(value, offset)
  }
}

/**
 * Cut the document down to `range` so the clip stands on its own: the
 * result starts at frame 0 and ends at `end - start + 1` (exclusive `op`).
 *
 * Root layers are retimed by shifting `ip`, `op`, `st`, and every keyframe
 * time by the same amount. In Lottie, layer in/out points and keyframe `t`
 * values are composition frames; `st` only offsets the content of precomp
 * (and time-remapped) layers, whose inner layers run in their own local
 * time and are left untouched. Markers shift too; ones outside the range
 * are dropped.
 *
 * Mutates and returns `doc` — call it on a clone.
 */
export function trimDoc(doc: LottieDoc, range: FrameRange): LottieDoc {
  const { start, end } = clampRange(range, docFrameCount(doc))
  const ip = typeof doc.ip === 'number' ? doc.ip : 0
  const offset = ip + start
  const length = end - start + 1

  doc.ip = 0
  doc.op = length

  doc.layers?.forEach((layer) => {
    if (typeof layer.ip === 'number') layer.ip -= offset
    if (typeof layer.op === 'number') layer.op -= offset
    if (typeof layer.st === 'number') layer.st -= offset
    shiftKeyframeTimes(layer, offset)
  })

  const markers = doc.markers
  if (Array.isArray(markers)) {
    doc.markers = markers
      .filter((m) => {
        const tm = (m as { tm?: unknown })?.tm
        return typeof tm !== 'number' || (tm >= offset && tm < offset + length)
      })
      .map((m) => {
        const tm = (m as { tm?: unknown })?.tm
        return typeof tm === 'number' ? { ...(m as object), tm: tm - offset } : m
      })
  }

  return doc
}

/** True when `range` covers the whole document — trimming would be a no-op. */
export function isFullRange(range: FrameRange, frameCount: number): boolean {
  return range.start <= 0 && range.end >= frameCount - 1
}
