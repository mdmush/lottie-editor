import { useEditorStore } from '../../store/editor-store'
import { ColorPanel } from './ColorPanel'
import { LayerTree } from './LayerTree'

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="flex items-baseline gap-2 px-4 pb-2 pt-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
      {title}
      <span className="font-mono text-[10px] font-normal tabular-nums tracking-normal text-ink-500">
        {count}
      </span>
    </h2>
  )
}

export function Sidebar() {
  const colorCount = useEditorStore((s) => s.colorGroups.length)
  const layerCount = useEditorStore((s) => s.doc?.layers?.length ?? 0)

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col overflow-hidden border-l border-ink-800 bg-ink-900">
      <section className="flex max-h-[45%] flex-col border-b border-ink-800">
        <SectionHeader title="Colors" count={colorCount} />
        <div className="min-h-0 overflow-y-auto px-2 pb-3">
          <ColorPanel />
        </div>
      </section>
      <section className="flex min-h-0 flex-1 flex-col">
        <SectionHeader title="Layers" count={layerCount} />
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <LayerTree />
        </div>
      </section>
    </aside>
  )
}
