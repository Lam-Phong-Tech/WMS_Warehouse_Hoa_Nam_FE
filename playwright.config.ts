import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "test-results/playwright-results.json" }],
  ],
  outputDir: "test-results",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium",
      testIgnore: "**/auth-role-navigation-qa2.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "wwhn-144-chromium",
      testMatch: "**/auth-role-navigation-qa2.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        video: "on",
        trace: "on-first-retry",
      },
    },
  ],
});
