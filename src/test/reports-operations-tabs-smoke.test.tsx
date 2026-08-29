/**
 * Báo cáo vận hành (7 tab) — smoke render THẬT của cả bảy tab.
 *
 * Vì sao cần: hai bộ test hiện có chỉ mount tab 1 (WWHN-240) và tab 6
 * (WWHN-258). Năm tab còn lại chỉ được "test" gián tiếp qua typecheck, mà
 * typecheck không bắt được lỗi runtime kinh điển của màn báo cáo: đọc field
 * `undefined` của payload, chart mount với series rỗng, hay bộ lọc chạy trên
 * mảng chưa tồn tại. File này mở lần lượt từng tab với payload đúng shape BE và
 * đòi hỏi: tab render được, không văng lỗi, và mục tiêu đề của tab có mặt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/shared/api/http", () => ({
  http: {
    get: vi.fn(),
    getPage: vi.fn(),
    post: vi.fn(),
    downloadFile: vi.fn(),
  },
}));

// jsdom không đo được SVG nên ApexCharts render rỗng; stub tối thiểu để cây
// component vẫn mount đúng như trên trình duyệt thật.
vi.mock("react-apexcharts", () => ({
  default: ({ type }: { type?: string }) => (
    <div data-testid={`chart-${type ?? "unknown"}`} />
  ),
}));

import { http } from "@/shared/api/http";
import { useAuthStore } from "@/shared/store/auth.store";
import AlignedReportsPage from "@/modules/reports/pages/AlignedReportsPage";

const TODAY = "2026-08-20";

/** Payload theo đúng shape của từng endpoint báo cáo BE đang phục vụ. */
const PAYLOAD: Record<string, unknown> = {
  "/reports/inventory-xnt-enhanced": {
    lines: [
      {
        warehouse_code: "KHO-HN",
        product_code: "SKU-A",
        product_name: "Máy A",
        stock_status: "AVAILABLE",
        opening: 100,
        receipt_gross: 20,
        receipt_reversal: 2,
        receipt_net: 18,
        issue_gross: 10,
        issue_reversal: 1,
        issue_net: 9,
        component_issue_gross: 4,
        component_issue_reversal: 0,
        component_issue_net: 4,
        reversal_unlinked_net: 0,
        reversal_net: -3,
        closing: 105,
      },
    ],
  },
  "/reports/movement-trace": {
    rows: [
      {
        id: "mv-1",
        occurred_at: `${TODAY} 09:15:00`,
        movement_type: "RECEIPT",
        warehouse_code: "KHO-HN",
        product_code: "SKU-A",
        product_name: "Máy A",
        qty_delta: 20,
        physical_code: "PC-001",
        actor: "Nguyễn Kho",
        source_type: "INBOUND",
        source_id: "doc-1",
      },
    ],
  },
  "/reports/document-history": {
    rows: [
      {
        id: "doc-1",
        document_no: "PN-0001",
        doc_type: "INBOUND",
        warehouse_code: "KHO-HN",
        counterpart: "NCC Alpha",
        document_date: TODAY,
        status: "POSTED",
        posted_at: `${TODAY} 10:00:00`,
        created_by_name: "Nguyễn Kho",
        lines: [
          {
            id: "l-1",
            line_no: 1,
            product_code: "SKU-A",
            product_name: "Máy A",
            expected_qty: 20,
            scanned_qty: 20,
            posted_qty: 20,
          },
        ],
      },
    ],
  },
  "/reports/inventory-balance": {
    rows: [
      {
        warehouse_code: "KHO-HN",
        product_code: "SKU-A",
        product_name: "Máy A",
        stock_status: "AVAILABLE",
        on_hand_qty: 105,
        available_qty: 100,
        ledger_qty: 105,
        variance: 0,
        reconciliation_status: "MATCH",
        updated_at: `${TODAY} 11:00:00`,
      },
    ],
  },
  "/reports/inventory-reconciliation": {
    rows: [
      {
        warehouse_code: "KHO-HN",
        product_code: "SKU-A",
        product_name: "Máy A",
        stock_status: "AVAILABLE",
        on_hand_qty: 105,
        available_qty: 100,
        ledger_qty: 100,
        variance: 5,
        reconciliation_status: "MISMATCH",
        reconciliation_overall: "MISMATCH",
        updated_at: `${TODAY} 11:00:00`,
      },
    ],
    summary: { rows_checked: 1, mismatch_count: 1 },
  },
  "/reports/import-match": {
    rows: [
      {
        id: "im-1",
        import_no: "IMP-0001",
        row_no: 1,
        source_request_no: "TOA-001",
        sku_code: "SKU-A",
        required_qty: 10,
        matched_qty: 10,
        scanned_qty: 10,
        posted_qty: 10,
        validation_status: "VALID",
        error_code: null,
        error_message: null,
      },
    ],
    batches: [
      {
        id: "batch-1",
        import_no: "IMP-0001",
        status: "CONSUMED",
        total_rows: 1,
        valid_rows: 1,
        error_rows: 0,
        uploaded_at: `${TODAY} 08:00:00`,
        uploaded_by_name: "Nguyễn Kho",
      },
    ],
  },
  "/reports/label-log": {
    rows: [
      {
        id: "ls-1",
        label_code: "LB-0001",
        outbound_no: "PX-0001",
        outbound_date: TODAY,
        recipient: "Đại lý An",
        status: "PRINTED",
        total_attempts: 2,
        failed_count: 1,
        reprint_count: 0,
        printer_name: "Zebra-01",
        printer_config_id: "pr-1",
        printed_by_name: "Nguyễn Kho",
        last_attempt_at: `${TODAY} 12:00:00`,
        created_at: `${TODAY} 11:30:00`,
      },
    ],
    summary: {},
  },
  "/reports/warranty-defects": {
    rows: [
      {
        warranty_case_id: "wc-1",
        case_no: "BH-0001",
        model: "SKU-A",
        sku_id: "sku-a",
        sku_name: "Máy A",
        defect: "Không lên nguồn",
        defects: [{ defect_id: "d-1", defect_name: "Không lên nguồn" }],
        components_issued: "SKU-LK × 2",
        status: "RECEIVED",
        received_at: TODAY,
        estimated_completion_date: "2026-08-25",
        customer_name: "*** A",
        customer_phone: "*******567",
        customer_address: "***",
      },
    ],
    pagination: { current_page: 1, per_page: 100, total: 1, last_page: 1 },
    by_defect: [],
  },
  "/reports/warranty-defect-sku-breakdown": {
    rows: [
      {
        sku_id: "sku-a",
        sku_code: "SKU-A",
        defect_id: "d-1",
        defect_code: "E01",
        defect_name: "Không lên nguồn",
        case_count: 3,
      },
    ],
  },
  "/reports/warranty-component-usage": {
    rows: [
      {
        sku_id: "lk-1",
        sku_code: "SKU-LK",
        sku_name: "Bo mạch",
        total_issued_qty: 5,
        case_count: 3,
      },
    ],
  },
  "/reports/outbound-by-recipient": {
    rows: [
      {
        document_id: "doc-2",
        outbound_no: "PX-0001",
        document_date: TODAY,
        recipient_id: "ag-1",
        agency_name: "Đại lý An",
        recipient_name: "Đại lý An",
        recipient_type: "AGENCY",
        market: "Miền Bắc",
        region: "Hà Nội",
        sku_id: "sku-a",
        product_code: "SKU-A",
        product_name: "Máy A",
        required_qty: 10,
        scanned_qty: 10,
        issued_qty: 10,
      },
    ],
    pagination: { current_page: 1, per_page: 100, total: 1, last_page: 1 },
    by_sku: [],
    by_recipient: [],
  },
  "/reports/outbound-by-agency": { rows: [], by_agency: [] },
  "/stock-movements/trace-by-code": { movements: [] },
};

