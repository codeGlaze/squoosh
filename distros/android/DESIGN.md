# Squoosh for Android — design

Status: **design draft** (no code yet). This document specifies how to bring
Squoosh to Android with a home-screen **widget**, following the same principles
as the desktop distros: as small as possible, pretty, and using as much native
as possible — while reusing the existing web app and codec work rather than
re-implementing it.

## Goals / non-goals

**Goals**

- A real Android app that runs the full Squoosh compressor.
- A native home-screen **widget** that is small, pretty, and idiomatic.
- Reuse everything already built: the codecs (jSquash + retained native wp2 /
  imagequant), crop, batch, and the whole UI — no second implementation to keep
  in sync.
- Offline: works with no network, like the PWA and the desktop distros.

**Non-goals (for the first cut)**

- Re-writing the codecs as native Android libraries. The C/C++ sources are
  vendored (`codecs/*/*.cpp`) and an NDK/JNI path is possible later (see
  [§ Later: native codecs](#later-native-codecs)), but it is not needed to ship.
- Play Store publishing / signing infrastructure. CI produces an installable
  **debug APK**; a signed release AAB is a follow-up that needs a keystore
  secret.

## The one constraint that shapes everything

An Android home-screen **widget cannot host a WebView or run wasm.** Widgets are
`RemoteViews` — a restricted, system-drawn view set (ImageView, TextView,
Button, lists). The launcher process renders them; arbitrary code and WebViews
are not allowed inside. Modern widgets written with **Jetpack Glance** are
Compose-authored but still compile down to `RemoteViews`, so the same limit
applies.

Consequence: the widget can never _be_ Squoosh. It is a small native surface
that shows status and fires intents; the actual compression runs elsewhere (an
Activity's WebView, or — later — a native background Worker). Every design
decision below follows from this.

## Chosen architecture: Tauri Android + WebView reuse

The app is the **existing Tauri project** (`distros/tauri`) extended to Android
via `tauri android init`. Tauri wraps the committed `dist/` in the system
WebView (Chromium-based) and serves it over a custom protocol with the COOP/COEP
headers we already set in `tauri.conf.json`.

```
┌─────────────────────── Android app (one APK) ───────────────────────┐
│                                                                      │
│  MainActivity ──► Tauri WebView ──► dist/ (Squoosh, offline assets)  │  ← the engine
│       ▲                  │                                           │
│       │  deep link       │  JS ⇄ native bridge (Tauri IPC / plugin)  │
│       │                  ▼                                           │
│  ┌────┴─────┐      DataStore (last-result stats)  ── read by ──┐     │
│  │ Share    │                                                  │     │
│  │ target   │      MediaStore (save compressed image)          │     │
│  │ (intent) │                                                  ▼     │
│  └──────────┘                                        ┌──────────────┐│
│   separate,                                          │ Glance widget ││  ← native surface
│   one-off flow                                       │ (home screen) ││
│                                                       └──────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

Why this over a fresh native app or native codecs:

- **Reuse.** One codebase. The mobile app is the same web build the PWA and
  desktop distros ship. Codec/crop/batch fixes land everywhere at once.
- **Small delta.** Android becomes another Tauri target next to desktop, not a
  new project.
- **Native where it counts.** The widget, share handling, icons, theming, and
  file I/O are all real Kotlin/Android — the parts the user actually sees and
  touches on the home screen.

The trade-off — a WebView is awkward to run headless — only bites the widget's
_background_ one-tap action, which we scope accordingly below.

## The three surfaces

These are distinct entry points. Only the third is the "widget"; the first two
are called out because they are what makes the widget useful.

### 1. Main app — `MainActivity` + Tauri WebView

The full Squoosh UI. Nothing new versus the desktop webview except mobile
viewport polish and Android file access. Reads an optional image `Uri` from its
launch intent (used by the widget deep-link and the share target) and auto-loads
it into the editor.

### 2. Share target — separate, transient (not the widget)

A per-image, one-off flow, deliberately **kept separate from the widget** (as
noted in review — a share is a one-shot, not a persistent surface). It is
included because "Share image → Squoosh" is the single highest-value mobile
entry point.

- Manifest: `<activity>` (can be `MainActivity` or a thin router) with
  `ACTION_SEND` / `ACTION_SEND_MULTIPLE`, `mimeType="image/*"` intent-filters.
- Flow: receive `content://` Uri(s) → resolve bytes → hand to the WebView →
  compress → write back to the gallery via **MediaStore** (scoped-storage safe).

### 3. The widget — Jetpack Glance (the native home-screen surface)

Persistent, pretty, native. Written with **Jetpack Glance** (Compose for
widgets) so it is small to author and gets **Material 3 dynamic color (Monet)**
for free — it tints to the user's wallpaper, which reads as "native + pretty."

What it shows and does:

| Element                    | Behaviour                                                                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App mark + name            | Brand, tap target                                                                                                                                                                       |
| Last-result chip           | "−63% · 1.8 MB → 0.7 MB" + thumbnail, from the last compression                                                                                                                         |
| **Open** action            | Launches `MainActivity` (the compressor)                                                                                                                                                |
| **Pick image** action      | Launches with an image-picker intent pre-armed                                                                                                                                          |
| **Compress latest** action | _Phase-1:_ deep-links into the app with the most-recent image auto-loaded and auto-encoded (foreground). _True background one-tap_ is the payoff of the native-codec phase — see below. |

State plumbing:

- After each compress, the WebView pushes a small `{origBytes, outBytes, savings, thumbUri}` record over the Tauri JS⇄native bridge; native writes it to
  **DataStore**.
- The widget's `GlanceStateDefinition` reads that DataStore; the app calls
  `SquooshWidget().updateAll(context)` after a compress so the tile refreshes.

Sizing/adaptivity: `sizeMode = Responsive` with a couple of breakpoints (a
compact 2×1 tile vs. a wider 4×2 with the thumbnail), plus Android-12+
`targetCellWidth/Height` and a `previewLayout` so the picker preview is real.

## The WebView ⇄ native bridge

Tauri v2 gives us JS⇄Rust IPC; on Android, Tauri plugins expose Kotlin. We need
a very small surface:

- **image in:** native resolves a `content://` Uri to bytes (share/pick) and
  passes them to JS.
- **image out:** JS hands compressed bytes to native → **MediaStore** insert →
  return the saved Uri.
- **stats out:** JS posts the last-result record → native DataStore (for the
  widget).

This is one small custom Tauri plugin (or the built-in
`tauri-plugin-fs`/`-dialog` where they suffice). Keeping it minimal keeps the
"as native as possible" honest without duplicating app logic.

## Cross-origin isolation & threads (must-validate)

Squoosh's multithreaded codecs need `crossOriginIsolated` (COOP/COEP →
SharedArrayBuffer). The Android System WebView is Chromium and supports SAB when
the document is isolated; Tauri serves assets with our configured COOP/COEP
headers. **This must be verified on-device** — Tauri's Android asset protocol has
historically been finicky about response headers. Fallback if isolation can't be
guaranteed: the app still runs single-threaded (the same graceful degradation as
the `file://` single-file distro), just slower. This is the top technical risk
and should be the first thing the POC proves.

## Files added (concrete)

```
distros/tauri/
  src-tauri/
    Cargo.toml                 # add [lib] crate-type = ["staticlib","cdylib","rlib"]
    src/lib.rs                 # tauri::mobile_entry_point run(); main.rs calls it
    tauri.conf.json            # bundle.android config, min SDK, etc.
    gen/android/               # `tauri android init` output — COMMITTED
      app/src/main/
        AndroidManifest.xml    # + widget <receiver>, share <intent-filter>
        kotlin/.../SquooshWidget.kt         # Glance widget + GlanceAppWidgetReceiver
        kotlin/.../LastResultStore.kt       # DataStore accessor
        kotlin/.../SharePlugin.kt (opt.)    # Uri⇄bytes + MediaStore bridge
        res/xml/squoosh_widget_info.xml     # AppWidgetProviderInfo
        res/mipmap-*/                        # adaptive launcher icons (regenerated)
        res/drawable/widget_preview.png
.github/workflows/android.yml  # build a debug APK in CI, upload as artifact
```

Icons: `tauri icon` already emits the Android adaptive set (`mipmap-*`,
foreground/background) — we pruned it from the desktop commit; it regenerates
from the same 1024px source, so Android launcher icons cost nothing new.

## Build & CI

`android.yml`, on `ubuntu-latest`:

1. JDK 17 (`actions/setup-java`), Android SDK + NDK (`android-actions/setup-android`).
2. Rust with the four Android targets: `aarch64-`, `armv7-`, `i686-`,
   `x86_64-linux-android`.
3. `tauri android build --apk --debug` → `app-universal-debug.apk`.
4. `actions/upload-artifact` the APK.

Debug APK installs via `adb install` / sideload. A signed **release AAB** for
Play is a later step (needs a keystore in repo secrets). APK size is a real
concern — the WebView bundles all codec wasm; see below.

## Size ("as small as possible")

The honest tension: WebView-reuse means shipping the wasm codecs inside the APK.
Options, in order of preference:

1. **Ship a mobile-lean asset set.** Most mobile users need JPEG/WebP/AVIF/PNG.
   A `dist-mobile/` that drops the heavy long-tail (wp2, jxl, hqx, some resize
   kernels) meaningfully shrinks the APK while keeping the common path. The build
   already tree-shakes per-codec, so this is a config, not a fork.
2. **Split by ABI** (`splits.abi`) so each device downloads one architecture,
   not four.
3. Later: the native-codec phase removes wasm from the APK for the codecs it
   covers.

The design keeps the full-fat `dist/` as the default and treats the lean set as
a build flag, so we never _cut_ a codec — same principle as the jSquash swap.

## <a name="later-native-codecs"></a>Later: native codecs (optional phase)

The compelling widget action — **one tap, compress the latest screenshot in the
background, no UI** — is awkward with a WebView (it wants a window/JS context).
That flow is clean only with a native engine: compile `codecs/*/*.cpp` with the
NDK, bind via JNI, run inside a `WorkerManager` job. The C/C++ sources are
already vendored, so this is "build + bind," not "port." It is scoped as a
**future phase**, not a blocker: Phase 1 ships the widget with a foreground
deep-link "compress latest," and the background version lands if/when the JNI
work does.

## Phased plan

| Phase              | Deliverable                                                                        | Proves                                                     |
| ------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **0**              | `tauri android init`, app builds a debug APK in CI, launches, loads Squoosh        | Tauri-Android viability + the COOP/COEP isolation question |
| **1**              | Share target (`ACTION_SEND image/*`) → compress → MediaStore save                  | The end-to-end mobile flow works                           |
| **2**              | Glance widget: launcher + last-result chip + Open/Pick actions; last-result bridge | The native home-screen surface                             |
| **3**              | Mobile-lean asset set + ABI splits; polish (Material 3, adaptive sizes)            | "small + pretty"                                           |
| **4** _(optional)_ | NDK/JNI codecs + background `WorkerManager` → true one-tap-background widget       | "as native as possible"                                    |

## Open decisions

- **min SDK** — Glance needs API 23+; Android-12 widget niceties
  (`targetCell*`, rounded corners) need API 31 with graceful fallback. Proposed:
  `minSdk 26`, `targetSdk` latest.
- **Release signing** — defer; debug APK only until a keystore secret exists.
- **Mobile codec set** — full `dist/` vs a lean subset as the default APK.
- **Isolation fallback UX** — if SAB is unavailable on some WebViews, do we show
  a "single-threaded, slower" notice or stay silent?
