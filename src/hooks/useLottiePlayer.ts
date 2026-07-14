import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import lottie, { type AnimationItem } from 'lottie-web'
import { resolveHighlight } from '../lib/highlight'
import { stripHiddenShapes } from '../lib/strip-hidden'
import { useEditorStore } from '../store/editor-store'

export interface LottiePlayer {
  isPlaying: boolean
  frame: number
  totalFrames: number
  frameRate: number
  speed: number
  loop: boolean
  togglePlay: () => void
  seek: (frame: number) => void
  setSpeed: (speed: number) => void
  setLoop: (loop: boolean) => void
}

/**
 * Shape-hugging outline: chained zero-blur drop-shadows trace the element's
 * actual silhouette (a circle gets a circular outline), unlike a bounding
 * box, and follow the animation for free since they ride on the element.
 */
/** Selection color follows the theme's accent token (amber/goldenrod). */
function getOutlineStyle() {
  const styles = getComputedStyle(document.documentElement)
  const color = styles.getPropertyValue('--color-accent').trim() || '#ffc940'
  const glow = styles.getPropertyValue('--color-accent-glow').trim() || 'rgba(255, 201, 64, 0.6)'
  const filter = [
    `drop-shadow(2px 0 0 ${color})`,
    `drop-shadow(-2px 0 0 ${color})`,
    `drop-shadow(0 2px 0 ${color})`,
    `drop-shadow(0 -2px 0 ${color})`,
    `drop-shadow(0 0 4px ${glow})`,
  ].join(' ')
  return { color, glow, filter }
}
const HIGHLIGHT_ATTR = 'data-highlight'

/**
 * Owns the lottie-web AnimationItem lifecycle inside `containerRef`.
 * Re-initializes whenever the document revision changes (color edits),
 * restoring frame position and play state so live edits don't interrupt
 * playback.
 */
