import { useState } from 'react'
import type { HighlightTarget } from '../../lib/highlight'
import type { JsonPath } from '../../lib/json-path'
import { useEditorStore } from '../../store/editor-store'

export interface TreeNodeData {
  id: string
  label: string
  badge?: string
  children: TreeNodeData[]
  /** Present on hideable nodes (layers and shape items) — enables the visibility toggle. */
  nodePath?: JsonPath
  hidden?: boolean
  /** Rendered element to outline in the player on hover; null when hidden. */
  highlightTarget?: HighlightTarget | null
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M2 2l12 12M6.5 6.7A2 2 0 0 0 9.3 9.5M4.2 4.4C2.9 5.3 1.9 6.6 1.3 8c1.2 2.7 3.7 4.5 6.7 4.5 1 0 2-.2 2.9-.6M7 3.6A7 7 0 0 1 8 3.5c3 0 5.5 1.8 6.7 4.5-.4.9-.9 1.7-1.6 2.4" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M1.3 8C2.5 5.3 5 3.5 8 3.5S13.5 5.3 14.7 8C13.5 10.7 11 12.5 8 12.5S2.5 10.7 1.3 8Z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  )
}

export function TreeNode({ node, depth }: { node: TreeNodeData; depth: number }) {
  const [open, setOpen] = useState(depth < 1)
  const toggleVisibility = useEditorStore((s) => s.toggleVisibility)
  const setHighlight = useEditorStore((s) => s.setHighlight)
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className="group flex items-center rounded-md transition-colors hover:bg-ink-800"
        onMouseEnter={() => setHighlight(node.highlightTarget ?? null)}
        onMouseLeave={() => setHighlight(null)}
      >
        <button
          onClick={() => hasChildren && setOpen((o) => !o)}
          aria-expanded={hasChildren ? open : undefined}
          className={`flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left text-[13px] ${
            hasChildren ? '' : 'cursor-default'
          }`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          <span className="flex w-3 shrink-0 items-center justify-center text-ink-500">
            {hasChildren && (
              <svg
                viewBox="0 0 12 12"
                className={`h-3 w-3 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4.5 2.5 8 6l-3.5 3.5" />
              </svg>
            )}
          </span>
          <span
            className={`truncate ${
              node.hidden ? 'text-ink-500 line-through decoration-ink-600' : 'text-ink-200'
            }`}
          >
            {node.label}
          </span>
          {node.badge && (
            <span className="ml-auto shrink-0 rounded bg-ink-800 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-ink-400 group-hover:bg-ink-700">
              {node.badge}
            </span>
          )}
        </button>
        {node.nodePath && (
          <button
            onClick={() => toggleVisibility(node.nodePath!)}
            aria-label={`${node.hidden ? 'Show' : 'Hide'} ${node.label}`}
            aria-pressed={!!node.hidden}
            title={node.hidden ? 'Show' : 'Hide'}
            className={`mr-1 shrink-0 rounded p-1 transition-colors hover:bg-ink-700 hover:text-ink-100 ${
              node.hidden
                ? 'text-ink-500'
                : 'text-ink-400 opacity-0 focus-visible:opacity-100 group-hover:opacity-100'
            }`}
          >
            <EyeIcon hidden={!!node.hidden} />
          </button>
        )}
      </div>
      {open &&
        node.children.map((child) => <TreeNode key={child.id} node={child} depth={depth + 1} />)}
    </div>
  )
}
