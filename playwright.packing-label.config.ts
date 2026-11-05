import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "packing-label-report.spec.ts",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:5198",
    headless: true,
    timezoneId: "Asia/Ho_Chi_Minh",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          args: ["--no-sandbox"],
        }
      : undefined,
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command:
          "node node_modules/vite/bin/vite.js --config e2e/fixtures/vite.packing-label.config.ts --host 127.0.0.1 --port 5198 --strictPort",
        url: "http://127.0.0.1:5198/e2e/fixtures/packing-label-report.html",
        reuseExistingServer: false,
        timeout: 180_000,
        env: {
          VITE_APP_ENV: "test",
          VITE_APP_VERSION: "1.0.0-packing-label",
          VITE_API_BASE_URL: "http://127.0.0.1:5198/api/v1",
          VITE_ENABLE_ANALYTICS: "false",
        },
      },
});
