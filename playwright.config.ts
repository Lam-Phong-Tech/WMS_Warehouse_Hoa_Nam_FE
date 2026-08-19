import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/playwright-results.json" }],
    ["junit", { outputFile: "test-results/playwright-junit.xml" }],
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
      testIgnore: [
        "**/auth-role-navigation-qa2.spec.ts",
        "**/wwhn-274-a11y-browser-matrix.spec.ts",
      ],
      use: { ...devices["Desktop Chrome"] },
    },
    // WWHN-274 / FE274-P2-03 — ma tran trinh duyet + thiet bi theo NFR-SRS-006
    // (Chrome/Edge desktop >=1280, Chrome Android >=360, Safari iOS). Day la bang chung
    // emulation engine-level; ma tran thiet bi that van thuoc QA1 (WWHN-275).
    {
      name: "wwhn-274-desktop-chromium",
      testMatch: "**/wwhn-274-a11y-browser-matrix.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "wwhn-274-chrome-android",
      testMatch: "**/wwhn-274-a11y-browser-matrix.spec.ts",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "wwhn-274-safari-ios",
      testMatch: "**/wwhn-274-a11y-browser-matrix.spec.ts",
      use: { ...devices["iPhone 13"] },
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
