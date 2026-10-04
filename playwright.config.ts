import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against the GitHub Pages build (`npm run build:pages`), served from
 * `/<repo>/` exactly as Pages will — so base-path mistakes fail here, not in
 * production.
 */
const PORT = 4173;
const BASE = `/${process.env.PAGES_REPO ?? "amar-shorir"}/`;

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
    trace: "on-first-retry",
    // Headless browsers draw WebGL on the CPU. With reduced motion the model
    // does not auto-spin, so the viewer only redraws when something changes
    // and parallel workers do not starve each other.
    reducedMotion: "reduce",
    // The offline service worker would answer from its cache and hide the
    // requests these tests watch.
    serviceWorkers: "block",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    {
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    command: "node scripts/serve-pages.mjs",
    url: `http://localhost:${PORT}${BASE}`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
  },
});