export function useLottiePlayer(containerRef: RefObject<HTMLDivElement | null>): LottiePlayer {
  const doc = useEditorStore((s) => s.doc)
  const docRevision = useEditorStore((s) => s.docRevision)
  const fileName = useEditorStore((s) => s.fileName)

  const animRef = useRef<AnimationItem | null>(null)
  // Play state captured on teardown so the next init (same file) resumes it.
  const restoreRef = useRef<{ frame: number; paused: boolean } | null>(null)
  const lastFileRef = useRef<string | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [frame, setFrame] = useState(0)
  const [totalFrames, setTotalFrames] = useState(0)
  const [speed, setSpeedState] = useState(1)
  const [loop, setLoopState] = useState(true)

  // While a tree row is hovered, keep the outline applied to its rendered
  // element. Re-resolved every animation frame because color edits rebuild
  // the whole SVG mid-hover, and geometry path data changes as it animates.
  const highlight = useEditorStore((s) => s.highlight)
  useEffect(() => {
    if (!highlight) return
    const outline = getOutlineStyle()
    let raf = 0
    // Nodes with their own DOM element get the outline filter directly.
    let styled: SVGGraphicsElement | null = null
    // Geometry items get a dedicated outline <path> injected next to the
    // style element whose coordinate space their cached path string uses.
    let overlay: SVGPathElement | null = null
    let overlayHost: ParentNode | null = null

    const clearStyled = () => {
      if (styled) {
        styled.style.filter = ''
        styled.removeAttribute(HIGHLIGHT_ATTR)
        styled = null
      }
    }
    const clearOverlay = () => {
      overlay?.remove()
      overlay = null
      overlayHost = null
    }

    const tick = () => {
      const anim = animRef.current
      const res = anim ? resolveHighlight(anim, highlight) : null
      if (!res) {
        clearStyled()
        clearOverlay()
      } else if (res.kind === 'element') {
        clearOverlay()
        if (res.el !== styled) {
          clearStyled()
          res.el.style.filter = outline.filter
          res.el.setAttribute(HIGHLIGHT_ATTR, '')
          styled = res.el
        }
      } else {
        clearStyled()
        const host = res.stylePElem.parentNode
        if (!host) {
          clearOverlay()
        } else {
          if (!overlay || !overlay.isConnected || overlayHost !== host) {
            clearOverlay()
            overlay = document.createElementNS('http://www.w3.org/2000/svg', 'path')
            overlay.setAttribute('fill', 'none')
            overlay.setAttribute('stroke', outline.color)
            overlay.setAttribute('stroke-width', '2.5')
            overlay.setAttribute('stroke-linejoin', 'round')
            // Keep the outline width constant regardless of viewBox scale
            // and the group transforms it sits under.
            overlay.setAttribute('vector-effect', 'non-scaling-stroke')
            overlay.setAttribute('pointer-events', 'none')
            overlay.setAttribute(HIGHLIGHT_ATTR, '')
            overlay.style.filter = `drop-shadow(0 0 3px ${outline.glow})`
            host.appendChild(overlay)
            overlayHost = host
          }
          const d = res.item.caches[0] ?? ''
          if (d) {
            if (overlay.getAttribute('d') !== d) overlay.setAttribute('d', d)
          } else {
            overlay.removeAttribute('d')
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      clearStyled()
      clearOverlay()
    }
  }, [highlight])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !doc) {
      setFrame(0)
      setTotalFrames(0)
      setIsPlaying(false)
      return
    }

    const isNewFile = fileName !== lastFileRef.current
    lastFileRef.current = fileName
    const restore = isNewFile ? null : restoreRef.current

    const anim = lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop,
      autoplay: false,
      // lottie-web mutates animationData while parsing — never hand it the
      // store's (frozen) document directly. Hidden shapes are stripped from
      // the clone (lottie-web ignores `hd` on shape groups), matching export.
      animationData: stripHiddenShapes(structuredClone(doc)),
    })
    animRef.current = anim
    anim.setSpeed(speed)
    setTotalFrames(anim.totalFrames)

    if (restore?.paused) {
      anim.goToAndStop(restore.frame, true)
      setFrame(restore.frame)
      setIsPlaying(false)
    } else {
      anim.goToAndPlay(restore?.frame ?? 0, true)
      setIsPlaying(true)
    }

    const onEnterFrame = () => setFrame(anim.currentFrame)
    const onComplete = () => setIsPlaying(false)
    anim.addEventListener('enterFrame', onEnterFrame)
    anim.addEventListener('complete', onComplete)

    return () => {
      restoreRef.current = { frame: anim.currentFrame, paused: anim.isPaused }
      anim.destroy()
      animRef.current = null
    }
    // speed/loop are applied imperatively below; only doc changes re-init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, docRevision, fileName, containerRef])

  const togglePlay = useCallback(() => {
    const anim = animRef.current
    if (!anim) return
    if (anim.isPaused) {
      // Restart from the top when a non-looping animation finished.
      if (!anim.loop && anim.currentFrame >= anim.totalFrames - 1) anim.goToAndPlay(0, true)
      else anim.play()
      setIsPlaying(true)
    } else {
      anim.pause()
      setIsPlaying(false)
    }
  }, [])

  const seek = useCallback((target: number) => {
    const anim = animRef.current
    if (!anim) return
    if (anim.isPaused) anim.goToAndStop(target, true)
    else anim.goToAndPlay(target, true)
    setFrame(target)
  }, [])

  const setSpeed = useCallback((value: number) => {
    animRef.current?.setSpeed(value)
    setSpeedState(value)
  }, [])

  const setLoop = useCallback((value: boolean) => {
    const anim = animRef.current
    if (anim) anim.loop = value
    setLoopState(value)
  }, [])

  return {
    isPlaying,
    frame,
    totalFrames,
    frameRate: typeof doc?.fr === 'number' ? doc.fr : 30,
    speed,
    loop,
    togglePlay,
    seek,
    setSpeed,
    setLoop,
  }
}
