import { test, expect } from '@playwright/test';
import { statSync } from 'fs';
import { fixture, openEditor, rightCanvasSize } from './helpers';

// a.png is 300x200.

test('crop: the exported image is the selected region', async ({ page }) => {
  await openEditor(page, fixture('a.png'));
  await page.click('button[title="Crop"]');
  await page.waitForSelector('button:has-text("Apply crop")');

  // Set a 180x120 region at (40,30) via the editor's numeric inputs.
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Apply crop',
    )!;
    const overlay = btn.closest('div[style*="fixed"]')!;
    const inputs = overlay.querySelectorAll('input[type=number]');
    const set = (el: Element, v: number) => {
      const setter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(el),
        'value',
      )!.set!;
      setter.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(inputs[0], 40);
    set(inputs[1], 30);
    set(inputs[2], 180);
    set(inputs[3], 120);
  });
  await page.click('button:has-text("Apply crop")');

  await expect
    .poll(() => rightCanvasSize(page), { timeout: 60_000 })
    .toEqual([180, 120]);
});

test('resize: the exported image matches the target size', async ({ page }) => {
  await openEditor(page, fixture('a.png'));

  // The identity side shows no processing options, so the only resize toggle
  // is the comparison side's. Enabling it reveals the width input.
  await page
    .locator('input[name="resize.enable"]')
    .first()
    .check({ force: true });
  const width = page.locator('input[name="width"]').first();
  await width.waitFor({ state: 'attached', timeout: 30_000 });
  await width.fill('150');
  await width.dispatchEvent('input');

  // Aspect ratio is maintained by default: 300x200 → 150x100.
  await expect
    .poll(() => rightCanvasSize(page), { timeout: 60_000 })
    .toEqual([150, 100]);
});

test('batch: compresses multiple files and downloads a zip', async ({
  page,
}) => {
  await openEditor(page, fixture('a.png'));

  await page.click('button[title="Open image(s)"]');
  await page.setInputFiles('input[type=file]', [
    fixture('a.png'),
    fixture('b.png'),
    fixture('c.png'),
  ]);

  await page.click('button:has-text("Compress all")');
  await expect(page.getByText('Compress all images')).toBeVisible();
  await expect(page.getByText(/3 \/ 3 done/)).toBeVisible({ timeout: 90_000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Download \.zip/ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('squoosh.zip');
  const path = await download.path();
  expect(statSync(path).size).toBeGreaterThan(100);
});
