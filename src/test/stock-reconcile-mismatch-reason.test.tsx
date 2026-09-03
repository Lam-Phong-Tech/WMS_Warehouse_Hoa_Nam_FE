/**
 * RPT-02 · "Chênh lệch 0 mà vẫn Lệch" phải nói được lệch ở đâu.
 *
 * Cột "Chênh lệch" chỉ đo Sổ cái ↔ số dư, còn badge "Trạng thái đối soát" tổng
 * hợp cả 4 check của SRS §7.5. Khi lệch nằm ở sổ phụ thì Chênh lệch = 0 mà badge
 * vẫn đỏ — nếu màn hình không nói lệch ở đâu, người đọc kết luận dữ liệu sai.
 *
 * Trên bản port 1:1 mockup 8.2, chỗ trả lời câu hỏi đó là bảng "Top SKU chênh
 * lệch đối soát" với cột "Lệch ở". Test khoá: SKU lệch ở sổ serial phải xuất
 * hiện ở bảng đó kèm đúng tên phép kiểm, còn SKU khớp cả 4 check thì không.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
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

import { http } from "@/shared/api/http";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";
import StockReconcileReportPage from "@/modules/reports/pages/StockReconcileReportPage";

const TODAY = "2026-08-20";

const RECONCILIATION_ROWS = [
  {
    // Lệch THẬT nhưng không sinh chênh lệch sổ cái: sổ phụ serial đếm 6, số dư 1.
    warehouse_code: "KHO-HN",
    product_id: "sku-serial",
    product_code: "SKU-SERIAL",
    product_name: "Máy cắt cỏ",
    sku_type: "PRODUCT",
    stock_status: "AVAILABLE",
    on_hand_qty: 1,
    available_qty: 1,
    ledger_qty: 1,
    variance: 0,
    delta_qty: 0,
    reconciliation_status: "MATCH",
    serial_subledger_status: "MISMATCH",
    reconciliation_overall: "MISMATCH",
    mismatch_checks: ["serial_subledger"],
    updated_at: `${TODAY} 11:00:00`,
  },
  {
    // Khớp toàn bộ 4 check.
    warehouse_code: "KHO-HN",
    product_id: "sku-ok",
    product_code: "SKU-OK",
    product_name: "Dây curoa",
    sku_type: "COMPONENT",
    stock_status: "AVAILABLE",
    on_hand_qty: 25,
    available_qty: 25,
    ledger_qty: 25,
    variance: 0,
    delta_qty: 0,
    reconciliation_status: "MATCH",
    serial_subledger_status: "NOT_APPLICABLE",
    reconciliation_overall: "MATCH",
    mismatch_checks: [],
    updated_at: `${TODAY} 11:00:00`,
  },
];

/** Dòng của bảng "SKU cần làm rõ" — chỉ bảng đó mới có cột "Lệch ở". */
function varianceRowOf(code: string): HTMLElement {
  const row = [...document.querySelectorAll("tbody tr")].find(
    (candidate) =>
      (candidate.textContent ?? "").includes(code) &&
      (candidate.textContent ?? "").includes("Sổ"),
  );
  if (row === undefined) {
    throw new Error(`Không tìm thấy dòng ${code} ở bảng Top SKU chênh lệch`);
  }
  return row as HTMLElement;
}

describe("RPT-02 · vì sao Chênh lệch 0 mà vẫn Lệch", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.get).mockImplementation(async (url: unknown) => {
      const key = String(url);
      if (key === "/reports/inventory-reconciliation") {
        return {
          rows: RECONCILIATION_ROWS,
          summary: { rows_checked: 2, mismatch_count: 0 },
        } as never;
      }
      return { rows: [], lines: [] } as never;
    });
    vi.mocked(http.getPage).mockImplementation(async () => ({
      data: [] as never,
      meta: { current_page: 1, last_page: 1, total: 0 },
    }));
    useAuthStore.setState({
      isSuperAdmin: false,
      permissionCodes: ["report.view"],
    });
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("chỉ rõ check nào đang lệch, và không bịa lý do cho dòng đã khớp", async () => {
    renderWithProviders(<StockReconcileReportPage />, [
      ROUTES.REPORTS_STOCK_RECONCILE,
    ]);
    await screen.findByTestId("wwhn-258-report-screen");
    // Bảng dựng sau khi payload đối soát về; chờ đúng dòng thay vì đọc DOM sớm.
    await waitFor(() => expect(varianceRowOf("SKU-SERIAL")).toBeTruthy());

    const mismatched = varianceRowOf("SKU-SERIAL");
    expect(within(mismatched).getByText("Sổ serial")).toBeInTheDocument();
    // Chênh lệch sổ cái vẫn là 0 — đúng dữ liệu, và badge tổng hợp mới là "Lệch".
    expect(within(mismatched).getByText("0")).toBeInTheDocument();

    // Đúng MỘT SKU lệch: SKU-OK khớp cả 4 check nên không lọt vào bảng này.
    expect(screen.getByText("1 SKU lệch")).toBeInTheDocument();
    expect(() => varianceRowOf("SKU-OK")).toThrow();
    // Bảng chi tiết vẫn hiển thị SKU-OK với badge "Khớp" (bảng + lát cắt).
    expect(screen.getAllByText("Khớp").length).toBeGreaterThan(0);
  });
});
