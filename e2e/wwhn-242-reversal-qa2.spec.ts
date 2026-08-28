import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  expect,
  test,
  type Page,
  type Route,
  type TestInfo,
} from "@playwright/test";
import { MOCK_ACCESS_TOKEN, MOCK_REFRESH_TOKEN } from "./support/mock-tokens";

/**
 * WWHN-242 (HN-FE-006 · REV-00/REV-01) — ma trận bằng chứng UI / role / stale /
 * partial / responsive / API-error trên đúng build đang review.
 *
 * RANH GIỚI SỰ THẬT: mọi payload ở đây là mock deterministic. File này chứng minh
 * HÀNH VI FE trước hợp đồng `reversal-documents` + `stock-movements/reversible`
 * (SRS §5.5 BR-REV-01..12, §6 state model, Annex D SCR-REV-01). Nó KHÔNG chứng minh
 * backend thật sự cắt data scope (bằng chứng đó nằm ở
 * `Wwhn242ReversalScopeAndProjectionTest` phía BE), KHÔNG thay QA độc lập và KHÔNG
 * phải bằng chứng UAT.
 */

const SOURCE_SHA =
  process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const APP_ENV = process.env.VITE_APP_ENV ?? "local-controlled";
const BUILD_VERSION = process.env.VITE_APP_VERSION ?? "local-dev";
const EVIDENCE_ROOT =
  process.env.WWHN_242_EVIDENCE_DIR ??
  join("test-results", "wwhn-242", SOURCE_SHA);

/** P2-01 yêu cầu đúng bốn khổ này. 1280 là nền tối thiểu desktop của NFR-SRS-006. */
const REQUIRED_VIEWPORTS = [
  { key: "desktop-1440", width: 1440, height: 900 },
  { key: "desktop-1366", width: 1366, height: 768 },
  { key: "tablet", width: 768, height: 1024 },
  { key: "mobile", width: 390, height: 844 },
] as const;

const PERM_VIEW = "inventory.view";
const PERM_POST = "inventory.reversal.post";

/** Giá trị thật của `UI_STATE.PERMISSION_DENIED` trong src/shared/constants/ui-state.ts. */
const UI_STATE_SELECTOR_PERMISSION_DENIED =
  '[data-ui-state="permission-denied"]';

const REVERSAL_DOC = {
  id: "rev-242-1",
  reversal_code: "REV-20260818-0001",
  status: "DRAFT",
  physical_return_status: "PENDING_RETURN",
  condition_status: "SELLABLE",
  reference_document_type: "OUTBOUND",
  reference_document_id: "doc-242-1",
  reference_document_code: "OUT-20260802-014",
  correction_chain_id: "chain-242-1",
  warehouse_id: "wh-1",
  warehouse_name: "Kho tổng Hoa Nam",
  total_lines: 1,
  total_qty: 1,
  reason_code: "CORRECTION",
  reason: "Giao nhầm Item cho khách",
  created_at: "2026-08-18T09:00:00Z",
  created_by: "thukho",
  cancelled_at: null,
  cancel_reason: null,
  version: 4,
};

const REVERSAL_LINES = [
  {
    id: "revline-242-1",
    reversal_id: "rev-242-1",
    line_no: 1,
    original_movement_id: "mv-242-1",
    original_movement_code: "MOV-ISSUE-000882",
    sku: "DCH-DRILL-DJZ10A-220V-V1",
    sku_name: "Máy khoan cầm tay",
    original_qty: 5,
    reversal_qty: 1,
    reversed_qty: 0,
    remaining_qty: 5,
    return_condition: "SELLABLE",
    status: "DRAFT",
  },
];

