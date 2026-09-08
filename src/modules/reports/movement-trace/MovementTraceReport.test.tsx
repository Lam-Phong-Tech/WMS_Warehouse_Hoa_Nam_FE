/**
 * RPT-MOV-01 "Truy vết hàng hóa" — bản port 1:1 mockup 8.4 chạy trên endpoint
 * thật `/reports/movement-trace`.
 *
 * File này khóa những gì typecheck không bắt được: KPI/timeline/ledger dựng
 * đúng từ payload BE, cột "Chứng từ" hiện MÃ người đọc được chứ không phải
 * UUID, bút toán đảo được gọi đúng tên theo chiều qty_delta, bộ lọc phụ +
 * "Đặt lại" thật sự đổi tập dòng, và bấm một dòng mở drawer bằng chứng.
 *
 * ĐỔI HỢP ĐỒNG (07/09/2026): mã chứng từ nguồn nay do BE tra sẵn và trả trong
 * chính `source_no` của từng dòng. Màn hình KHÔNG còn gọi
 * `/reports/document-history` + `/reversal-documents` để tự ghép bảng tra —
 * riêng document-history tốn 328 KB nén / 1,69 MB giải nén cho đúng hai trường.
 * Fixture dưới đây vì thế mang `source_no`, và hai payload phụ đã bỏ.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import MovementTraceReport from "./MovementTraceReport";

const MOVEMENT_TRACE = {
  period: { from_date: "2026-08-01", to_date: "2026-08-31" },
  summary: { total_movements: 3, net_effect: 2, reversal_count: 1 },
  by_movement_type: [
    { movement_type: "RECEIPT", movement_count: 1 },
    { movement_type: "ISSUE", movement_count: 1 },
    { movement_type: "REVERSAL", movement_count: 1 },
  ],
  rows: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      movement_no: "MV-20260829-0003",
      occurred_at: "2026-08-29 14:30:00",
      movement_type: "REVERSAL",
      warehouse_code: "KHO-HN",
      product_code: "SKU-VENT-01",
      product_name: "Máy thở VENT",
      qty_delta: 1,
      actor: "approver.hn",
      source_type: "REVERSAL_DOCUMENT",
      source_id: "rev-1",
      source_no: "REV-2026-00007",
      original_movement_id: "22222222-2222-4222-8222-222222222222",
      correction_chain_id: "chain-2",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      movement_no: "MV-20260829-0002",
      occurred_at: "2026-08-29 14:30:00",
      movement_type: "ISSUE",
      warehouse_code: "KHO-HN",
      product_code: "SKU-VENT-01",
      product_name: "Máy thở VENT",
      qty_delta: -1,
      actor: "vanhanh.hn",
      source_type: "OUTBOUND_DOCUMENT",
      source_id: "out-1",
      source_no: "OUT-2026-00018",
      correction_chain_id: "chain-2",
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      movement_no: "MV-20260825-0001",
      occurred_at: "2026-08-25 08:15:00",
      movement_type: "RECEIPT",
      warehouse_code: "KHO-HN",
      product_code: "SKU-VENT-01",
      product_name: "Máy thở VENT",
      qty_delta: 2,
      actor: "thukho.hn",
      source_type: "INBOUND_DOCUMENT",
      source_id: "in-1",
      source_no: "IN-2026-00031",
      correction_chain_id: "chain-1",
    },
  ],
};

const PAYLOAD: Record<string, unknown> = {};

const PAGE_PAYLOAD: Record<string, unknown> = {
  "/products": [
    {
      sku_id: "sku-vent",
      sku_code: "SKU-VENT-01",
      sku_name: "Máy thở VENT",
      sku_type: "PRODUCT",
    },
  ],
};

// Danh mục SKU của màn báo cáo giờ đi qua GET /skus/lookup (một request, không
// phân trang — xem fetchAllSkus); cùng dòng dữ liệu với "/products" ở trên.
PAYLOAD["/skus/lookup"] = PAGE_PAYLOAD["/products"];

function renderReport() {
  renderWithProviders(<MovementTraceReport />, [ROUTES.REPORTS_TRACEABILITY]);
}

describe("RPT-MOV-01 · Truy vết hàng hóa", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.get).mockImplementation(
      async (url: unknown) => (PAYLOAD[String(url)] ?? { rows: [] }) as never,
    );
    vi.mocked(http.getPage).mockImplementation(async (url: unknown) => {
      const key = String(url);
      if (key === "/reports/movement-trace") {
        return {
          data: MOVEMENT_TRACE as never,
          meta: {
            request_id: "req-abc",
            timestamp: "2026-09-02T10:00:00+07:00",
          },
        };
      }
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

  it("dựng KPI, timeline và ledger từ payload thật, có mốc chốt của máy chủ", async () => {
    renderReport();

    expect(
      await screen.findByTestId("movement-trace-report"),
    ).toBeInTheDocument();

    // Ledger đọc theo posted_at ↑, chứng từ đã đổi từ UUID sang mã người đọc được.
    const table = await screen.findByRole("table");
    await screen.findByText("IN-2026-00031");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("IN-2026-00031")).toBeInTheDocument();
    // Hai dòng cùng posted_at 14:30 xếp tiếp theo movement_id tăng dần.
    expect(within(rows[1]).getByText("REV-2026-00007")).toBeInTheDocument();
    expect(within(rows[2]).getByText("OUT-2026-00018")).toBeInTheDocument();

    // 4 thẻ: tổng 3 · nhập 1 · xuất 1 · đảo 1 (summary + by_movement_type).
    expect(screen.getByText("Tổng biến động")).toBeInTheDocument();
    // Loại các ô nằm TRONG bảng: cột STT của ledger cũng in ra 1/2/3 nên
    // truy vấn theo con số trần không còn duy nhất.
    const outsideTable = (text: string) =>
      screen.getAllByText(text).filter((node) => !table.contains(node));
    expect(outsideTable("3").length).toBeGreaterThan(0);
    expect(outsideTable("1").length).toBeGreaterThanOrEqual(3);

    // meta.timestamp của phản hồi là mốc "Chốt" hiển thị trên màn.
    expect(screen.getAllByText(/Chốt 10:00 02-09/).length).toBeGreaterThan(0);
  });

  it("gọi bút toán đảo theo chiều qty_delta: đảo phiếu xuất làm tăng tồn", async () => {
    renderReport();

    const table = await screen.findByRole("table");
    // qty_delta = +1 ⇒ đang đảo một phiếu XUẤT, không phải phiếu nhập.
    expect(within(table).getByText("Đảo phiếu xuất")).toBeInTheDocument();
    expect(within(table).queryByText("Đảo phiếu nhập")).not.toBeInTheDocument();
    // Timeline dùng cách gọi nghiệp vụ của bản demo cho cùng dòng đó.
    expect(screen.getByText("Phiếu đảo cho phiếu xuất")).toBeInTheDocument();
  });

  it("lọc theo Actor rồi Đặt lại đưa ledger về đủ ba dòng", async () => {
    const user = userEvent.setup();
    renderReport();
    await screen.findByRole("table");

    const resetButton = screen.getByRole("button", { name: "Đặt lại" });
    expect(resetButton).toBeDisabled();

    await user.type(screen.getByLabelText("Người thực hiện"), "thukho");
    await user.click(screen.getByRole("button", { name: /Tra cứu/ }));

    expect(
      within(await screen.findByRole("table"))
        .getAllByRole("row")
        .slice(1),
    ).toHaveLength(1);

    expect(resetButton).toBeEnabled();
    await user.click(resetButton);
    expect(
      within(await screen.findByRole("table"))
        .getAllByRole("row")
        .slice(1),
    ).toHaveLength(3);
  });

  it("bấm một dòng ledger mở drawer bằng chứng chỉ đọc của đúng movement", async () => {
    const user = userEvent.setup();
    renderReport();

    const table = await screen.findByRole("table");
    await screen.findByText("OUT-2026-00018");
    // Thứ tự posted_at ↑ · movement_id: RECEIPT → REVERSAL → ISSUE.
    const issueRow = within(table)
      .getByText("OUT-2026-00018")
      .closest("tr") as HTMLElement;
    await user.click(issueRow);

    const drawer = await screen.findByRole("dialog", {
      name: /Bằng chứng biến động/,
    });
    expect(within(drawer).getByText(/Xuất kho đã ghi sổ/)).toBeInTheDocument();
    expect(
      // Nguồn hiện tên chứng từ tiếng Việt, không phải mã `source_type` của BE.
      within(drawer).getByText(/OUT-2026-00018 · Phiếu xuất kho/),
    ).toBeInTheDocument();
    expect(within(drawer).getByText("vanhanh.hn")).toBeInTheDocument();
    expect(
      within(drawer).getByText(/Chi tiết chứng từ là read-only/),
    ).toBeInTheDocument();
  });
});
