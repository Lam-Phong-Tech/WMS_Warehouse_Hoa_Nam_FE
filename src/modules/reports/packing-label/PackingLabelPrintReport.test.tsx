/**
 * RPT-05 "Nhãn đóng gói · In / In lại" dùng endpoint thật qua
 * `packing-label-api` và màn chi tiết/xem trước theo UIUX V2.
 *
 * File này khóa những gì typecheck không bắt được:
 *  · một dòng = một lần in, ghép đúng nhãn/phiếu/máy in/người thao tác từ ba
 *    nguồn rời (`/reports/label-log`, `/label-print-events`, danh mục);
 *  · In lại được suy ra theo ĐÚNG định nghĩa BE dùng cho `reprint_count` (lần
 *    in THÀNH CÔNG thứ hai trở đi), không phải "tổng số lần in trừ 1";
 *  · `FAILED` của trigger PostgreSQL và `PRINT_FAILED` của tầng nghiệp vụ về
 *    cùng một nhãn hiển thị;
 *  · lọc trạng thái, mở chi tiết bản lưu, lịch sử in và xem trước nhãn từ đúng ID.
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
vi.mock("@/modules/outbound/components/AlignedOutboundDetailModal", () => ({
  AlignedOutboundDetailModal: ({ documentId }: { documentId: string }) => <div data-testid="outbound-source-id">{documentId}</div>,
}));

import { http } from "@/shared/api/http";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";
import PackingLabelPrintReport from "./PackingLabelPrintReport";

const PRINTER_A = "pc-a";
const PRINTER_B = "pc-b";
const ACTOR = "u-1";
const LABEL_1 = "ls-1";
const LABEL_2 = "ls-2";

/** Dòng `/reports/label-log` theo đúng shape AlignedLabelLogReportController. */
const LABEL_LOG_ROWS = [
  {
    id: LABEL_1,
    label_code: "PL-PX-0001",
    outbound_no: "PX-0001",
    outbound_date: "2026-09-01",
    recipient: "Đại lý An Phát",
    status: "PRINTED",
    applied: true,
    printer_config_id: PRINTER_A,
    printer_name: "Zebra ZD421",
    printed_by_name: "Nguyễn Kho Vận",
    total_attempts: 2,
    failed_count: 0,
    reprint_count: 1,
    item_count: 3,
    sku_count: 2,
    sku_summary: "SKU-A x2, SKU-B x1",
    last_attempt_at: "2026-09-02 10:00:00",
    created_at: "2026-09-01 08:00:00",
  },
  {
    id: LABEL_2,
    label_code: "PL-PX-0002",
    outbound_no: "PX-0002",
    outbound_date: "2026-09-02",
    recipient: "Công ty Tân Phát",
    status: "PRINTED",
    applied: true,
    printer_config_id: PRINTER_B,
    printer_name: "TSC TE200",
    printed_by_name: "Nguyễn Kho Vận",
    total_attempts: 2,
    failed_count: 1,
    reprint_count: 0,
    item_count: 1,
    sku_count: 1,
    sku_summary: "SKU-C x1",
    last_attempt_at: "2026-09-02 09:30:00",
    created_at: "2026-09-02 09:00:00",
  },
];

/**
 * Bốn lần in thô của bảng `label_print_events`. LS-1 in thành công hai lần
 * (lần thứ hai là In lại); LS-2 lỗi giấy rồi in lại thành công — theo định
 * nghĩa BE, lần sau vẫn là Print vì đây là lần THÀNH CÔNG đầu tiên.
 */
const PRINT_EVENTS = [
  {
    id: "ev-1",
    label_snapshot_id: LABEL_1,
    printer_config_id: PRINTER_A,
    created_by: ACTOR,
    status: "PRINTED",
    error_code: null,
    error_message: null,
    reason: null,
    requested_at: "2026-09-02T08:00:00+07:00",
    created_at: "2026-09-02 08:00:00",
  },
  {
    id: "ev-2",
    label_snapshot_id: LABEL_1,
    printer_config_id: PRINTER_A,
    created_by: ACTOR,
    status: "PRINTED",
    error_code: null,
    error_message: null,
    reason: "Nhãn đầu bị nhòe khi dán",
    requested_at: "2026-09-02T10:00:00+07:00",
    created_at: "2026-09-02 10:00:00",
  },
  {
    id: "ev-3",
    label_snapshot_id: LABEL_2,
    printer_config_id: PRINTER_B,
    created_by: ACTOR,
    // Trigger PostgreSQL chuẩn hoá PRINT_FAILED → FAILED; màn hình phải đọc
    // được cả hai từ vựng.
    status: "FAILED",
    error_code: "PAPER_OUT",
    error_message: "Máy in hết giấy nhãn",
    reason: null,
    requested_at: "2026-09-02T09:00:00+07:00",
    created_at: "2026-09-02 09:00:00",
  },
  {
    id: "ev-4",
    label_snapshot_id: LABEL_2,
    printer_config_id: PRINTER_B,
    created_by: ACTOR,
    status: "PRINTED",
    error_code: null,
    error_message: null,
    reason: null,
    requested_at: "2026-09-02T09:30:00+07:00",
    created_at: "2026-09-02 09:30:00",
  },
];

