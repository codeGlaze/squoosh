import { Page, expect } from '@playwright/test';
import { join } from 'path';

export const fixture = (name: string) => join(__dirname, 'fixtures', name);

/** Load the editor with a single source image and wait for the first render. */
export async function openEditor(page: Page, file: string) {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', file);
  await page.waitForSelector('canvas', { timeout: 30_000 });
}

/** The right-hand (comparison) side is always the last preview canvas. */
export async function rightCanvasSize(page: Page): Promise<[number, number]> {
  return page.evaluate(() => {
    const cs = document.querySelectorAll('canvas');
    const c = cs[cs.length - 1] as HTMLCanvasElement | undefined;
    return c ? [c.width, c.height] : [0, 0];
  });
}

/** The right-hand side's download link (rendered after the left one). */
export async function rightDownload(
  page: Page,
): Promise<{ name: string; bytes: number } | null> {
  return page.evaluate(async () => {
    const links = [...document.querySelectorAll('a[download]')];
    const a = links[links.length - 1] as HTMLAnchorElement | undefined;
    if (!a) return null;
    const bytes = (await (await fetch(a.href)).arrayBuffer()).byteLength;
    return { name: a.getAttribute('download') || '', bytes };
  });
}

/** Pick the encoder on the right (comparison) side by its key, e.g. "webP". */
export async function selectRightEncoder(page: Page, key: string) {
  const selects = page
    .locator('select')
    .filter({ has: page.locator('option[value="mozJPEG"]') });
  // [left, right] — the comparison side is the second.
  await selects.nth(1).selectOption(key);
}

/**
 * Wait until the right side has produced an encoded output with the expected
 * file extension AND decoded back to the given dimensions — i.e. the codec's
 * encode+decode round-trip succeeded.
 */
export async function expectRoundTrip(
  page: Page,
  ext: string,
  [w, h]: [number, number],
) {
  await expect
    .poll(async () => (await rightDownload(page))?.name.endsWith('.' + ext), {
      timeout: 90_000,
      message: `waiting for .${ext} output`,
    })
    .toBe(true);
  await expect
    .poll(() => rightCanvasSize(page), {
      timeout: 90_000,
      message: `waiting for ${ext} to decode to ${w}x${h}`,
    })
    .toEqual([w, h]);
  const out = await rightDownload(page);
  expect(out!.bytes, `${ext} output should be non-empty`).toBeGreaterThan(20);
}
