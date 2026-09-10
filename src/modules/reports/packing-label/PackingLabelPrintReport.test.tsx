/**
 * RPT-05 "Nhãn đóng gói · In / In lại" — màn port 1:1 mockup 8.6 chạy trên
 * endpoint thật qua `packing-label-api`.
 *
 * File này khóa những gì typecheck không bắt được:
 *  · một dòng = một lần in, ghép đúng nhãn/phiếu/máy in/người thao tác từ ba
 *    nguồn rời (`/reports/label-log`, `/label-print-events`, danh mục);
 *  · In lại được suy ra theo ĐÚNG định nghĩa BE dùng cho `reprint_count` (lần
 *    in THÀNH CÔNG thứ hai trở đi), không phải "tổng số lần in trừ 1";
 *  · `FAILED` của trigger PostgreSQL và `PRINT_FAILED` của tầng nghiệp vụ về
 *    cùng một nhãn hiển thị;
 *  · tab Bảng/Lát cắt, bộ lọc chi tiết và hộp thoại audit đều dẫn tới dữ liệu
 *    thật chứ không phải nút chết.
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
    expect(within(table).getAllByText("Nguyễn Kho Vận")).toHaveLength(4);
    // Định danh bản lưu (label_snapshot_id) không có mã nghiệp vụ — bảng chỉ
    // hiện mã nhãn, không in định danh nội bộ (phản ánh 10/09/2026).
    expect(table).not.toHaveTextContent(LABEL_1);
    expect(table).not.toHaveTextContent(LABEL_2);
    expect(within(table).getAllByText(/Zebra ZD421/)).toHaveLength(2);

    // `FAILED` của trigger đọc ra đúng nhãn nghiệp vụ, kèm lý do đã Việt hoá.
    expect(within(table).getByText("In lỗi")).toBeInTheDocument();
    expect(within(table).getByText("Máy in hết giấy")).toBeInTheDocument();
    expect(within(table).getByText("Máy in hết giấy nhãn")).toBeInTheDocument();

    // In lại = lần in THÀNH CÔNG thứ hai; thử lại sau lỗi vẫn là Print.
    expect(within(table).getAllByText("In lại")).toHaveLength(1);
    expect(within(table).getAllByText("In lần đầu")).toHaveLength(3);
  });

  it("tổng quan tính trên đúng tập dòng đang hiển thị", async () => {
    renderReport();

    const kpis = await screen.findByLabelText("Tổng quan vận hành in nhãn", {
      selector: "section",
    });
    expect(await within(kpis).findByText("4")).toBeInTheDocument(); // tổng lượt in
    expect(within(kpis).getByText("3")).toBeInTheDocument(); // in thành công
    expect(within(kpis).getAllByText("1")).toHaveLength(2); // in lỗi + in lại
    expect(within(kpis).getByText("75%")).toBeInTheDocument();
    expect(within(kpis).getAllByText("25%")).toHaveLength(2);
  });

  it("ô tìm kiếm thu hẹp đúng tập event và cập nhật tổng quan", async () => {
    const user = userEvent.setup();
    renderReport();

    await screen.findByRole("table");
    await user.type(
      screen.getByRole("textbox", {
        name: "Tìm phiếu xuất hoặc mã nhãn",
      }),
      "PX-0002",
    );

    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3); // 1 header + 2
    expect(screen.getByText("2 sự kiện")).toBeInTheDocument();
  });

  it("mở bộ lọc chi tiết và chuyển Bảng ↔ Lát cắt", async () => {
    const user = userEvent.setup();
    renderReport();

    const advanced = await screen.findByRole("button", {
      name: /Bộ lọc chi tiết/,
    });
    expect(advanced).toHaveAttribute("aria-expanded", "false");
    await user.click(advanced);
    expect(
      screen.getByRole("button", { name: /Thu gọn bộ lọc/ }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Lọc theo thao tác")).toBeInTheDocument();
    expect(screen.getByLabelText("Lọc theo kết quả")).toBeInTheDocument();
    expect(screen.getByLabelText("Lọc theo máy in")).toBeInTheDocument();

    const sliceTab = screen.getByRole("tab", { name: /Dạng hộp/ });
    await user.click(sliceTab);
    expect(sliceTab).toHaveAttribute("aria-selected", "true");
    // Sang Lát cắt thì lưới bộ lọc thu lại, chừa nút bung lại.
    expect(
      await screen.findByRole("button", { name: "Hiện bộ lọc" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Xem vết kiểm chứng/ }),
    ).toHaveLength(4);
  });

  it("mở hộp thoại audit của đúng nhãn kèm bản lưu bất biến", async () => {
    const user = userEvent.setup();
    renderReport();

    await screen.findByRole("table");
    await user.click(
      screen.getAllByRole("button", { name: /Xem vết kiểm chứng/ })[0],
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Bản lưu bất biến")).toBeInTheDocument();
    expect(within(dialog).getByText("v2")).toBeInTheDocument();
    // Không còn ô "Mã bản lưu" in định danh nội bộ của bản lưu.
    expect(within(dialog).queryByText("Mã bản lưu")).not.toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(LABEL_1);
    expect(within(dialog).getByText("SKU-A x2, SKU-B x1")).toBeInTheDocument();
    expect(within(dialog).getByText("Đại lý An Phát")).toBeInTheDocument();
    // Lịch sử attempt chỉ của ĐÚNG nhãn đã mở (LS-1 có 2 lần in).
    expect(
      within(dialog).getByText("Lịch sử lần thử của nhãn"),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByText("In lại")).toHaveLength(1);
    expect(
      within(dialog).getByText("Nhãn đầu bị nhòe khi dán"),
    ).toBeInTheDocument();
  });

  /**
   * Người dùng báo lỗi 2026-09-06: cột "Lỗi / lý do" in nguyên mã máy in
   * (PRINTER_JAMMED / PAPER_JAM) giữa màn tiếng Việt. Khoá cả hai chỗ hiển
   * thị — bảng chính và hộp thoại kiểm chứng — để mã thô không quay lại.
   */
  it("dịch mã lỗi máy in sang tiếng Việt, không in mã thô ra bảng", async () => {
    const user = userEvent.setup();
    renderReport();

    const table = await screen.findByRole("table");
    expect(table).not.toHaveTextContent("PAPER_OUT");

    const failedRow = within(table)
      .getAllByRole("row")
      .find((row) => row.textContent?.includes("Máy in hết giấy nhãn"));
    await user.click(
      within(failedRow!).getByRole("button", { name: /Xem vết kiểm chứng/ }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText("Máy in hết giấy"),
    ).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("PAPER_OUT");
  });

  it("dịch trạng thái bản lưu của BE thay vì in enum PRINTED", async () => {
    const user = userEvent.setup();
    renderReport();

    await screen.findByRole("table");
    await user.click(
      screen.getAllByRole("button", { name: /Xem vết kiểm chứng/ })[0],
    );

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Đã in")).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("PRINTED");
  });

  it("hai nút xuất mở theo quyền REPORT_EXPORT", async () => {
    renderReport();

    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: /Xuất XLSX/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Xuất PDF/ })).toBeEnabled();
  });
});