const PAYLOAD: Record<string, unknown> = {
  "/reports/label-log": { rows: LABEL_LOG_ROWS, summary: {} },
  [`/label-snapshots/${LABEL_1}`]: {
    id: LABEL_1,
    outbound_document_id: "outbound-1",
    status: "PRINTED",
    version: 2,
    applied_at: "2026-09-01T08:10:00+07:00",
    created_at: "2026-09-01T08:00:00+07:00",
    label_payload: {
      label_code: "PL-PX-0001",
      outbound_no: "PX-0001",
      item_ids: ["it-1", "it-2", "it-3"],
    },
    print_events: PRINT_EVENTS.filter(
      (event) => event.label_snapshot_id === LABEL_1,
    ),
  },
  [`/label-snapshots/${LABEL_2}`]: {
    id: LABEL_2,
    status: "PRINT_FAILED",
    version: 1,
    applied_at: null,
    created_at: "2026-09-01T09:00:00+07:00",
    label_payload: {
      label_code: "PL-PX-0002",
      outbound_no: "PX-0002",
      item_ids: ["it-4"],
    },
    print_events: PRINT_EVENTS.filter(
      (event) => event.label_snapshot_id === LABEL_2,
    ),
  },
};

const PAGE_PAYLOAD: Record<string, unknown[]> = {
  "/label-print-events": PRINT_EVENTS,
  "/printer-configs": [
    { id: PRINTER_A, printer_code: "PRN-01", printer_name: "Zebra ZD421" },
    { id: PRINTER_B, printer_code: "PRN-02", printer_name: "TSC TE200" },
  ],
  "/users": [
    {
      user_id: ACTOR,
      display_name: "Nguyễn Kho Vận",
      department: { department_id: "dep-1", department_name: "Kho vận" },
    },
  ],
};

function renderReport() {
  renderWithProviders(<PackingLabelPrintReport />, [
    ROUTES.REPORTS_PACKING_LABEL,
  ]);
}

