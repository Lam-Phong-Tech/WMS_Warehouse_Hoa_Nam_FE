import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import { MOCK_ACCESS_TOKEN, MOCK_REFRESH_TOKEN } from "./support/mock-tokens";

/**
 * Responsive regression sweep toàn ứng dụng (bổ sung cho
 * wwhn-292-ui-responsive-rbac.spec.ts — KHÔNG thay thế contract shell 980px).
 *
 * Với mỗi viewport bắt buộc: đi qua mọi route nghiệp vụ + các deep-link
 * ?screen= mở modal, và assert:
 *   - documentElement.scrollWidth <= innerWidth + 1 (không tràn ngang trang;
 *     cuộn ngang bên trong .ant-table-container / .table-wrap là hợp lệ);
 *   - primary navigation hiển thị;
 *   - header title hiển thị;
 *   - nếu có modal đang mở: modal không rộng hơn viewport.
 */

// Nằm trong test-results thì bị Playwright dọn giữa các run; cho phép override
// ra ngoài khi cần giữ ảnh làm bằng chứng duyệt mắt.
const SCREENSHOT_DIR =
  process.env.RESPONSIVE_SWEEP_SHOT_DIR ??
  join("test-results", "responsive-sweep");

const ALL_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

/** Route nghiệp vụ chính — quét ở mọi viewport. */
const CORE_ROUTES = [
  "/dashboard",
  "/system/users",
  "/system/roles",
  "/master-data/skus",
  "/master-data/catalog",
  "/master-data/warehouse",
  "/master-data/agencies",
  "/master-data/defects",
  "/inbound",
  "/putaway",
  "/outbound",
  "/warranty",
  "/inventory",
  "/reverse",
  "/reports",
  "/audit-logs",
  "/profile",
  "/component-catalog",
] as const;

/** Deep-link mở modal (dữ liệu mock rỗng — chỉ kiểm tra overflow/geometry). */
const MODAL_ROUTES = [
  "/system/users?screen=IAM-02",
  "/master-data/skus?screen=MST-02",
  "/master-data/agencies?screen=AGY-02",
  "/master-data/defects?screen=DEF-02",
  "/inbound?screen=IN-02",
  "/outbound?screen=OUT-REQ-01",
  "/warranty?screen=WAR-02",
  "/inventory?screen=TRACE-01",
  "/reverse?screen=REV-01",
] as const;

async function setupMockApi(page: Page): Promise<void> {
  const activeContext = {
    role_id: 1,
    role_name: "Super Admin",
    scope_type: "he_thong",
    org_unit_id: null,
    department_id: null,
    warehouse_id: null,
    permission_codes: [] as string[],
  };
  const user = {
    id: 1,
    name: "Responsive Sweep Admin",
    email: "responsive.sweep@example.com",
    code: "RSP-SWEEP",
    is_super_admin: true,
    // normalizeMeResponse chỉ công nhận super admin qua roles[].role_code,
    // không đọc is_super_admin — bắt buộc phải khai role SUPER_ADMIN ở đây.
    roles: [
      {
        // normalizeRoles đòi role_id/role_code/role_name đều là string.
        role_id: "1",
        role_code: "SUPER_ADMIN",
        role_name: "Super Admin",
        scope_ref: null,
      },
    ],
    permissions: [] as string[],
    active_context: activeContext,
    available_contexts: [activeContext],
  };

  await page.route("**/api/v1/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname;

    if (path.endsWith("/auth/refresh")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            access_token: MOCK_ACCESS_TOKEN,
            refresh_token: MOCK_REFRESH_TOKEN,
            token_type: "bearer",
            expires_in: 3600,
          },
          meta: { request_id: "RSP-SWEEP-REFRESH" },
        }),
      });
      return;
    }

    if (path.endsWith("/auth/me")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: user,
          meta: { request_id: "RSP-SWEEP-ME" },
        }),
      });
      return;
    }

    // Dashboard cần object theo KPI matrix (data:[] sẽ crash data.period.*).
    if (path.endsWith("/reports/dashboard-quick")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            period: { from_date: "2026-07-19", to_date: "2026-08-18" },
            data_scope: "GLOBAL",
            scope_warehouse_ids: null,
            available_qty: 1234,
            receipt_qty: 300,
            issue_qty: 120,
            component_issue_qty: 25,
            reversal_net: -5,
            warranty_cases_by_status: { CHECKING: 3, COMPLETED: 7 },
            reconciliation_warning_count: 1,
            reconciliation_warnings: [{ product_id: "p-1" }],
          },
          meta: { request_id: "RSP-SWEEP-DASHBOARD" },
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

interface SweepFailure {
  route: string;
  problem: string;
}

