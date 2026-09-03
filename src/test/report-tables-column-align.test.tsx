/**
 * TIÊU ĐỀ CỘT PHẢI CÙNG CĂN LỀ VỚI DỮ LIỆU — cho các bảng TỰ DỰNG của hai bản
 * port RPT-01 và RPT-02.
 *
 * VÌ SAO CÓ (phản hồi người dùng 2026-09-03, lần thứ hai về cùng triệu chứng):
 * hai màn này không dùng `ResponsiveDataTable` mà dựng `<table className=
 * "report-table">` thủ công. Căn phải của cột số đến từ MỘT class duy nhất —
 * `.num` — và class đó phải được gắn TAY cho cả `<th>` lẫn `<td>`. Bảng "SKU
 * cần làm rõ" chỉ gắn cho `<td>`, nên tiêu đề căn trái còn con số căn phải:
 * nhìn vào thì cột số không nằm dưới tên cột của nó.
 *
 * Kiểu lỗi này không có gì bắt được — typecheck không thấy, test hiện có chỉ
 * đọc nội dung chứ không đo bố cục, và mắt người soát rất dễ bỏ qua. Test này
 * RENDER thật rồi so `text-align` của từng `<th>` với ô dữ liệu cùng cột, nên
 * thiếu `.num` ở bất kỳ bảng nào cũng đỏ ngay.
 *
 * `vitest.config.ts` đặt `css: true` nên file CSS của bản port được nạp thật —
 * phép đo dưới đây chạy trên đúng cascade của trình duyệt, không phải môi
 * trường trống.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
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

vi.mock("react-apexcharts", () => ({
  default: ({ type }: { type?: string }) => (
    <div data-testid={`chart-${type ?? "unknown"}`} />
  ),
}));

import { http } from "@/shared/api/http";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";
import InventoryFlowReportPage from "@/modules/reports/pages/InventoryFlowReportPage";
import StockReconcileReportPage from "@/modules/reports/pages/StockReconcileReportPage";

const TODAY = "2026-08-20";

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
  // Có dòng LỆCH thì bảng "SKU cần làm rõ" mới đổ dữ liệu để đo được.
  "/reports/inventory-reconciliation": {
    rows: [
      {
        warehouse_code: "KHO-HN",
        product_id: "sku-a",
        product_code: "SKU-A",
        product_name: "Máy A",
        stock_status: "AVAILABLE",
        on_hand_qty: 105,
        available_qty: 100,
        ledger_qty: 100,
        delta_qty: 5,
        reconciliation_status: "MISMATCH",
        reconciliation_overall: "MISMATCH",
        mismatch_checks: ["ledger_to_balance"],
        updated_at: `${TODAY} 11:00:00`,
      },
    ],
    summary: { rows_checked: 1, mismatch_count: 1 },
  },
};

const PAGE_PAYLOAD: Record<string, unknown[]> = {
  "/products": [
    {
      sku_id: "sku-a",
      sku_code: "SKU-A",
      sku_name: "Máy A",
      sku_type: "PRODUCT",
      unit: "Cái",
      min_stock: 50,
      max_stock: 200,
    },
  ],
};

/**
 * So căn lề của từng `<th>` với ô dữ liệu CÙNG CỘT ở dòng đầu tiên có dữ liệu.
 * Bỏ qua bảng đang ở trạng thái rỗng (dòng `colSpan`) vì lúc đó không có ô nào
 * để đối chiếu.
 */
function assertHeaderMatchesData(table: HTMLTableElement, name: string) {
  const ths = Array.from(table.querySelectorAll("thead th"));
  const dataRow = Array.from(table.querySelectorAll("tbody tr")).find(
    (row) =>
      row.querySelectorAll("td").length === ths.length &&
      !row.querySelector("td[colspan]"),
  );
  if (!dataRow) return false;

  const tds = Array.from(dataRow.querySelectorAll("td"));
  /**
   * jsdom KHÔNG phân giải thừa kế `text-align`: ô nào không tự khai thuộc
   * tính này thì `getComputedStyle` trả chuỗi rỗng. Quy về "left" — đúng giá
   * trị mà trình duyệt tính ra cho ô bảng ở ngữ cảnh trái-sang-phải — để phép
   * so sánh nói về cái mắt người nhìn thấy chứ không về chỗ khai style.
   */
  const alignOf = (el: Element) => getComputedStyle(el).textAlign || "left";

  ths.forEach((th, index) => {
    const thAlign = alignOf(th);
    const tdAlign = alignOf(tds[index]);
    expect(
      thAlign,
      `${name} · cột ${index} ("${th.textContent?.trim() || "(trống)"}"): ` +
        `tiêu đề căn ${thAlign} nhưng dữ liệu căn ${tdAlign}`,
    ).toBe(tdAlign);
  });
  return true;
}

describe("Bảng tự dựng của bản port · tiêu đề cùng căn lề với dữ liệu", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.get).mockImplementation(
      async (url: unknown) =>
        (PAYLOAD[String(url)] ?? { rows: [], lines: [] }) as never,
    );
    vi.mocked(http.getPage).mockImplementation(async (url: unknown) => ({
      data: (PAGE_PAYLOAD[String(url)] ?? []) as never,
      meta: { current_page: 1, last_page: 1, total: 1 },
    }));
    useAuthStore.setState({
      isSuperAdmin: false,
      permissionCodes: ["report.view", "report.export", "REPORT_EXPORT"],
    });
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("RPT-01 · mọi .report-table", async () => {
    renderWithProviders(<InventoryFlowReportPage />, [
      ROUTES.REPORTS_INVENTORY_FLOW,
    ]);
    await screen.findByText("SKU-A");

    const tables = Array.from(
      document.querySelectorAll<HTMLTableElement>("table.report-table"),
    );
    expect(tables.length).toBeGreaterThan(0);
    let checked = 0;
    tables.forEach((table, index) => {
      if (assertHeaderMatchesData(table, `RPT-01 bảng #${index + 1}`)) {
        checked += 1;
      }
    });
    expect(checked).toBeGreaterThan(0);
  });

  it("RPT-02 · mọi .report-table (gồm bảng 'SKU cần làm rõ')", async () => {
    renderWithProviders(<StockReconcileReportPage />, [
      ROUTES.REPORTS_STOCK_RECONCILE,
    ]);
    await screen.findAllByText("SKU-A");

    const tables = Array.from(
      document.querySelectorAll<HTMLTableElement>("table.report-table"),
    );
    expect(tables.length).toBeGreaterThan(0);
    let checked = 0;
    tables.forEach((table, index) => {
      if (assertHeaderMatchesData(table, `RPT-02 bảng #${index + 1}`)) {
        checked += 1;
      }
    });
    expect(checked).toBeGreaterThan(0);
  });
});
