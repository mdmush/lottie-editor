import { useState } from 'react'
import { describeNode } from '../../lib/node-addressing'
import { useEditorStore } from '../../store/editor-store'
import { Inspector } from '../inspector/Inspector'
import { JsonView } from '../inspector/JsonView'
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

const TABS = [
  { id: 'inspect', label: 'Inspect' },
  { id: 'json', label: 'JSON' },
] as const
type TabId = (typeof TABS)[number]['id']

/** Editor-mode bottom half: element name + Inspect/JSON tab switch. */
function ElementPanel() {
  const [tab, setTab] = useState<TabId>('inspect')
  const label = useEditorStore((s) =>
    s.doc && s.selection ? (describeNode(s.doc, s.selection.nodePath)?.label ?? '—') : '—',
  )
  const selectionKey = useEditorStore((s) => s.selection?.nodePath.join('/') ?? '')

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 pb-2 pt-3">
        <h2 className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
          {label}
        </h2>
        <div
          role="group"
          aria-label="Element view"
          className="ml-auto flex shrink-0 rounded-lg border border-ink-700 bg-ink-850 p-0.5"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                tab === t.id ? 'bg-ink-600 text-ink-100' : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {tab === 'inspect' ? <Inspector /> : <JsonView key={selectionKey} />}
      </div>
    </section>
  )
}

export function Sidebar() {
  const colorCount = useEditorStore((s) => s.colorGroups.length)
  const layerCount = useEditorStore((s) => s.doc?.layers?.length ?? 0)
  const editing = useEditorStore((s) => s.selection !== null)

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col overflow-hidden border-l border-ink-800 bg-ink-900">
      {editing ? (
        <section className="flex max-h-[45%] flex-col border-b border-ink-800">
          <SectionHeader title="Layers" count={layerCount} />
          <div className="min-h-0 overflow-y-auto px-2 pb-3">
            <LayerTree />
          </div>
        </section>
      ) : (
        <section className="flex max-h-[45%] flex-col border-b border-ink-800">
          <SectionHeader title="Colors" count={colorCount} />
          <div className="min-h-0 overflow-y-auto px-2 pb-3">
            <ColorPanel />
          </div>
        </section>
      )}
      {editing ? (
        <ElementPanel />
      ) : (
        <section className="flex min-h-0 flex-1 flex-col">
          <SectionHeader title="Layers" count={layerCount} />
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <LayerTree />
          </div>
        </section>
      )}
    </aside>
  )
}
