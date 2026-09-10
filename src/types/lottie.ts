/**
 * Pragmatic partial typings for the Lottie/Bodymovin JSON schema.
 * Only the fields the editor traverses are typed; everything else is
 * preserved via index signatures so untouched data round-trips intact.
 */

export interface LottieProperty {
  /** 0 = static, 1 = animated */
  a?: number
  k?: unknown
  [key: string]: unknown
}

/** Per-segment easing handle; x/y are per-dimension arrays or scalars. */
export interface KeyframeEasing {
  x?: number[] | number
  y?: number[] | number
  [key: string]: unknown
}

export interface LottieKeyframe {
  t?: number
  s?: unknown
  /** legacy end-value, emitted by old Bodymovin versions */
  e?: unknown
  /** incoming easing of the segment this keyframe starts */
  i?: KeyframeEasing
  /** outgoing easing of the segment this keyframe starts */
  o?: KeyframeEasing
  /** 1 = hold — the value jumps at the next keyframe */
  h?: number
  /** spatial in-tangent of the segment this (position) keyframe starts */
  ti?: number[]
  /** spatial out-tangent of the segment this (position) keyframe starts */
  to?: number[]
  [key: string]: unknown
}

/**
 * Position properties may be split (`s: true`) into independent scalar
 * `x`/`y` (and `z`) sub-properties instead of a single multi-dim `k`.
 */
export interface LottiePositionProperty extends LottieProperty {
  s?: unknown
  x?: LottieProperty
  y?: LottieProperty
  z?: LottieProperty
}

export interface LottieTransform {
  a?: LottieProperty
  p?: LottiePositionProperty
  s?: LottieProperty
  r?: LottieProperty
  o?: LottieProperty
  sk?: LottieProperty
  sa?: LottieProperty
  [key: string]: unknown
}

export interface GradientDef {
  /** number of color stops in the flattened k.k array */
  p?: number
  k?: LottieProperty
  [key: string]: unknown
}

export interface ShapeItem {
  /** 'gr' | 'fl' | 'st' | 'gf' | 'gs' | ... */
  ty?: string
  nm?: string
  /** hidden flag — true renders the shape invisible */
  hd?: boolean
  it?: ShapeItem[]
  c?: LottieProperty
  g?: GradientDef
  /** opacity (most types) */
  o?: LottieProperty
  /** stroke width */
  w?: LottieProperty
  /** trim start / rect & ellipse size / gradient start point */
  s?: LottieProperty
  /** position (rect/ellipse/polystar/transform) */
  p?: LottiePositionProperty
  /** rotation (transform/polystar) / roundness (rect) */
  r?: LottieProperty
  /** trim end / gradient end point */
  e?: LottieProperty
  /** transform anchor point */
  a?: LottieProperty
  /** polystar point count */
  pt?: LottieProperty
  /** polystar outer radius */
  or?: LottieProperty
  /** polystar inner radius */
  ir?: LottieProperty
  /** polystar outer roundness */
  os?: LottieProperty
  /** polystar inner roundness */
  is?: LottieProperty
  [key: string]: unknown
}

export interface TextStyle {
  fc?: number[]
  sc?: number[]
  [key: string]: unknown
}

export interface TextDocumentKeyframe {
  s?: TextStyle
  t?: number
  [key: string]: unknown
}

export interface TextAnimator {
  a?: { fc?: LottieProperty; sc?: LottieProperty; [key: string]: unknown }
  [key: string]: unknown
}

export interface LottieTextData {
  d?: { k?: TextDocumentKeyframe[]; [key: string]: unknown }
  a?: TextAnimator[]
  [key: string]: unknown
}

export interface LottieLayer {
  /** 0 precomp, 1 solid, 2 image, 3 null, 4 shape, 5 text */
  ty?: number
  nm?: string
  refId?: string
  /** solid layer color, "#rrggbb" */
  sc?: string
  /** hidden flag — true renders the layer invisible */
  hd?: boolean
  /** layer transform */
  ks?: LottieTransform
  ip?: number
  op?: number
  st?: number
  ind?: number
  parent?: number
  shapes?: ShapeItem[]
  t?: LottieTextData
  layers?: LottieLayer[]
  [key: string]: unknown
}

export interface LottieAsset {
  id?: string
  layers?: LottieLayer[]
  [key: string]: unknown
}

export interface LottieDoc {
  v?: string
  nm?: string
  fr?: number
  ip?: number
  op?: number
  w?: number
  h?: number
  layers?: LottieLayer[]
  assets?: LottieAsset[]
  [key: string]: unknown
}
