// A minimal, fully self-contained image compressor built on jSquash.
// The build step (build.mjs) bundles this and inlines the codec wasm as base64
// into one HTML file that runs straight from file:// — no server. Because
// file:// can't be cross-origin isolated, codecs run single-threaded (fine, just
// a bit slower for AVIF).
import jpegEncode, { init as jpegInit } from '@jsquash/jpeg/encode';
import webpEncode, { init as webpInit } from '@jsquash/webp/encode';
import avifEncode, { init as avifInit } from '@jsquash/avif/encode';

const WASM = /** @type {Record<string,string>} */ (window.__WASM || {});
const bytes = (k) => Uint8Array.from(atob(WASM[k]), (c) => c.charCodeAt(0));

const inited = {};
async function ensure(fmt) {
  if (inited[fmt]) return;
  // Supply the wasm bytes inline. `locateFile` keeps the Emscripten glue off
  // the `new URL(..., import.meta.url)` path, which throws in a non-module
  // bundle — the bytes are used directly, so nothing is ever fetched.
  const opts = { wasmBinary: bytes(fmt), locateFile: (p) => p };
  if (fmt === 'jpeg') await jpegInit(opts);
  if (fmt === 'webp') await webpInit(opts);
  if (fmt === 'avif') await avifInit(opts);
  inited[fmt] = true;
}

const $ = (id) => document.getElementById(id);
let sourceImageData = null;
let sourceName = 'image';

function fmtBytes(n) {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} kB`;
}

async function fileToImageData(file, maxW) {
  const bmp = await createImageBitmap(file);
  let w = bmp.width;
  let h = bmp.height;
  if (maxW && w > maxW) {
    h = Math.round((h * maxW) / w);
    w = maxW;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

async function encodeImageData(data, fmt, quality) {
  if (fmt === 'png') {
    const canvas = document.createElement('canvas');
    canvas.width = data.width;
    canvas.height = data.height;
    canvas.getContext('2d').putImageData(data, 0, 0);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    return await blob.arrayBuffer();
  }
  await ensure(fmt);
  if (fmt === 'jpeg') return jpegEncode(data, { quality });
  if (fmt === 'webp') return webpEncode(data, { quality });
  if (fmt === 'avif') return avifEncode(data, { quality: Math.round(quality / 2) });
  throw new Error('unknown format ' + fmt);
}

const EXT = { jpeg: 'jpg', webp: 'webp', avif: 'avif', png: 'png' };
const MIME = {
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  png: 'image/png',
};

async function run() {
  const file = $('file').files[0];
  if (!file) return;
  sourceName = file.name.replace(/\.[^.]*$/, '');
  const fmt = $('format').value;
  const quality = Number($('quality').value);
  const maxW = Number($('maxw').value) || 0;

  $('status').textContent = 'Working…';
  $('download').hidden = true;
  try {
    sourceImageData = await fileToImageData(file, maxW);
    const t = performance.now();
    const buf = await encodeImageData(sourceImageData, fmt, quality);
    const ms = Math.round(performance.now() - t);
    const blob = new Blob([buf], { type: MIME[fmt] });
    const saved = Math.round((1 - blob.size / file.size) * 100);
    $('status').innerHTML =
      `${sourceImageData.width}×${sourceImageData.height} · ` +
      `${fmtBytes(file.size)} → <b>${fmtBytes(blob.size)}</b> ` +
      `(${saved >= 0 ? '−' : '+'}${Math.abs(saved)}%) · ${ms} ms`;
    const url = URL.createObjectURL(blob);
    const a = $('download');
    a.href = url;
    a.download = `${sourceName}.${EXT[fmt]}`;
    a.hidden = false;
    const prev = $('preview');
    prev.src = url;
    prev.hidden = false;
  } catch (err) {
    $('status').textContent = 'Error: ' + (err && err.message);
    console.error(err);
  }
}

function syncQualityVisibility() {
  const lossy = $('format').value !== 'png';
  $('qualityRow').style.opacity = lossy ? '1' : '0.4';
  $('quality').disabled = !lossy;
}

window.addEventListener('DOMContentLoaded', () => {
  $('quality').addEventListener('input', () => {
    $('qval').textContent = $('quality').value;
  });
  $('format').addEventListener('change', syncQualityVisibility);
  $('go').addEventListener('click', run);
  $('file').addEventListener('change', () => {
    $('go').disabled = !$('file').files[0];
  });
  syncQualityVisibility();
});
