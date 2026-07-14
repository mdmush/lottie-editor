/**
 * Conversions between Lottie color representations and #RRGGBB hex.
 *
 * Lottie color components are floats in 0–1, but legacy Bodymovin exports
 * used 0–255. A triple is treated as legacy when any component exceeds 1;
 * reads and writes both apply the rule, so a file keeps its native scale.
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function isLegacyRange(rgb: readonly number[]): boolean {
  return rgb.slice(0, 3).some((v) => v > 1)
}

/** [r,g,b] in the array's native scale → "#RRGGBB" (uppercase, group key form). */
export function rgbComponentsToHex(rgb: readonly number[]): string {
  const legacy = isLegacyRange(rgb)
  const toByte = (v: number) =>
    legacy ? Math.round(Math.min(255, Math.max(0, v))) : Math.round(clamp01(v) * 255)
  const hex = rgb
    .slice(0, 3)
    .map((v) => toByte(v).toString(16).padStart(2, '0'))
    .join('')
  return `#${hex}`.toUpperCase()
}

/** "#rgb" | "#rrggbb" → [r,g,b] floats 0–1. Throws on malformed input. */
export function hexToFloats(hex: string): [number, number, number] {
  let h = hex.replace(/^#/, '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Invalid hex color: ${hex}`)
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

/** Normalize any user/file hex to the uppercase "#RRGGBB" group key form. */
export function normalizeHex(hex: string): string {
  return rgbComponentsToHex(hexToFloats(hex))
}
