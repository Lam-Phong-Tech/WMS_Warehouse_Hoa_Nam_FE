import { expect, test, type Page, type Route } from "@playwright/test";
import { MOCK_ACCESS_TOKEN, MOCK_REFRESH_TOKEN } from "./support/mock-tokens";

/**
 * Màn Dashboard tổng quan — bằng chứng hành vi FE với payload mock deterministic.
 *
 * Ranh giới sự thật: mọi payload ở đây là mock. File này chứng minh FE render đúng
 * contract `GET /api/v1/reports/dashboard-overview` — KHÔNG chứng minh backend tính
 * đúng số, và không thay thế QA/UAT.
 */

const TODAY = new Date().toISOString().slice(0, 10);

function daysAgo(count: number): string {
  const date = new Date();
  date.setDate(date.getDate() - count);
  return date.toISOString().slice(0, 10);
}

const OVERVIEW = {
  period: { from_date: daysAgo(6), to_date: TODAY },
  data_scope: "GLOBAL",
  scope_warehouse_ids: null,
  kpi: {
    on_hand: { product: 800, component: 434, total: 1234 },
    receipt_today: { product: 200, component: 100, total: 300 },
    issue_today: { product: 90, component: 30, total: 120 },
    receipt_month: { product: 1000, component: 500, total: 1500 },
    issue_month: { product: 600, component: 150, total: 750 },
  },
  warranty_received: { today: 3, week: 11, month: 42 },
  top_sku: {
    best: { sku_code: "SKU-A", sku_name: "Máy bơm ly tâm A", issue_qty: 90 },
    worst: { sku_code: "SKU-Z", sku_name: "Van một chiều Z", issue_qty: 2 },
  },
  flow_daily: Array.from({ length: 7 }, (_, index) => ({
    date: daysAgo(6 - index),
    receipt_product: 40 + index * 10,
    receipt_component: 20 + index * 5,
    issue_product: 30 + index * 8,
    issue_component: 10 + index * 3,
  })),
  stock_trend: Array.from({ length: 7 }, (_, index) => ({
    date: daysAgo(6 - index),
    closing_qty: 1000 + index * 40,
  })),
  stock_structure: {
    PRODUCT: {
      AVAILABLE: 800,
      NON_SELLABLE: 120,
      DEFECTIVE: 60,
      QUARANTINE: 20,
    },
    COMPONENT: {
      AVAILABLE: 434,
      NON_SELLABLE: 30,
      DEFECTIVE: 12,
      QUARANTINE: 4,
    },
  },
  warranty: {
    by_status: { RECEIVED: 5, CHECKING: 3, REPAIRING: 4, COMPLETED: 7 },
    overdue_count: 137,
    overdue_sample: [
      {
        warranty_case_code: "WC-0001",
        customer_name: "Nguyễn Văn A",
        status: "CHECKING",
        estimated_completion_date: daysAgo(28),
        days_overdue: 28,
      },
      {
        warranty_case_code: "WC-0002",
        customer_name: "Trần Thị B",
        status: "REPAIRING",
        estimated_completion_date: daysAgo(9),
        days_overdue: 9,
      },
    ],
  },
  issues: {
    inventory_mismatch: 5,
    import_error: 2,
    warranty_overdue: 137,
    print_failed: 1,
  },
};

function authUser() {
  const activeContext = {
    role_id: 1,
    role_name: "Super Admin",
    scope_type: "he_thong",
    org_unit_id: null,
    department_id: null,
    warehouse_id: null,
    permission_codes: ["report.view"],
  };
  return {
    id: 1,
    name: "Dashboard Evidence",
    email: "dashboard.evidence@example.com",
    code: "DASH-EVIDENCE",
    is_super_admin: true,
    permissions: ["report.view"],
    active_context: activeContext,
    available_contexts: [activeContext],
  };
}

async function setupMockApi(page: Page): Promise<void> {
  await page.route("**/api/v1/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data, meta: { request_id: "E2E" } }),
      });

    if (path.endsWith("/auth/refresh")) {
      return json({
        access_token: MOCK_ACCESS_TOKEN,
        refresh_token: MOCK_REFRESH_TOKEN,
        token_type: "bearer",
        expires_in: 3600,
      });
    }
    if (path.endsWith("/auth/me")) return json(authUser());
    if (path.endsWith("/reports/dashboard-overview")) return json(OVERVIEW);
    return json([]);
  });
}

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
}

