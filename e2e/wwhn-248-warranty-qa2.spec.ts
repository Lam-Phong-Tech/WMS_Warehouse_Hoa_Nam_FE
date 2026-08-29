import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * WWHN-248 · QA2 independent retest cho WWHN-247 (Luồng 04 · Bảo hành FE).
 *
 * Đóng FE247-P1-01/P1-02: QA2 chạy ĐỘC LẬP (fixture, kịch bản và assertion riêng —
 * không copy e2e của DEV ở warranty-flow04-evidence.spec.ts) trên exact candidate,
 * phủ đúng ma trận review yêu cầu:
 *   - UI states: loading / empty / error / success (hợp đồng UI_STATE của WWHN-268)
 *   - TEMP_ONLY (mã tạm, NOT_TRACEABLE, stock-neutral)
 *   - Transition guards (DEC-WAR-STATE-001): dropdown chỉ mở đúng cạnh ma trận,
 *     bắt buộc bằng chứng (confirmed_defect / note / cancel_reason), terminal khóa,
 *     409 từ BE hiển thị trong modal
 *   - RBAC 403 (thiếu warranty.manage)
 *   - PII masked vs full-view (§13.8 + NFR-SRS-015, fail-closed khi BE trả PII thô)
 *   - Responsive 360 / 768 / 1440 (Annex D SCR-WAR-01: không mất critical action)
 *
 * Chạy: npx playwright test e2e/wwhn-248-warranty-qa2.spec.ts --project=chromium
 */

const MANAGE_PERMISSIONS = [
  "warranty.manage",
  "warranty.temp_only",
  "warranty.component_issue",
];
const PII_PERMISSIONS = [...MANAGE_PERMISSIONS, "warranty.pii.view"];

/** PII thô cố ý xuất hiện trong payload để chứng minh FE fail-closed. */
const RAW_NAME = "Đỗ Thị Hồng Gấm";
const RAW_PHONE = "0912345678";
const RAW_ADDRESS = "12 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội";

const CHECKING_CASE = {
  id: "wcq-2",
  case_code: "BH-QA2-0002",
  sku: "MK-350",
  sku_name: "Máy khoan pin MK-350",
  item_code: "SER-QA2-02",
  identification_type: "IDENTIFIED",
  customer_name: RAW_NAME,
  customer_phone: RAW_PHONE,
  customer_address: RAW_ADDRESS,
  reported_defect: "Sạc không vào pin",
  status: "CHECKING",
  // Cố ý CHƯA có confirmed_defect để kích hoạt guard chẩn đoán khi rời CHECKING.
  received_at: "2026-08-14T02:00:00Z",
  created_at: "2026-08-14T02:00:00Z",
  version: 2,
};

const TEMP_ONLY_RETURNED_CASE = {
  id: "wcq-7",
  case_code: "BH-QA2-0007",
  temporary_item_code: "TEMP-QA2-77",
  missing_code_reason: "Tem mã bị bong mất",
  manual_product_description: "Máy bắn vít màu đỏ, vỏ trầy góc phải",
  identification_type: "TEMP_ONLY",
  identification_status: "TEMP_ONLY",
  customer_name: RAW_NAME,
  customer_phone: RAW_PHONE,
  status: "RETURNED",
  received_at: "2026-08-11T02:00:00Z",
  created_at: "2026-08-11T02:00:00Z",
  version: 5,
};

const QA2_LIST = [CHECKING_CASE, TEMP_ONLY_RETURNED_CASE];

function envelope(data: unknown, meta: Record<string, unknown> = {}) {
  return JSON.stringify({
    success: true,
    data,
    meta: { request_id: "WWHN-248-QA2", ...meta },
  });
}

interface MockOptions {
  /** Trì hoãn GET /warranty-cases (ms) — dựng trạng thái loading. */
  listDelayMs?: number;
  /** GET /warranty-cases trả rỗng — dựng trạng thái empty. */
  emptyList?: boolean;
  /**
   * GET /warranty-cases trả 500 cho tới khi test đặt state.failList = false.
   * Phải fail BỀN (không phải fail-một-lần) vì query-client.ts chủ động retry
   * 5xx thêm 1 lần — fail đơn lẻ sẽ bị auto-retry che mất trạng thái error.
   */
  failList?: boolean;
  /** POST /warranty-cases/:id/status trả 409 STATE_CONFLICT. */
  transitionConflict?: boolean;
  /** BE khai báo pii_masked (mặc định không khai — mô phỏng hồi quy trả PII thô). */
  piiMasked?: boolean;
}