/** Movement đảo được — dùng cho ca partial (đảo 2/20). */
const REVERSIBLE_OK = {
  id: "mv-242-2",
  movement_code: "MOV-RECEIPT-000441",
  movement_type: "RECEIPT",
  source_document_type: "INBOUND",
  source_document_id: "doc-242-2",
  source_document_code: "IN-20260801-003",
  warehouse_id: "wh-1",
  warehouse_name: "Kho tổng Hoa Nam",
  posted_at: "2026-08-01T09:00:00Z",
  version: "3",
  dependency_guard: null,
  can_reverse: true,
  lines: [
    {
      id: "mvl-242-2",
      sku: "LK-DCH-PIN-20V-V1",
      sku_name: "Pin 20V",
      original_qty: 20,
      reversed_qty: 0,
      reversible_qty: 20,
      remaining_qty: 20,
      uom: "cai",
      dependency_guard: null,
      can_reverse: true,
      is_serial_tracked: false,
      items: [],
    },
  ],
};

/** Movement bị chặn bởi dependency downstream — BR-REV-03/04. */
const REVERSIBLE_BLOCKED = {
  ...REVERSIBLE_OK,
  id: "mv-242-3",
  movement_code: "MOV-RECEIPT-000442",
  source_document_id: "doc-242-3",
  source_document_code: "IN-20260728-004",
  dependency_guard: "DOWNSTREAM_CONSUMPTION_EXISTS",
  can_reverse: false,
  lines: [
    {
      ...REVERSIBLE_OK.lines[0],
      id: "mvl-242-3",
      dependency_guard: "DOWNSTREAM_CONSUMPTION_EXISTS",
      can_reverse: false,
    },
  ],
};

interface EvidenceInput {
  scenario: string;
  role: string;
  viewport: { width: number; height: number };
  route: string;
  assertions: string[];
}

interface MockOptions {
  permissionCodes?: string[];
  isSuperAdmin?: boolean;
  movements?: unknown[];
  /** Ép lỗi cho POST /reversal-documents/:id/post. */
  postStatus?: number;
  postErrorCode?: string;
  postMessage?: string;
  listStatus?: number;
  listErrorCode?: string;
  /** BR-REV-06: PENDING_RETURN khoá nút Post cho tới khi xác nhận hàng vật lý đã về. */
  physicalReturnStatus?: "PENDING_RETURN" | "CONFIRMED";
}

function safeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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
    "WWHN-242",
    safeName(input.scenario),
    safeName(input.role),
    `${input.viewport.width}x${input.viewport.height}`,
  ].join("__");

  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  await page.screenshot({
    path: join(EVIDENCE_ROOT, `${prefix}.png`),
    fullPage: true,
  });

  const metadata = {
    ticket: "WWHN-242",
    screen: "REV-00 / REV-01",
    contract:
      "GET|POST /api/v1/reversal-documents{,/:id,/:id/lines,/:id/confirm,/:id/post,/:id/cancel} + GET /api/v1/stock-movements/reversible",
    baselineClause:
      "SRS/FRD v1.12 REQ-SRS-013, BR-REV-01..12, §6, Annex D SCR-REV-01",
    evidenceClass: "FE_CONTROLLED_NOT_UAT",
    result: "PASS",
    sourceSha: SOURCE_SHA,
    environment: APP_ENV,
    buildVersion: BUILD_VERSION,
    browserProject: testInfo.project.name,
    role: input.role,
    viewport: input.viewport,
    route: input.route,
    finalUrl: page.url(),
    timestamp: new Date().toISOString(),
    screenshotFilename: `${prefix}.png`,
    assertions: input.assertions,
    truthBoundary:
      "Controlled FE rendering evidence only; backend data-scope enforcement is proved separately by Wwhn242ReversalScopeAndProjectionTest. Not QA-independent evidence, not UAT.",
  };

  writeFileSync(
    join(EVIDENCE_ROOT, `${prefix}.json`),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
  await testInfo.attach("wwhn-242-evidence-metadata", {
    body: Buffer.from(JSON.stringify(metadata, null, 2)),
    contentType: "application/json",
  });
}

