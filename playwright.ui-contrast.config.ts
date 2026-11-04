import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "ui-contrast.spec.ts",
  timeout: 90000,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results/ui-contrast/browser",
  use: { baseURL: "http://127.0.0.1:5209", screenshot: "only-on-failure" },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config e2e/fixtures/vite.ui-contrast.config.ts --host 127.0.0.1 --port 5209 --strictPort`,
    url: "http://127.0.0.1:5209/e2e/fixtures/ui-contrast.html",
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      VITE_APP_ENV: "test",
      VITE_APP_VERSION: "1.0.0-ui-contrast",
      VITE_API_BASE_URL: "http://127.0.0.1:5209/api/v1",
      VITE_ENABLE_ANALYTICS: "false",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
