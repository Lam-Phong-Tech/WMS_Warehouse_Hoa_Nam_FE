import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "iam-audit.spec.ts",
  timeout: 180000,
  workers: 1,
  outputDir: "test-results/iam-audit/browser",
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5204",
    screenshot: "only-on-failure",
    actionTimeout: 15000,
  },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config e2e/fixtures/vite.iam-audit.config.ts --host 127.0.0.1 --port 5204 --strictPort`,
    url: "http://127.0.0.1:5204/e2e/fixtures/iam-audit.html",
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      VITE_APP_ENV: "test",
      VITE_APP_VERSION: "1.0.0-iam-audit",
      VITE_API_BASE_URL: "http://127.0.0.1:5204/api/v1",
      VITE_STORAGE_URL: "",
      VITE_ENABLE_ANALYTICS: "false",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
