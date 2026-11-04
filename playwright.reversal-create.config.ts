import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "reversal-create.spec.ts",
  timeout: 180000,
  workers: 1,
  outputDir: "test-results/reversal-create/browser",
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:5201", screenshot: "only-on-failure" },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config e2e/fixtures/vite.reversal-create.config.ts --host 127.0.0.1 --port 5201 --strictPort`,
    url: "http://127.0.0.1:5201/e2e/fixtures/reversal-create.html",
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      VITE_APP_ENV: "test",
      VITE_APP_VERSION: "1.0.0-reversal-create",
      VITE_API_BASE_URL: "http://127.0.0.1:5201/api/v1",
      VITE_STORAGE_URL: "",
      VITE_ENABLE_ANALYTICS: "false",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
