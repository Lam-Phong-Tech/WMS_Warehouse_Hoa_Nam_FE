/**
 * WWHN-240 · DEV240-P1-HANDOFF-R3 — bằng chứng render THẬT của tab XNT.
 *
 * Vì sao phải có file này: trước đây cột gross/đã đảo/thuần của XNT chỉ được
 * "test" bằng cách đọc source text (`flow06-report-pagination-export.test.ts`
 * readFileSync + regex) — chứng minh "trong file có chuỗi này", không chứng minh
 * "người dùng nhìn thấy đúng số". Register R3 đòi "QA chụp/test XNT columns",
 * nên bộ test này mount `AlignedReportsPage`, mở tab Nhập-Xuất-Tồn với payload
 * đúng hợp đồng `report_xnt_enhanced` (BE `OperationalReportController::buildXnt`)
 * và assert từng cột reversal hiển thị đúng giá trị BE trả về.
 *
 * Bất biến nghiệp vụ được phản chiếu (BR-RPT-01..07 + BR-REV-11, SRS §13.10
 * RPT-XNT-01): mỗi chiều Nhập/Xuất/Xuất LK tách gross / đã đảo / thuần;
 * closing = opening + receipt_net - issue_net - component_issue_net
 * + reversal_unlinked_net; không ẩn hay sửa lịch sử.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
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
vi.mock("@/modules/master-data/services/warehouse.service", () => ({
  fetchWarehouses: vi.fn(async () => []),
}));
vi.mock("@/modules/outbound/services/mvpOutboundService", () => ({
  fetchPrinterConfigs: vi.fn(async () => []),
}));
vi.mock("@/modules/master-data/hooks/use-mvp-master", () => ({
  useMvpAgencies: vi.fn(() => ({ data: { data: [] }, isLoading: false })),
  useMvpDefects: vi.fn(() => ({ data: { data: [] }, isLoading: false })),
}));

import { http } from "@/shared/api/http";
import { useAuthStore } from "@/shared/store/auth.store";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import AlignedReportsPage from "@/modules/reports/pages/AlignedReportsPage";

/**
 * Một dòng XNT đúng shape `lines[]` của `buildXnt()`. Mỗi giá trị số xuất
 * hiện đúng một lần trong fixture để mọi kiểu render nhầm cột (tráo, mất,
 * lệch một ô) đều làm assertion thứ tự bên dưới đỏ.
 */
const XNT_LINE = {
  warehouse_code: "KHO-TONG-HN",
  product_code: "PRD-QA19-01",
  product_name: "Máy KT-2000",
  stock_status: "AVAILABLE",
  opening: 100,
  receipt: 21,
  receipt_gross: 21,
  receipt_reversal: 3,
  receipt_net: 18,
  issue: 55,
  issue_gross: 55,
  issue_reversal: 5,
  issue_net: 50,
  component_issue: 13,
  component_issue_gross: 13,
  component_issue_reversal: 6,
  component_issue_net: 7,
  reversal_unlinked_net: 0,
  reversal_net: -2,
  // closing = 100 + 18 - 50 - 7 + 0 (công thức NET của BE)
  closing: 61,
};

function xntPayload() {
  return {
    from_date: "2026-08-18",
    to_date: "2026-08-20",
    lines: [XNT_LINE],
    pagination: { current_page: 1, per_page: 15, total: 1 },
  };
}

async function openXntTab() {
  renderWithProviders(<AlignedReportsPage />, ["/reports"]);
  fireEvent.click(await screen.findByRole("tab", { name: /Nhập-Xuất-Tồn/ }));
  return screen.findByText("PRD-QA19-01");
}

describe("WWHN-240 · tab XNT render đủ cột gross / đã đảo / thuần", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.get).mockImplementation(async (endpoint: string) =>
      endpoint === API_ENDPOINTS.REPORTS_XNT_ENHANCED
        ? xntPayload()
        : { rows: [], lines: [], pagination: { total: 0 } },
    );
    vi.mocked(http.getPage).mockResolvedValue({ data: [], meta: {} });
    useAuthStore.setState({
      isSuperAdmin: false,
      permissionCodes: ["report.view", "report.export", "REPORT_EXPORT"],
    });
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("gọi đúng endpoint canonical /reports/inventory-xnt-enhanced", async () => {
    await openXntTab();

    const calls = vi.mocked(http.get).mock.calls.map(([endpoint]) => endpoint);
    expect(calls).toContain(API_ENDPOINTS.REPORTS_XNT_ENHANCED);
    expect(API_ENDPOINTS.REPORTS_XNT_ENHANCED).toBe(
      "/reports/inventory-xnt-enhanced",
    );
  });

  it("giá trị từng ô reversal đúng số BE trả về, không tráo/mất cột nhóm", async () => {
    // Harness mock antd Table flatten grouped columns về cột lá (xem
    // src/test/setup.ts, ghi chú WWHN-240) — trước đó mọi ô thuộc nhóm
    // Nhập/Xuất/Xuất LK render null và test kiểu này không thể tồn tại.
    await openXntTab();
    const row = screen.getByText("PRD-QA19-01").closest('[role="row"]');
    expect(row).not.toBeNull();
    const cells = Array.from((row as HTMLElement).children).map((cell) =>
      cell.textContent?.trim(),
    );

    // Thứ tự cột lá theo columnsFor("xnt"): kho, mã, tên, tồn, đầu kỳ,
    // nhập(gross/đã đảo/thuần), xuất(g/đ/t), xuất LK(g/đ/t), reversal net,
    // cuối kỳ. Mỗi giá trị fixture là duy nhất nên mọi hoán vị/mất cột đều đỏ.
    expect(cells).toEqual([
      "KHO-TONG-HN",
      "PRD-QA19-01",
      "Máy KT-2000",
      "AVAILABLE",
      "100",
      "21",
      "3",
      "18",
      "55",
      "5",
      "50",
      "13",
      "6",
      "7",
      "-2",
      "61",
    ]);
  });

  it("bất biến WWHN-240 giữ trên chính fixture: closing = opening + Σnet + unlinked, net = gross - reversal", () => {
    // Chốt chặn để fixture của test này không bao giờ tự mâu thuẫn với công
    // thức formula_net của BE (nếu ai sửa fixture sai, test đỏ ngay tại đây
    // thay vì âm thầm assert một bảng sai nghiệp vụ).
    expect(XNT_LINE.receipt_net).toBe(
      XNT_LINE.receipt_gross - XNT_LINE.receipt_reversal,
    );
    expect(XNT_LINE.issue_net).toBe(
      XNT_LINE.issue_gross - XNT_LINE.issue_reversal,
    );
    expect(XNT_LINE.component_issue_net).toBe(
      XNT_LINE.component_issue_gross - XNT_LINE.component_issue_reversal,
    );
    expect(XNT_LINE.closing).toBe(
      XNT_LINE.opening +
        XNT_LINE.receipt_net -
        XNT_LINE.issue_net -
        XNT_LINE.component_issue_net +
        XNT_LINE.reversal_unlinked_net,
    );
  });
});
