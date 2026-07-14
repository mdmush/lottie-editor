const SPEEDS = [0.25, 0.5, 1, 1.5, 2]

interface Props {
  isPlaying: boolean
  speed: number
  loop: boolean
  frame: number
  totalFrames: number
  frameRate: number
  onTogglePlay: () => void
  onSpeedChange: (speed: number) => void
  onLoopChange: (loop: boolean) => void
}

export function PlayerControls({
  isPlaying,
  speed,
  loop,
  frame,
  totalFrames,
  frameRate,
  onTogglePlay,
  onSpeedChange,
  onLoopChange,
}: Props) {
  const pad = String(Math.max(0, totalFrames - 1)).length
  return (
    <div className="mt-1.5 flex items-center gap-3">
      <button
        onClick={onTogglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-colors hover:bg-accent-bright"
      >
        {isPlaying ? (
          <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-hidden="true">
            <rect x="3" y="2" width="4" height="12" rx="1" />
            <rect x="9" y="2" width="4" height="12" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true">
            <path d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5Z" />
          </svg>
        )}
      </button>

      <div
        role="group"
        aria-label="Playback speed"
        className="flex rounded-lg border border-ink-700 bg-ink-850 p-0.5"
      >
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            aria-pressed={speed === s}
            className={`rounded-md px-2 py-1 font-mono text-[11px] tabular-nums transition-colors ${
              speed === s
                ? 'bg-ink-600 text-ink-100'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>

      <button
        onClick={() => onLoopChange(!loop)}
        aria-pressed={loop}
        aria-label="Loop playback"
        title="Loop"
        className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
          loop
            ? 'border-ink-600 bg-ink-800 text-accent-text'
            : 'border-ink-700 text-ink-400 hover:text-ink-200'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m17 2 4 4-4 4" />
          <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
          <path d="m7 22-4-4 4-4" />
          <path d="M21 13v1a4 4 0 0 1-4 4H3" />
        </svg>
      </button>

      <span className="font-mono text-[11px] tabular-nums text-ink-400">
        f&thinsp;{String(Math.round(Math.min(frame, Math.max(0, totalFrames - 1)))).padStart(pad, '0')}
        <span className="text-ink-500"> / {Math.max(0, totalFrames - 1)}</span>
        <span className="text-ink-500"> · {frameRate}&thinsp;fps</span>
      </span>

      <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-ink-400 sm:flex">
        <kbd>Space</kbd> play
        <span className="text-ink-600">·</span>
        <kbd>←</kbd>
        <kbd>→</kbd> step
        <span className="text-ink-600">·</span>
        <kbd>⇧</kbd> ×10
      </span>
    </div>
  )
}
