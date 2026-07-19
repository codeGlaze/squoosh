# squooshii — prebuilt snapshot

This is a **compiled build** of the `squooshii` branch (all codecs on jSquash),
committed so you can interact with it without a toolchain. It's a build
artifact — regenerate with `npm run build && rm -rf dist && cp -r build dist`.

## ⚠️ Do NOT double-click `index.html`

This is a root-served PWA with absolute asset paths. Opening it as a file
(`file://…/dist/index.html`) makes every asset 404 (they resolve to your drive
root) and blocks the manifest/service worker (`file://` is a null origin). You
**must** serve it over HTTP.

## Run it locally

From the repo root — this one command needs no prior install:

```bash
npx serve --config serve.json dist     # prints http://localhost:3000
```

or, if you've already run `npm ci`:

```bash
npm run preview
```

Then open the printed URL and load an image from inside the app.

**The `--config serve.json` matters.** Squoosh's multithreaded codecs need
cross-origin isolation (COOP/COEP headers). Serving without those headers (e.g.
`python -m http.server`) makes threaded encoders fall back or fail — the app
loads, but you're not getting the real thing.

## Deploy it

This build already includes a `_headers` file that sets COOP/COEP, so it works
as-is on hosts that read it:

- **Netlify** or **Cloudflare Pages**: point the site at this `dist/` directory.
  The `_headers` file gives you cross-origin isolation automatically.

GitHub Pages can't set those headers; it needs a client-side `coi-serviceworker`
shim (not included here).