interface MockState {
  listCalls: number;
  transitionCalls: number;
  lastTransitionHeaders: Record<string, string> | null;
  lastTransitionBody: Record<string, unknown> | null;
  /** Test flip về false để lượt "Thử lại" thành công. */
  failList: boolean;
}

async function mockQa2Session(
  page: Page,
  permissionCodes: string[],
  options: MockOptions = {},
): Promise<MockState> {
  const state: MockState = {
    listCalls: 0,
    transitionCalls: 0,
    lastTransitionHeaders: null,
    lastTransitionBody: null,
    failList: options.failList ?? false,
  };

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/api\/v1/, "");
    const method = request.method();

    if (path === "/auth/refresh") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope({
          access_token: "<WWHN248_QA2_ACCESS_TOKEN>",
          refresh_token: "<WWHN248_QA2_REFRESH_TOKEN>",
          token_type: "bearer",
          expires_in: 3600,
        }),
      });
      return;
    }

    if (path === "/auth/me") {
      const context = {
        role_id: 9,
        role_name: "QA2 warranty",
        scope_type: "he_thong",
        org_unit_id: null,
        department_id: null,
        warehouse_id: null,
        permission_codes: permissionCodes,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope({
          id: 9,
          name: "WWHN-248 QA2",
          email: "qa2.wwhn248@gmail.com",
          code: "QA2-248",
          is_super_admin: false,
          roles: [],
          permissions: permissionCodes,
          active_context: context,
          available_contexts: [context],
        }),
      });
      return;
    }

    if (path === "/warranty-cases" && method === "GET") {
      state.listCalls += 1;
      if (state.failList) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Lỗi máy chủ nội bộ (giả lập QA2)",
            error_code: "INTERNAL_ERROR",
            request_id: "WWHN-248-QA2-LIST-500",
          }),
        });
        return;
      }
      if (options.listDelayMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, options.listDelayMs),
        );
      }
      const rows = options.emptyList
        ? []
        : QA2_LIST.map((row) =>
            options.piiMasked === undefined
              ? row
              : { ...row, pii_masked: options.piiMasked },
          );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope(rows, {
          total: rows.length,
          current_page: 1,
          per_page: 15,
        }),
      });
      return;
    }

    const detailMatch = /^\/warranty-cases\/([^/]+)$/.exec(path);
    if (detailMatch && method === "GET") {
      const found = QA2_LIST.find((row) => row.id === detailMatch[1]);
      const body =
        options.piiMasked === undefined
          ? found
          : { ...found, pii_masked: options.piiMasked };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope({ ...body, stock_effect: "NONE" }),
      });
      return;
    }

    const statusMatch = /^\/warranty-cases\/([^/]+)\/status$/.exec(path);
    if (statusMatch && method === "POST") {
      state.transitionCalls += 1;
      state.lastTransitionHeaders = request.headers();
      state.lastTransitionBody = request.postDataJSON() as Record<
        string,
        unknown
      >;
      if (options.transitionConflict) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Case đã ở trạng thái đóng, không cập nhật được.",
            error_code: "STATE_CONFLICT",
            request_id: "WWHN-248-QA2-409",
          }),
        });
        return;
      }
      const target = (state.lastTransitionBody?.status ??
        "COMPLETED") as string;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope({
          ...CHECKING_CASE,
          status: target,
          confirmed_defect:
            (state.lastTransitionBody?.confirmed_defect as string) ?? null,
          version: CHECKING_CASE.version + 1,
          stock_effect: "NONE",
        }),
      });
      return;
    }

    if (/^\/warranty-cases\/[^/]+\/(events|attachments)$/.test(path)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope([]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: envelope([]),
    });
  });

  return state;
}

