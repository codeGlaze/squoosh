// Bundles app.mjs and inlines the jSquash codec wasm as base64 into ONE HTML
// file that runs from file:// (double-click, no server). Needs esbuild:
//   npx esbuild --version   (or: npm i -D esbuild)
//   node build.mjs
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const nm = join(here, '..', '..', 'node_modules', '@jsquash');

const result = await build({
  entryPoints: [join(here, 'app.mjs')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  legalComments: 'none',
  // Resolve @jsquash from the repo root node_modules.
  absWorkingDir: join(here, '..', '..'),
  nodePaths: [join(here, '..', '..', 'node_modules')],
});
const js = result.outputFiles[0].text;

const b64 = (p) => readFileSync(p).toString('base64');
const WASM = {
  jpeg: b64(join(nm, 'jpeg/codec/enc/mozjpeg_enc.wasm')),
  webp: b64(join(nm, 'webp/codec/enc/webp_enc.wasm')),
  avif: b64(join(nm, 'avif/codec/enc/avif_enc.wasm')),
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Squoosh Lite</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font: 15px/1.5 system-ui, sans-serif; background: #141414; color: #eee; }
  main { max-width: 640px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.sub { color: #999; margin: 0 0 20px; }
  .card { background: #1f1f1f; border: 1px solid #333; border-radius: 10px; padding: 18px; }
  label { display: block; margin: 12px 0 4px; color: #bbb; font-size: 13px; }
  select, input[type=number] { width: 100%; box-sizing: border-box; padding: 8px; background: #2a2a2a; color: #fff; border: 1px solid #444; border-radius: 6px; }
  input[type=range] { width: 100%; }
  .row2 { display: flex; gap: 12px; }
  .row2 > div { flex: 1; }
  button { margin-top: 18px; width: 100%; padding: 11px; font-size: 15px; font-weight: 600; background: #d81b60; color: #fff; border: 0; border-radius: 8px; cursor: pointer; }
  button:disabled { background: #444; cursor: default; }
  #status { margin-top: 16px; min-height: 20px; }
  #download { display: inline-block; margin-top: 12px; color: #4fc3f7; }
  #preview { display: block; max-width: 100%; margin-top: 16px; border-radius: 6px; background: #000; }
  footer { color: #666; font-size: 12px; margin-top: 24px; text-align: center; }
</style>
</head>
<body>
<main>
  <h1>Squoosh Lite</h1>
  <p class="sub">Single-file offline image compressor. Everything runs on your machine — nothing is uploaded.</p>
  <div class="card">
    <label for="file">Image (JPEG / PNG / WebP / GIF)</label>
    <input id="file" type="file" accept="image/*" />
    <div class="row2">
      <div>
        <label for="format">Output format</label>
        <select id="format">
          <option value="jpeg">JPEG (MozJPEG)</option>
          <option value="webp">WebP</option>
          <option value="avif">AVIF</option>
          <option value="png">PNG (lossless)</option>
        </select>
      </div>
      <div>
        <label for="maxw">Max width (px, 0 = keep)</label>
        <input id="maxw" type="number" min="0" step="1" value="0" />
      </div>
    </div>
    <div id="qualityRow">
      <label for="quality">Quality: <span id="qval">75</span></label>
      <input id="quality" type="range" min="1" max="100" value="75" />
    </div>
    <button id="go" disabled>Compress</button>
    <div id="status"></div>
    <a id="download" hidden>Download</a>
    <img id="preview" hidden alt="result preview" />
  </div>
  <footer>Codecs: MozJPEG · libwebp · libavif (jSquash). Runs single-threaded from a file.</footer>
</main>
<script>window.__WASM=${JSON.stringify(WASM)}</script>
<script>${js}</script>
</body>
</html>`;

const out = join(here, 'squoosh-lite.html');
writeFileSync(out, html);
console.log(
  'wrote',
  out,
  (Buffer.byteLength(html) / 1024 / 1024).toFixed(1) + ' MB',
);
