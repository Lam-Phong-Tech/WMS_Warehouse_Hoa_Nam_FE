import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "inbound-receipt.spec.ts",
  timeout: 90000,
  workers: 1,
  outputDir: "test-results/inbound-receipt/browser",
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:5211", screenshot: "only-on-failure" },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5211 --strictPort`,
    url: "http://127.0.0.1:5211/e2e/fixtures/inbound-receipt.html",
    reuseExistingServer: true,
    timeout: 180000,
    env: {
      VITE_APP_ENV: "test",
      VITE_API_BASE_URL: "http://127.0.0.1:5211/api/v1",
      VITE_STORAGE_URL: "",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
