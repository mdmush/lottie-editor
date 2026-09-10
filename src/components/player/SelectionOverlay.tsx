import { useEffect, useMemo, useRef } from 'react'
import {
  applyLinear,
  applyMatrix,
  invertMatrix,
  rotationDeltaDeg,
  scaleFactors,
  type Mat2D,
  type Pt,
} from '../../lib/canvas-math'
import { resolveHighlight } from '../../lib/highlight'
import { getAtPath, type JsonPath } from '../../lib/json-path'
import { valueAtFrame } from '../../lib/keyframes'
import { docPathToRenderedTarget, findDocNode } from '../../lib/node-addressing'
import { playerHandle } from '../../lib/player-handle'
import { descriptorsFor } from '../../lib/property-descriptors'
import { useEditorStore } from '../../store/editor-store'
import type { LottieProperty } from '../../types/lottie'

/** Element kinds that get live transform handles (others: display-only bbox). */
const TRANSFORMABLE = new Set(['layer', 'gr', 'tr'])

interface PositionPaths {
  split: boolean
  x?: JsonPath
  y?: JsonPath
  p?: JsonPath
}

interface TransformPaths {
  position: PositionPaths | null
  scale: JsonPath | null
  rotation: JsonPath | null
  anchor: JsonPath | null
}

function readTransformPaths(
  doc: NonNullable<ReturnType<typeof useEditorStore.getState>['doc']>,
  nodePath: JsonPath,
): TransformPaths | null {
  const kind = findDocNode(doc, nodePath)?.kind
  if (!kind || !TRANSFORMABLE.has(kind)) return null
  const defs = descriptorsFor(doc, nodePath)
  const by = (key: string) => defs.find((d) => d.key === key)?.propPath ?? null
  const px = by('px')
  const py = by('py')
  const p = by('p')
  return {
    position: px && py ? { split: true, x: px, y: py } : p ? { split: false, p } : null,
    scale: by('s'),
    rotation: by('r'),
    anchor: by('a'),
  }
}

function propValue(doc: unknown, path: JsonPath | null, frame: number): number[] | null {
  if (!path) return null
  const prop = getAtPath(doc, path) as LottieProperty | undefined
  if (!prop || typeof prop !== 'object') return null
  return valueAtFrame(prop, frame)
}

interface DragState {
  mode: 'move' | 'scale' | 'rotate'
  startClient: Pt
  /** maps screen deltas into the transform's parent space (move) */
  inverseParent: Mat2D | null
  /** maps client points into the element's child space (scale) */
  inverseEl: Mat2D | null
  anchorLocal: Pt
  anchorScreen: Pt
  startLocal: Pt
  baseP: number[] | null
  baseS: number[] | null
  baseR: number[] | null
  /** last previewed edits, committed on release */
  lastEdits: { propPath: JsonPath; value: number[] }[]
}

const HANDLE = 7

/**
 * Transform handles over the player stage: dashed bbox with corner scale
 * handles and a rotate stem. Lives outside the lottie SVG (which is torn
 * down on every doc revision) and re-resolves the selected element per
 * animation frame, mirroring the highlight loop. Matrices and base values
 * are captured once at pointer-down (playback paused) so throttled
 * re-renders mid-drag can't feed back into the math.
 */