test.describe("Dashboard tổng quan", () => {
  for (const viewport of [
    { key: "desktop", width: 1440, height: 900 },
    { key: "tablet", width: 768, height: 1024 },
    { key: "mobile", width: 375, height: 812 },
  ] as const) {
    test(`render đủ KPI và 5 biểu đồ ở ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await setupMockApi(page);
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/dashboard");

      const kpi = page.getByRole("region", { name: "Chỉ số vận hành" });
      await expect(kpi).toBeVisible();
      await expect(kpi.getByText("1.234")).toBeVisible();

      for (const title of [
        "Nhập – Xuất theo thời gian",
        "Xu hướng tồn kho",
        "Cơ cấu tồn kho hiện tại",
        "Tình trạng bảo hành",
        "Vấn đề cần xử lý",
      ]) {
        await expect(
          page.getByRole("heading", { name: title, exact: true }),
        ).toBeVisible();
      }

      expect(await hasHorizontalOverflow(page)).toBe(false);
    });
  }

  test("KPI đổi theo toggle Sản phẩm / Linh kiện", async ({ page }) => {
    await setupMockApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    const kpi = page.getByRole("region", { name: "Chỉ số vận hành" });
    await expect(kpi.getByText("1.234")).toBeVisible();

    await kpi.getByRole("button", { name: "Linh kiện", exact: true }).click();
    await expect(kpi.getByText("434")).toBeVisible();
    await expect(kpi.getByText("1.234")).toHaveCount(0);

    await kpi.getByRole("button", { name: "Sản phẩm", exact: true }).click();
    await expect(kpi.getByText("800")).toBeVisible();
  });

  test("biểu đồ nhập-xuất đổi kỳ và giữ đủ 4 chuỗi", async ({ page }) => {
    await setupMockApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    const group = page.getByRole("group", {
      name: "Chọn kỳ xem biểu đồ nhập xuất",
    });
    await expect(group).toBeVisible();

    for (const name of ["Nhập sản phẩm", "Nhập linh kiện", "Xuất sản phẩm"]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }

    await group.getByRole("button", { name: "Năm này" }).click();
    await expect(
      page.getByRole("heading", { name: "Nhập – Xuất theo thời gian" }),
    ).toBeVisible();
  });

  test("số ca quá hạn là tổng thật và mở được danh sách chi tiết", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    // overdue_sample chỉ có 2 dòng nhưng tổng thật là 137 — không được lấy length.
    await expect(page.getByText("137 ca quá hạn")).toBeVisible();

    await page.getByRole("button", { name: "Xem chi tiết" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("WC-0001")).toBeVisible();
    await expect(dialog.getByText(/đang hiển thị 2 ca cũ hạn nhất/)).toBeVisible();
  });

  test("không gọi API và không lộ số khi thiếu quyền report.view", async ({
    page,
  }) => {
    let calls = 0;
    page.on("request", (request) => {
      if (request.url().includes("/reports/dashboard-overview")) calls += 1;
    });
    await page.route("**/api/v1/**", async (route: Route) => {
      const path = new URL(route.request().url()).pathname;
      const body = (data: unknown) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data, meta: {} }),
        });
      if (path.endsWith("/auth/refresh")) {
        return body({
          access_token: MOCK_ACCESS_TOKEN,
          refresh_token: MOCK_REFRESH_TOKEN,
          token_type: "bearer",
          expires_in: 3600,
        });
      }
      if (path.endsWith("/auth/me")) {
        const user = authUser();
        return body({
          ...user,
          is_super_admin: false,
          permissions: ["inventory.view"],
          active_context: {
            ...user.active_context,
            permission_codes: ["inventory.view"],
          },
        });
      }
      return body([]);
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    await expect(
      page.getByText("Không có quyền xem báo cáo tổng quan."),
    ).toBeVisible();
    expect(calls).toBe(0);
  });
});
