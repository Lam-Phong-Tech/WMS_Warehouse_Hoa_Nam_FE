import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "outlined-field-focus.spec.ts",
  globalSetup: "./e2e/form-focus.setup.ts",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  workers: 2,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/form-focus/results.json" }],
  ],
  outputDir: "test-results/form-focus/browser",
  use: {
    baseURL: "http://127.0.0.1:5191",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config e2e/fixtures/vite.form-focus.config.ts --host 127.0.0.1 --port 5191 --strictPort`,
    url: "http://127.0.0.1:5191/e2e/fixtures/outlined-fields.html",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_APP_ENV: "test",
      VITE_APP_VERSION: "1.0.0-form-focus",
      VITE_API_BASE_URL: "http://127.0.0.1:5191/api/v1",
      VITE_STORAGE_URL: "",
      VITE_ENABLE_ANALYTICS: "false",
      VITE_ENABLE_DEBUG: "false",
      VITE_ENABLE_PERF_MONITOR: "false",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