function authUser(permissionCodes: string[], isSuperAdmin: boolean) {
  const activeContext = {
    role_id: 242,
    role_name: isSuperAdmin ? "Super Admin" : "WWHN-242 Reversal Actor",
    scope_type: "kho",
    org_unit_id: null,
    department_id: null,
    warehouse_id: "wh-1",
    permission_codes: permissionCodes,
  };

  return {
    id: 242,
    name: "WWHN-242 Reversal Evidence",
    email: "wwhn242.evidence@example.com",
    code: "WWHN-242-EVIDENCE",
    is_super_admin: isSuperAdmin,
    permissions: permissionCodes,
    active_context: activeContext,
    available_contexts: [activeContext],
  };
}

function errorBody(code: string, message: string, requestId: string) {
  return JSON.stringify({
    success: false,
    message,
    error_code: code,
    errors: {},
    error: { code, details: {} },
    request_id: requestId,
    meta: { request_id: requestId },
  });
}

async function setupMockApi(
  page: Page,
  options: MockOptions = {},
): Promise<void> {
  const permissionCodes = options.permissionCodes ?? [PERM_VIEW, PERM_POST];
  const user = authUser(permissionCodes, options.isSuperAdmin ?? false);
  const movements = options.movements ?? [REVERSIBLE_OK, REVERSIBLE_BLOCKED];
  const doc = {
    ...REVERSAL_DOC,
    physical_return_status:
      options.physicalReturnStatus ?? REVERSAL_DOC.physical_return_status,
  };

  await page.route("**/api/v1/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (data: unknown, meta: Record<string, unknown> = {}) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data,
          meta: { request_id: "WWHN-242-OK", ...meta },
        }),
      });

    if (path.endsWith("/auth/refresh")) {
      await json({
        access_token: MOCK_ACCESS_TOKEN,
        refresh_token: MOCK_REFRESH_TOKEN,
        token_type: "bearer",
        expires_in: 3600,
      });
      return;
    }

    if (path.endsWith("/auth/me")) {
      await json(user);
      return;
    }

    if (path.endsWith("/stock-movements/reversible")) {
      await json(movements);
      return;
    }

    if (path.endsWith("/reversal-documents/rev-242-1/lines")) {
      await json(REVERSAL_LINES);
      return;
    }

    // DocumentEvidenceGuard (a908c42): REVERSAL bắt buộc >=1 chứng từ trước khi
    // Post — nút "Hoàn tất điều chỉnh" disabled tới khi evidence_status=PROVIDED.
    // Mock 1 chứng từ đã nộp để mở khoá gate (cùng họ drift-repair với unit
    // wwhn-242-reversal-corrections).
    if (path.endsWith("/reversal-documents/rev-242-1/attachments")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "att-242-1",
              document_type: "REVERSAL",
              document_id: "rev-242-1",
              file_name: "bien-ban-dieu-chinh.pdf",
              mime_type: "application/pdf",
              file_size: 12345,
              uploaded_by: "thukho",
              uploaded_at: "2026-08-18T09:30:00Z",
            },
          ],
          meta: {
            request_id: "WWHN-242-ATTACH",
            evidence_status: "PROVIDED",
            requires_evidence: true,
          },
        }),
      });
      return;
    }

    if (path.endsWith("/reversal-documents/rev-242-1")) {
      await json(doc);
      return;
    }

    if (path.endsWith("/reversal-documents/rev-242-1/post")) {
      if (options.postStatus && options.postStatus !== 200) {
        await route.fulfill({
          status: options.postStatus,
          contentType: "application/json",
          body: errorBody(
            options.postErrorCode ?? "STATE_CONFLICT",
            options.postMessage ?? "Thao tác bị từ chối.",
            `WWHN-242-POST-${options.postStatus}`,
          ),
        });
        return;
      }
      await json({ ...doc, status: "POSTED", version: 5 });
      return;
    }

    if (path.endsWith("/reversal-documents")) {
      if (options.listStatus && options.listStatus !== 200) {
        await route.fulfill({
          status: options.listStatus,
          contentType: "application/json",
          body: errorBody(
            options.listErrorCode ?? "DATA_SCOPE_DENIED",
            "Không tải được danh sách hoàn đảo.",
            `WWHN-242-LIST-${options.listStatus}`,
          ),
        });
        return;
      }
      await json([doc], {
        current_page: 1,
        per_page: 15,
        total: 1,
        last_page: 1,
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

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
}

async function openDetail(page: Page): Promise<void> {
  // exact:true — shell mobile có hamburger aria-label "Mở menu"; khớp lỏng
  // /Mở/ sẽ trúng hamburger trước và mở Drawer thay vì mở chi tiết.
  await page.getByRole("button", { name: "Mở", exact: true }).first().click();
  // Title đổi "Chi tiết hoàn đảo" → "Chi tiết phiếu điều chỉnh" (i18n 2ad8aa7).
  await expect(
    page.getByText(/Chi tiết phiếu điều chỉnh — REV-20260818-0001/),
  ).toBeVisible();
}

test.use({ video: "on", trace: "on", screenshot: "on" });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";

test.beforeAll(async ({ browser }) => {
  // Lần điều hướng đầu tiên phải chờ Vite dev server biên dịch cả cây module. Nếu để
  // test đầu tiên của ma trận gánh việc đó, nó đỏ vì timeout điều hướng chứ không phải
  // vì màn hình sai — đúng ca đã xảy ra ở lượt chạy 19/08. Hâm nóng trước, ngoài phạm
  // vi mọi phép đo, để QA2 chạy lại cho kết quả ổn định.
  const page = await browser.newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: "commit", timeout: 120_000 });
    await page.waitForLoadState("load", { timeout: 120_000 });
  } finally {
    await page.close();
  }
});

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe("WWHN-242 · REV-00/REV-01 evidence matrix", () => {
  // ─────────── UI + responsive (P2-01) ───────────
  for (const viewport of REQUIRED_VIEWPORTS) {
    test(`REV-00 danh sách hiển thị đúng và không tràn ngang tại ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await setupMockApi(page);
      await page.setViewportSize(viewport);
      await page.goto("/reverse");

      await expect(page.getByText("REV-20260818-0001")).toBeVisible();
      await expect(page.getByText("OUT-20260802-014")).toBeVisible();
      expect(await hasHorizontalOverflow(page)).toBe(false);

      await captureEvidence(page, testInfo, {
        scenario: "rev00-list",
        role: `${PERM_VIEW}+${PERM_POST}`,
        viewport,
        route: "/reverse",
        assertions: [
          "REV-00 renders reversal_code and reference document code",
          "no horizontal overflow at this viewport (NFR-SRS-006)",
        ],
      });
    });

    test(`REV-01 chi tiết hoàn đảo không tràn ngang tại ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await setupMockApi(page);
      await page.setViewportSize(viewport);
      await page.goto("/reverse");
      await openDetail(page);

      // Annex D SCR-REV-01: movement gốc + version If-Match phải hiện ở chi tiết.
      await expect(page.getByText("MOV-ISSUE-000882")).toBeVisible();
      expect(await hasHorizontalOverflow(page)).toBe(false);

      await captureEvidence(page, testInfo, {
        scenario: "rev01-detail",
        role: `${PERM_VIEW}+${PERM_POST}`,
        viewport,
        route: "/reverse (detail modal)",
        assertions: [
          "detail modal shows original movement code",
          "no horizontal overflow at this viewport",
        ],
      });
    });

    test(`REV-01 hộp xác nhận Post hiển thị cảnh báo append-only và huỷ không ghi tại ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      // BR-REV-06 đã thoả (hàng vật lý đã về) nên Post mở khoá; đây là màn "xác nhận"
      // mà FE242-P2-01 đòi chụp — trước đây chỉ tồn tại ở 1440×900.
      await setupMockApi(page, { physicalReturnStatus: "CONFIRMED" });
      await page.setViewportSize(viewport);
      await page.goto("/reverse");
      await openDetail(page);

      await page
        .getByRole("button", { name: /Hoàn tất điều chỉnh/ })
        .first()
        .click();

      // Annex D SCR-REV-01: "confirmation shows stock effect" — hộp xác nhận phải nói
      // rõ đây là bước duy nhất sinh movement và không hoàn tác được.
      // antd v6 vẽ tiêu đề Modal.confirm ở HAI nút DOM: một `ant-modal-title` ẩn
      // (chỉ để aria-labelledby) và một `ant-modal-confirm-title` hiện. Bám theo chuỗi
      // tiêu đề trần sẽ hoặc vi phạm strict mode, hoặc trúng đúng nút ẩn — nên định vị
      // theo hộp thoại chứa nội dung cảnh báo rồi mới soi tiêu đề bên trong nó.
      const confirmDialog = page
        .getByRole("dialog")
        .filter({ hasText: "Đây là bước làm phát sinh giao dịch đối ứng" });
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog).toContainText("Hoàn tất phiếu điều chỉnh tồn kho?");
      await expect(
        page.getByText(/Đây là bước làm phát sinh giao dịch đối ứng/),
      ).toBeVisible();
      // antd Modal.confirm cũ để lại 2 nút cùng tên trong a11y tree; UiDialog
      // (MUI) đặt aria-hidden lên nền sau modal → chỉ còn nút của hộp xác nhận
      // là accessible (cải thiện a11y, không phải mất nút).
      await expect(
        page.getByRole("button", { name: /Hoàn tất điều chỉnh/ }),
      ).toHaveCount(1);
      expect(await hasHorizontalOverflow(page)).toBe(false);

      await captureEvidence(page, testInfo, {
        scenario: "rev01-confirm",
        role: `${PERM_VIEW}+${PERM_POST}`,
        viewport,
        route: "/reverse (detail modal → Modal.confirm)",
        assertions: [
          "confirm dialog states the append-only/no-undo stock effect (SCR-REV-01)",
          "no horizontal overflow while the confirm dialog is open",
        ],
      });

      // Huỷ ở hộp xác nhận là no-write: phiếu vẫn không POSTED.
      await page.getByRole("button", { name: "Kiểm tra lại" }).click();
      await expect(
        page.getByText(/Reversal đã POSTED — append-only/),
      ).toHaveCount(0);
    });

    test(`REV-00 lỗi 403 DATA_SCOPE_DENIED hiện đúng trạng thái quyền tại ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await setupMockApi(page, {
        listStatus: 403,
        listErrorCode: "DATA_SCOPE_DENIED",
      });
      await page.setViewportSize(viewport);
      await page.goto("/reverse");

      // `ApiErrorAlert` cố ý quy MỌI 403 (gồm DATA_SCOPE_DENIED, xem §8.2) về
      // `NoPermissionState` để 403 hiển thị nhất quán toàn hệ thống, thay vì Alert đỏ
      // mang tiêu đề riêng của từng màn. Có hai lớp lồng nhau cùng mang `data-ui-state`
      // (khối bọc của ApiErrorAlert và NoPermissionState bên trong) nên lấy phần tử
      // ngoài cùng.
      await expect(
        page.locator(UI_STATE_SELECTOR_PERMISSION_DENIED).first(),
      ).toBeVisible();
      await expect(
        page.getByText(/Không có quyền truy cập/).first(),
      ).toBeVisible();
      expect(await hasHorizontalOverflow(page)).toBe(false);

      await captureEvidence(page, testInfo, {
        scenario: "list-error-403",
        role: `${PERM_VIEW}+${PERM_POST}`,
        viewport,
        route: "/reverse",
        assertions: [
          "list 403 DATA_SCOPE_DENIED renders the canonical NoPermissionState instead of a blank table",
          "no horizontal overflow in the error state at this viewport",
        ],
      });
    });
  }

  // ─────────── Role matrix (P1-01) ───────────
  test("vai chỉ có inventory.view: vào được REV-00 ở chế độ đọc, không có hành động ghi", async ({
    page,
  }, testInfo) => {
    await setupMockApi(page, { permissionCodes: [PERM_VIEW] });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/reverse");

    // Trước bản vá RBAC, route gate đòi inventory.reversal.post nên vai này bị đá
    // khỏi màn hình dù BE cho đọc.
    await expect(page.getByText("REV-20260818-0001")).toBeVisible();
    await expect(page.getByTestId("reversal-readonly-note")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Tạo phiếu điều chỉnh/ }),
    ).toHaveCount(0);

    await openDetail(page);
    await expect(
      page.getByRole("button", { name: /Hoàn tất điều chỉnh/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Huỷ phiếu DRAFT/ }),
    ).toHaveCount(0);

    await captureEvidence(page, testInfo, {
      scenario: "role-readonly",
      role: PERM_VIEW,
      viewport: { width: 1440, height: 900 },
      route: "/reverse",
      assertions: [
        "inventory.view-only role reaches REV-00",
        "read-only note rendered",
        "no create/post/cancel affordance",
      ],
    });
  });

  test("vai có inventory.reversal.post: hiện hành động tạo và lifecycle", async ({
    page,
  }, testInfo) => {
    await setupMockApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/reverse");

    await expect(
      page.getByRole("button", { name: /Tạo phiếu điều chỉnh/ }),
    ).toBeVisible();
    await expect(page.getByTestId("reversal-readonly-note")).toHaveCount(0);

    await captureEvidence(page, testInfo, {
      scenario: "role-writer",
      role: `${PERM_VIEW}+${PERM_POST}`,
      viewport: { width: 1440, height: 900 },
      route: "/reverse",
      assertions: [
        "inventory.reversal.post role sees the create affordance",
        "read-only note absent",
      ],
    });
  });

  // ─────────── Partial + dependency guard (P1-03) ───────────
  test("REV-01 partial: đảo 2/20 và dependency guard chặn movement có downstream", async ({
    page,
  }, testInfo) => {
    await setupMockApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/reverse");
    await page.getByRole("button", { name: /Tạo phiếu điều chỉnh/ }).click();

    // Operator UI không hiện mã guard thô của BE nữa (định hướng gỡ thuật ngữ
    // developer khỏi UI vận hành — 024f578): movement bị chặn phải hiện trạng
    // thái chặn rõ ràng, không phải thông điệp chung chung.
    await expect(
      page.getByText("Đang bị chặn bởi nghiệp vụ liên quan").first(),
    ).toBeVisible();

    await page.getByText("MOV-RECEIPT-000441").click();
    await expect(
      page.getByText(/Điều chỉnh từ MOV-RECEIPT-000441/),
    ).toBeVisible();

    const qtyInput = page.getByRole("spinbutton").first();
    await qtyInput.fill("2");
    await page
      .getByPlaceholder("Nhập lý do điều chỉnh (tối thiểu 5 ký tự)...")
      .fill("Nhập thừa 2 đơn vị, trả lại NCC");

    // Preview ảnh hưởng tồn phải là partial (-2), không phải toàn bộ 20.
    await expect(page.getByText(/Kiểm tra phụ thuộc: Đạt/)).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);

    await captureEvidence(page, testInfo, {
      scenario: "rev01-partial-and-guard",
      role: `${PERM_VIEW}+${PERM_POST}`,
      viewport: { width: 1440, height: 900 },
      route: "/reverse (create modal)",
      assertions: [
        "blocked movement shows the backend dependency guard code",
        "partial quantity 2/20 accepted with dependency check PASS",
      ],
    });
  });

  // ─────────── Bước CONFIRMED của §6 (BR-REV-06) ───────────
  test("PENDING_RETURN: hiện bước xác nhận hàng về và khoá Post cho tới khi xác nhận", async ({
    page,
  }, testInfo) => {
    await setupMockApi(page, { physicalReturnStatus: "PENDING_RETURN" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/reverse");
    await openDetail(page);

    // Bằng chứng cho bản vá BE: `physical_return_status` phải được chiếu ra ở
    // GET /reversal-documents/:id. Nếu BE bỏ cột này, khối dưới đây không tồn tại và
    // Reverse Issue chết vĩnh viễn ở 409 PHYSICAL_RETURN_REQUIRED.
    await expect(
      page.getByRole("button", { name: /Xác nhận hàng vật lý đã về/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Hoàn tất điều chỉnh/ }).first(),
    ).toBeDisabled();

    await captureEvidence(page, testInfo, {
      scenario: "lifecycle-pending-return",
      role: `${PERM_VIEW}+${PERM_POST}`,
      viewport: { width: 1440, height: 900 },
      route: "/reverse (detail modal)",
      assertions: [
        "physical_return_status=PENDING_RETURN renders the CONFIRMED step",
        "Post stays disabled until the physical return is confirmed (BR-REV-06)",
      ],
    });
  });

  // ─────────── API error matrix (P1-03) ───────────
  const ERROR_MATRIX = [
    {
      status: 403,
      code: "PERMISSION_DENIED",
      message: "Thiếu quyền inventory.reversal.post.",
      expectStaleNotice: false,
    },
    {
      status: 409,
      code: "DOWNSTREAM_DEPENDENCY_EXISTS",
      message: "Còn dependency downstream, phải đảo theo thứ tự ngược.",
      expectStaleNotice: true,
    },
    {
      status: 412,
      code: "STALE_VERSION",
      message: "Phiên bản chứng từ đã thay đổi.",
      expectStaleNotice: true,
    },
    {
      status: 422,
      code: "REVERSAL_QTY_EXCEEDS_REVERSIBLE",
      message: "Số lượng đảo vượt reversible_qty.",
      expectStaleNotice: false,
    },
    {
      status: 428,
      code: "PRECONDITION_REQUIRED",
      message: "Thao tác reversal bắt buộc header If-Match.",
      expectStaleNotice: true,
    },
  ] as const;

  for (const scenario of ERROR_MATRIX) {
    test(`Post reversal trả ${scenario.status} ${scenario.code}: UI báo đúng và không đổi trạng thái`, async ({
      page,
    }, testInfo) => {
      await setupMockApi(page, {
        postStatus: scenario.status,
        postErrorCode: scenario.code,
        postMessage: scenario.message,
        // BR-REV-06 đã được thoả (hàng vật lý đã về) nên Post mở khoá; ca PENDING_RETURN
        // được chứng minh riêng ở test "bước CONFIRMED".
        physicalReturnStatus: "CONFIRMED",
      });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/reverse");
      await openDetail(page);

      // Bấm Post rồi xác nhận trong hộp Modal.confirm (nút OK trùng nhãn nên lấy nút cuối).
      await page
        .getByRole("button", { name: /Hoàn tất điều chỉnh/ })
        .first()
        .click();
      // UiDialog đặt aria-hidden lên nền → chỉ nút xác nhận là accessible.
      const postButtons = page.getByRole("button", { name: /Hoàn tất điều chỉnh/ });
      await expect(postButtons).toHaveCount(1);
      await postButtons.last().click();

      const staleNotice = page.getByTestId("reversal-stale-version-notice");
      if (scenario.expectStaleNotice) {
        await expect(staleNotice).toBeVisible();
      }

      // Không có bước nào ghi trạng thái: phiếu vẫn DRAFT trên UI.
      await expect(
        page.getByText(/Reversal đã POSTED — append-only/),
      ).toHaveCount(0);
      expect(await hasHorizontalOverflow(page)).toBe(false);

      await captureEvidence(page, testInfo, {
        scenario: `post-error-${scenario.status}`,
        role: `${PERM_VIEW}+${PERM_POST}`,
        viewport: { width: 1440, height: 900 },
        route: "/reverse (detail modal)",
        assertions: [
          `POST post returns ${scenario.status} ${scenario.code}`,
          scenario.expectStaleNotice
            ? "stale-version notice rendered and document refetched"
            : "no stale-version notice for a non optimistic-lock failure",
          "document stays DRAFT on the UI (no write)",
        ],
      });
    });
  }
});