describe("RPT-05 · Nhãn đóng gói In / In lại", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.get).mockImplementation(
      async (url: unknown) => (PAYLOAD[String(url)] ?? { rows: [] }) as never,
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

  it("dựng một dòng cho mỗi lần in, ghép đủ nhãn / máy in / người thao tác", async () => {
    renderReport();

    expect(
      await screen.findByTestId("rpt-tab-packing-label"),
    ).toBeInTheDocument();

    const table = await screen.findByRole("table");
    // 4 lần in của 2 nhãn — không gộp về mức nhãn.
    expect(within(table).getAllByRole("row")).toHaveLength(5); // 1 header + 4
    expect(within(table).getAllByText("PL-PX-0001")).toHaveLength(2);
    expect(within(table).getAllByText("PL-PX-0002")).toHaveLength(2);
    expect(within(table).getAllByText("Đại lý An Phát")).toHaveLength(2);
    // Định danh bản lưu (label_snapshot_id) không có mã nghiệp vụ — bảng chỉ
    // hiện mã nhãn, không in định danh nội bộ (phản ánh 10/09/2026).
    expect(table).not.toHaveTextContent(LABEL_1);
    expect(table).not.toHaveTextContent(LABEL_2);
    const user = userEvent.setup();
    await user.click(within(table).getAllByRole("button", { name: /Xem chi tiết nhãn/ })[0]);
    expect((await screen.findAllByText(/Zebra ZD421 · Nguyễn Kho Vận/)).length).toBe(2);
    expect(screen.getByText("Nhãn đầu bị nhòe khi dán")).toBeInTheDocument();
    expect(screen.getByText("In lại")).toBeInTheDocument();
  });

  it("tổng quan tính trên đúng tập dòng đang hiển thị", async () => {
    renderReport();

    const kpis = await screen.findByLabelText("Tổng quan in nhãn", {
      selector: "section",
    });
    expect(await within(kpis).findByText("4")).toBeInTheDocument(); // tổng lượt in
    expect(within(kpis).getByText("3")).toBeInTheDocument(); // in thành công
    expect(within(kpis).getAllByText("1")).toHaveLength(2); // in lỗi + in lại
    expect(kpis).toHaveTextContent(/75\s*%/);
  });

  it("ô tìm kiếm thu hẹp đúng tập event và cập nhật tổng quan", async () => {
    const user = userEvent.setup();
    renderReport();

    await screen.findByRole("table");
    await user.type(
      screen.getByRole("textbox", {
        name: "Tìm trong danh sách nhãn",
      }),
      "PX-0002",
    );

    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3); // 1 header + 2
    expect(within(table).getAllByText("PL-PX-0002")).toHaveLength(2);
  });

  it("lọc theo kết quả in và khôi phục đầy đủ dòng", async () => {
    const user = userEvent.setup();
    renderReport();

    const table = await screen.findByRole("table");
    await user.selectOptions(screen.getByRole("combobox", { name: "Trạng thái" }), "PRINT_FAILED");
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByText("Lỗi in")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Trạng thái" }), "");
    expect(within(table).getAllByRole("row")).toHaveLength(5);
  });

  it("mở chi tiết đúng nhãn kèm bản lưu và lịch sử in", async () => {
    const user = userEvent.setup();
    renderReport();

    await screen.findAllByRole("button", { name: /Xem chi tiết nhãn/ });
    await user.click(
      screen.getAllByRole("button", { name: /Xem chi tiết nhãn/ })[0],
    );

    const detail = await screen.findByTestId("packing-label-detail");
    expect(within(detail).getByText("Trạng thái bản lưu")).toBeInTheDocument();
    expect(within(detail).getByText("Đã in")).toBeInTheDocument();
    expect(detail).not.toHaveTextContent(LABEL_1);
    expect(within(detail).getByText("SKU-A x2, SKU-B x1")).toBeInTheDocument();
    expect(within(detail).getByText("Nhãn đầu bị nhòe khi dán")).toBeInTheDocument();
  });

  it("mở trang chi tiết và bản xem trước từ đúng bản lưu nhãn", async () => {
    const user = userEvent.setup();
    vi.mocked(http.get).mockImplementation(async (url: unknown) =>
      String(url) === "/reports/label-log"
        ? ({ rows: LABEL_LOG_ROWS.map((row) => ({ ...row, outbound_date: "2026-10-29", created_at: "2026-10-29 08:00:00" })), summary: {} } as never)
        : ((PAYLOAD[String(url)] ?? { rows: [] }) as never),
    );
    renderReport();
    await screen.findAllByText("PL-PX-0001");

    await user.click(screen.getAllByRole("button", { name: /Xem chi tiết nhãn/ })[0]);
    expect(await screen.findByRole("heading", { name: "Chi tiết nhãn đóng gói" })).toBeInTheDocument();
    expect(http.get).toHaveBeenCalledWith("/label-snapshots/ls-1");
    expect(screen.getByText("SKU-A x2, SKU-B x1")).toBeInTheDocument();
    expect(screen.getByText("Lịch sử in nhãn")).toBeInTheDocument();
    expect(screen.queryByText("Công ty Tân Phát")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xem trước nhãn" }));
    expect(await screen.findByRole("heading", { name: "Xem trước nhãn" })).toBeInTheDocument();
    expect(screen.getByText("100 mm")).toBeInTheDocument();
    expect(screen.getByText("150 mm")).toBeInTheDocument();
    expect(screen.getAllByText("PL-PX-0001")).toHaveLength(2);
  });

  it("mở phiếu xuất nguồn từ ID của bản lưu nhãn", async () => {
    const user = userEvent.setup();
    renderReport();
    await screen.findAllByRole("button", { name: /Xem chi tiết nhãn/ });
    await user.click(screen.getAllByRole("button", { name: /Xem chi tiết nhãn/ })[0]);
    await screen.findByTestId("packing-label-detail");
    await user.click(screen.getByRole("button", { name: "Mở phiếu xuất" }));
    expect(screen.getByTestId("outbound-source-id")).toHaveTextContent("outbound-1");
  });

  /**
   * Người dùng báo lỗi 2026-09-06: cột "Lỗi / lý do" in nguyên mã máy in
   * (PRINTER_JAMMED / PAPER_JAM) giữa màn tiếng Việt. Khoá cả hai chỗ hiển
   * thị — bảng chính và hộp thoại kiểm chứng — để mã thô không quay lại.
   */
  it("dịch mã lỗi máy in sang tiếng Việt, không in mã thô ra bảng", async () => {
    const user = userEvent.setup();
    renderReport();

    await screen.findAllByRole("button", { name: /Xem chi tiết nhãn/ });
    const table = screen.getByRole("table");
    expect(table).not.toHaveTextContent("PAPER_OUT");

    const failedRow = within(table)
      .getAllByRole("row")
      .find((row) => row.textContent?.includes("Lỗi in"));
    await user.click(
      within(failedRow!).getByRole("button", { name: /Xem chi tiết nhãn/ }),
    );

    const dialog = await screen.findByTestId("packing-label-detail");
    expect(
      await within(dialog).findByText("Máy in hết giấy nhãn"),
    ).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("PAPER_OUT");
  });

  it("dịch trạng thái bản lưu của BE thay vì in enum PRINTED", async () => {
    const user = userEvent.setup();
    renderReport();

    await screen.findAllByRole("button", { name: /Xem chi tiết nhãn/ });
    await user.click(
      screen.getAllByRole("button", { name: /Xem chi tiết nhãn/ })[0],
    );

    const dialog = await screen.findByTestId("packing-label-detail");
    expect(await within(dialog).findByText("Đã in")).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("PRINTED");
  });

  it("cho xuất báo cáo khi có quyền REPORT_EXPORT", async () => {
    renderReport();

    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: /Xuất báo cáo/ })).toBeEnabled();
  });
});
