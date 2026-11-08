import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "dashboard-thresholds.spec.ts",
  timeout: 180000,
  expect: { timeout: 30000 },
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results/dashboard-thresholds/browser",
  use: {
    baseURL: "http://127.0.0.1:5223",
    headless: true,
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --config e2e/fixtures/vite.dashboard-thresholds.config.ts --host 127.0.0.1 --port 5223 --strictPort",
    url: "http://127.0.0.1:5223/e2e/fixtures/dashboard-thresholds.html",
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      VITE_APP_ENV: "test",
      VITE_APP_VERSION: "1.0.0-thresholds",
      VITE_API_BASE_URL: "http://127.0.0.1:5223/api/v1",
      VITE_ENABLE_ANALYTICS: "false",
    },
  },
});
