import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "notification-toast.spec.ts",
  timeout: 90000,
  workers: 1,
  outputDir: "test-results/notification-toast/browser",
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:5217", screenshot: "only-on-failure" },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config e2e/fixtures/vite.notification-toast.config.ts --host 127.0.0.1 --port 5217 --strictPort`,
    url: "http://127.0.0.1:5217/e2e/fixtures/notification-toast.html",
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      VITE_APP_ENV: "test",
      VITE_APP_VERSION: "1.0.0-notification-test",
      VITE_API_BASE_URL: "http://127.0.0.1:5217/api/v1",
      VITE_STORAGE_URL: "",
      VITE_ENABLE_ANALYTICS: "false",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