test.describe("WWHN-248 · QA2 — UI states (hợp đồng UI_STATE WWHN-268)", () => {
  test("loading: dải ui-state-loading-table hiện trong lúc chờ API", async ({
    page,
  }, testInfo) => {
    await mockQa2Session(page, MANAGE_PERMISSIONS, { listDelayMs: 1200 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/warranty");

    await expect(
      page.getByTestId("ui-state-loading-table"),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("qa2-state-loading.png"),
    });

    // Loading kết thúc → dữ liệu hiện, dải loading biến mất.
    await expect(page.getByText("BH-QA2-0002")).toBeVisible();
    await expect(page.getByTestId("ui-state-loading-table")).toHaveCount(0);
  });

  test("empty: bảng rỗng hiển thị đúng empty-state + còn nguyên action tiếp nhận", async ({
    page,
  }, testInfo) => {
    await mockQa2Session(page, MANAGE_PERMISSIONS, { emptyList: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/warranty");

    await expect(page.getByTestId("ui-state-empty-table")).toBeVisible();
    await expect(
      page.getByText("Không có phiếu bảo hành theo bộ lọc hiện tại"),
    ).toBeVisible();
    // Empty ≠ dead-end: hướng đi tiếp theo (tiếp nhận case mới) vẫn hiển thị.
    await expect(
      page.getByRole("button", { name: /Tiếp nhận bảo hành/ }),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("qa2-state-empty.png") });
  });

  test("error + retry: list 500 → alert lỗi; Thử lại → dữ liệu về", async ({
    page,
  }, testInfo) => {
    const state = await mockQa2Session(page, MANAGE_PERMISSIONS, {
      failList: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/warranty");

    // query-client retry 5xx đúng 1 lần → alert chỉ hiện sau khi cả lượt
    // auto-retry cũng fail; mock fail bền nên trạng thái error là thật.
    const errorAlert = page
      .locator('[data-ui-state="error"]')
      .filter({ hasText: "Không tải được danh sách bảo hành" });
    await expect(errorAlert).toBeVisible({ timeout: 15_000 });
    expect(state.listCalls).toBeGreaterThanOrEqual(2);
    await page.screenshot({ path: testInfo.outputPath("qa2-state-error.png") });

    state.failList = false;
    await errorAlert.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByText("BH-QA2-0002")).toBeVisible();
    await expect(errorAlert).toHaveCount(0);
  });
});

test.describe("WWHN-248 · QA2 — transition guards (DEC-WAR-STATE-001)", () => {
  test("CHECKING chỉ mở đúng 3 cạnh; thiếu bằng chứng bị chặn tại form; đủ thì POST /status kèm If-Match + Idempotency-Key và toast success", async ({
    page,
  }, testInfo) => {
    const state = await mockQa2Session(page, MANAGE_PERMISSIONS);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/warranty");

    // Part 4: click dòng đã mở luôn modal chi tiết (onRowClick) — không còn
    // bước bấm nút hàng riêng; nút "Sửa" phía sau bị aria-hidden bởi modal.
    await page.getByText("BH-QA2-0002").click();
    await expect(page.getByText("Khách hàng & tiếp nhận")).toBeVisible();

    await page.getByRole("button", { name: "Cập nhật trạng thái" }).click();
    // Modal trạng thái là modal LỒNG trong modal chi tiết — Part 4: UiDialog
    // (MUI) có aria-label riêng nên scope thẳng theo accessible name.
    const statusModal = page.getByRole("dialog", {
      name: "Cập nhật trạng thái bảo hành",
    });
    await expect(statusModal).toBeVisible();

    // Ma trận: CHECKING → {REPAIRING, COMPLETED, CANCELLED} — không hơn.
    // Select giờ là MUI (UiTextField select) — options nằm trong listbox portal.
    await statusModal.getByRole("combobox").first().click();
    const options = page.getByRole("option");
    await expect(options).toHaveText([
      "Đang sửa chữa",
      "Đã hoàn tất xử lý",
      "Đã hủy",
    ]);
    await options.filter({ hasText: "Đã hoàn tất xử lý" }).click();

    // Guard bằng chứng: rời CHECKING cần confirmed_defect, COMPLETED cần note.
    await expect(
      page.getByText("Kết quả kiểm tra / bệnh xác nhận (bắt buộc)").first(),
    ).toBeVisible();
    await expect(page.getByText("Kết quả xử lý (bắt buộc)").first()).toBeVisible();

    await statusModal
      .getByRole("button", { name: "Cập nhật", exact: true })
      .click();
    await expect(
      page.getByText(
        "Phải ghi kết quả kiểm tra trước khi rời trạng thái CHECKING.",
      ),
    ).toBeVisible();
    expect(state.transitionCalls).toBe(0); // client-side guard chặn trước khi gọi BE
    await page.screenshot({
      path: testInfo.outputPath("qa2-transition-guard-blocked.png"),
    });

    await statusModal
      .getByLabel(/Kết quả kiểm tra \/ bệnh xác nhận/)
      .fill("Pin chai, đã kiểm tra xong — không cần thay linh kiện");
    await statusModal
      .getByLabel(/Kết quả xử lý/)
      .fill("Vệ sinh khoang pin, hiệu chỉnh mạch sạc, máy chạy ổn định");
    await statusModal
      .getByRole("button", { name: "Cập nhật", exact: true })
      .click();

    await expect(
      page.locator('[data-sonner-toast][data-type="success"]'),
    ).toBeVisible();
    expect(state.transitionCalls).toBe(1);
    expect(state.lastTransitionHeaders?.["if-match"]).toBe("2");
    expect(state.lastTransitionHeaders?.["idempotency-key"]).toMatch(
      /^fe:warranty-update-/,
    );
    expect(state.lastTransitionBody).toMatchObject({
      status: "COMPLETED",
      confirmed_defect:
        "Pin chai, đã kiểm tra xong — không cần thay linh kiện",
      note: "Vệ sinh khoang pin, hiệu chỉnh mạch sạc, máy chạy ổn định",
    });
    await page.screenshot({
      path: testInfo.outputPath("qa2-transition-success.png"),
    });
  });

  test("BE trả 409 STATE_CONFLICT → lỗi hiển thị ngay trong modal, không nuốt", async ({
    page,
  }) => {
    await mockQa2Session(page, MANAGE_PERMISSIONS, {
      transitionConflict: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/warranty");

    await page.getByRole("button", { name: "Sửa", exact: true }).first().click();
    await page.getByRole("button", { name: "Cập nhật trạng thái" }).click();
    const statusModal = page.getByRole("dialog", {
      name: "Cập nhật trạng thái bảo hành",
    });
    await expect(statusModal).toBeVisible();
    await statusModal.getByRole("combobox").first().click();
    await page
      .getByRole("option")
      .filter({ hasText: "Đang sửa chữa" })
      .click();
    await statusModal
      .getByLabel(/Kết quả kiểm tra \/ bệnh xác nhận/)
      .fill("Hỏng chổi than, cần thay");
    // Guard mới (a908c42): sang REPAIRING bắt buộc ngày dự kiến sửa xong —
    // phải điền để request thật sự tới BE và nhận 409.
    await statusModal
      .getByLabel(/Ngày dự kiến sửa xong/)
      .fill("2026-09-05");
    await statusModal
      .getByRole("button", { name: "Cập nhật", exact: true })
      .click();

    // Chuẩn hoá toast (a908c42): lỗi 409 báo qua toast lỗi mang đúng message
    // của BE; modal GIỮ NGUYÊN mở cùng dữ liệu đã nhập — người dùng không mất
    // ngữ cảnh (ngữ nghĩa cũ của Alert trong modal được giữ theo cách này).
    await expect(
      page
        .locator('[data-sonner-toast][data-type="error"]')
        .getByText(/Case đã ở trạng thái đóng, không cập nhật được\./),
    ).toBeVisible();
    await expect(statusModal).toBeVisible();
  });

  test("terminal RETURNED: nút Cập nhật trạng thái bị khóa; TEMP_ONLY hiện mã tạm + NOT_TRACEABLE + stock-neutral", async ({
    page,
  }, testInfo) => {
    await mockQa2Session(page, MANAGE_PERMISSIONS);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/warranty");

    await expect(page.getByText("BH-QA2-0007")).toBeVisible();
    await page.getByRole("button", { name: "Sửa", exact: true }).nth(1).click();

    await expect(
      page.getByText(/Mã tạm: TEMP-QA2-77 · sales_trace_status = NOT_TRACEABLE/),
    ).toBeVisible();
    // VietnameseUiBoundary rewrite từ kỹ thuật trong DOM ("item"→"sản phẩm",
    // "movement"→"biến động tồn kho") — regex nới theo cả hai dạng.
    await expect(
      page.getByText(/Không liên kết (item|sản phẩm) gốc, không sinh stock/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cập nhật trạng thái" }),
    ).toBeDisabled();
    await page.screenshot({
      path: testInfo.outputPath("qa2-terminal-temp-only.png"),
    });
  });
});

test.describe("WWHN-248 · QA2 — RBAC & PII (§13.8, NFR-SRS-015)", () => {
  test("403: thiếu warranty.manage bị chặn khỏi /warranty", async ({
    page,
  }, testInfo) => {
    await mockQa2Session(page, []);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/warranty");

    await expect(page).toHaveURL(/\/errors\/403$/);
    await expect(
      page.getByText("Không có quyền truy cập", { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("qa2-rbac-403.png") });
  });

  test("PII masked fail-closed: BE trả PII THÔ nhưng actor thiếu warranty.pii.view → DOM không bao giờ chứa giá trị thô", async ({
    page,
  }, testInfo) => {
    // Mô phỏng hồi quy BE: payload chứa PII thô, KHÔNG khai pii_masked.
    await mockQa2Session(page, MANAGE_PERMISSIONS);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/warranty");

    // Banner che PII ở list.
    await expect(
      page.getByText(/đang được che theo quyền/),
    ).toBeVisible();
    // Shape mask đúng NFR-SRS-015: tên rút gọn, phone giữ 3 số cuối.
    await expect(page.getByText("Đ*** T*** H*** G***").first()).toBeVisible();
    await expect(page.getByText("*******678").first()).toBeVisible();

    let content = await page.content();
    expect(content).not.toContain(RAW_NAME);
    expect(content).not.toContain(RAW_PHONE);

    // Detail: banner mask + địa chỉ masked, PII thô vẫn không lộ.
    await page.getByRole("button", { name: "Sửa", exact: true }).first().click();
    await expect(
      page.getByText(
        "Thông tin khách hàng đang được che (mask) theo quyền warranty.pii.view.",
      ),
    ).toBeVisible();
    await expect(page.getByText("***, Hà Nội")).toBeVisible();
    content = await page.content();
    expect(content).not.toContain(RAW_NAME);
    expect(content).not.toContain(RAW_PHONE);
    expect(content).not.toContain(RAW_ADDRESS);
    await page.screenshot({
      path: testInfo.outputPath("qa2-pii-masked-fail-closed.png"),
    });
  });

  test("PII full-view: có warranty.pii.view + BE khai pii_masked=false → thấy giá trị thật, không có banner che", async ({
    page,
  }, testInfo) => {
    await mockQa2Session(page, PII_PERMISSIONS, { piiMasked: false });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/warranty");

    await expect(page.getByText(RAW_NAME).first()).toBeVisible();
    await expect(page.getByText(RAW_PHONE).first()).toBeVisible();
    await expect(page.getByText(/đang được che theo quyền/)).toHaveCount(0);

    await page.getByRole("button", { name: "Sửa", exact: true }).first().click();
    await expect(page.getByText(RAW_ADDRESS)).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("qa2-pii-full-view.png"),
    });
  });
});

test.describe("WWHN-248 · QA2 — responsive Annex D (360/768/1280+)", () => {
  for (const viewport of [
    { name: "mobile-360", width: 360, height: 800 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "desktop-1440", width: 1440, height: 900 },
  ]) {
    test(`${viewport.name}: WAR-01 giữ nguyên critical action, không tràn ngang trang`, async ({
      page,
    }, testInfo) => {
      await mockQa2Session(page, MANAGE_PERMISSIONS);
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/warranty");

      await expect(page.getByText("BH-QA2-0002")).toBeVisible();
      // Annex D: "no horizontal loss of critical action" — ô quét + nút tiếp nhận
      // phải còn dùng được ở mọi bề rộng.
      await expect(page.getByLabel("Tìm case bảo hành")).toBeVisible();
      const intakeButton = page.getByRole("button", {
        name: /Tiếp nhận bảo hành/,
      });
      await expect(intakeButton).toBeVisible();
      const box = await intakeButton.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);

      // Trang không tràn ngang (bảng cuộn trong container riêng là hợp lệ).
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);

      await page.screenshot({
        path: testInfo.outputPath(`qa2-responsive-${viewport.name}.png`),
        fullPage: true,
      });
    });
  }
});
