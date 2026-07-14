# Lottie Editor

A browser-based editor for [Lottie](https://airbnb.io/lottie/) animations. Drop in a `.json` export, preview it on a transparency checkerboard, recolor it, hide layers, and export the edited file — no account, no upload, everything stays in your browser.

## Features

- **Live preview** — plays the animation with lottie-web on a checkerboard canvas, with play/pause, 0.25×–2× speed, and looping.
- **Frame-accurate timeline** — a ruler-style scrubber with a playhead, time and frame readouts, and keyboard stepping (`←`/`→` for one frame, `Shift` for ten, `Space` to play/pause).
- **Recoloring** — every solid fill, stroke, and gradient stop in the file is grouped by color into one swatch. Pick a new color to preview it live; opacity gets its own slider. Edits apply everywhere the color is used.
- **Layer tree** — browse layers, groups, and shapes (precomps expand in place). Hover a row to outline the matching element in the preview; click the eye to hide or show it.
- **Round-trip export** — download the edited document as Lottie JSON. Hidden shapes are stripped the same way in preview and export, so what you see is what you ship. Reset restores the original file at any time.
- **Light & dark themes** — toggle in the header; the choice is remembered and defaults to your system preference.

## Getting started

Requires Node.js 20+.

```sh
npm install
npm run dev
```

Open the printed URL (Vite defaults to `http://localhost:5173`) and drop a Lottie `.json` file onto the page — exports from After Effects (Bodymovin), Figma, or LottieFiles all work.

## Scripts

| Command           | What it does                                |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Start the Vite dev server with HMR          |
| `npm run build`   | Type-check and build for production (`dist/`) |
| `npm run preview` | Serve the production build locally          |
| `npm test`        | Run the Vitest unit tests                   |
| `npm run lint`    | Lint with Oxlint                            |

## How it's built

React 19 + TypeScript + Vite, styled with Tailwind CSS v4. State lives in a single [Zustand](https://github.com/pmndrs/zustand) store (`src/store/editor-store.ts`) that holds the parsed Lottie document as immutable snapshots via Immer — color edits produce a new document revision, and the player re-initializes from it without losing playback position.

```
src/
├── components/        # UI: drop zone, header buttons, theme toggle
│   ├── player/        #   canvas, timeline scrubber, transport controls
│   └── sidebar/       #   color swatches and the layer tree
├── hooks/             # lottie-web lifecycle, file drop, theme
├── lib/               # pure logic: color scanning/rewriting, hidden-shape
│                      #   stripping, hover-highlight resolution, download
├── store/             # Zustand editor store
└── types/             # minimal Lottie document types
```

A few implementation notes:

- **Color scanning** (`src/lib/lottie-colors.ts`) walks the document for `fl`/`st`/`gf`/`gs` shape items and gradient stops, normalizes them to hex, and records a JSON path for each use so edits can be written back precisely.
- **Hover highlighting** (`src/lib/highlight.ts`) maps a tree row to the SVG element lottie-web rendered for it and traces its silhouette with stacked drop-shadows, so the outline hugs the shape and follows the animation.
- **Preview/export parity** (`src/lib/strip-hidden.ts`) removes `hd: true` shapes from a clone before handing it to lottie-web, because lottie-web ignores the flag on shape groups while other players don't.

The design system (graphite surfaces, keyframe-amber accent, both themes) is defined as CSS variables in `src/index.css`.

## License

Private project — no license granted.
