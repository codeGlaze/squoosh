import { test, expect } from '@playwright/test';
import {
  fixture,
  openEditor,
  selectRightEncoder,
  expectRoundTrip,
  rightDownload,
  rightCanvasSize,
} from './helpers';

// Every registered encoder. Guards against a codec swap (e.g. → jSquash)
// silently breaking encode, decode, or the wiring for any format.
const ENCODERS: { key: string; ext: string; lossy: boolean }[] = [
  { key: 'mozJPEG', ext: 'jpg', lossy: true },
  { key: 'browserJPEG', ext: 'jpg', lossy: true },
  { key: 'webP', ext: 'webp', lossy: true },
  { key: 'avif', ext: 'avif', lossy: true },
  { key: 'jxl', ext: 'jxl', lossy: true },
  { key: 'wp2', ext: 'wp2', lossy: true },
  { key: 'oxiPNG', ext: 'png', lossy: false },
  { key: 'browserPNG', ext: 'png', lossy: false },
  { key: 'qoi', ext: 'qoi', lossy: false },
  // browserGIF is intentionally omitted: it relies on the browser's
  // canvas.toBlob('image/gif'), which Chromium doesn't support, so Squoosh
  // filters it out of the encoder list. It's a JS canvas encoder, not part of
  // the WASM/jSquash codec set this suite guards.
];

const SIZE: [number, number] = [300, 200]; // matches fixtures/a.png

test.describe('encoders round-trip', () => {
  for (const { key, ext } of ENCODERS) {
    test(`${key} encodes to .${ext} and decodes back to ${SIZE[0]}x${SIZE[1]}`, async ({
      page,
    }) => {
      await openEditor(page, fixture('a.png'));
      await selectRightEncoder(page, key);
      await expectRoundTrip(page, ext, SIZE);
    });
  }
});

test('MozJPEG quality drives output size (options are wired)', async ({
  page,
}) => {
  await openEditor(page, fixture('a.png'));
  await selectRightEncoder(page, 'mozJPEG');
  await expectRoundTrip(page, 'jpg', SIZE);

  const setQuality = (q: number) =>
    page.evaluate((q) => {
      // The only range inputs present belong to the right encoder's options;
      // quality is the 0–100 range.
      const range = [...document.querySelectorAll('input[type=range]')].find(
        (r) => (r as HTMLInputElement).max === '100',
      ) as HTMLInputElement | undefined;
      if (!range) throw new Error('no quality range found');
      const setter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(range),
        'value',
      )!.set!;
      setter.call(range, String(q));
      range.dispatchEvent(new Event('input', { bubbles: true }));
      range.dispatchEvent(new Event('change', { bubbles: true }));
    }, q);

  await setQuality(95);
  await expect
    .poll(async () => (await rightDownload(page))?.bytes, { timeout: 60_000 })
    .toBeGreaterThan(0);
  const high = (await rightDownload(page))!.bytes;

  await setQuality(10);
  // Wait until the size actually changes from the high-quality encode.
  await expect
    .poll(async () => (await rightDownload(page))!.bytes, { timeout: 60_000 })
    .toBeLessThan(high);
  const low = (await rightDownload(page))!.bytes;

  expect(low).toBeLessThan(high);
  expect(await rightCanvasSize(page)).toEqual(SIZE);
});