export function SelectionOverlay() {
  const selection = useEditorStore((s) => s.selection)

  const svgRef = useRef<SVGSVGElement>(null)
  const groupRef = useRef<SVGGElement>(null)
  const boxRef = useRef<SVGPolygonElement>(null)
  const handleRefs = useRef<(SVGRectElement | null)[]>([])
  const rotRef = useRef<SVGCircleElement>(null)
  const stemRef = useRef<SVGLineElement>(null)
  const dragRef = useRef<DragState | null>(null)
  /** Latest projected bbox corners in overlay coordinates (for handle math). */
  const cornersRef = useRef<Pt[]>([])

  const nodePath = selection?.nodePath ?? null
  const pathKey = nodePath?.join('/') ?? ''

  // Editability of the current selection (recomputed on doc changes too —
  // cheap, and the rAF loop reads fresh doc state each frame anyway).
  const doc = useEditorStore((s) => s.doc)
  const paths = useMemo(
    () => (doc && nodePath ? readTransformPaths(doc, nodePath) : null),
    [doc, nodePath],
  )

  useEffect(() => {
    if (!nodePath) return
    let raf = 0

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const svg = svgRef.current
      const group = groupRef.current
      if (!svg || !group) return
      const state = useEditorStore.getState()
      const anim = playerHandle.current?.anim() ?? null
      const target = state.doc ? docPathToRenderedTarget(state.doc, nodePath) : null
      const res = anim && target ? resolveHighlight(anim, target) : null
      const el = res ? (res.kind === 'element' ? res.el : res.stylePElem) : null
      const ctm = el?.getScreenCTM?.()
      if (!el || !ctm) {
        group.style.display = 'none'
        return
      }
      let bbox: DOMRect
      try {
        bbox = el.getBBox()
      } catch {
        group.style.display = 'none'
        return
      }
      const overlayRect = svg.getBoundingClientRect()
      const project = (p: Pt): Pt => {
        const s = applyMatrix(ctm, p)
        return { x: s.x - overlayRect.left, y: s.y - overlayRect.top }
      }
      const corners = [
        project({ x: bbox.x, y: bbox.y }),
        project({ x: bbox.x + bbox.width, y: bbox.y }),
        project({ x: bbox.x + bbox.width, y: bbox.y + bbox.height }),
        project({ x: bbox.x, y: bbox.y + bbox.height }),
      ]
      cornersRef.current = corners
      group.style.display = ''
      boxRef.current?.setAttribute(
        'points',
        corners.map((c) => `${c.x},${c.y}`).join(' '),
      )
      corners.forEach((c, i) => {
        handleRefs.current[i]?.setAttribute(
          'transform',
          `translate(${c.x - HANDLE / 2}, ${c.y - HANDLE / 2})`,
        )
      })
      // Rotate stem: outward normal from the top edge midpoint.
      const mid = { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 }
      const center = {
        x: (corners[0].x + corners[2].x) / 2,
        y: (corners[0].y + corners[2].y) / 2,
      }
      const outLen = Math.hypot(mid.x - center.x, mid.y - center.y) || 1
      const out = {
        x: mid.x + ((mid.x - center.x) / outLen) * 22,
        y: mid.y + ((mid.y - center.y) / outLen) * 22,
      }
      stemRef.current?.setAttribute('x1', String(mid.x))
      stemRef.current?.setAttribute('y1', String(mid.y))
      stemRef.current?.setAttribute('x2', String(out.x))
      stemRef.current?.setAttribute('y2', String(out.y))
      rotRef.current?.setAttribute('cx', String(out.x))
      rotRef.current?.setAttribute('cy', String(out.y))
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [nodePath, pathKey])

  if (!nodePath) return null

  const beginDrag = (e: React.PointerEvent, mode: DragState['mode']) => {
    if (!paths) return
    const state = useEditorStore.getState()
    const anim = playerHandle.current?.anim() ?? null
    const target = state.doc ? docPathToRenderedTarget(state.doc, nodePath) : null
    const res = anim && target ? resolveHighlight(anim, target) : null
    const el = res ? (res.kind === 'element' ? res.el : res.stylePElem) : null
    if (!el) return
    const ctm = el.getScreenCTM()
    const parentCTM = (el.parentNode as SVGGraphicsElement | null)?.getScreenCTM?.() ?? null
    if (!ctm) return

    // Freeze animated transforms so capture-once matrices stay valid.
    playerHandle.current?.pause()

    const frame = state.playhead
    const anchor = propValue(state.doc, paths.anchor, frame)
    const anchorLocal: Pt = { x: anchor?.[0] ?? 0, y: anchor?.[1] ?? 0 }
    const inverseEl = invertMatrix(ctm)
    const client: Pt = { x: e.clientX, y: e.clientY }

    dragRef.current = {
      mode,
      startClient: client,
      inverseParent: parentCTM ? invertMatrix(parentCTM) : null,
      inverseEl,
      anchorLocal,
      anchorScreen: applyMatrix(ctm, anchorLocal),
      startLocal: inverseEl ? applyMatrix(inverseEl, client) : { x: 0, y: 0 },
      baseP: paths.position
        ? paths.position.split
          ? (() => {
              const x = propValue(state.doc, paths.position!.x!, frame)
              const y = propValue(state.doc, paths.position!.y!, frame)
              return x && y ? [x[0], y[0]] : null
            })()
          : propValue(state.doc, paths.position.p!, frame)
        : null,
      baseS: propValue(state.doc, paths.scale, frame),
      baseR: propValue(state.doc, paths.rotation, frame),
      lastEdits: [],
    }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    e.stopPropagation()
    e.preventDefault()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || !paths) return
    const state = useEditorStore.getState()
    const client: Pt = { x: e.clientX, y: e.clientY }
    let edits: { propPath: JsonPath; value: number[] }[] = []

    if (drag.mode === 'move' && drag.baseP && paths.position) {
      const delta = drag.inverseParent
        ? applyLinear(drag.inverseParent, {
            x: client.x - drag.startClient.x,
            y: client.y - drag.startClient.y,
          })
        : { x: client.x - drag.startClient.x, y: client.y - drag.startClient.y }
      const nx = drag.baseP[0] + delta.x
      const ny = drag.baseP[1] + delta.y
      edits = paths.position.split
        ? [
            { propPath: paths.position.x!, value: [nx] },
            { propPath: paths.position.y!, value: [ny] },
          ]
        : [
            {
              propPath: paths.position.p!,
              value: [nx, ny, ...drag.baseP.slice(2)],
            },
          ]
    } else if (drag.mode === 'scale' && drag.baseS && paths.scale && drag.inverseEl) {
      const curLocal = applyMatrix(drag.inverseEl, client)
      let { sx, sy } = scaleFactors(drag.anchorLocal, drag.startLocal, curLocal)
      if (e.shiftKey) {
        const u = Math.abs(sx) > Math.abs(sy) ? sx : sy
        sx = u
        sy = u
      }
      const baseSY = drag.baseS[1] ?? drag.baseS[0]
      edits = [
        {
          propPath: paths.scale,
          value: [drag.baseS[0] * sx, baseSY * sy, ...drag.baseS.slice(2)],
        },
      ]
    } else if (drag.mode === 'rotate' && drag.baseR && paths.rotation) {
      const delta = rotationDeltaDeg(drag.anchorScreen, drag.startClient, client)
      edits = [{ propPath: paths.rotation, value: [drag.baseR[0] + delta] }]
    }

    if (edits.length > 0) {
      drag.lastEdits = edits
      state.previewEdits(edits)
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    ;(e.target as Element).releasePointerCapture(e.pointerId)
    if (drag.lastEdits.length > 0) {
      useEditorStore.getState().commitEdits(drag.lastEdits)
    }
  }

  const interactive = paths !== null
  const canMove = interactive && paths!.position !== null
  const canScale = interactive && paths!.scale !== null
  const canRotate = interactive && paths!.rotation !== null

  return (
    <svg
      ref={svgRef}
      data-selection-overlay=""
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      aria-hidden="true"
    >
      <g ref={groupRef} style={{ display: 'none' }}>
        <polygon
          ref={boxRef}
          fill="transparent"
          className="stroke-accent/80"
          strokeWidth="1"
          strokeDasharray="4 3"
          style={
            canMove
              ? { pointerEvents: 'fill', cursor: 'move' }
              : undefined
          }
          onPointerDown={canMove ? (e) => beginDrag(e, 'move') : undefined}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
        {canRotate && (
          <>
            <line ref={stemRef} className="stroke-accent/60" strokeWidth="1" />
            <circle
              ref={rotRef}
              r="4.5"
              className="fill-ink-900 stroke-accent"
              strokeWidth="1.5"
              style={{ pointerEvents: 'all', cursor: 'grab' }}
              onPointerDown={(e) => beginDrag(e, 'rotate')}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          </>
        )}
        {canScale &&
          [0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              ref={(r) => {
                handleRefs.current[i] = r
              }}
              width={HANDLE}
              height={HANDLE}
              className="fill-ink-900 stroke-accent"
              strokeWidth="1.5"
              style={{
                pointerEvents: 'all',
                cursor: i % 2 === 0 ? 'nwse-resize' : 'nesw-resize',
              }}
              onPointerDown={(e) => beginDrag(e, 'scale')}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          ))}
      </g>
    </svg>
  )
}