/** Payload cho các endpoint đọc qua `getPage` (danh mục, người dùng, batch). */
const PAGE_PAYLOAD: Record<string, unknown[]> = {
  "/products": [
    {
      sku_id: "sku-a",
      sku_code: "SKU-A",
      sku_name: "Máy A",
      sku_type: "PRODUCT",
      min_stock: 50,
      max_stock: 200,
    },
    {
      sku_id: "lk-1",
      sku_code: "SKU-LK",
      sku_name: "Bo mạch",
      sku_type: "COMPONENT",
      min_stock: null,
      max_stock: null,
    },
  ],
  "/users": [
    {
      user_id: "u-1",
      display_name: "Nguyễn Kho",
      department: { department_id: "dep-1", department_name: "Kho vận" },
    },
  ],
  "/agencies": [
    {
      agency_id: "ag-1",
      agency_code: "AG01",
      agency_name: "Đại lý An",
      recipient_type: "AGENCY",
      market: "Miền Bắc",
      region: "Hà Nội",
    },
  ],
  "/skus/import-reports": [
    {
      import_report_id: "ir-1",
      file_name: "sku.xlsx",
      status: "COMMITTED",
      total_rows: 3,
      valid_rows: 2,
      error_rows: 1,
      actor_id: "u-1",
      created_at: `${TODAY} 07:00:00`,
      error_file_available: true,
      row_errors: [
        {
          row: 3,
          code: "ITEM_ALREADY_EXISTS",
          field: "sku_code",
          message: "SKU đã tồn tại",
          value: "SKU-A",
        },
      ],
    },
  ],
};

