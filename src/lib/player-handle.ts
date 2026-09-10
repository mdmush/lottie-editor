/**
 * Imperative bridge to the single live lottie player. Registered by
 * `useLottiePlayer`, consumed by editor UI (track panel seeks, canvas drags
 * pausing playback) — a module ref because exactly one player exists and
 * these calls need no reactivity.
 */
import type { AnimationItem } from 'lottie-web'

export interface PlayerHandle {
  seek: (frame: number) => void
  pause: () => void
  /** The live AnimationItem — for resolving rendered SVG elements. */
  anim: () => AnimationItem | null
}

export const playerHandle: { current: PlayerHandle | null } = { current: null }
