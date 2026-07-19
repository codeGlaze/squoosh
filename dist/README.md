# Squoosh (stable) — prebuilt snapshot

A **compiled build** of this branch — Squoosh's original native codecs plus the
crop, in-editor image swap, and batch-compress features — committed so you can
run it without a toolchain. It's a build artifact; regenerate with
`npm run build && rm -rf dist && cp -r build dist`.

## ⚠️ Do NOT double-click `index.html`

This is a root-served PWA with absolute asset paths. Opening it as a file
(`file://…/dist/index.html`) makes every asset 404 (they resolve to your drive
root) and blocks the manifest/service worker (`file://` is a null origin). You
**must** serve it over HTTP.

## Run it

From the repo root — this one command needs no prior install:

```bash
npx serve --config serve.json dist     # prints http://localhost:3000
```

or, if you've run `npm ci`:

```bash
npm run preview
```

Then open the printed URL and load an image from inside the app.

**The `--config serve.json` matters.** Squoosh's multithreaded codecs need
cross-origin isolation (COOP/COEP headers). Serving without them (e.g.
`python -m http.server`) makes threaded encoders fall back or fail.

## Offline / PWA

This build keeps upstream Squoosh's service-worker precache intact, so once
you've loaded it over HTTP the app shell and codecs are cached and it works
offline (verify in a real browser via DevTools → Application → Service Workers).

## Deploy

The build includes a `_headers` file setting COOP/COEP, so it works as-is on
**Netlify** or **Cloudflare Pages** — point the site at this `dist/` directory.
(GitHub Pages can't set those headers without a `coi-serviceworker` shim.)
