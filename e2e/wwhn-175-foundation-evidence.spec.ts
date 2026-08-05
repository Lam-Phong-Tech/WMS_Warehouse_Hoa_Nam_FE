/**
 * WWHN-175 / WWHN-176 – FE foundation responsive, accessibility and smoke evidence.
 *
 * Controlled API mocks verify deterministic FE behaviour. This suite does not
 * prove backend authorization and does not replace independent QA2 acceptance.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  expect,
  test,
  type Page,
  type Route,
  type TestInfo,
} from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";
const SOURCE_SHA =
  process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const APP_ENV = process.env.VITE_APP_ENV ?? "local";
const BUILD_VERSION = process.env.VITE_APP_VERSION ?? "local-dev";
const EVIDENCE_ROOT =
  process.env.WWHN_175_EVIDENCE_DIR ??
  join("test-results", "wwhn-175", SOURCE_SHA);

const VIEWPORTS = [
  { key: "desktop", width: 1440, height: 900 },
  { key: "tablet", width: 768, height: 1024 },
  { key: "mobile", width: 375, height: 812 },
] as const;

interface EvidenceInput {
  scenario: string;
  role: string;
  viewport: { width: number; height: number };
  route: string;
  assertions: string[];
}

function safeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  input: EvidenceInput,
): Promise<void> {
  const prefix = [
    "WWHN-175",
    safeName(input.scenario),
    safeName(input.role),
    `${input.viewport.width}x${input.viewport.height}`,
  ].join("__");
  const screenshotFilename = `${prefix}.png`;
  const metadataFilename = `${prefix}.json`;
  const timestamp = new Date().toISOString();

  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  await page.screenshot({
    path: join(EVIDENCE_ROOT, screenshotFilename),
    fullPage: true,
  });

  const metadata = {
    schemaVersion: "1.0.0",
    ticket: "WWHN-175",
    qaTicket: "WWHN-176",
    scenario: input.scenario,
    result: "PASS",
    sourceSha: SOURCE_SHA,
    environment: APP_ENV,
    buildVersion: BUILD_VERSION,
    role: input.role,
    viewport: input.viewport,
    browserProject: testInfo.project.name,
    route: input.route,
    finalUrl: page.url(),
    timestamp,
    screenshotFilename,
    videoPolicy: "on",
    tracePolicy: "on",
    assertions: input.assertions,
    evidenceBoundary:
      "Controlled FE evidence only; independent QA2 browser/UAT sign-off remains required.",
  };

  writeFileSync(
    join(EVIDENCE_ROOT, metadataFilename),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
  await testInfo.attach("wwhn-175-evidence-metadata", {
    body: Buffer.from(JSON.stringify(metadata, null, 2)),
    contentType: "application/json",
  });
}

async function mockAnonymousSession(page: Page): Promise<void> {
  await page.route("**/api/v1/auth/refresh", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        error_code: "UNAUTHENTICATED",
        message: "No active WWHN-175 test session",
      }),
    });
  });
}

async function mockAuthenticatedSession(page: Page): Promise<void> {
  await page.route("**/api/v1/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname;

    if (path.endsWith("/auth/refresh")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            access_token: "wwhn-175-controlled-access-token",
            refresh_token: "wwhn-175-controlled-refresh-token",
            token_type: "bearer",
            expires_in: 3600,
          },
          meta: { request_id: "wwhn-175-refresh" },
        }),
      });
      return;
    }

    if (path.endsWith("/auth/me")) {
      const activeContext = {
        role_id: 175,
        role_name: "Foundation QA Admin",
        scope_type: "he_thong",
        org_unit_id: null,
        department_id: null,
        warehouse_id: null,
        permission_codes: [],
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: 175,
            name: "WWHN-175 QA User",
            email: "qa.wwhn175@example.com",
            code: "QA-WWHN-175",
            is_super_admin: true,
            active_context: activeContext,
            available_contexts: [activeContext],
          },
          meta: { request_id: "wwhn-175-me" },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [], meta: {} }),
    });
  });
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasOverflow).toBe(false);
}

test.use({ video: "on", trace: "on", screenshot: "on" });

test.describe("WWHN-175 / WWHN-176 foundation closure", () => {
  for (const viewport of VIEWPORTS) {
    test(`login shell responsive ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await mockAnonymousSession(page);
      await page.goto(`${BASE_URL}/login`);

      await expect(page.getByRole("heading", { name: "Hoa Nam" })).toBeVisible();
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeEnabled();
      await expectNoDocumentOverflow(page);

      await captureEvidence(page, testInfo, {
        scenario: `login-responsive-${viewport.key}`,
        role: "anonymous",
        viewport,
        route: "/login",
        assertions: [
          "Login heading, email, password and submit controls are visible",
          "Submit control has an accessible role and name",
          "Document has no horizontal overflow",
        ],
      });
    });
  }

  for (const viewport of VIEWPORTS) {
    test(`component catalog smoke ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await mockAuthenticatedSession(page);
      await page.goto(`${BASE_URL}/component-catalog`);

      await expect(
        page.getByRole("heading", { name: "Component catalog" }),
      ).toBeVisible();
      await expect(page.getByText("Loading", { exact: true })).toBeVisible();
      await expect(page.getByText("Empty", { exact: true })).toBeVisible();
      await expect(page.getByText("Error", { exact: true })).toBeVisible();
      await expect(
        page.getByText("No permission", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("API error + field errors", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Disabled until valid" }),
      ).toBeDisabled();
      await expectNoDocumentOverflow(page);

      await captureEvidence(page, testInfo, {
        scenario: `component-catalog-smoke-${viewport.key}`,
        role: "super_admin",
        viewport,
        route: "/component-catalog",
        assertions: [
          "Shared loading, empty, error and no-permission states render",
          "Validation and disabled-action states render",
          "Controls expose accessible role/name",
          "Document has no horizontal overflow",
        ],
      });
    });
  }

  test("keyboard focus opens and closes shared form modal", async ({
    page,
  }, testInfo) => {
    const viewport = { width: 1440, height: 900 };
    await page.setViewportSize(viewport);
    await mockAuthenticatedSession(page);
    await page.goto(`${BASE_URL}/component-catalog`);

    const openButton = page.getByRole("button", { name: "Mở modal" });
    await openButton.focus();
    await expect(openButton).toBeFocused();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Form modal" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByPlaceholder("IN-260729-001"),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(openButton).toBeFocused();

    await captureEvidence(page, testInfo, {
      scenario: "keyboard-modal-focus",
      role: "super_admin",
      viewport,
      route: "/component-catalog",
      assertions: [
        "Modal trigger receives keyboard focus",
        "Enter opens an accessible named dialog",
        "Escape closes the dialog",
        "Focus returns to the trigger",
      ],
    });
  });
});