const TABS: Array<{ tab: RegExp; testId: string; heading: RegExp }> = [
  {
    tab: /Nhập/,
    testId: "rpt-tab-inventory-flow",
    // Tiêu đề tab 1 cũng chứa cụm "Lịch sử chứng từ" nên phải khớp CHÍNH XÁC
    // tiêu đề mục 1.4, nếu không sẽ dính hai phần tử.
    heading: /^Lịch sử chứng từ$/,
  },
  {
    tab: /Tồn kho & đối soát/,
    testId: "rpt-tab-stock-reconcile",
    heading: /Cảnh báo định mức tồn kho/,
  },
  {
    tab: /Truy vết hàng hóa/,
    testId: "rpt-tab-traceability",
    heading: /Vòng đời sản phẩm/,
  },
  {
    tab: /Import \/ Match/,
    testId: "rpt-tab-import-quality",
    heading: /Lịch sử Import\/Scan & Batch/,
  },
  {
    tab: /Packing Label/,
    testId: "rpt-tab-packing-label",
    heading: /Lịch sử Print \/ Reprint/,
  },
  {
    tab: /Bảo hành & linh kiện/,
    testId: "rpt-tab-warranty",
    heading: /Danh sách chi tiết hồ sơ bảo hành/,
  },
  {
    tab: /Xuất theo người nhận/,
    testId: "rpt-tab-recipient",
    heading: /Bảng chi tiết xuất theo người nhận/,
  },
  {
    tab: /Chứng từ cần bổ sung/,
    testId: "rpt-tab-pending-evidence",
    heading: /Danh sách chứng từ cần bổ sung/,
  },
];

describe("Báo cáo vận hành · 7 tab render được với payload thật", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.get).mockImplementation(async (url: unknown) => {
      const key = String(url);
      return (PAYLOAD[key] ?? { rows: [], lines: [] }) as never;
    });
    vi.mocked(http.getPage).mockImplementation(async (url: unknown) => {
      const key = String(url);
      return {
        data: (PAGE_PAYLOAD[key] ?? []) as never,
        meta: { current_page: 1, last_page: 1, total: 1 },
      };
    });
    useAuthStore.setState({
      isSuperAdmin: false,
      permissionCodes: ["report.view", "report.export", "REPORT_EXPORT"],
    });
  });

  afterEach(() => {
    cleanupTestState();
  });

  it.each(TABS)(
    "mở tab $testId không văng lỗi và hiện mục chính",
    async ({ tab, testId, heading }) => {
      renderWithProviders(<AlignedReportsPage />, ["/reports"]);
      fireEvent.click(await screen.findByRole("tab", { name: tab }));

      expect(await screen.findByTestId(testId)).toBeInTheDocument();
      expect(await screen.findByText(heading)).toBeInTheDocument();
    },
  );

  it("chuyển qua đủ các tab liên tiếp trong một phiên", async () => {
    renderWithProviders(<AlignedReportsPage />, ["/reports"]);
    for (const { tab, testId } of TABS) {
      fireEvent.click(await screen.findByRole("tab", { name: tab }));
      expect(await screen.findByTestId(testId)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("tab")).toHaveLength(TABS.length);
  });
});
