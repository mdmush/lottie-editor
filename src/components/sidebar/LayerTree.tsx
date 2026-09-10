import { useMemo } from 'react'
import { buildDocTree } from '../../lib/node-addressing'
import { useEditorStore } from '../../store/editor-store'
import { TreeNode } from './TreeNode'

export function LayerTree() {
  const doc = useEditorStore((s) => s.doc)

  const nodes = useMemo(() => (doc ? buildDocTree(doc) : []), [doc])

  if (nodes.length === 0) {
    return <p className="px-2 py-1 text-[13px] text-ink-400">No layers in this file.</p>
  }

  return (
    <div className="flex flex-col">
      {nodes.map((node) => (
        <TreeNode key={node.id} node={node} depth={0} />
      ))}
    </div>
  )
}
