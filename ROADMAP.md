# Roadmap

Near-term improvements to the editing workflow. Ordered by effort/impact.

## 1. Hot-swap the image from the editor

**Problem.** Editing is one image at a time. To work on another image you have
to hit back, land on the home screen, pick a new file, and re-apply every
setting before you can download again. For anyone processing a set of images
with the same settings, that round-trip is the whole cost of the tool.

**Goal.** Swap the source image from inside the editor — keep the encoder,
resize, quantize, and (new) crop settings, just point them at a new file.

**Why it's mostly plumbing that already exists.**

- `App` (`src/client/initial-app/App/index.tsx`) holds a single `file` in
  state and passes it to `<Compress file={file} …>`. Both `onFileDrop` and
  `onIntroPickFile` do nothing more than `this.setState({ file })`.
- `Compress.componentWillReceiveProps` already re-decodes when `props.file`
  changes (`this.sourceFile = nextProps.file; queueUpdateImage`). So swapping
  the file prop reruns the pipeline without a remount.
- Per-side settings (`side.latestSettings.encoderState`, quantize, resize
  _method_) already persist in `Compress` state across a source change — only
  resize width/height reset to the new image's dimensions (with resize
  disabled), which is the behaviour you want.
- The `<file-drop>` wrapper in `App` is around the whole app, so **dragging a
  new image onto the editor may already swap it today** — there's just no
  visible affordance and no confirmation.

**Work.**

