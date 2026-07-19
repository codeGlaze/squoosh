# Squooshii — modernization plan

Goal: modernize the codec layer (shed the hand-built WASM toolchain, get
maintained codecs) **without cutting any feature — niche formats included**.
`squooshii` is the modernization branch; the feature branches stay the stable
line.

## Are the libraries a direct replacement?

Functionally yes, mechanically "thin adapter". [jSquash](https://github.com/jamsinclair/jSquash)
is Squoosh's own codecs extracted into maintained npm packages, so:

- API is uniform: `encode(data: ImageData, options?) => Promise<ArrayBuffer>`
  and `decode(data: ArrayBuffer) => Promise<ImageData>`.
- Encode options are **derived from Squoosh's `meta.ts`**, so our existing
  option types and the whole Options UI map over almost unchanged.
- jSquash does **not** provide worker orchestration — but we already have that
  (`WorkerBridge` + comlink). We keep it and call jSquash inside the worker.

So each codec is a small rewrite of one worker wrapper
(`src/features/{encoders,decoders}/*/worker/*.ts`) to call the jSquash package
instead of the locally-built Emscripten glue. Meta, options, and UI stay.

## What can be replaced vs what must be retained

Squoosh ships 10 encoders + 5 WASM decoders + resize + quantize. jSquash covers
the mainstream set. To honour "don't cut anything", the swap is a **hybrid**:

| Squoosh feature           | jSquash?                                           | Plan                                    |
| ------------------------- | -------------------------------------------------- | --------------------------------------- |
| MozJPEG (enc)             | ✅ `@jsquash/jpeg`                                 | replace                                 |
| WebP (enc/dec)            | ✅ `@jsquash/webp`                                 | replace                                 |
| AVIF (enc/dec)            | ✅ `@jsquash/avif`                                 | replace                                 |
| JPEG XL (enc/dec)         | ✅ `@jsquash/jxl`                                  | replace                                 |
| PNG / OxiPNG (enc)        | ✅ `@jsquash/png` (+oxipng)                        | replace                                 |
| QOI (enc/dec)             | ✅ `@jsquash/qoi`                                  | replace                                 |
| Resize                    | ✅ jSquash resize (rust resize, hqx, magic-kernel) | replace                                 |
| **WebP2 (enc/dec)**       | ❌ no package                                      | **retain native**                       |
| **Quantize (imagequant)** | ❌ no package                                      | **retain native**                       |
| **GIF (enc)**             | ❌ (JS lib, not WASM)                              | **retain as-is**                        |
| Rotate                    | ❌ (trivial)                                       | retain native, or reimplement on canvas |
| browser JPEG/PNG/GIF      | n/a (canvas)                                       | unchanged                               |

Net: ~7 of 10 encoders, 4 of 5 WASM decoders, and resize move to maintained
jSquash packages. Three things stay native (WebP2, imagequant, GIF) so **no
format or capability is lost**.

## The line: "still Squoosh" vs "squooshii"

- **Still Squoosh** — the hybrid codec swap above. Same features, same UI, same
  formats; just maintained codecs and a much smaller `codecs/` build. This is a
  modernization that keeps Squoosh's identity. Zero feature cut.
- **Squooshii** — the further steps that change identity, not just codecs:
  1. Package WebP2 + imagequant as jSquash-style modules so the **entire**
     `codecs/` native/Emscripten toolchain (34 MB, 217 files) can be deleted.
     imagequant is the single highest-value gap in the whole jSquash ecosystem.
  2. Modernize the shell: Vite instead of Rollup, refresh Preact/custom-els.
  3. Fold in the batch mode + crop as first-class features.

Codec modernization and shell modernization are **orthogonal** — either can
ship without the other.

## Phased plan

1. **Proof of concept (de-risk):** ✅ **done** — MozJPEG moved to
   `@jsquash/jpeg` by rewriting only its worker wrapper. Verified: valid JPEG
   output, quality slider still drives file size (q90≫q20), Options UI and
   client wrapper untouched, and the build now emits jSquash's wasm (via
   `importMetaAssets`) instead of the native one. The adapter pattern holds.
2. **Roll out the mainstream codecs:** webp, avif, jxl, png/oxipng, qoi, then
   resize. One thin wrapper each; meta/UI unchanged.
3. **Shrink the build:** delete the `codecs/` sources for everything replaced;
   keep only `imagequant`, `wp2`, gif. Confirm build + all formats still work.
4. **(Squooshii)** Package imagequant + wp2 → drop the last native build.
5. **(Squooshii)** Shell modernization + first-class batch/crop.

Guarantee for phases 1–3: **no feature is removed** — WebP2, quantize, and GIF
keep working via retained native code the whole way.
