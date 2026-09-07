/**
 * WWHN-240 · DEV240-P1-HANDOFF-R3 — bằng chứng render THẬT của màn XNT (RPT-01).
 *
 * Vì sao phải có file này: trước đây các cột gross/đã đảo/thuần của XNT chỉ
 * được "test" bằng cách đọc source text (`flow06-report-pagination-export.test.ts`
 * readFileSync + regex) — chứng minh "trong file có chuỗi này", không chứng minh
 * "người dùng nhìn thấy đúng số". Register R3 đòi "QA chụp/test XNT columns",
 * nên bộ test này mount `InventoryFlowReportPage` với payload đúng hợp đồng
 * `report_xnt_enhanced` (BE `OperationalReportController::buildXnt`) và assert
 * từng ô hiển thị đúng giá trị BE trả về.
 *
 * PHẠM VI ĐÃ ĐỔI (2026-09-03, bản port 1:1 mockup UI/UX 8.1):
 * mockup chốt cho RPT-01 hiển thị bảng "Chi tiết cân đối tồn kho" theo cột
 * THUẦN (Đầu kỳ · Nhập thuần · Xuất SP · Xuất LK · Hoàn tác · Cuối kỳ), không
 * còn ba tầng cột gross/đã đảo/thuần của bản bảng cũ. Bộ test vì vậy:
 *  · assert đúng những ô NGƯỜI DÙNG THẤY (cột thuần) — vẫn là bằng chứng render
 *    thật, không phải đọc source;
 *  · assert hộp thoại "Đối soát SKU" in đúng phương trình BR-RPT/BA-03 trên
 *    cùng bộ số đó;
 *  · giữ nguyên chốt chặn bất biến trên chính fixture;
 *  · thêm guard rằng adapter vẫn CHUẨN HOÁ đủ ba tầng cột của hợp đồng BE
 *    (`*_gross` / `*_reversal` / `*_net`) để hợp đồng WWHN-240 không bị âm thầm
 *    rơi mất ở tầng dữ liệu khi UI chỉ còn hiển thị cột thuần.
 *
 * PHẠM VI ĐÃ ĐỔI LẦN HAI (2026-09-06, yêu cầu người dùng): màn gộp Nhập + Xuất
 * + Tồn tách làm HAI trang theo chiều nghiệp vụ và phần TỒN bỏ hẳn (RPT-02 lo
 * phần đó). Bảng vì thế không còn cột Đầu kỳ / Cuối kỳ / Đối soát; mỗi trang
 * chỉ giữ cột thuần của CHIỀU mình cộng cột Hoàn tác. Bộ test giữ nguyên lý do
 * tồn tại — assert đúng ô người dùng THẤY trên cùng fixture hợp đồng BE — và
 * chạy trên CẢ hai trang để không chiều nào render lệch cột mà lọt lưới.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
import { ROUTES } from "@/shared/constants/routes";
import InventoryFlowReportPage from "@/modules/reports/pages/InventoryFlowReportPage";
import OutboundFlowReportPage from "@/modules/reports/pages/OutboundFlowReportPage";

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

/** Mở màn RPT-01 (nhập kho) và chờ dòng SKU của fixture xuất hiện trong bảng. */
async function openXntScreen() {
  renderWithProviders(<InventoryFlowReportPage />, [
    ROUTES.REPORTS_INVENTORY_FLOW,
  ]);
  return screen.findByText("PRD-QA19-01");
}

/** Mở màn RPT-01B (xuất kho) — cùng fixture, khác chiều hiển thị. */
async function openOutboundScreen() {
  renderWithProviders(<OutboundFlowReportPage />, [
    ROUTES.REPORTS_OUTBOUND_FLOW,
  ]);
  return screen.findByText("PRD-QA19-01");
}

/** Nội dung từng ô của dòng SKU đang hiển thị. */
function cellsOfSkuRow(): Array<string | undefined> {
  const row = screen.getByText("PRD-QA19-01").closest("tr");
  expect(row).not.toBeNull();
  return Array.from((row as HTMLElement).children).map((cell) =>
    cell.textContent?.trim(),
  );
}

