import { useEffect, useRef } from 'react'
import { useLottiePlayer } from '../../hooks/useLottiePlayer'
import { PlayerControls } from './PlayerControls'
import { Timeline } from './Timeline'

export function Player() {
  const containerRef = useRef<HTMLDivElement>(null)
  const player = useLottiePlayer(containerRef)

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
      <div className="checkerboard relative min-h-0 flex-1 overflow-hidden">
        <div ref={containerRef} className="absolute inset-8 [&_svg]:!h-full [&_svg]:!w-full" />
      </div>
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
