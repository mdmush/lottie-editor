interface Props {
  frame: number
  totalFrames: number
  frameRate: number
  onSeek: (frame: number) => void
}

function formatTime(frames: number, fps: number): string {
  const seconds = fps > 0 ? frames / fps : 0
  return `${seconds.toFixed(2)}s`
}

export function Timeline({ frame, totalFrames, frameRate, onSeek }: Props) {
  const max = Math.max(0, totalFrames - 1)
  const clamped = Math.min(frame, max)
  const pct = max > 0 ? (clamped / max) * 100 : 0

  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-right font-mono text-[11px] tabular-nums text-ink-300">
        {formatTime(clamped, frameRate)}
      </span>
      <div className="relative h-8 min-w-0 flex-1">
        <div aria-hidden="true" className="ruler-ticks absolute inset-x-0 bottom-1 h-4 opacity-70" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-1 h-px bg-ink-700" />
        <div
          aria-hidden="true"
          className="absolute bottom-1 left-0 h-0.5 rounded-full bg-accent/70"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={clamped}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="timeline-range absolute inset-0 h-full w-full"
          aria-label="Timeline"
          aria-valuetext={`Frame ${Math.round(clamped)} of ${totalFrames}`}
        />
      </div>
      <span className="w-14 font-mono text-[11px] tabular-nums text-ink-400">
        {formatTime(totalFrames, frameRate)}
      </span>
    </div>
  )
}
