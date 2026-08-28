import { expect, test, type Page, type Route } from "@playwright/test";
import {
  MOCK_ACCESS_TOKEN as ACCESS_TOKEN,
  MOCK_REFRESH_TOKEN,
} from "./support/mock-tokens";

/**
 * Flow 06 · Báo cáo — runtime evidence cho các cột/hành động §13.10 mới bổ sung:
 * RPT-INV-01 as_of, RPT-OUT-MATCH-01 tầng dòng, RPT-LABEL-01 printer/actor,
 * RPT-IO-01 tầng dòng và Annex D "export đi qua POST /reports/export".
 */

type Harness = {
  refreshCalls: () => number;
  meCalls: () => number;
  reportUrls: string[];
  exportBodies: () => unknown[];
  exportIdempotencyKeys: () => string[];
  downloadUrls: string[];
};

const PERMISSIONS = ["report.view", "report.export"];

async function installApi(page: Page): Promise<Harness> {
  let refreshCalls = 0;
  let meCalls = 0;
  const reportUrls: string[] = [];
  const downloadUrls: string[] = [];
  const exportBodies: unknown[] = [];
  const exportIdempotencyKeys: string[] = [];

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const rawUrl = request.url();
    const url = new URL(rawUrl);
    const path = url.pathname.replace(/^\/api\/v1\/?/, "/");
    const json = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data,
          meta: { request_id: "FLOW06-DOCS" },
        }),
      });

    if (rawUrl.endsWith("/auth/refresh")) {
      refreshCalls += 1;
      await json({
        access_token: ACCESS_TOKEN,
        refresh_token: MOCK_REFRESH_TOKEN,
        token_type: "bearer",
        expires_in: 3600,
      });
      return;
    }

    if (rawUrl.endsWith("/auth/me")) {
      meCalls += 1;
      const context = {
        role_id: 6,
        role_name: "Lãnh đạo",
        scope_type: "he_thong",
        org_unit_id: null,
        department_id: null,
        warehouse_id: null,
        permission_codes: PERMISSIONS,
      };
      await json({
        id: 6,
        name: "Flow06 Reporter",
        email: "flow06.reporter@gmail.com",
        code: "FLOW06-RPT",
        is_super_admin: false,
        permissions: PERMISSIONS,
        active_context: context,
        available_contexts: [context],
      });
      return;
    }

    // Checklist 27/08: POST /reports/export chỉ tạo job; FE poll
    // GET /reports/export/{id} tới khi READY rồi mới tải file.
    if (path === "/reports/export/job-flow06-1") {
      await json({
        export_job_id: "job-flow06-1",
        report_code: "inventory-balance",
        format: "xlsx",
        status: "READY",
        row_count: 1,
        download_url:
          "/api/v1/reports/inventory-balance/export-excel?format=xlsx",
        error_message: null,
      });
      return;
    }

    if (path === "/reports/export") {
      exportBodies.push(request.postDataJSON());
      exportIdempotencyKeys.push(
        request.headers()["idempotency-key"] ?? "",
      );
      await json({
        export_job_id: "job-flow06-1",
        report_code: "inventory-balance",
        format: "xlsx",
        status: "READY",
        row_count: 1,
        filters: {},
        download_url: "/api/v1/reports/inventory-balance/export-excel?format=xlsx",
        requested_at: "2026-08-17T10:00:00+07:00",
      });
      return;
    }

    if (path.endsWith("/export-excel")) {
      downloadUrls.push(rawUrl);
      await route.fulfill({
        status: 200,
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition":
            'attachment; filename="bao-cao-ton-kho-hien-tai-20260817-100000.xlsx"',
          // BE phải expose header này qua CORS (config/cors.php) thì trình duyệt
          // mới đọc được tên file có timestamp theo BR-EXP-03.
          "access-control-expose-headers": "Content-Disposition",
        },
        body: "xlsx-binary",
      });
      return;
    }

    if (path === "/reports/inventory-balance") {
      reportUrls.push(rawUrl);
      await json({
        as_of: url.searchParams.get("as_of"),
        as_of_snapshot: url.searchParams.get("as_of") !== null,
        summary: {
          total_rows: 1,
          total_on_hand: 10,
          total_available: 10,
          mismatch_count: 0,
        },
        pagination: { current_page: 1, per_page: 15, total: 1, last_page: 1 },
        rows: [
          {
            id: "row-1",
            warehouse_code: "KHO-HN",
            product_code: "SKU-RPT-01",
            product_name: "Máy khoan báo cáo",
            category: "Máy khoan",
            stock_status: "AVAILABLE",
            on_hand_qty: 10,
            available_qty: 10,
            serial_qty: 10,
            box_qty: 0,
            location_hint: "Khay T-01",
            ledger_qty: 10,
            variance: 0,
            reconciliation_status:
              url.searchParams.get("as_of") !== null ? "NOT_APPLICABLE" : "MATCH",
            updated_at: "2026-08-17 09:30:00",
          },
        ],
      });
      return;
    }

    if (path === "/reports/document-history") {
      reportUrls.push(rawUrl);
      await json({
        period: { from_date: "2026-07-18", to_date: "2026-08-17" },
        summary: { total: 1, draft: 0, scanning: 0, posted: 1, cancelled: 0 },
        pagination: { current_page: 1, per_page: 15, total: 1, last_page: 1 },
        rows: [
          {
            id: "doc-1",
            document_no: "OUT-20260817-001",
            doc_type: "OUTBOUND",
            warehouse_code: "KHO-HN",
            counterpart: "Đại lý Minh Anh",
            document_date: "2026-08-17",
            status: "POSTED",
            posted_at: "2026-08-17 10:00:00",
            created_by_name: "NV Kho",
            posted_by_name: "QL Kho",
            lines: [
              {
                id: "line-1",
                line_no: 1,
                product_code: "SKU-RPT-01",
                product_name: "Máy khoan báo cáo",
                expected_qty: 5,
                scanned_qty: 5,
                posted_qty: 5,
              },
            ],
          },
        ],
      });
      return;
    }

    if (path === "/reports/import-match") {
      reportUrls.push(rawUrl);
      await json({
        period: { from_date: "2026-07-18", to_date: "2026-08-17" },
        summary: {
          total_batches: 1,
          total_lines: 1,
          fully_matched_lines: 1,
          invalid_lines: 0,
          total_required_qty: 10,
          total_scanned_qty: 10,
        },
        pagination: { current_page: 1, per_page: 15, total: 1, last_page: 1 },
        batches: [],
        rows: [
          {
            id: "imp-1|1",
            source_request_no: "TOA-20260817-001",
            source_version: 3,
            row_no: 1,
            sku_code: "SKU-RPT-01",
            sku_name: "Máy khoan báo cáo",
            required_qty: 10,
            matched_qty: 10,
            scanned_qty: 10,
            posted_qty: 10,
            is_fully_matched: true,
            validation_status: "VALID",
            outbound_no: "OUT-20260817-001",
            import_no: "IMP-001",
            source_file_name: "toa.xlsx",
            import_status: "CONSUMED",
            uploaded_by_name: "NV Kho",
            consumed_by_name: "QL Kho",
          },
        ],
      });
      return;
    }

    if (path === "/reports/label-log") {
      reportUrls.push(rawUrl);
      await json({
        period: { from_date: "2026-07-18", to_date: "2026-08-17" },
        summary: {
          total_labels: 1,
          printed: 1,
          pending: 0,
          failed: 0,
          applied: 1,
          reprinted: 0,
        },
        pagination: { current_page: 1, per_page: 15, total: 1, last_page: 1 },
        rows: [
          {
            id: "snap-1",
            label_code: "PKL-OUT-001",
            outbound_no: "OUT-20260817-001",
            outbound_date: "2026-08-17",
            recipient: "Đại lý Minh Anh",
            label_count: 1,
            item_count: 3,
            sku_count: 2,
            sku_summary: "SKU-RPT-01 x3",
            status: "PRINTED",
            applied: true,
            printer_code: "PRN-01",
            printer_name: "Máy in kho tổng",
            printed_by_name: "NV Kho",
            last_attempt_at: "2026-08-17 10:05:00",
            total_attempts: 1,
            failed_count: 0,
            reprint_count: 0,
          },
        ],
      });
      return;
    }

    if (path.startsWith("/reports/")) {
      reportUrls.push(rawUrl);
      await json({ summary: {}, rows: [], lines: [] });
      return;
    }

    // Master data phụ trợ (kho, nhóm hàng, đại lý, máy in, người dùng...).
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [],
        meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 },
      }),
    });
  });

  return {
    refreshCalls: () => refreshCalls,
    meCalls: () => meCalls,
    reportUrls,
    exportBodies: () => exportBodies,
    exportIdempotencyKeys: () => exportIdempotencyKeys,
    downloadUrls,
  };
}

