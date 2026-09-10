import { useEffect, useRef } from 'react'
import { useLottiePlayer } from '../../hooks/useLottiePlayer'
import { resolveHighlight } from '../../lib/highlight'
import type { JsonPath } from '../../lib/json-path'
import { buildDocTree, type DocNode } from '../../lib/node-addressing'
import { playerHandle } from '../../lib/player-handle'
import { useEditorStore } from '../../store/editor-store'
import { PlayerControls } from './PlayerControls'
import { SelectionOverlay } from './SelectionOverlay'
import { Timeline } from './Timeline'
import { TrackPanel } from './TrackPanel'

/**
 * Click-to-select: find the doc nodes whose rendered element contains the
 * click target. DFS order lists ancestors before descendants, so the last
 * match is the deepest — Alt-click picks the shallowest (the layer) instead.
 */
function selectFromCanvasClick(clickTarget: Element, altKey: boolean) {
  const state = useEditorStore.getState()
  const anim = playerHandle.current?.anim() ?? null
  if (!state.doc || !anim) return
  const matches: JsonPath[] = []
  const visit = (nodes: DocNode[]) => {
    for (const node of nodes) {
      if (node.target) {
        const res = resolveHighlight(anim, node.target)
        const el = res ? (res.kind === 'element' ? res.el : res.stylePElem) : null
        if (el && (el === clickTarget || el.contains(clickTarget))) matches.push(node.path)
      }
      visit(node.children)
    }
  }
  visit(buildDocTree(state.doc))
  if (matches.length > 0) {
    state.select(altKey ? matches[0] : matches[matches.length - 1])
  } else if (state.selection) {
    state.clearSelection()
  }
}

export function Player() {
  const containerRef = useRef<HTMLDivElement>(null)
  const player = useLottiePlayer(containerRef)
  const editing = useEditorStore((s) => s.selection !== null)

  // Ref so the single keydown listener always sees the current frame/handlers.
  const playerRef = useRef(player)
  playerRef.current = player

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'BUTTON')
        return
      const p = playerRef.current
      if (e.code === 'Space') {
        e.preventDefault()
        p.togglePlay()
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        if (p.totalFrames === 0) return
        e.preventDefault()
        const step = (e.code === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1)
        const max = Math.max(0, p.totalFrames - 1)
        p.seek(Math.min(max, Math.max(0, Math.round(p.frame) + step)))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex h-full flex-col">
      <div
        className="checkerboard relative min-h-0 flex-1 overflow-hidden"
        onClick={(e) => {
          const target = e.target as Element
          // Ignore clicks on (or drags ending over) the handle overlay.
          if (target.closest('[data-selection-overlay]')) return
          selectFromCanvasClick(target, e.altKey)
        }}
      >
        <div ref={containerRef} className="absolute inset-8 [&_svg]:!h-full [&_svg]:!w-full" />
        <SelectionOverlay />
      </div>
      {editing && <TrackPanel />}
      <div className="border-t border-ink-800 bg-ink-900 px-4 pb-3 pt-2">
        <Timeline
          frame={player.frame}
          totalFrames={player.totalFrames}
          frameRate={player.frameRate}
          onSeek={player.seek}
        />
        <PlayerControls
          isPlaying={player.isPlaying}
          speed={player.speed}
          loop={player.loop}
          frame={player.frame}
          totalFrames={player.totalFrames}
          frameRate={player.frameRate}
          onTogglePlay={player.togglePlay}
          onSpeedChange={player.setSpeed}
          onLoopChange={player.setLoop}
        />
      </div>
    </div>
  )
}
