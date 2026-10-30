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
        "**/auth-restore-session.spec.ts",
        // Component fixtures run with their isolated Vite server/config.
        "**/outlined-field-focus.spec.ts",
        "**/warranty-table-layout.spec.ts",
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
    // WWHN-167 QA2: evidence Edge thật (channel msedge, Windows). Gate bằng env
    // QA2_EDGE=1 để không đổi hành vi mặc định của `npx playwright test` cho
    // các phiên/gate khác; CI không bao giờ bật cờ này.
    ...(process.env.QA2_EDGE === "1"
      ? [
          {
            name: "qa2-msedge",
            testMatch: [
              "**/wwhn-165-auth-session.spec.ts",
              "**/auth-role-navigation-qa2.spec.ts",
            ],
            use: {
              ...devices["Desktop Edge"],
              channel: "msedge" as const,
              viewport: { width: 1440, height: 900 },
              video: "on" as const,
            },
          },
        ]
      : []),
  ],
});
