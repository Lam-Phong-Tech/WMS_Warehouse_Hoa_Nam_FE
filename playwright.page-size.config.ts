import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "page-size-selectors.spec.ts",
  timeout: 90000,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results/page-size/browser",
  use: { baseURL: "http://127.0.0.1:5227", screenshot: "only-on-failure" },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5227 --strictPort`,
    url: "http://127.0.0.1:5227/e2e/fixtures/page-size-selectors.html",
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      VITE_APP_ENV: "test",
      VITE_API_BASE_URL: "http://127.0.0.1:5227/api/v1",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
