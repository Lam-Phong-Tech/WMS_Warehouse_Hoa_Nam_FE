/**
 * RPT-INV-01 · bảng "2.5 Chi tiết tồn kho & đối soát".
 *
 * Cột "Chênh lệch" chỉ đo Sổ cái ↔ số dư, còn badge "Trạng thái đối soát" tổng
 * hợp cả 4 check của SRS §7.5. Khi lệch nằm ở sổ phụ thì Chênh lệch = 0 mà badge
 * vẫn đỏ — nếu màn hình không nói lệch ở đâu, người đọc kết luận dữ liệu sai.
 * Test khoá: có mismatch_checks thì phải hiện dòng "Lệch ở: …", và dòng khớp
 * hoàn toàn thì không hiện gì thêm.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
import AlignedReportsPage from "@/modules/reports/pages/AlignedReportsPage";

const TODAY = "2026-08-20";

const RECONCILIATION_ROWS = [
  {
    // Lệch THẬT nhưng không sinh chênh lệch sổ cái: sổ phụ serial đếm 6, số dư 1.
    warehouse_code: "KHO-HN",
    product_id: "sku-serial",
    product_code: "SKU-SERIAL",
    product_name: "Máy cắt cỏ",
    stock_status: "AVAILABLE",
    on_hand_qty: 1,
    available_qty: 1,
    ledger_qty: 1,
    variance: 0,
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
    stock_status: "AVAILABLE",
    on_hand_qty: 25,
    available_qty: 25,
    ledger_qty: 25,
    variance: 0,
    reconciliation_status: "MATCH",
    serial_subledger_status: "NOT_APPLICABLE",
    reconciliation_overall: "MATCH",
    mismatch_checks: [],
    updated_at: `${TODAY} 11:00:00`,
  },
];

/**
 * Mã SKU xuất hiện ở CẢ bảng 2.4 (cảnh báo định mức) lẫn 2.5, nên phải neo vào
 * đúng dòng của 2.5. Nút "Xem chi tiết SKU" chỉ bảng 2.5 mới có, dùng làm mốc.
 */
function rowOf(code: string): HTMLElement {
  const row = [...document.querySelectorAll('[role="row"]')].find(
    (candidate) =>
      (candidate.textContent ?? "").includes(code) &&
      candidate.querySelector('[aria-label="Xem chi tiết SKU"]') !== null,
  );
  if (row === undefined) {
    throw new Error(`Không tìm thấy dòng ${code} ở bảng 2.5`);
  }
  return row as HTMLElement;
}

describe("RPT-INV-01 · vì sao Chênh lệch 0 mà vẫn Có chênh lệch", () => {
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
    renderWithProviders(<AlignedReportsPage />, ["/reports"]);
    fireEvent.click(
      await screen.findByRole("tab", { name: /Tồn kho & đối soát/ }),
    );
    await screen.findByTestId("rpt-tab-stock-reconcile");
    // Bảng 2.5 render sau khi payload đối soát về; chờ đúng dòng thay vì đọc DOM sớm.
    await waitFor(() => expect(rowOf("SKU-SERIAL")).toBeTruthy());

    const mismatched = rowOf("SKU-SERIAL");
    expect(within(mismatched).getByText("Có chênh lệch")).toBeInTheDocument();
    expect(
      within(mismatched).getByText(/Lệch ở: Sổ serial/),
    ).toBeInTheDocument();

    const matched = rowOf("SKU-OK");
    expect(within(matched).getByText("Khớp")).toBeInTheDocument();
    expect(within(matched).queryByText(/Lệch ở:/)).toBeNull();
  });
});