async function auditCurrentPage(
  page: Page,
  route: string,
  failures: SweepFailure[],
  desktopNav: boolean,
): Promise<void> {
  const geometry = await page.evaluate(() => {
    const doc = document.documentElement;
    const nav = document.querySelector('[data-testid="primary-navigation"]');
    const toggle = document.querySelector('[data-testid="mobile-nav-toggle"]');
    const title = document.querySelector(".hn-mvp-title h2");
    const modal = document.querySelector(".ant-modal");
    const modalRect = modal ? modal.getBoundingClientRect() : null;
    return {
      scrollWidth: doc.scrollWidth,
      innerWidth: window.innerWidth,
      navVisible: nav ? (nav as HTMLElement).offsetParent !== null : false,
      toggleVisible: toggle
        ? (toggle as HTMLElement).offsetParent !== null
        : false,
      titleVisible: title
        ? (title as HTMLElement).getBoundingClientRect().height > 0
        : false,
      modalWidth: modalRect ? Math.round(modalRect.width) : null,
      modalLeft: modalRect ? Math.round(modalRect.left) : null,
    };
  });

  if (geometry.scrollWidth > geometry.innerWidth + 1) {
    failures.push({
      route,
      problem: `page horizontal overflow: scrollWidth ${geometry.scrollWidth} > innerWidth ${geometry.innerWidth}`,
    });
  }
  // Shell Part 4 (UiAppShell): <lg (980) sidebar ẩn sau hamburger + Drawer
  // (hợp đồng đã kiểm ở wwhn-144 mobile branch) — mobile chỉ yêu cầu nút mở nav.
  if (desktopNav ? !geometry.navVisible : !geometry.toggleVisible) {
    failures.push({
      route,
      problem: desktopNav
        ? "primary navigation not visible"
        : "mobile nav toggle not visible",
    });
  }
  if (!geometry.titleVisible) {
    failures.push({ route, problem: "header title not visible" });
  }
  if (geometry.modalWidth !== null) {
    if (geometry.modalWidth > geometry.innerWidth) {
      failures.push({
        route,
        problem: `modal wider than viewport: ${geometry.modalWidth} > ${geometry.innerWidth}`,
      });
    }
    if (geometry.modalLeft !== null && geometry.modalLeft < -1) {
      failures.push({
        route,
        problem: `modal clipped off-viewport left: ${geometry.modalLeft}`,
      });
    }
  }
}

test.describe("responsive sweep — authenticated shell across all modules", () => {
  for (const viewport of ALL_VIEWPORTS) {
    test(`no page overflow at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      test.setTimeout(240_000);
      await setupMockApi(page);
      await page.setViewportSize(viewport);

      const failures: SweepFailure[] = [];
      mkdirSync(SCREENSHOT_DIR, { recursive: true });
      // Shell Part 4: sidebar chỉ render từ lg (980) trở lên; dưới đó nav nằm
      // trong Drawer sau hamburger (data-testid mobile-nav-toggle).
      const desktopNav = viewport.width >= 980;

      for (const route of CORE_ROUTES) {
        await page.goto(route);
        // Timeout rộng: 27 lượt goto/viewport trên 1 dev server làm lazy chunk
        // thỉnh thoảng transform chậm hơn 10s mặc định (flake hạ tầng).
        await expect(
          page.getByTestId(
            desktopNav ? "primary-navigation" : "mobile-nav-toggle",
          ),
          `${desktopNav ? "nav" : "mobile nav toggle"} must render on ${route}`,
        ).toBeVisible({ timeout: 30_000 });
        // Cho lazy chunk + effect render xong trước khi đo.
        await page.waitForTimeout(250);
        await auditCurrentPage(page, route, failures, desktopNav);
      }

      for (const route of MODAL_ROUTES) {
        await page.goto(route);
        // Chờ shell render như nhánh CORE_ROUTES — chờ cứng 450ms không đủ khi
        // Vite transform chunk lạnh (deep-link modal nằm trên các page nặng).
        await expect(
          page.getByTestId(
            desktopNav ? "primary-navigation" : "mobile-nav-toggle",
          ),
          `${desktopNav ? "nav" : "mobile nav toggle"} must render on ${route}`,
        ).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(450);
        await auditCurrentPage(page, route, failures, desktopNav);
      }

      // Screenshot bằng chứng cho các màn tiêu biểu ở viewport này.
      for (const shot of ["/dashboard", "/outbound", "/reports"]) {
        await page.goto(shot);
        await page.waitForTimeout(250);
        await page.screenshot({
          path: join(
            SCREENSHOT_DIR,
            `${viewport.width}x${viewport.height}${shot.replace(/\//g, "_")}.png`,
          ),
          fullPage: true,
        });
      }

      expect(
        failures,
        failures
          .map((failure) => `${failure.route}: ${failure.problem}`)
          .join("\n"),
      ).toEqual([]);
    });
  }

  for (const viewport of ALL_VIEWPORTS) {
    test(`login has no overflow at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.route("**/api/v1/**", async (route: Route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/auth/refresh")) {
          await route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({
              success: false,
              error_code: "UNAUTHENTICATED",
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
      await page.setViewportSize(viewport);
      await page.goto("/login");

      await expect(
        page.getByRole("heading", { name: "Đăng nhập hệ thống" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Đăng nhập" }),
      ).toBeVisible();

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(hasOverflow).toBe(false);
    });
  }
});
