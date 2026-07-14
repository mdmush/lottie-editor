export type JsonPath = (string | number)[]

export function getAtPath(obj: unknown, path: JsonPath): unknown {
  let cur: unknown = obj
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string | number, unknown>)[key]
  }
  return cur
}

/** Mutates in place — intended for use inside an immer `produce` draft. */
export function setAtPath(obj: unknown, path: JsonPath, value: unknown): void {
  if (path.length === 0) throw new Error('setAtPath requires a non-empty path')
  const parent = getAtPath(obj, path.slice(0, -1))
  if (parent == null || typeof parent !== 'object') {
    throw new Error(`setAtPath: no object at path ${path.slice(0, -1).join('.')}`)
  }
  ;(parent as Record<string | number, unknown>)[path[path.length - 1]] = value
}
