import { useCallback, useState, type DragEvent } from 'react'
import type { LottieDoc } from '../types/lottie'
import { useEditorStore } from '../store/editor-store'

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
      const file = e.dataTransfer.files[0]
      if (file) void loadFromFile(file)
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
