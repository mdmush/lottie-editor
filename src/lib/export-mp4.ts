import lottie, { type AnimationItem } from 'lottie-web'
import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import type { LottieDoc } from '../types/lottie'
import { stripHiddenShapes } from './strip-hidden'
import { docFrameCount, isFullRange, trimDoc, type FrameRange } from './trim'

export interface Mp4ExportOptions {
  /** CSS hex color painted under every frame — MP4 has no alpha channel. */
  backgroundColor: string
  /** Inclusive player-frame range to render; omit for the whole timeline. */
  range?: FrameRange
  /** 0..1, called as frames are encoded. */
  onProgress?: (fraction: number) => void
}

/** True when the browser can encode H.264 via WebCodecs. */
export function canExportMp4(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'
}

/**
 * Load the document into a headless lottie-web canvas renderer. No container
 * element is passed — the renderer draws straight into the supplied context
 * (dpr locked to 1 so canvas pixels map 1:1 to animation units). Resolves
 * once vector data and any embedded images are ready to draw.
 */
async function loadHeadlessAnim(
  doc: LottieDoc,
  ctx: CanvasRenderingContext2D,
  range?: FrameRange,
): Promise<AnimationItem> {
  const cleaned = stripHiddenShapes(structuredClone(doc))
  const anim = lottie.loadAnimation({
    renderer: 'canvas',
    loop: false,
    autoplay: false,
    animationData: range && !isFullRange(range, docFrameCount(doc)) ? trimDoc(cleaned, range) : cleaned,
    rendererSettings: { context: ctx, clearCanvas: true, dpr: 1 },
  } as unknown as Parameters<typeof lottie.loadAnimation>[0])

  const hasImages = doc.assets?.some((a) => typeof a.p === 'string' && !a.layers) ?? false
  await new Promise<void>((resolve) => {
    let domLoaded = false
    let imagesLoaded = !hasImages
    const check = () => {
      if (domLoaded && imagesLoaded) resolve()
    }
    anim.addEventListener('DOMLoaded', () => {
      domLoaded = true
      check()
    })
    if (hasImages) {
      anim.addEventListener('loaded_images', () => {
        imagesLoaded = true
        check()
      })
      // Don't hang the export on a broken embedded image.
      setTimeout(() => {
        imagesLoaded = true
        check()
      }, 10_000)
    }
  })
  return anim
}

/**
 * Does the animation leave any pixel non-opaque? Samples the first, middle,
 * and last frames at thumbnail size. Used to warn that the chosen MP4
 * background color will show through (MP4 can't store transparency).
 */
export async function detectTransparency(doc: LottieDoc): Promise<boolean> {
  const w = Math.max(1, doc.w ?? 512)
  const h = Math.max(1, doc.h ?? 512)
  const scale = Math.min(1, 96 / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return true

  const anim = await loadHeadlessAnim(doc, ctx)
  try {
    const last = Math.max(0, anim.totalFrames - 1)
    for (const frame of new Set([0, Math.round(last / 2), last])) {
      anim.goToAndStop(frame, true)
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 250) return true
      }
    }
    return false
  } finally {
    anim.destroy()
  }
}

/** Smallest H.264 High-profile level that fits the frame size, then fallbacks. */
async function pickEncoderConfig(width: number, height: number, fps: number): Promise<VideoEncoderConfig> {
  const pixels = width * height
  const levels = ['avc1.640028', 'avc1.640032', 'avc1.640034'] // High @ 4.0 / 5.0 / 5.2
  const start = pixels > 2560 * 1920 ? 2 : pixels > 1920 * 1088 ? 1 : 0
  const bitrate = Math.min(20_000_000, Math.max(1_000_000, Math.round(pixels * fps * 0.15)))
  for (const codec of levels.slice(start)) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate: fps }
    if ((await VideoEncoder.isConfigSupported(config)).supported) return config
  }
  throw new Error('This browser cannot encode H.264 video at this resolution.')
}

/**
 * Render every frame (of `options.range`, or the whole timeline) through
 * lottie-web's canvas renderer, composite it over the chosen background
 * color, encode with WebCodecs, and mux into an MP4 blob. Runs on the main
 * thread; yields periodically so progress can paint.
 */
export async function exportMp4(doc: LottieDoc, options: Mp4ExportOptions): Promise<Blob> {
  if (!canExportMp4()) throw new Error('MP4 export needs a browser with WebCodecs (Chrome, Edge, or Safari 16.4+).')

  const srcW = Math.max(1, Math.round(doc.w ?? 512))
  const srcH = Math.max(1, Math.round(doc.h ?? 512))
  // H.264 requires even dimensions; pad by one transparent row/column if needed.
  const outW = srcW + (srcW % 2)
  const outH = srcH + (srcH % 2)
  const fps = typeof doc.fr === 'number' && doc.fr > 0 ? doc.fr : 30

  const renderCanvas = document.createElement('canvas')
  renderCanvas.width = srcW
  renderCanvas.height = srcH
  const renderCtx = renderCanvas.getContext('2d')
  const outCanvas = document.createElement('canvas')
  outCanvas.width = outW
  outCanvas.height = outH
  const outCtx = outCanvas.getContext('2d')
  if (!renderCtx || !outCtx) throw new Error('Could not create a canvas context.')

  const config = await pickEncoderConfig(outW, outH, fps)
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: outW, height: outH, frameRate: fps },
    fastStart: 'in-memory',
  })
  let encoderError: Error | null = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encoderError = e
    },
  })
  encoder.configure(config)

  const anim = await loadHeadlessAnim(doc, renderCtx, options.range)
  try {
    const totalFrames = Math.max(1, Math.round(anim.totalFrames))
    const keyframeInterval = Math.max(1, Math.round(fps * 2))
    const frameMicros = 1e6 / fps

    for (let i = 0; i < totalFrames; i++) {
      if (encoderError) throw encoderError
      anim.goToAndStop(i, true)
      outCtx.fillStyle = options.backgroundColor
      outCtx.fillRect(0, 0, outW, outH)
      outCtx.drawImage(renderCanvas, 0, 0)

      const frame = new VideoFrame(outCanvas, {
        timestamp: Math.round(i * frameMicros),
        duration: Math.round(frameMicros),
      })
      encoder.encode(frame, { keyFrame: i % keyframeInterval === 0 })
      frame.close()

      // Backpressure: don't let raw frames pile up in the encoder queue.
      while (encoder.encodeQueueSize > 4) {
        await new Promise((r) => setTimeout(r, 1))
      }
      options.onProgress?.((i + 1) / totalFrames)
      // Yield so the progress bar (and the rest of the UI) can paint.
      if (i % 5 === 4) await new Promise((r) => setTimeout(r))
    }

    await encoder.flush()
    if (encoderError) throw encoderError
    muxer.finalize()
    return new Blob([muxer.target.buffer], { type: 'video/mp4' })
  } finally {
    if (encoder.state !== 'closed') encoder.close()
    anim.destroy()
  }
}
