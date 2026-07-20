# Distro experiment: Tauri desktop app (SCAFFOLD — unverified here)

A native desktop app: Tauri bundles a tiny Rust binary + the OS's own webview and
serves the built app internally, so it's a real double-click program with no
server and no browser install dance. Small (~5–10 MB, vs Electron's ~150 MB).

**Honesty:** I could not build or verify this in the Linux sandbox — Tauri needs
the target OS's webview (webkit2gtk on Linux, WebView2 on Windows) and those
aren't installed, and cross-compiling to a Windows `.exe` from Linux isn't
practical. So this is a working _scaffold_ you build on your own machine.

## Build (on Windows/macOS/Linux — build on the OS you want to target)

Prerequisites: [Rust](https://rustup.rs), the Tauri CLI, and your OS's webview
(Windows: WebView2, preinstalled on Win11; Linux: `webkit2gtk`).

```bash
# 1. Rebuild the app if needed, so ../dist is current:
#    npm run build && rm -rf dist && cp -r build dist
cargo install tauri-cli --version "^2"

# 2. From distros/tauri/, initialise the Rust side (creates src-tauri/):
cargo tauri init --ci \
  --app-name Squoosh \
  --window-title Squoosh \
  --frontend-dist ../dist \
  --dev-url "" \
  --before-dev-command "" \
  --before-build-command ""

# 3. Replace the generated src-tauri/tauri.conf.json with the one in THIS folder
#    (it adds the COOP/COEP headers the codecs need), then:
cargo tauri build
```

The installer/binary lands in `src-tauri/target/release/bundle/`.

## The one thing to watch: multithreading

The codecs are multithreaded only if the webview is **cross-origin isolated**.
The `app.security.headers` block in `tauri.conf.json` sets COOP/COEP for exactly
this (Tauri >= 2.1). If threads still don't engage, confirm `self.crossOriginIsolated`
is `true` in the webview devtools; some webview versions need the headers applied
via a custom asset-protocol handler in `src-tauri/src/main.rs` instead.
