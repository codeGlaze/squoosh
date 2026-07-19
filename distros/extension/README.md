# Distro experiment: browser extension (MV3)

Runs Squoosh from a `chrome-extension://` origin. Unlike the single-file build,
an extension page **can be cross-origin isolated** (via the manifest's COOP/COEP
keys), so the **multithreaded codecs work**. Fully offline — all resources are
local to the extension.

## Install (unpacked)

1. Unzip.
2. Go to `chrome://extensions`, turn on **Developer mode**.
3. **Load unpacked** → select the `ext/` folder.
4. Click the extension's toolbar icon → Squoosh opens in a tab.

Chrome / Edge / Brave. (Firefox uses a different extension model.)

## Build

```bash
bash build.sh    # assembles ext/ from the repo's dist/
```

It copies `dist/`, swaps in the extension `manifest.json` + `ext-background.js`,
and — because MV3 forbids inline scripts — moves Squoosh's inline bootstrap into
`bootstrap.js` (`extract-inline.mjs`). The extension CSP allows
`script-src 'self' 'wasm-unsafe-eval'`.

## Notes

- Google Analytics is blocked by the extension CSP — harmless (we don't want it).
- The app's own service worker doesn't register inside an extension; that's fine,
  extension resources are always local so it works offline regardless.
