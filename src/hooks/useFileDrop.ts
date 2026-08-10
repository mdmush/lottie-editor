import { useCallback, useState, type DragEvent } from 'react'
import type { LottieDoc } from '../types/lottie'
import { useEditorStore } from '../store/editor-store'
import { useLibraryStore } from '../store/library-store'

function looksLikeLottie(json: unknown): json is LottieDoc {
  return (
    typeof json === 'object' &&
    json !== null &&
    Array.isArray((json as LottieDoc).layers) &&
    'v' in (json as object)
  )
}

export function useFileDrop() {
  const loadFile = useEditorStore((s) => s.loadFile)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const loadFromFile = useCallback(
    async (file: File) => {
      setError(null)
      try {
        const json: unknown = JSON.parse(await file.text())
        if (!looksLikeLottie(json)) {
          setError(`"${file.name}" is valid JSON but doesn't look like a Lottie animation.`)
          return
        }
        loadFile(json, file.name)
        useLibraryStore.getState().upsert(json, file.name)
      } catch {
        setError(`"${file.name}" could not be parsed as JSON.`)
      }
    },
    [loadFile],
  )

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      // Sequential so a multi-file drop lands in a stable order and the
      // last file ends up open in the editor.
      const files = Array.from(e.dataTransfer.files)
      void (async () => {
        for (const file of files) await loadFromFile(file)
      })()
    },
    [loadFromFile],
  )

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  return { loadFromFile, error, isDragging, dropHandlers: { onDrop, onDragOver, onDragLeave } }
}