async function openReports(page: Page, api: Harness): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 950 });
  await page.goto("/reports");
  await expect.poll(api.refreshCalls, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
  await expect.poll(api.meCalls, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
  // ReportsPage (UiTabs shell) mặc định mở tab thị trường; RPT-01 nằm ở tab
  // "Báo cáo vận hành" — chọn trước khi thao tác các tab nhóm bên trong.
  await page.getByRole("tab", { name: /Báo cáo vận hành/ }).click();
  await expect(page.getByTestId("wwhn-258-report-screen")).toBeVisible({
    timeout: 15_000,
  });
}

test("Flow 06 · RPT-INV-01 hiển thị as_of snapshot và cột updated_at", async ({
  page,
}, testInfo) => {
  const api = await installApi(page);
  await openReports(page, api);

  await expect(page.getByText("SKU-RPT-01").first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Cập nhật/ })).toBeVisible();

  await page.getByPlaceholder("Chốt số liệu tại ngày").click();
  await page.getByTitle("2026-08-10").first().click();

  await expect
    .poll(() => api.reportUrls.some((url) => url.includes("as_of=2026-08-10")), {
      timeout: 5_000,
    })
    .toBe(true);
  // Part 4: cột "Đối soát" (reconciliation_status) chuyển vào modal "Xem";
  // enum thô cũng đã Việt hoá (NOT_APPLICABLE → "Không áp dụng").
  await page
    .getByRole("button", { name: "Xem chi tiết dòng báo cáo" })
    .first()
    .click();
  await expect(
    page.getByRole("dialog").getByText("Không áp dụng"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText(/ảnh chụp theo sổ tồn kho/)).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("rpt-inv-01-as-of.png"),
    fullPage: true,
  });
});

