/**
 * WWHN-274 / FE274-P2-03 — Keyboard, focus, basic a11y va browser/device matrix.
 *
 * Neo yeu cau: SRS v1.12 NFR-SRS-006 "Responsive/browser/device matrix — Desktop >=1280px;
 * tablet >=768px; mobile >=360px; Chrome/Edge latest 2 versions, Chrome Android latest 2,
 * Safari iOS latest 2" (bang do luong 13.7: 360/768/1280+).
 *
 * Ranh gioi su that: day la bang chung ENGINE-LEVEL bang device emulation cua Playwright
 * (Chromium cho Chrome/Edge — hai trinh duyet dung chung engine Blink; WebKit cho Safari iOS;
 * Chromium mobile emulation cho Chrome Android). No KHONG thay the ma tran thiet bi that cua
 * QA1 (WWHN-275) va khong phai audit WCAG day du — pham vi la keyboard reachability,
 * focus visibility, semantic form/landmark va khong tran ngang o 3 diem gay NFR-SRS-006.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const SOURCE_SHA =
  process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const APP_ENV = process.env.VITE_APP_ENV ?? "local-controlled";
const BUILD_VERSION = process.env.VITE_APP_VERSION ?? "local-dev";
// Xem ghi chú cùng chỗ trong e2e/wwhn-274-release-signoff.spec.ts: test-results/ bị
// Playwright dọn ở đầu mỗi run và bị .gitignore, nên không dùng làm nơi giữ evidence.
const EVIDENCE_ROOT =
  process.env.WWHN_274_A11Y_EVIDENCE_DIR ??
  join("docs", "evidence", "WWHN-274", "generated", SOURCE_SHA, "a11y");

/** Diem gay NFR-SRS-006: bien duoi cua desktop/tablet/mobile. */
const NFR_BREAKPOINTS = [
  { key: "desktop-min", width: 1280, height: 800 },
  { key: "tablet-min", width: 768, height: 1024 },
  { key: "mobile-min", width: 360, height: 640 },
] as const;

/** Nhan trinh duyet thuc te ma tung project dai dien, de evidence khong noi qua su that. */
const BROWSER_MATRIX_LABEL: Record<string, string> = {
  "wwhn-274-desktop-chromium":
    "Chrome/Edge desktop (Blink/Chromium engine, emulated latest)",
  "wwhn-274-chrome-android":
    "Chrome Android (Chromium mobile emulation, Pixel-class 360px)",
  "wwhn-274-safari-ios": "Safari iOS (WebKit engine, iPhone-class emulation)",
};

function safeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/[^a-zA-Z0-9_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase();
}

