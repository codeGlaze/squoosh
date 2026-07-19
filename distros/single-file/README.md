# Distro experiment: single-file HTML

`squoosh-lite.html` is **one self-contained file** — double-click it and it runs
straight from `file://`, no server, fully offline. The codec wasm is base64-
inlined and the UI is bundled in. It's a lean compressor, not the full Squoosh
shell.

- **Formats:** JPEG (MozJPEG), WebP, AVIF via jSquash (wasm inlined) + PNG via
  canvas. Inputs are decoded by the browser (JPEG/PNG/WebP/GIF). Optional
  max-width resize.
- **Why it's the only "double-click a file" option:** `file://` can't register a
  service worker or be cross-origin isolated, so codecs run **single-threaded**
  (AVIF is slower than in the served app). That's a browser rule, not a feature
  cut — everything still works.

## Build

```bash
npm i -D @jsquash/jpeg @jsquash/webp @jsquash/avif esbuild   # already in devDeps
node build.mjs        # → squoosh-lite.html (~5 MB)
```

JXL and QOI are omittable-by-default only to keep the file small (JXL's wasm is
large); they can be added the same way if you want every format.
