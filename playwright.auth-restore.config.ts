import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "auth-restore-session.spec.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/auth-restore/results.json" }],
  ],
  outputDir: "test-results/auth-restore/browser",
  use: {
    baseURL: "http://127.0.0.1:5193",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js build --config e2e/fixtures/vite.auth-restore.config.ts && "${process.execPath}" node_modules/vite/bin/vite.js preview --config e2e/fixtures/vite.auth-restore.config.ts --host 127.0.0.1 --port 5193 --strictPort`,
    url: "http://127.0.0.1:5193/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_APP_ENV: "test",
      VITE_APP_VERSION: "1.0.0-auth-restore",
      VITE_API_BASE_URL: "http://127.0.0.1:5193/api/v1",
      VITE_API_WITH_CREDENTIALS: "true",
      VITE_STORAGE_URL: "",
      VITE_TEMP_AUTO_LOGIN: "false",
      VITE_SCANNER_KIOSK_MODE: "false",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