async function writeMatrixEvidence(
  page: Page,
  testInfo: TestInfo,
  input: {
    scenario: string;
    viewport: { width: number; height: number };
    assertions: string[];
    observed: Record<string, unknown>;
  },
): Promise<void> {
  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  const prefix = [
    "WWHN-274",
    safeName(input.scenario),
    safeName(testInfo.project.name),
    `${input.viewport.width}x${input.viewport.height}`,
  ].join("__");

  await page.screenshot({
    path: join(EVIDENCE_ROOT, `${prefix}.png`),
    fullPage: true,
  });

  const payload = {
    ticket: "WWHN-274",
    finding: "FE274-P2-03",
    parent: "WWHN-72",
    requirement: "NFR-SRS-006",
    evidenceClass: "FE_CONTROLLED_ENGINE_EMULATION_NOT_REAL_DEVICE",
    scenario: input.scenario,
    result: "PASS",
    sourceSha: SOURCE_SHA,
    environment: APP_ENV,
    buildVersion: BUILD_VERSION,
    browserProject: testInfo.project.name,
    browserMatrixTarget:
      BROWSER_MATRIX_LABEL[testInfo.project.name] ?? testInfo.project.name,
    engine: testInfo.project.use.browserName ?? "chromium",
    viewport: input.viewport,
    route: "/login",
    timestamp: new Date().toISOString(),
    screenshotFilename: `${prefix}.png`,
    assertions: input.assertions,
    observed: input.observed,
    truthBoundary:
      "Emulation-level browser/device evidence + basic a11y. Khong phai real-device matrix cua QA1 (WWHN-275) va khong phai audit WCAG day du.",
  };
  writeFileSync(
    join(EVIDENCE_ROOT, `${prefix}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
  await testInfo.attach("wwhn-274-a11y-matrix-evidence", {
    body: Buffer.from(JSON.stringify(payload, null, 2)),
    contentType: "application/json",
  });
}

/**
 * Chu ky thi giac cua trang thai focus.
 *
 * AntD ve focus ring len wrapper `.ant-input-affix-wrapper`, KHONG len chinh the
 * `<input>` khi o nhap co prefix icon (LoginPage dung prefix cho ca hai o). Do thang
 * tren `<input>` se luon tra `none|3px|none` o ca hai trang thai va bien phep do
 * thanh vo nghia — chinh la ly do ban dau cua bai test nay bao do.
 */
function readFocusSignature(element: HTMLElement | SVGElement): string {
  // Part 4 (MUI): input không mang border — chỉ báo focus nằm trên fieldset
  // `.MuiOutlinedInput-notchedOutline` (đổi màu/độ dày viền). Giữ nhánh antd
  // cũ cho các control adapter còn lại.
  const root =
    element.closest(".MuiOutlinedInput-root") ??
    element.closest(".ant-input-affix-wrapper") ??
    element;
  const target =
    root.querySelector?.(".MuiOutlinedInput-notchedOutline") ?? root;
  const style = window.getComputedStyle(target);
  return [
    style.outlineStyle,
    style.outlineWidth,
    style.boxShadow,
    style.borderColor,
    style.borderWidth,
  ].join("|");
}

/** Chan moi request API: spec nay chi do UI shell, khong duoc phu thuoc backend. */
async function stubAuthBootstrap(page: Page): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        message: "No session",
        error_code: "UNAUTHENTICATED",
      }),
    });
  });
}

test.describe("WWHN-274 a11y + browser/device matrix (NFR-SRS-006)", () => {
  test.beforeEach(async ({ page, context }) => {
    // Lan dau khoi dong Vite dev server co the ton hon 30s (optimize deps) va bai test
    // nay chay tren 3 engine noi tiep nhau, nen noi rong ngan sach thoi gian mac dinh.
    test.setTimeout(120_000);
    await context.clearCookies();
    await stubAuthBootstrap(page);
  });

  test("login shell keeps accessible semantics on every matrix engine", async ({
    page,
  }, testInfo) => {
    await page.goto("/login");

    // Landmark + heading duy nhat: dieu kien toi thieu de screen reader dinh huong.
    await expect(page.locator("main")).toHaveCount(1);
    const headings = page.getByRole("heading", { level: 1 });
    await expect(headings).toHaveCount(1);
    await expect(headings).toHaveText("Đăng nhập hệ thống");

    // Label phai lien ket voi input that (getByLabel chi khop khi co htmlFor/aria-label).
    const identifier = page.getByLabel("Đăng nhập bằng Gmail");
    const password = page.getByLabel("Mật khẩu", { exact: true });
    await expect(identifier).toBeVisible();
    await expect(password).toBeVisible();
    await expect(password).toHaveAttribute("type", "password");

    const submit = page.getByRole("button", { name: "Đăng nhập" });
    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();

    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    await writeMatrixEvidence(page, testInfo, {
      scenario: "accessible-login-semantics",
      viewport,
      assertions: [
        "Co dung mot landmark <main> va dung mot heading level 1",
        "Label duoc lien ket voi o nhap (getByLabel khop)",
        "O mat khau dung type=password",
        "Nut submit co accessible name va dang enabled",
      ],
      observed: {
        headingText: "Đăng nhập hệ thống",
        submitAccessibleName: "Đăng nhập",
      },
    });
  });

  test("keyboard-only operation reaches and submits the login form", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "wwhn-274-desktop-chromium",
      "Tab-order la hop dong ban phim cua desktop; Chrome Android/Safari iOS dung touch nen khong ap dung",
    );

    await page.goto("/login");
    const identifier = page.getByLabel("Đăng nhập bằng Gmail");
    const password = page.getByLabel("Mật khẩu", { exact: true });

    // Focus dau tien phai o o dau tien (autoFocus), khong lac vao phan tu trang tri.
    await expect(identifier).toBeFocused();

    // Phep do phai lay CUNG mot o nhap, truoc va sau khi no nhan focus. Do o dang
    // focus (identifier) roi so voi o vua nhan focus (password) thi ca hai lan do
    // deu la trang thai focus nen phep do khong con y nghia.
    const blurredFocusStyle = await password.evaluate(readFocusSignature);

    await page.keyboard.press("Tab");
    await expect(password).toBeFocused();

    // Focus phai NHIN THAY duoc: style luc focus khac luc khong focus.
    const focusedFocusStyle = await password.evaluate(readFocusSignature);
    expect(focusedFocusStyle).not.toBe(blurredFocusStyle);

    // "Khac nhau" chua du: khac biet phai la dau hieu thi giac that — outline,
    // box-shadow, HOAC vien doi mau/do day (chi bao focus chuan cua MUI
    // notched outline).
    const [focusedOutlineStyle, , focusedBoxShadow, focusedBorderColor, focusedBorderWidth] =
      focusedFocusStyle.split("|");
    const [, , , blurredBorderColor, blurredBorderWidth] =
      blurredFocusStyle.split("|");
    expect(
      focusedOutlineStyle !== "none" ||
        focusedBoxShadow !== "none" ||
        focusedBorderColor !== blurredBorderColor ||
        focusedBorderWidth !== blurredBorderWidth,
    ).toBe(true);

    // Submit phai voi toi bang ban phim va Enter phai kich hoat validation, khong "im lang".
    const submit = page.getByRole("button", { name: "Đăng nhập" });
    await submit.focus();
    await expect(submit).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(
      page.getByText("Vui lòng nhập email hoặc tên đăng nhập"),
    ).toBeVisible();
    await expect(submit).toBeEnabled();

    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    await writeMatrixEvidence(page, testInfo, {
      scenario: "keyboard-only-login",
      viewport,
      assertions: [
        "Focus khoi tao nam o o nhap dau tien",
        "Tab di chuyen sang o mat khau",
        "Trang thai focus co bieu dien thi giac khac trang thai khong focus",
        "Enter tren nut submit kich hoat validation va khong khoa lai nut",
      ],
      observed: { blurredFocusStyle, focusedFocusStyle },
    });
  });

  test("no horizontal overflow at the NFR-SRS-006 breakpoints", async ({
    page,
  }, testInfo) => {
    const measured: Array<Record<string, unknown>> = [];

    for (const breakpoint of NFR_BREAKPOINTS) {
      await page.setViewportSize({
        width: breakpoint.width,
        height: breakpoint.height,
      });
      await page.goto("/login");
      await expect(
        page.getByRole("button", { name: "Đăng nhập" }),
      ).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);

      const submitBox = await page
        .getByRole("button", { name: "Đăng nhập" })
        .boundingBox();
      expect(submitBox).not.toBeNull();
      // Vung cham toi thieu de thao tac duoc tren mobile (>=360px) va tablet.
      expect(submitBox?.height ?? 0).toBeGreaterThanOrEqual(32);
      expect(submitBox?.width ?? 0).toBeLessThanOrEqual(breakpoint.width);

      measured.push({
        breakpoint: breakpoint.key,
        width: breakpoint.width,
        height: breakpoint.height,
        horizontalOverflowPx: overflow,
        submitHeightPx: submitBox?.height ?? null,
      });

      await writeMatrixEvidence(page, testInfo, {
        scenario: `responsive-${breakpoint.key}`,
        viewport: { width: breakpoint.width, height: breakpoint.height },
        assertions: [
          `Viewport ${breakpoint.width}x${breakpoint.height} khong tran ngang`,
          "Hanh dong chinh hien thi va co vung cham du lon",
        ],
        observed: {
          horizontalOverflowPx: overflow,
          submitHeightPx: submitBox?.height ?? null,
        },
      });
    }

    expect(measured).toHaveLength(NFR_BREAKPOINTS.length);
  });
});
