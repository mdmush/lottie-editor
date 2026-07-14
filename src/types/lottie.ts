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

export interface LottieKeyframe {
  t?: number
  s?: unknown
  /** legacy end-value, emitted by old Bodymovin versions */
  e?: unknown
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