test("Flow 06 · RPT-OUT-MATCH-01 hiển thị tầng dòng của toa", async ({ page }) => {
  const api = await installApi(page);
  await openReports(page, api);

  await page.getByRole("tab", { name: "Đối soát toa" }).click();
  await expect(page.getByText("TOA-20260817-001")).toBeVisible();
  // Part 4: bảng ngoài chỉ giữ cột thiết yếu (PRIMARY_REPORT_FIELDS) — header
  // Việt hoá; "Phiên bản"/"Đã match" chuyển vào modal "Xem".
  for (const header of [/Phiếu toa/, /Yêu cầu/, /Đã quét/, /Kiểm tra/]) {
    await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Xem chi tiết dòng báo cáo" })
    .first()
    .click();
  const matchDialog = page.getByRole("dialog");
  await expect(matchDialog.getByText("v3")).toBeVisible();
  await expect(matchDialog.getByText("Đã đối chiếu")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByPlaceholder("Mã SKU").fill("SKU-RPT-01");
  await expect
    .poll(
      () => api.reportUrls.some((url) => url.includes("sku_code=SKU-RPT-01")),
      { timeout: 5_000 },
    )
    .toBe(true);
});

test("Flow 06 · RPT-LABEL-01 hiển thị máy in và người in", async ({ page }) => {
  const api = await installApi(page);
  await openReports(page, api);

  await page.getByRole("tab", { name: "Nhật ký nhãn đóng gói" }).click();
  // Part 4: máy in / người in là metadata soi-từng-dòng → modal "Xem".
  await page
    .getByRole("button", { name: "Xem chi tiết dòng báo cáo" })
    .first()
    .click();
  const labelDialog = page.getByRole("dialog");
  await expect(labelDialog.getByText("Máy in kho tổng")).toBeVisible();
  await expect(labelDialog.getByText("Người in")).toBeVisible();
  await page.keyboard.press("Escape");
});

test("Flow 06 · RPT-IO-01 mở rộng phiếu để xem tầng dòng", async ({ page }) => {
  const api = await installApi(page);
  await openReports(page, api);

  await page.getByRole("tab", { name: "Lịch sử nhập/xuất" }).click();
  await expect(page.getByText("OUT-20260817-001").first()).toBeVisible();
  // Part 4: expandable row antd bỏ — tầng dòng (DocumentLines) xem trong modal
  // "Xem" (cùng đường đi người dùng, không mất dữ liệu).
  await page
    .getByRole("button", { name: "Xem chi tiết dòng báo cáo" })
    .first()
    .click();
  const ioDialog = page.getByRole("dialog");
  await expect(
    ioDialog.getByRole("columnheader", { name: /Kế hoạch/ }),
  ).toBeVisible();
  await expect(
    ioDialog.getByRole("columnheader", { name: /Đã ghi nhận/ }),
  ).toBeVisible();
  await expect(ioDialog.getByText("SKU-RPT-01").first()).toBeVisible();
});

test("Flow 06 · export đi qua POST /reports/export và giữ tên file của BE", async ({
  page,
}) => {
  const api = await installApi(page);
  await openReports(page, api);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất XLSX" }).click();

  await expect.poll(() => api.exportBodies().length, { timeout: 10_000 }).toBe(1);
  expect(api.exportBodies()[0]).toMatchObject({
    report_code: "inventory-balance",
    format: "xlsx",
  });
  expect(api.exportIdempotencyKeys()[0]).not.toBe("");
  expect((await download).suggestedFilename()).toBe(
    "bao-cao-ton-kho-hien-tai-20260817-100000.xlsx",
  );
});