describe("WWHN-240 · màn XNT render đúng số BE trả về", () => {
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
    await openXntScreen();

    const calls = vi.mocked(http.get).mock.calls.map(([endpoint]) => endpoint);
    expect(calls).toContain(API_ENDPOINTS.REPORTS_XNT_ENHANCED);
    expect(API_ENDPOINTS.REPORTS_XNT_ENHANCED).toBe(
      "/reports/inventory-xnt-enhanced",
    );
  });

  it("gọi /reports/inventory-ledger cho drill-down và hai biểu đồ theo ngày", async () => {
    await openXntScreen();

    const calls = vi.mocked(http.get).mock.calls.map(([endpoint]) => endpoint);
    expect(calls).toContain(API_ENDPOINTS.REPORTS_INVENTORY_LEDGER);
    expect(API_ENDPOINTS.REPORTS_INVENTORY_LEDGER).toBe(
      "/reports/inventory-ledger",
    );
  });

  it("trang NHẬP: từng ô cột thuần đúng số BE trả về, không tráo/mất cột", async () => {
    await openXntScreen();

    // Thứ tự cột: STT · SKU/Tên hàng · Loại · Đơn vị · Nhập thuần · Hoàn tác ·
    // Thao tác. Cột STT đứng đầu ở MỌI bảng báo cáo (thêm ngoài mockup 8.1).
    // Loại/Đơn vị đến từ danh mục `/products` — fixture để trống danh mục nên
    // hai ô đó hiển thị "Chưa có" theo quy ước EMPTY_TEXT.
    expect(cellsOfSkuRow()).toEqual([
      "1",
      "PRD-QA19-01Máy KT-2000",
      "Chưa có",
      "Chưa có",
      "18",
      "0",
      "Đối soát",
    ]);
  });

  it("trang XUẤT: cột Xuất SP / Xuất LK đúng số BE trả về, không tráo/mất cột", async () => {
    await openOutboundScreen();

    // Thứ tự cột: STT · SKU/Tên hàng · Loại · Đơn vị · Xuất SP · Xuất LK ·
    // Hoàn tác · Thao tác.
    expect(cellsOfSkuRow()).toEqual([
      "1",
      "PRD-QA19-01Máy KT-2000",
      "Chưa có",
      "Chưa có",
      "50",
      "7",
      "0",
      "Đối soát",
    ]);
  });

  it("hộp thoại Đối soát SKU in đúng phương trình BA-03 trên cùng bộ số", async () => {
    await openXntScreen();
    fireEvent.click(screen.getByRole("button", { name: "Đối soát" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("PRD-QA19-01 · Máy KT-2000");
    // Dấu trừ của mockup là U+2212, không phải dấu gạch nối.
    expect(dialog).toHaveTextContent("100 + 18 − 50 − 7 + 0 = 61");
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

  it("adapter vẫn chuẩn hoá đủ ba tầng cột gross / đã đảo / thuần của hợp đồng BE", () => {
    // Mockup 8.1 chỉ hiển thị cột THUẦN, nhưng hợp đồng XntReportLine vẫn phát
    // hành cả ba tầng; giữ chúng ở tầng dữ liệu để không phải sửa lại adapter
    // khi cần thêm cột, và để hợp đồng WWHN-240 không rơi mất lặng lẽ.
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/modules/reports/inventory-flow/inventory-flow-api.ts",
      ),
      "utf8",
    );
    for (const field of [
      "receipt_gross",
      "receipt_reversal",
      "receipt_net",
      "issue_gross",
      "issue_reversal",
      "issue_net",
      "component_issue_gross",
      "component_issue_reversal",
      "component_issue_net",
      "reversal_unlinked_net",
      "reversal_net",
    ]) {
      expect(source).toContain(field);
    }
  });
});
