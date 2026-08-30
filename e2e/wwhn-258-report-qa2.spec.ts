import { expect, test, type Page, type Route } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  MOCK_ACCESS_TOKEN as ACCESS_TOKEN,
  MOCK_REFRESH_TOKEN,
} from "./support/mock-tokens";

/**
 * WWHN-258 · FE258-P1-03 + FE258-P1-04 + FE258-P2-02 — ma trận QA2 độc lập cho
 * SCR-RPT-01, chạy trên build thật.
 *
 * Register WWHN-258 đòi WWHN-259 chứng minh: filter, export, 403, loading/empty/
 * error, responsive, phản hồi dữ liệu lớn, và ma trận vai. Spec này phủ đúng bảy
 * mặt đó bằng runtime evidence (ảnh chụp + assertion trên `data-ui-state`), thay
 * cho việc mô tả bằng lời trong Jira.
 *
 * Neo tài liệu:
 *   - Annex D SCR-RPT-01: Loading/Empty/Error-Retry/Success/Confirm/Responsive,
 *     "360/768/1280+, no horizontal loss of critical action".
 *   - §13.8: PII export cần `warranty.pii.export` + reason (≥ 5 ký tự).
 *   - §8.2: 403 = PERMISSION_DENIED, state/stock không đổi, trả request_id.
 */

const EVIDENCE_DIR = join(
  "test-results",
  "wwhn-258",
  process.env.SOURCE_SHA ?? "local",
);

/** NFR-SRS-006 / §13.7: desktop ≥1280, tablet ≥768, mobile ≥360. */
const VIEWPORTS = [
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "desktop-1366x900", width: 1366, height: 900 },
] as const;

type Scenario = {
  permissions: string[];
  /** Tổng số dòng BE báo về — dùng để kích hoạt phản hồi dữ liệu lớn. */
  total?: number;
  /** Ép GET báo cáo trả lỗi để chụp trạng thái error / permission-denied. */
  reportStatus?: number;
  /** Trả 0 dòng để chụp trạng thái empty. */
  empty?: boolean;
};

type Harness = {
  meCalls: () => number;
  reportUrls: string[];
  exportBodies: () => Record<string, unknown>[];
};

const WARRANTY_ROW = {
  id: "wc-1",
  case_no: "BH-20260819-001",
  identification_status: "IDENTIFIED",
  model: "KT-2000",
  defect: "Không lên nguồn",
  components_issued: "1",
  status: "RECEIVED",
  purchase_date: "2026-01-05",
  received_at: "2026-08-10 09:00:00",
  returned_at: null,
  turnaround_days: null,
  updated_at: "2026-08-11 10:00:00",
  // BE mask theo quyền actor. Fixture để PII thô nhằm chứng minh FE fail-closed
  // ngay cả khi tầng BE hỏng hoặc client gọi qua một route chưa mask.
  customer_name: "Nguyễn Văn A",
  customer_phone: "0901234567",
  customer_address: "12 Lê Lợi, Quận 1, TP.HCM",
};

