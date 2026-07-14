import { useRef } from 'react'
import { useFileDrop } from '../hooks/useFileDrop'

export function DropZone() {
  const { loadFromFile, error, isDragging, dropHandlers } = useFileDrop()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      {...dropHandlers}
      className={`flex h-full flex-col items-center justify-center gap-5 px-6 transition-colors duration-200 ${
        isDragging ? 'bg-ink-900' : 'bg-ink-950'
      }`}
    >
      <button
        onClick={() => inputRef.current?.click()}
        className={`group relative flex w-full max-w-lg flex-col items-center gap-5 rounded-2xl border-2 border-dashed px-10 py-16 text-center transition-[border-color,transform] duration-200 ${
          isDragging
            ? 'drop-glow scale-[1.02] border-accent'
            : 'border-ink-700 hover:border-ink-500'
        }`}
      >
        <svg viewBox="0 0 24 24" className={`h-12 w-12 transition-colors ${isDragging ? 'stroke-accent' : 'stroke-ink-500'}`} fill="none" strokeWidth="1.5" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
          />
        </svg>
        <div>
          <p className="font-display text-xl font-semibold text-ink-100">
            {isDragging ? 'Drop it here' : 'Drop a Lottie file'}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-400">
            .json exports from After Effects (Bodymovin), Figma, or LottieFiles.
            <br />
            Preview it, recolor it, toggle layers, export.
          </p>
        </div>
        <span className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors group-hover:bg-accent-bright">
          Browse files
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label="Choose a Lottie JSON file"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void loadFromFile(file)
          e.target.value = ''
        }}
      />
      {error && (
        <p
          role="alert"
          className="max-w-md rounded-lg border border-danger-border bg-danger-surface px-4 py-2 text-sm text-danger-text"
        >
          {error}
        </p>
      )}
    </div>
  )
}
