import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "warranty-typography.spec.ts",
  timeout: 90_000,
  workers: 1,
  outputDir: "test-results/warranty-typography/browser",
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:5200", screenshot: "only-on-failure" },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config e2e/fixtures/vite.warranty-typography.config.ts --host 127.0.0.1 --port 5200 --strictPort`,
    url: "http://127.0.0.1:5200/e2e/fixtures/warranty-typography.html",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_APP_ENV: "test",
      VITE_APP_VERSION: "1.0.0-warranty-typography",
      VITE_API_BASE_URL: "http://127.0.0.1:5200/api/v1",
      VITE_STORAGE_URL: "",
      VITE_ENABLE_ANALYTICS: "false",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
