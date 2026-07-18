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

**Suggested first step.** Do #1 first (it delivers most of the day-to-day
relief on its own), then pull one of the forks above locally, diff it against
this tree, and decide whether to adopt its batch UI wholesale or cherry-pick
the queue/chunking logic onto our current codebase.
