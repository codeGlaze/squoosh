# squooshii — prebuilt snapshot

This is a **compiled build** of the `squooshii` branch (all codecs on jSquash),
committed so you can interact with it without a toolchain. It's a build
artifact — regenerate with `npm run build && rm -rf dist && cp -r build dist`.

## Run it locally

From the repo root:

```bash
npm run preview          # serves this dir on http://localhost:3000
```

or directly:

```bash
npx serve --config serve.json dist
```

**The `--config serve.json` matters.** Squoosh's multithreaded codecs need
cross-origin isolation (COOP/COEP headers). Serving without those headers makes
threaded encoders fall back or fail. `npm run preview` and the command above set
them; a plain static file server (or opening `index.html` via `file://`) will
not.

## Deploy it

This build already includes a `_headers` file that sets COOP/COEP, so it works
as-is on hosts that read it:

- **Netlify** or **Cloudflare Pages**: point the site at this `dist/` directory.
  The `_headers` file gives you cross-origin isolation automatically.

GitHub Pages can't set those headers; it needs a client-side `coi-serviceworker`
shim (not included here).
