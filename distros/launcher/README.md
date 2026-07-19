# Distro experiment: self-contained launcher

A single executable that **embeds the entire built app** (`//go:embed`) and, when
run, serves it on `http://localhost:8787` with the COOP/COEP headers the
multithreaded codecs need, then opens the browser. Localhost is a secure
context, so from there you can click the browser's **Install** button to install
Squoosh as a proper offline PWA — after which the launcher is no longer needed.

This is the "zip it and hand it to friends" answer: one file, no runtime, no
external assets, threads intact (unlike opening `index.html` off disk).

## Build

Needs [Go](https://go.dev). From this directory:

```bash
./build.sh
```

Produces `Squoosh.exe` (Windows), `Squoosh-macos-intel`, `Squoosh-macos-apple`,
and `Squoosh-linux` — each ~31 MB with the whole app baked in. Zip a binary with
`HOW-TO-RUN.txt` and share it.

The embedded app is copied from the repo's `dist/` at build time, so rebuild
`dist/` first (`npm run build && rm -rf dist && cp -r build dist`) to update it.

## Caveats

- **Unsigned binary** → Windows SmartScreen shows "unknown publisher" (More info
  → Run anyway). Signing needs a code-signing cert.
- **PWA install needs a Chromium browser** (Chrome/Edge/Brave). The app still
  runs in any browser; only the "install as app" step is Chromium-only.
- Fixed port **8787** keeps the PWA install stable across runs.
