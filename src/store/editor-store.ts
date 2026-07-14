import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { LottieDoc, LottieLayer, ShapeItem } from '../types/lottie'
import {
  applyAlphaToRefs,
  applyColorToRefs,
  extractColors,
  type ColorGroup,
} from '../lib/lottie-colors'
import { getAtPath, type JsonPath } from '../lib/json-path'
import type { HighlightTarget } from '../lib/highlight'

interface EditorState {
  doc: LottieDoc | null
  /** Pristine copy taken at load time; `resetDoc` restores it. */
  originalDoc: LottieDoc | null
  fileName: string | null
  /** Bumped on every doc mutation; the player reloads when it changes. */
  docRevision: number
  /** True once any edit has been made since load/reset. */
  isDirty: boolean
  colorGroups: ColorGroup[]
  /** Element to outline in the player while a tree row is hovered. */
  highlight: HighlightTarget | null
  setHighlight: (target: HighlightTarget | null) => void
  loadFile: (json: LottieDoc, name: string) => void
  /** Live update while dragging a picker — throttled internally. */
  previewColor: (groupHex: string, newHex: string) => void
  /** Final value on picker release — applies immediately and regroups. */
  commitColor: (groupHex: string, newHex: string) => void
  /** Live update while dragging an opacity slider — throttled internally. */
  previewAlpha: (groupHex: string, alpha: number) => void
  commitAlpha: (groupHex: string, alpha: number) => void
  /** Flip an object's `hd` flag. Path points at a layer or shape item. */
  toggleVisibility: (nodePath: JsonPath) => void
  /** Discard all edits and restore the file as it was loaded. */
  resetDoc: () => void
  closeFile: () => void
}

const PREVIEW_THROTTLE_MS = 100

let previewTimer: ReturnType<typeof setTimeout> | null = null
let queuedPreview: (() => void) | null = null

/**
 * Leading + trailing throttle shared by all live-preview edits: apply at
 * most every 100ms while a control is being dragged; the last value always
 * lands.
 */
function runThrottled(apply: () => void) {
  if (previewTimer !== null) {
    queuedPreview = apply
    return
  }
  apply()
  previewTimer = setTimeout(() => {
    previewTimer = null
    if (queuedPreview) {
      const queued = queuedPreview
      queuedPreview = null
      runThrottled(queued)
    }
  }, PREVIEW_THROTTLE_MS)
}

function cancelPendingPreview() {
  if (previewTimer !== null) {
    clearTimeout(previewTimer)
    previewTimer = null
  }
  queuedPreview = null
}

export const useEditorStore = create<EditorState>()(
  immer((set, get) => {
    const applyToGroup = (groupHex: string, newHex: string, regroup: boolean) =>
      set((state) => {
        if (!state.doc) return
        const group = state.colorGroups.find((g) => g.hex === groupHex)
        if (!group) return
        applyColorToRefs(state.doc, group.refs, newHex)
        state.docRevision++
        state.isDirty = true
        if (regroup) state.colorGroups = extractColors(state.doc)
      })

    const applyAlphaToGroup = (groupHex: string, alpha: number) =>
      set((state) => {
        if (!state.doc) return
        const group = state.colorGroups.find((g) => g.hex === groupHex)
        if (!group) return
        applyAlphaToRefs(state.doc, group.refs, alpha)
        state.docRevision++
        state.isDirty = true
      })

    return {
      doc: null,
      originalDoc: null,
      fileName: null,
      docRevision: 0,
      isDirty: false,
      colorGroups: [],
      highlight: null,

      setHighlight: (target) => {
        set((state) => {
          state.highlight = target
        })
      },

      loadFile: (json, name) => {
        cancelPendingPreview()
        const doc = structuredClone(json)
        set((state) => {
          state.doc = doc
          state.originalDoc = structuredClone(json)
          state.fileName = name
          state.docRevision++
          state.isDirty = false
          state.colorGroups = extractColors(doc)
          state.highlight = null
        })
      },

      previewColor: (groupHex, newHex) => {
        runThrottled(() => applyToGroup(groupHex, newHex, false))
      },

      commitColor: (groupHex, newHex) => {
        cancelPendingPreview()
        applyToGroup(groupHex, newHex, true)
      },

      previewAlpha: (groupHex, alpha) => {
        runThrottled(() => applyAlphaToGroup(groupHex, alpha))
      },

      commitAlpha: (groupHex, alpha) => {
        cancelPendingPreview()
        applyAlphaToGroup(groupHex, alpha)
      },

      toggleVisibility: (nodePath) => {
        set((state) => {
          if (!state.doc) return
          const node = getAtPath(state.doc, nodePath) as LottieLayer | ShapeItem | undefined
          if (!node || typeof node !== 'object') return
          node.hd = !node.hd
          state.docRevision++
          state.isDirty = true
        })
      },

      resetDoc: () => {
        cancelPendingPreview()
        const original = get().originalDoc
        if (!original) return
        // Clone the frozen snapshot outside the recipe — cloning a draft
        // proxy inside `set` would walk the whole document through immer.
        const doc = structuredClone(original)
        set((state) => {
          state.doc = doc
          state.docRevision++
          state.isDirty = false
          state.colorGroups = extractColors(doc)
        })
      },

      closeFile: () => {
        cancelPendingPreview()
        set((state) => {
          state.doc = null
          state.originalDoc = null
          state.fileName = null
          state.colorGroups = []
          state.isDirty = false
          state.highlight = null
          state.docRevision++
        })
      },
    }
  }),
)