async function installApi(page: Page, scenario: Scenario): Promise<Harness> {
  let meCalls = 0;
  const reportUrls: string[] = [];
  const exportBodies: Record<string, unknown>[] = [];

  // Một test có thể đổi vai nhiều lần; gỡ handler cũ để bộ quyền của vai trước
  // không còn nằm trong chuỗi route và trả nhầm /auth/me.
  await page.unrouteAll({ behavior: "ignoreErrors" });

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const rawUrl = request.url();
    const path = new URL(rawUrl).pathname.replace(/^\/api\/v1\/?/, "/");
    const json = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data,
          meta: { request_id: "WWHN-258-QA2" },
        }),
      });

    if (rawUrl.endsWith("/auth/refresh")) {
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
        role_name: "QA2 Reporter",
        scope_type: "he_thong",
        org_unit_id: null,
        department_id: null,
        warehouse_id: null,
        permission_codes: scenario.permissions,
      };
      await json({
        id: 6,
        name: "QA2 Reporter",
        email: "qa2.reporter@gmail.com",
        code: "WWHN-258",
        is_super_admin: false,
        permissions: scenario.permissions,
        active_context: context,
        available_contexts: [context],
      });
      return;
    }

    // Checklist 27/08: POST /reports/export chỉ tạo job; FE poll
    // GET /reports/export/{id} tới khi READY rồi mới tải file.
    if (path === "/reports/export/job-258") {
      await json({
        export_job_id: "job-258",
        report_code: "warranty-defects",
        format: "xlsx",
        status: "READY",
        row_count: 1,
        download_url:
          "/api/v1/reports/warranty-defects/export-excel?format=xlsx",
        error_message: null,
      });
      return;
    }

    if (path === "/reports/export") {
      exportBodies.push(request.postDataJSON() as Record<string, unknown>);
      await json({
        export_job_id: "job-258",
        report_code: "warranty-defects",
        format: "xlsx",
        status: "READY",
        row_count: 1,
        filters: {},
        download_url:
          "/api/v1/reports/warranty-defects/export-excel?format=xlsx",
        requested_at: "2026-08-19T10:00:00+07:00",
      });
      return;
    }

    if (path.endsWith("/export-excel")) {
      await route.fulfill({
        status: 200,
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition":
            'attachment; filename="bao-cao-bao-hanh-20260819-100000.xlsx"',
          "access-control-expose-headers": "Content-Disposition",
        },
        body: "xlsx-binary",
      });
      return;
    }

    if (path === "/reports/warranty-defects") {
      reportUrls.push(rawUrl);
      if (scenario.reportStatus) {
        await route.fulfill({
          status: scenario.reportStatus,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error_code:
              scenario.reportStatus === 403
                ? "PERMISSION_DENIED"
                : "INTERNAL_SERVER_ERROR",
            message: "Không đủ quyền đọc báo cáo bảo hành.",
            meta: { request_id: "WWHN-258-ERR" },
          }),
        });
        return;
      }
      const total = scenario.total ?? 1;
      await json({
        period: { from_date: "2026-07-20", to_date: "2026-08-19" },
        // Contract hiện tại (BaM1ReportController): summary.total/processing/
        // returned/cancelled/temp_only — không còn total_cases.
        summary: {
          total,
          processing: total,
          returned: 0,
          cancelled: 0,
          temp_only: 0,
        },
        pagination: { current_page: 1, per_page: 15, total, last_page: 1 },
        rows: scenario.empty ? [] : [WARRANTY_ROW],
        by_defect: [],
      });
      return;
    }

    // Mọi master-data phụ trợ của thanh lọc: trả rỗng, không phải mặt đang đo.
    // `data` phải là MẢNG — `listPage()` trả thẳng `envelope.data` cho consumer,
    // nên bọc thêm một lớp `{data: []}` sẽ làm `.map` của dropdown nổ.
    await json([]);
  });

  return {
    meCalls: () => meCalls,
    reportUrls,
    exportBodies: () => exportBodies,
  };
}

type Viewport = (typeof VIEWPORTS)[number];

async function openWarrantyReport(
  page: Page,
  api: Harness,
  viewport: Viewport = VIEWPORTS[2],
): Promise<void> {
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });
  // Báo cáo bảo hành là MỘT route riêng trong sidebar (trước đây là tab con
  // của "/reports" — phản hồi người dùng 2026-08-30 tách hẳn ra), nên mở
  // thẳng route thay vì goto("/reports") rồi bấm tab.
  await page.goto("/reports/warranty");
  await expect.poll(api.meCalls, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId("wwhn-258-report-screen")).toBeVisible({
    timeout: 15_000,
  });
}

test.beforeAll(() => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
});

// ── Ma trận vai ────────────────────────────────────────────────────────────

