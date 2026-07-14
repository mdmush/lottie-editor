import { downloadLottie } from '../lib/download'
import { useEditorStore } from '../store/editor-store'

export function ExportButton() {
  const doc = useEditorStore((s) => s.doc)
  const fileName = useEditorStore((s) => s.fileName)

  return (
    <button
      disabled={!doc}
      onClick={() => doc && downloadLottie(doc, fileName)}
      className="flex h-8 items-center gap-2 rounded-lg bg-accent px-3.5 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-bright disabled:opacity-40 disabled:hover:bg-accent"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
      </svg>
      Export JSON
    </button>
  )
}
