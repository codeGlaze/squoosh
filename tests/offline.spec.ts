import { test, expect } from '@playwright/test';
import {
  openEditor,
  selectRightEncoder,
  expectRoundTrip,
  fixture,
} from './helpers';

/**
 * Regression guard for offline PWA support after the jSquash codec swap.
 *
 * The jSquash codec wasm is NOT in the install-time precache, so the service
 * worker must cache it on first fetch (see `shouldRuntimeCache` in
 * src/sw/to-cache.ts and the fetch handler in src/sw/index.ts). Without that,
 * the codecs 404 offline. This test drives a real encode, then inspects the
 * Cache Storage to confirm the codec wasm landed in the versioned cache.
 */
test('service worker runtime-caches jSquash codec wasm for offline use', async ({
  page,
}) => {
  await openEditor(page, fixture('a.png'));

  // Let the service worker install and take control.
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            !!navigator.serviceWorker.controller ||
            navigator.serviceWorker.ready.then(() => false),
        ),
      { timeout: 30_000, message: 'waiting for SW registration' },
    )
    .toBeTruthy();

  // Reload so the SW controls this page and intercepts codec fetches.
  await page.reload();
  await page.waitForSelector('canvas', { timeout: 30_000 });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, {
    timeout: 30_000,
  });
  await page.setInputFiles('input[type=file]', fixture('a.png'));
  await page.waitForSelector('canvas', { timeout: 30_000 });

  // Encode with a jSquash codec (webP) so its wasm is fetched under /c/.
  await selectRightEncoder(page, 'webP');
  await expectRoundTrip(page, 'webp', [300, 200]);

  // Inspect Cache Storage: at least one /c/*.wasm must be cached.
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const out: string[] = [];
    for (const name of names) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) {
        const p = new URL(req.url).pathname;
        if (p.startsWith('/c/') && p.endsWith('.wasm')) out.push(p);
      }
    }
    return out;
  });

  expect(
    cached.length,
    `expected a /c/*.wasm codec to be cached; got ${JSON.stringify(cached)}`,
  ).toBeGreaterThan(0);
});
