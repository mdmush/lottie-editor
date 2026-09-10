import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { LottieDoc, LottieLayer, LottieProperty, ShapeItem } from '../types/lottie'
import {
  applyAlphaToRefs,
  applyColorToRefs,
  extractColors,
  type ColorGroup,
} from '../lib/lottie-colors'
import { getAtPath, setAtPath, type JsonPath } from '../lib/json-path'
import type { HighlightTarget } from '../lib/highlight'
import {
  deleteKeyframeAt,
  moveKeyframeT,
  upsertKeyframeAtFrame,
  valueAtFrame,
} from '../lib/keyframes'

interface EditorState {
  doc: LottieDoc | null
  /** Pristine copy taken at load time; `resetDoc` restores it. */
  originalDoc: LottieDoc | null
  fileName: string | null
  /** Bumped on every doc mutation; the player reloads when it changes. */
  docRevision: number
  /** True once any edit has been made since load/reset. */
  isDirty: boolean
  /** docRevision at the last library save; unsaved = docRevision differs. */
  savedRevision: number
  /** Timestamp of the last successful library save for the open file. */
  lastSavedAt: number | null
  isSaving: boolean
  markSaving: () => void
  markSaved: (revision: number, at: number) => void
  colorGroups: ColorGroup[]
  /** Element to outline in the player while a tree row is hovered. */
  highlight: HighlightTarget | null
  setHighlight: (target: HighlightTarget | null) => void
  /**
   * The element open in editor mode. Only the doc path is stored — kind,
   * label, and the rendered-SVG target are derived from `doc + nodePath`
   * because rendered indices drift on visibility toggles and undo.
   */
  selection: { nodePath: JsonPath } | null
  select: (nodePath: JsonPath) => void
  clearSelection: () => void
  /**
   * Undo history as plain doc references. The immer middleware produces a
   * new frozen doc per mutation with structural sharing, so the previous
   * `doc` reference is already a free immutable snapshot.
   */
  past: LottieDoc[]
  future: LottieDoc[]
  undo: () => void
  redo: () => void
  /** Integer current frame, mirrored from the player for editor UI. */
  playhead: number
  setPlayhead: (frame: number) => void
  /** Track row the K shortcut targets (last focused/hovered property). */
  focusedProperty: JsonPath | null
  setFocusedProperty: (propPath: JsonPath | null) => void
  /** Keyframe diamond selected in the track panel (Delete target). */
  selectedKeyframe: { propPath: JsonPath; index: number } | null
  setSelectedKeyframe: (kf: { propPath: JsonPath; index: number } | null) => void
  /**
   * Set a property's value at the playhead: static properties update in
   * place, animated ones upsert a keyframe at the current frame. One undo
   * entry per call.
   */
  updateProperty: (propPath: JsonPath, value: number[]) => void
  /** Live drag variant of updateProperty — throttled, no history entry. */
  previewProperty: (propPath: JsonPath, value: number[]) => void
  /** Drag release — applies the final value and pushes one undo entry for the gesture. */
  commitProperty: (propPath: JsonPath, value: number[]) => void
  /**
   * Multi-property variants for canvas drags (split position writes X and Y
   * together): all edits land in one revision and one undo entry.
   */
  previewEdits: (edits: { propPath: JsonPath; value: number[] }[]) => void
  commitEdits: (edits: { propPath: JsonPath; value: number[] }[]) => void
  /** Insert a keyframe at the playhead holding the current interpolated value. */
  addKeyframeAtPlayhead: (propPath: JsonPath) => void
  removeKeyframe: (propPath: JsonPath, index: number) => void
  previewMoveKeyframe: (propPath: JsonPath, index: number, t: number) => void
  commitMoveKeyframe: (propPath: JsonPath, index: number, t: number) => void
  /** Replace the selected element's JSON subtree. Returns false when the path is gone. */
  applyJsonEdit: (nodePath: JsonPath, value: unknown) => boolean
  loadFile: (json: LottieDoc, name: string, savedAt?: number) => void
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
const UNDO_LIMIT = 100

let previewTimer: ReturnType<typeof setTimeout> | null = null
let queuedPreview: (() => void) | null = null

/**
 * Doc reference captured before the first preview of a drag gesture, so the
 * commit at pointer-up pushes exactly one undo entry for the whole drag —
 * regardless of how many throttled previews landed in between.
 */
let gestureBase: LottieDoc | null = null

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

/** Called on file switch/close — an interrupted gesture must not leak its base. */
function abortGesture() {
  cancelPendingPreview()
  gestureBase = null
}

export const useEditorStore = create<EditorState>()(
  immer((set, get) => {
    /**
     * Chokepoint for every undoable doc mutation: runs `recipe` on the
     * draft, bumps the revision, and pushes `undoBase` (default: the doc as
     * it was before this call) onto the undo stack. Pass `undoBase: null`
     * for previews — they render live but leave no history entry.
     */
    const mutateDoc = (
      recipe: (state: EditorState) => void,
      opts?: { undoBase: LottieDoc | null },
    ) => {
      const prev = opts ? opts.undoBase : get().doc
      set((state) => {
        if (!state.doc) return
        recipe(state as EditorState)
        state.docRevision++
        state.isDirty = true
        if (prev) {
          state.past.push(prev)
          if (state.past.length > UNDO_LIMIT) state.past.shift()
          state.future = []
        }
      })
    }

    /** Begin (or continue) a drag gesture; returns nothing, previews use it implicitly. */
    const captureGestureBase = () => {
      if (gestureBase === null) gestureBase = get().doc
    }

    /** End a drag gesture, returning the doc to attribute the whole drag to. */
    const takeGestureBase = (): LottieDoc | null => {
      const base = gestureBase ?? get().doc
      gestureBase = null
      return base
    }

    const applyToGroup = (
      groupHex: string,
      newHex: string,
      regroup: boolean,
      undoBase: LottieDoc | null,
    ) => {
      // Bail before mutateDoc — a no-op must not leave an undo entry.
      if (!get().colorGroups.some((g) => g.hex === groupHex)) return
      mutateDoc(
        (state) => {
          const group = state.colorGroups.find((g) => g.hex === groupHex)
          if (!group || !state.doc) return
          applyColorToRefs(state.doc, group.refs, newHex)
          if (regroup) state.colorGroups = extractColors(state.doc)
        },
        { undoBase },
      )
    }

    const applyAlphaToGroup = (groupHex: string, alpha: number, undoBase: LottieDoc | null) => {
      if (!get().colorGroups.some((g) => g.hex === groupHex)) return
      mutateDoc(
        (state) => {
          const group = state.colorGroups.find((g) => g.hex === groupHex)
          if (!group || !state.doc) return
          applyAlphaToRefs(state.doc, group.refs, alpha)
        },
        { undoBase },
      )
    }

    return {
      doc: null,
      originalDoc: null,
      fileName: null,
      docRevision: 0,
      isDirty: false,
      savedRevision: 0,
      lastSavedAt: null,
      isSaving: false,
      colorGroups: [],
      highlight: null,
      selection: null,
      past: [],
      future: [],
      playhead: 0,
      focusedProperty: null,
      selectedKeyframe: null,

      markSaving: () => {
        set((state) => {
          state.isSaving = true
        })
      },

      markSaved: (revision, at) => {
        set((state) => {
          state.isSaving = false
          // A stale save (older overlapping write) must not regress state.
          if (revision <= state.savedRevision) return
          state.savedRevision = revision
          state.lastSavedAt = at
        })
      },

      setHighlight: (target) => {
        set((state) => {
          state.highlight = target
        })
      },

      select: (nodePath) => {
        set((state) => {
          state.selection = { nodePath }
          state.focusedProperty = null
          state.selectedKeyframe = null
        })
      },

      clearSelection: () => {
        set((state) => {
          state.selection = null
          state.focusedProperty = null
          state.selectedKeyframe = null
        })
      },

      undo: () => {
        const { doc, past } = get()
        if (!doc || past.length === 0) return
        abortGesture()
        const prev = past[past.length - 1]
        set((state) => {
          state.past.pop()
          state.future.push(doc)
          state.doc = prev
          state.docRevision++
          state.isDirty = true
          state.colorGroups = extractColors(prev)
          // Keyframe indices may have shifted arbitrarily.
          state.selectedKeyframe = null
          if (state.selection && getAtPath(prev, state.selection.nodePath) === undefined) {
            state.selection = null
          }
        })
      },

      redo: () => {
        const { doc, future } = get()
        if (!doc || future.length === 0) return
        abortGesture()
        const next = future[future.length - 1]
        set((state) => {
          state.future.pop()
          state.past.push(doc)
          state.doc = next
          state.docRevision++
          state.isDirty = true
          state.colorGroups = extractColors(next)
          state.selectedKeyframe = null
          if (state.selection && getAtPath(next, state.selection.nodePath) === undefined) {
            state.selection = null
          }
        })
      },

      setPlayhead: (frame) => {
        const rounded = Math.round(frame)
        // Written from enterFrame — dedupe to one store update per int frame.
        if (rounded === get().playhead) return
        set((state) => {
          state.playhead = rounded
        })
      },

      setFocusedProperty: (propPath) => {
        set((state) => {
          state.focusedProperty = propPath
        })
      },

      setSelectedKeyframe: (kf) => {
        set((state) => {
          state.selectedKeyframe = kf
        })
      },

      updateProperty: (propPath, value) => {
        const playhead = get().playhead
        const prop = getAtPath(get().doc, propPath)
        if (!prop || typeof prop !== 'object' || !value.every(Number.isFinite)) return
        mutateDoc((state) => {
          upsertKeyframeAtFrame(getAtPath(state.doc, propPath) as LottieProperty, playhead, value)
        })
      },

      previewProperty: (propPath, value) => {
        const playhead = get().playhead
        if (!getAtPath(get().doc, propPath) || !value.every(Number.isFinite)) return
        captureGestureBase()
        runThrottled(() =>
          mutateDoc(
            (state) => {
              upsertKeyframeAtFrame(
                getAtPath(state.doc, propPath) as LottieProperty,
                playhead,
                value,
              )
            },
            { undoBase: null },
          ),
        )
      },

      commitProperty: (propPath, value) => {
        cancelPendingPreview()
        const playhead = get().playhead
        if (!getAtPath(get().doc, propPath) || !value.every(Number.isFinite)) return
        mutateDoc(
          (state) => {
            upsertKeyframeAtFrame(getAtPath(state.doc, propPath) as LottieProperty, playhead, value)
          },
          { undoBase: takeGestureBase() },
        )
      },

      previewEdits: (edits) => {
        const playhead = get().playhead
        const valid = edits.filter(
          (e) => getAtPath(get().doc, e.propPath) && e.value.every(Number.isFinite),
        )
        if (valid.length === 0) return
        captureGestureBase()
        runThrottled(() =>
          mutateDoc(
            (state) => {
              for (const e of valid) {
                upsertKeyframeAtFrame(
                  getAtPath(state.doc, e.propPath) as LottieProperty,
                  playhead,
                  e.value,
                )
              }
            },
            { undoBase: null },
          ),
        )
      },

      commitEdits: (edits) => {
        cancelPendingPreview()
        const playhead = get().playhead
        const valid = edits.filter(
          (e) => getAtPath(get().doc, e.propPath) && e.value.every(Number.isFinite),
        )
        if (valid.length === 0) {
          gestureBase = null
          return
        }
        mutateDoc(
          (state) => {
            for (const e of valid) {
              upsertKeyframeAtFrame(
                getAtPath(state.doc, e.propPath) as LottieProperty,
                playhead,
                e.value,
              )
            }
          },
          { undoBase: takeGestureBase() },
        )
      },

      addKeyframeAtPlayhead: (propPath) => {
        const { doc, playhead } = get()
        const prop = getAtPath(doc, propPath) as LottieProperty | undefined
        if (!prop || typeof prop !== 'object') return
        const value = valueAtFrame(prop, playhead)
        if (!value) return
        mutateDoc((state) => {
          upsertKeyframeAtFrame(getAtPath(state.doc, propPath) as LottieProperty, playhead, value, {
            forceKeyframe: true,
          })
        })
      },

      removeKeyframe: (propPath, index) => {
        const prop = getAtPath(get().doc, propPath)
        if (!prop || typeof prop !== 'object') return
        mutateDoc((state) => {
          deleteKeyframeAt(getAtPath(state.doc, propPath) as LottieProperty, index)
          const sel = state.selectedKeyframe
          if (sel && sel.propPath.join('/') === propPath.join('/')) state.selectedKeyframe = null
        })
      },

      previewMoveKeyframe: (propPath, index, t) => {
        if (!getAtPath(get().doc, propPath)) return
        captureGestureBase()
        runThrottled(() =>
          mutateDoc(
            (state) => {
              moveKeyframeT(getAtPath(state.doc, propPath) as LottieProperty, index, t)
            },
            { undoBase: null },
          ),
        )
      },

      commitMoveKeyframe: (propPath, index, t) => {
        cancelPendingPreview()
        if (!getAtPath(get().doc, propPath)) return
        mutateDoc(
          (state) => {
            moveKeyframeT(getAtPath(state.doc, propPath) as LottieProperty, index, t)
          },
          { undoBase: takeGestureBase() },
        )
      },

      applyJsonEdit: (nodePath, value) => {
        if (getAtPath(get().doc, nodePath) === undefined) return false
        mutateDoc((state) => {
          setAtPath(state.doc, nodePath, value)
          // Colors may have changed arbitrarily.
          if (state.doc) state.colorGroups = extractColors(state.doc)
        })
        return true
      },

      loadFile: (json, name, savedAt) => {
        abortGesture()
        const doc = structuredClone(json)
        set((state) => {
          state.doc = doc
          state.originalDoc = structuredClone(json)
          state.fileName = name
          state.docRevision++
          state.isDirty = false
          // A just-loaded file matches its library record by definition.
          state.savedRevision = state.docRevision
          state.lastSavedAt = savedAt ?? Date.now()
          state.isSaving = false
          state.colorGroups = extractColors(doc)
          state.highlight = null
          state.selection = null
          state.past = []
          state.future = []
          state.playhead = 0
          state.focusedProperty = null
          state.selectedKeyframe = null
        })
      },

      previewColor: (groupHex, newHex) => {
        captureGestureBase()
        runThrottled(() => applyToGroup(groupHex, newHex, false, null))
      },

      commitColor: (groupHex, newHex) => {
        cancelPendingPreview()
        applyToGroup(groupHex, newHex, true, takeGestureBase())
      },

      previewAlpha: (groupHex, alpha) => {
        captureGestureBase()
        runThrottled(() => applyAlphaToGroup(groupHex, alpha, null))
      },

      commitAlpha: (groupHex, alpha) => {
        cancelPendingPreview()
        applyAlphaToGroup(groupHex, alpha, takeGestureBase())
      },

      toggleVisibility: (nodePath) => {
        const existing = getAtPath(get().doc, nodePath)
        if (!existing || typeof existing !== 'object') return
        mutateDoc((state) => {
          const node = getAtPath(state.doc, nodePath) as LottieLayer | ShapeItem
          node.hd = !node.hd
        })
      },

      resetDoc: () => {
        abortGesture()
        const { originalDoc, doc: prev } = get()
        if (!originalDoc) return
        // Clone the frozen snapshot outside the recipe — cloning a draft
        // proxy inside `set` would walk the whole document through immer.
        const doc = structuredClone(originalDoc)
        set((state) => {
          state.doc = doc
          state.docRevision++
          state.isDirty = false
          state.colorGroups = extractColors(doc)
          if (prev) {
            state.past.push(prev)
            if (state.past.length > UNDO_LIMIT) state.past.shift()
            state.future = []
          }
          if (state.selection && getAtPath(doc, state.selection.nodePath) === undefined) {
            state.selection = null
          }
        })
      },

      closeFile: () => {
        abortGesture()
        set((state) => {
          state.doc = null
          state.originalDoc = null
          state.fileName = null
          state.colorGroups = []
          state.isDirty = false
          state.highlight = null
          state.selection = null
          state.past = []
          state.future = []
          state.playhead = 0
          state.focusedProperty = null
          state.selectedKeyframe = null
          state.docRevision++
          state.savedRevision = state.docRevision
          state.lastSavedAt = null
          state.isSaving = false
        })
      },
    }
  }),
)