test("QA2 · ma trận vai: report.view / +report.export / +warranty.pii.export", async ({
  page,
}) => {
  // Vai 1 — chỉ đọc: nút export bị khoá và mang test hook disabled.
  const readOnly = await installApi(page, { permissions: ["report.view"] });
  await openWarrantyReport(page, readOnly);
  await expect(page.getByRole("button", { name: "Xuất XLSX" })).toBeDisabled();
  await expect(page.getByTestId("report-pii-reason")).toHaveCount(0);
  await page.screenshot({
    path: join(EVIDENCE_DIR, "role-01-report-view-only.png"),
    fullPage: true,
  });

  // Vai 2 — được export nhưng KHÔNG được xuất PII: không có ô lý do, và thông
  // điệp phải nói rõ vì sao file luôn ở dạng mask.
  const exporter = await installApi(page, {
    permissions: ["report.view", "report.export"],
  });
  await openWarrantyReport(page, exporter);
  await expect(page.getByRole("button", { name: "Xuất XLSX" })).toBeEnabled();
  await expect(page.getByTestId("report-pii-reason")).toHaveCount(0);
  await expect(
    page.getByText(/không có quyền xuất PII nên tệp xuất luôn che thông tin/),
  ).toBeVisible();
  await page.screenshot({
    path: join(EVIDENCE_DIR, "role-02-export-without-pii.png"),
    fullPage: true,
  });

  // Vai 3 — đủ quyền xuất PII: ô lý do xuất hiện.
  const piiExporter = await installApi(page, {
    permissions: ["report.view", "report.export", "warranty.pii.export"],
  });
  await openWarrantyReport(page, piiExporter);
  await expect(page.getByTestId("report-pii-reason")).toBeVisible();
  await page.screenshot({
    path: join(EVIDENCE_DIR, "role-03-pii-export-allowed.png"),
    fullPage: true,
  });
});

