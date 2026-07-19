import { defineConfig, devices } from '@playwright/test';

/**
 * E2E regression tests. They build the app and serve `build/` with the same
 * COOP/COEP headers production uses (needed for the wasm codecs), then drive
 * the real UI so the WASM encoders/decoders actually run.
 */
const PORT = Number(process.env.TEST_PORT || 5099);

// The sandbox ships Chromium at a fixed path; use it directly so we don't
// depend on Playwright's browser download matching this @playwright/test build.
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { executablePath, args: ['--no-sandbox'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx serve --listen ${PORT} --config serve.json build`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