- Add an explicit "Open image" control in the editor UI (a button in
  `Compress/Output`'s toolbar, and/or a labelled drop zone) that calls back up
  to `App` to set the new `file` without leaving the editor route.
- Decide the settings-persistence contract and make it deliberate rather than
  incidental: keep encoder + quantize + crop; reset resize dimensions to the
  new source (already happens). Crop in particular should probably reset,
  since a region from image A rarely makes sense on image B — clear
  `preprocessorState.crop` on swap unless we add "lock crop across images".
- Small UX: filename in the results, a toast confirming the swap, and guard the
  in-flight decode/encode jobs (the abort controllers in `updateImage` already
  handle cancellation).

**Estimate.** Small — a day or so. Most of the machinery is in place; this is
surfacing it and defining the settings-carryover rules.

## 2. Multi-file / batch mode

**Problem.** Same as above at scale: apply one set of settings to N images and
download them all (ideally as a zip). This is the single most-requested Squoosh
feature upstream.

**Approach.** Survey the existing forks before writing anything — several
already implement batch and are worth borrowing from:

- **squoosh-multiple-export** (Khongchai) —
  https://github.com/Khongchai/squoosh-multiple-export
- **squiish** (nightgolfer), built on the above, adds batch-size chunking with
  a graceful fallback for memory pressure (defaults to ~3 images at a time) —
  https://github.com/nightgolfer/squiish
- **Bulk Squoosh** (toototech) — https://squoosh.toototech.com/

Upstream discussion / demand for context:

- Bulk image upload & processing — https://github.com/GoogleChromeLabs/squoosh/issues/1406
- Batch / Bulk process — https://github.com/GoogleChromeLabs/squoosh/issues/1259
- CLI batch compression — https://github.com/GoogleChromeLabs/squoosh/issues/916

**Why it's bigger than #1.** The app is single-file deep: `App.file` is one
`File`, and `Compress` is built around a two-sided A/B comparison of that one
image. Batch mode means a new surface — a file list, shared settings applied
across all of them, a queue with progress, memory-aware chunking (per squiish),
and a zip download — rather than a tweak to the existing screen. The good news
is the core `decode → preprocess → process → encode` pipeline and the worker
bridge are per-image and reusable as-is; the work is orchestration and UI
around them, plus watching memory when many wasm codecs run at once.

### What the existing forks actually do (analysis)

Read the source of the forks so we borrow the good parts and avoid their bugs.

**squoosh-multiple-export (Khongchai)** — the base. Keeps `files: File[]` as a
private field and only touches it at download time; the A/B pipeline stays
single-image. Proof-of-concept quality with a real bug: it chunks on
`i % BULK_SIZE === 0`, which flushes a chunk of 1 up front, mis-sizes the rest,
and **never flushes the trailing partial chunk — tail files are silently
dropped**. Downloads are individual `<a download>` clicks. Use only as lineage.

**squiish (nightgolfer)** — the batch-hardened fork, Apache-2.0. Worth
studying. It fixes the chunking (`promises.length >= size` + a trailing flush),
`revokeObjectURL`s after each chunk, clamps batch size `>= 1`, tags pipeline
errors by stage, and wires abort controllers. Default batch size **3**.

- **Critical subtlety:** our `WorkerBridge`
  (`src/client/lazy-app/worker-bridge/index.ts`) **serializes every job through
  an internal promise queue per instance**, and squiish runs all N jobs of a
  chunk against a single bridge (`workerBridges[0]`). So its "batch of 3" is
  _not_ 3 parallel codecs — it's sequential, just holding 3 images' worth of
  buffers in the JS heap at once. The real OOM guard is the bridge's
  serialization, not the batch number. The batch size only bounds heap
  accumulation. (WorkerBridge's ~10s idle `terminate()` is what frees WASM
  memory between bursts — we inherit that for free.)
- **Two weaknesses to fix, not copy:** (a) no real parallelism because
  everything funnels through one bridge; (b) failures are `filter(Boolean)`ed
  away — a batch of 50 can silently deliver 47 with only a `console.error`.
- Batch config lives inside per-side encoder settings
  (`latestSettings.bulkProcessing`) — wrong home (A and B can disagree); it's a
  session concern. No zip: individual downloads with a 300ms throttle (trips
  Chrome's "download multiple files?" gate).

**Bulk Squoosh (toototech)** — deployment is closed-source; the `bulk-squoosh`
repos on GitHub are plain, unmodified upstream forks with no batch code. Treat
its site as a **UX reference only** (drop many files, one shared settings panel,
per-file client-side compression), not a code source.

### Recommended approach for our tree

Keep the single-image editor exactly as-is for preview/tuning; add a **separate
batch-apply/export path** that reuses the same pipeline functions. Do not
rewrite `Compress` to be N-aware internally.

- **State model.** `App`: `file: File` → `files: File[]` + `selectedIndex`
  (single-file flows are just `length === 1`). Reuse the existing side/encoder
  settings as the one "apply to all" config — tune on the selected file, apply
  to every file. Put batch/session config (`batchSize`, `concurrency`,
  `outputFormat`, filename template) in a **separate `BatchOptions`** object on
  `App`, **not** nested in encoder settings (squiish's mistake). Track per-file
  status as a first-class `Map<fileId, {state, error?, resultBlob?, size?}>` —
  the piece all three forks lack.
- **Concurrency = a small pool of `WorkerBridge` instances**, not many jobs on
  one bridge. Size `concurrency = clamp(hardwareConcurrency - 1, 1, 4)`, default
  cap **3**. An async task queue keeps exactly `concurrency` images in flight,
  one per free bridge — real parallelism with a hard ceiling on simultaneous
  WASM instances (the actual OOM lever). Never `Promise.all` the whole list.
- **Memory-safety rules (the bug-prevention core).**
  1. Bounded parallelism always (the pool cap is the #1 OOM guard).
  2. Release eagerly: drop decoded `ImageData`/`ImageBitmap` refs and
     `revokeObjectURL` **every** URL right after each image is saved/zipped.
  3. Stream results into the zip as they finish; don't buffer all N blobs.
  4. Optional size-aware backoff: drop to concurrency 1 for very large images.
  5. **Never silently drop a failure** — isolate with `allSettled` but record
     every rejection in the status map and show it in the UI (with retry).
  6. Explicit teardown: abort on cancel/unmount; terminate pooled workers when
     the batch ends.
- **Download = a streaming zip.** Use **`client-zip`** (MIT, tiny, zero-dep,
  store-only — our payloads are already-compressed images, so no wasted deflate
  pass). Feed each encoded blob into the stream as it's produced and revoke it
  immediately, so peak memory ≈ one zip stream, not N blobs. Keep an
  individual-download fallback for single files. Dedupe filenames
  (zero-padded index) before adding — borrow squiish's numbering idea.
- **Layering (no rewrite).** Extract the per-image pipeline in `Compress`
  (`decodeImage → preprocessImage → processImage → compressImage`, already
  discrete functions) into a reusable `processOneImage(file, settings, bridge, signal)`. `Compress` keeps using it for live preview; a new plain-TS
  `BatchRunner` (worker-bridge pool + bounded queue + abort + progress events)
  calls the same function per file. `WorkerBridge` is reused unchanged.

**Phased build order.** (1) lift `App` to `files[]` + `selectedIndex`;
(2) extract `processOneImage`; (3) `BatchRunner` (pool + bounded queue + abort +
per-file status), temp "compress all" button; (4) per-file status/progress UI
with an explicit **failure list + retry**; (5) streaming `client-zip` export
with revoke-as-you-go; (6) polish — filename templating, size-aware backoff,
cancel, worker teardown.

### Attribution (Apache-2.0)

Squoosh and both forks are **Apache-2.0**; upstream has **no `NOTICE`** file and
the client `.tsx` files carry **no per-file headers**, so nothing extra travels
with borrowed snippets and there is no copyleft or license-compatibility issue
(our tree is already Apache-2.0 — keep the root `LICENSE`). Obligations if we
adapt fork code: retain any notice we _do_ encounter (§4a — there are none to
retain here), and it's good practice to state significant changes (§4b). We are
**reimplementing the approach**, not verbatim-copying files, which carries no
formal attribution requirement — but we will add a courtesy credit line to the
README/CONTRIBUTING regardless:

> Bulk-processing approach adapted from
> [nightgolfer/squiish](https://github.com/nightgolfer/squiish) (Apache-2.0),
> itself derived from
> [Khongchai/squoosh-multiple-export](https://github.com/Khongchai/squoosh-multiple-export)
> and [GoogleChromeLabs/squoosh](https://github.com/GoogleChromeLabs/squoosh).

If we add `client-zip`, confirm its MIT license carries into our dependency
licensing (it does).