test("QA2 · PII cột khách hàng luôn mask khi thiếu warranty.pii.view", async ({
  page,
}) => {
  const api = await installApi(page, {
    permissions: ["report.view", "report.export"],
  });
  await openWarrantyReport(page, api);

  // Mã case xuất hiện ở cả bảng 6.5 lẫn 6.6 nên đếm theo tập phần tử.
  await expect(page.getByText("BH-20260819-001").first()).toBeVisible();
  // Bản 7 tab hiển thị Khách hàng/SĐT ngay trên bảng 6.6 (yêu cầu nghiệp vụ)
  // NHƯNG luôn ở dạng đã che khi thiếu warranty.pii.view.
  await expect(page.getByText("Nguyễn Văn A")).toHaveCount(0);
  await expect(page.getByText("0901234567")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Xem chi tiết dòng báo cáo" })
    .first()
    .click();
  const detailDialog = page.getByRole("dialog");
  await expect(detailDialog.getByText("*******567").first()).toBeVisible();
  await expect(detailDialog.getByText("N*** V*** A***").first()).toBeVisible();
  await expect(page.getByText("Nguyễn Văn A")).toHaveCount(0);
  await expect(page.getByText("0901234567")).toHaveCount(0);
  await page.screenshot({
    path: join(EVIDENCE_DIR, "pii-01-masked-columns.png"),
    fullPage: true,
  });
});

// ── Filter + export ────────────────────────────────────────────────────────

test("QA2 · filter đi vào request và export giữ nguyên bộ lọc", async ({
  page,
}) => {
  const api = await installApi(page, {
    permissions: ["report.view", "report.export", "warranty.pii.export"],
  });
  await openWarrantyReport(page, api);

  // Mục 6.6: ô tìm kiếm gộp "Mã case / SKU / Physical Code / Serial" và lọc
  // ngay trên tập đã tải (chart + bảng dùng chung một tập dòng), nên bằng chứng
  // là bảng thu hẹp đúng chứ không phải một tham số mới trên URL.
  // Placeholder cũng đi qua VietnameseUiBoundary ("Serial" → "Số sê-ri") nên
  // selector bám phần đầu không bị đổi.
  const search = page.getByRole("textbox", {
    name: /Tìm mã case, SKU, physical code/,
  });
  await search.fill("KHONG-TON-TAI");
  await expect(page.getByText("Không có hồ sơ nào theo bộ lọc")).toBeVisible();
  await search.fill("KT-2000");
  await expect(page.getByText("BH-20260819-001").first()).toBeVisible();

  await page
    .getByTestId("report-pii-reason")
    .fill("Doi soat khieu nai khach hang 8891");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất XLSX" }).click();

  await expect
    .poll(() => api.exportBodies().length, { timeout: 15_000 })
    .toBe(1);
  const body = api.exportBodies()[0] as {
    report_code: string;
    filters: Record<string, unknown>;
  };
  expect(body.report_code).toBe("warranty-defects");
  expect(body.filters.reason).toBe("Doi soat khieu nai khach hang 8891");
  // BR-EXP-03: tên file có timestamp do BE đặt, client không dựng đè.
  expect((await download).suggestedFilename()).toBe(
    "bao-cao-bao-hanh-20260819-100000.xlsx",
  );
});

test("QA2 · lý do PII ngắn hơn 5 ký tự bị chặn tại client", async ({
  page,
}) => {
  const api = await installApi(page, {
    permissions: ["report.view", "report.export", "warranty.pii.export"],
  });
  await openWarrantyReport(page, api);

  await page.getByTestId("report-pii-reason").fill("abc");
  await expect(
    page.getByText(/Lý do xuất PII phải có ít nhất 5 ký tự/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Xuất XLSX" })).toBeDisabled();
  expect(api.exportBodies()).toHaveLength(0);
  await page.screenshot({
    path: join(EVIDENCE_DIR, "pii-02-reason-too-short.png"),
    fullPage: true,
  });
});

// ── Trạng thái Annex D ─────────────────────────────────────────────────────

test("QA2 · trạng thái empty phát đúng data-ui-state", async ({ page }) => {
  const api = await installApi(page, {
    permissions: ["report.view", "report.export"],
    empty: true,
    total: 0,
  });
  await openWarrantyReport(page, api);

  await expect(page.locator('[data-ui-state="empty"]').first()).toBeVisible();
  await page.screenshot({
    path: join(EVIDENCE_DIR, "state-01-empty.png"),
    fullPage: true,
  });
});

test("QA2 · trạng thái error có retry và không giả dạng empty", async ({
  page,
}) => {
  const api = await installApi(page, {
    permissions: ["report.view", "report.export"],
    reportStatus: 500,
  });
  await openWarrantyReport(page, api);

  await expect(page.locator('[data-ui-state="error"]').first()).toBeVisible();
  await page.screenshot({
    path: join(EVIDENCE_DIR, "state-02-error.png"),
    fullPage: true,
  });
});

test("QA2 · BE trả 403 thì UI hiện permission-denied, không phải lỗi chung", async ({
  page,
}) => {
  const api = await installApi(page, {
    permissions: ["report.view", "report.export"],
    reportStatus: 403,
  });
  await openWarrantyReport(page, api);

  await expect(
    page.locator('[data-ui-state="permission-denied"]').first(),
  ).toBeVisible();
  await page.screenshot({
    path: join(EVIDENCE_DIR, "state-03-permission-denied.png"),
    fullPage: true,
  });
});

test("QA2 · dữ liệu lớn: cảnh báo trần 10.000 dòng trước khi export", async ({
  page,
}) => {
  const api = await installApi(page, {
    permissions: ["report.view", "report.export"],
    total: 10_001,
  });
  await openWarrantyReport(page, api);

  const banner = page.getByTestId("report-export-row-limit");
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute("data-ui-state", "disabled");
  await expect(page.getByRole("button", { name: "Xuất XLSX" })).toBeDisabled();
  await page.screenshot({
    path: join(EVIDENCE_DIR, "state-04-large-data.png"),
    fullPage: true,
  });
});

// ── Responsive ─────────────────────────────────────────────────────────────

for (const viewport of VIEWPORTS) {
  test(`QA2 · responsive ${viewport.name} không mất hành động quan trọng`, async ({
    page,
  }) => {
    const api = await installApi(page, {
      permissions: ["report.view", "report.export", "warranty.pii.export"],
    });
    await openWarrantyReport(page, api, viewport);

    await expect(page.getByRole("button", { name: "Xuất XLSX" })).toBeVisible();
    await expect(page.getByTestId("report-pii-reason")).toBeVisible();

    // Annex D "no horizontal loss of critical action": trang không được cuộn
    // ngang. Bảng rộng phải cuộn TRONG khung của nó (`scroll={{x}}`), không đẩy
    // cả document.
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: join(EVIDENCE_DIR, `responsive-${viewport.name}.png`),
      fullPage: true,
    });
  });
}
