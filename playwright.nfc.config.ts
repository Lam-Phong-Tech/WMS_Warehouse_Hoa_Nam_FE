import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "nfc.spec.ts",
  timeout: 90000,
  workers: 1,
  outputDir: "test-results/nfc/browser",
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:5197", screenshot: "only-on-failure" },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config e2e/fixtures/vite.nfc.config.ts --host 127.0.0.1 --port 5197 --strictPort`,
    url: "http://127.0.0.1:5197/e2e/fixtures/nfc.html",
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      VITE_APP_ENV: "test",
      VITE_APP_VERSION: "1.0.0-nfc",
      VITE_API_BASE_URL: "http://127.0.0.1:5197/api/v1",
      VITE_STORAGE_URL: "",
      VITE_ENABLE_ANALYTICS: "false",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
