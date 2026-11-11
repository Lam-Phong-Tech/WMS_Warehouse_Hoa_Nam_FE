import dayjs from "dayjs";
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
import {
  act,
  fireEvent,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
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
  AlignedOutboundDetailModal: ({ documentId }: { documentId: string }) => (
    <div data-testid="outbound-source-id">{documentId}</div>
  ),
}));

import { http } from "@/shared/api/http";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";
import PackingLabelPrintReport from "./PackingLabelPrintReport";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";

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
      recipient_name: "Đại lý An Phát",
      items: [
        { sku_code: "SKU-A", sku_name: "Máy khoan", quantity: 2 },
        { sku_code: "SKU-B", quantity: 1 },
      ],
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
      recipient_name: "Công ty Tân Phát",
      items: [{ sku_code: "SKU-C", quantity: 1 }],
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
    act(() => useLanguageStore.getState().setLanguage("vi"));
    cleanupTestState();
  });

  it("switches the report, filters, status counts and open drawer from Vietnamese to English", async () => {
    const user = userEvent.setup();
    renderReport();
    expect(
      await screen.findByRole("heading", {
        name: "Báo cáo nhãn đóng gói – In / In lại",
      }),
    ).toBeInTheDocument();
    await screen.findByText("4 lượt in trong kỳ");
    await act(async () => {
      await ensureEnglishMessages();
      useLanguageStore.getState().setLanguage("en");
    });

    expect(
      screen.getByRole("heading", {
        name: "Packing label report – Print / Reprint",
      }),
    ).toBeInTheDocument();
    const kpis = screen.getByRole("region", {
      name: "Label printing overview",
    });
    for (const text of [
      "Unique labels",
      "4 print attempts in period",
      "75% of all print attempts",
      "Check the printer response",
      "Keep the label code and content",
    ]) {
      expect(kpis).toHaveTextContent(text);
    }
    const health = screen.getByRole("region", {
      name: "Label printing status",
    });
    for (const text of ["3 successful", "1 failed", "0 undetermined"]) {
      expect(within(health).getByText(text)).toBeInTheDocument();
    }
    expect(
      within(health).getByLabelText("3 successful, 1 failed, 0 undetermined"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Print attempts 4" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Labels 2" })).toBeInTheDocument();
    expect(screen.getByText(/Latest attempt:/)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "Search label code, outbound, SKU, recipient…",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveTextContent(
      "Result: AllResult: SuccessfulResult: FailedResult: Undetermined",
    );
    expect(screen.getByRole("combobox", { name: "Printer" })).toHaveTextContent(
      "Printer: All",
    );
    const filtersButton = screen.getByRole("button", { name: "Filters" });
    expect(filtersButton).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("combobox", { name: "Operator" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Print attempt type" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Label creation period:.*Vietnam time/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Refresh" }),
    ).not.toBeInTheDocument();

    await user.click(filtersButton);
    expect(filtersButton).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("combobox", { name: "Operator" }),
    ).toHaveTextContent("Printed by: All");
    expect(
      screen.getByRole("combobox", { name: "Print attempt type" }),
    ).toHaveTextContent("Attempt type: First print / retry");

    const table = screen.getByRole("table");
    for (const name of [
      "#",
      "Label / Outbound",
      "SKU / Recipient",
      "Time ↓",
      "Result",
      "Actions",
    ]) {
      expect(
        within(table).getByRole("columnheader", { name }),
      ).toBeInTheDocument();
    }
    const bodyRows = within(table).getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getAllByRole("cell")[0]).toHaveTextContent("1");
    expect(within(table).getByText("Print failed")).toBeInTheDocument();
    expect(within(table).getAllByText("First print / retry")).toHaveLength(3);
    expect(within(table).getAllByText("Đại lý An Phát")).toHaveLength(2);
    expect(
      within(table).getByText("Nhãn đầu bị nhòe khi dán"),
    ).toBeInTheDocument();

    await user.click(
      within(table).getAllByRole("button", { name: /View label details/ })[0],
    );
    const detail = await screen.findByTestId("packing-label-detail");
    expect(detail).toHaveTextContent("Packing label information");
    expect(detail).toHaveTextContent("Snapshot statusPrinted");
    expect(
      await within(detail).findByRole("heading", {
        name: "Label print history",
      }),
    ).toBeInTheDocument();
    expect(
      within(detail).getByRole("button", { name: "Preview label" }),
    ).toBeInTheDocument();
    expect(detail).toHaveTextContent("Máy khoan");
    expect(detail).toHaveTextContent("Nhãn đầu bị nhòe khi dán");
    await user.click(
      within(detail).getByRole("button", { name: "Preview label" }),
    );
    const preview = await screen.findByTestId("packing-label-preview");
    expect(
      within(preview).getByRole("heading", { name: "PACKING LABEL" }),
    ).toBeInTheDocument();
    expect(
      within(preview).getByRole("combobox", { name: "Zoom label preview" }),
    ).toHaveTextContent("Fit to frame");
    expect(preview).toHaveTextContent("Total: 2 SKUs / 3 items");
    await user.click(
      within(preview).getByRole("button", { name: "Back to label details" }),
    );
    await act(async () => useLanguageStore.getState().setLanguage("vi"));
    expect(
      within(screen.getByTestId("packing-label-detail")).getByRole("heading", {
        name: "Thông tin nhãn đóng gói",
      }),
    ).toBeInTheDocument();
  });

  it("tự áp dụng khoảng ngày khi chọn mà không cần nút Áp dụng", async () => {
    renderReport();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Từ ngày" }));
    fireEvent.click(await screen.findByRole("button", { name: "Hôm qua" }));
    const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
    await waitFor(() =>
      expect(http.get).toHaveBeenCalledWith(
        "/reports/label-log",
        expect.objectContaining({
          params: expect.objectContaining({
            from_date: yesterday,
            to_date: yesterday,
          }),
        }),
      ),
    );
  });

  it("localizes labels with no attempts and preserves their ready-to-print status", async () => {
    vi.mocked(http.get).mockResolvedValue({
      rows: [{ id: "ready", label_code: "PL-READY", status: "READY_TO_PRINT" }],
    } as never);
    vi.mocked(http.getPage).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, total: 0 },
    } as never);
    renderReport();
    await screen.findByRole("heading", { name: "Chưa có lượt in trong kỳ" });
    await act(async () => {
      await ensureEnglishMessages();
      useLanguageStore.getState().setLanguage("en");
    });
    expect(
      screen.getByRole("heading", { name: "No print attempts in period" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Try a different keyword or date range."),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Labels 1" }));
    const table = screen.getByRole("table");
    for (const text of [
      "No SKU content",
      "No recipient",
      "No print attempts",
      "Awaiting first print",
      "Ready to print",
    ]) {
      expect(within(table).getByText(text)).toBeInTheDocument();
    }
  });

  it("dựng một dòng cho mỗi lần in, ghép đủ nhãn / máy in / người thao tác", async () => {
    renderReport();

    expect(
      await screen.findByTestId("rpt-tab-packing-label"),
    ).toBeInTheDocument();

    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(6);
    for (const name of ["Máy in / Người in", "Lượt in"]) {
      expect(
        within(table).queryByRole("columnheader", { name }),
      ).not.toBeInTheDocument();
    }
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
    await user.click(
      within(table).getAllByRole("button", { name: /Xem chi tiết nhãn/ })[0],
    );
    const detail = await screen.findByTestId("packing-label-detail");
    expect(within(detail).getAllByText("PRN-01 · Zebra ZD421")).toHaveLength(1);
    expect(within(detail).getAllByText("Nguyễn Kho Vận")).toHaveLength(1);
    expect(detail).toHaveTextContent("Máy in");
    expect(detail).toHaveTextContent("Người in");
    expect(detail).toHaveTextContent("Lượt in");
    expect(
      within(detail).getAllByText("Nhãn đầu bị nhòe khi dán").length,
    ).toBeGreaterThan(0);
    expect(within(detail).getAllByText("In lại").length).toBeGreaterThan(0);
  });

  it("tổng quan tính trên đúng tập dòng đang hiển thị", async () => {
    renderReport();

    const kpis = await screen.findByLabelText("Tổng quan in nhãn", {
      selector: "section",
    });
    expect(await within(kpis).findByText("2")).toBeInTheDocument(); // nhãn duy nhất
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
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Trạng thái" }),
      "PRINT_FAILED",
    );
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByText("Lỗi in")).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Trạng thái" }),
      "",
    );
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
    expect(within(detail).getByText("SKU-A")).toBeInTheDocument();
    expect(
      within(detail).getAllByText("Nhãn đầu bị nhòe khi dán")[0],
    ).toBeInTheDocument();
  });

  it("mở trang chi tiết và bản xem trước từ đúng bản lưu nhãn", async () => {
    const user = userEvent.setup();
    vi.mocked(http.get).mockImplementation(async (url: unknown) =>
      String(url) === "/reports/label-log"
        ? ({
            rows: LABEL_LOG_ROWS.map((row) => ({
              ...row,
              outbound_date: "2026-10-29",
              created_at: "2026-10-29 08:00:00",
            })),
            summary: {},
          } as never)
        : ((PAYLOAD[String(url)] ?? { rows: [] }) as never),
    );
    renderReport();
    await screen.findAllByText("PL-PX-0001");

    await user.click(
      screen.getAllByRole("button", { name: /Xem chi tiết nhãn/ })[0],
    );
    expect(
      await screen.findByRole("dialog", { name: /^Chi tiết nhãn đóng gói/ }),
    ).toBeInTheDocument();
    expect(http.get).toHaveBeenCalledWith("/label-snapshots/ls-1");
    expect(
      within(screen.getByTestId("packing-label-detail")).getByText("SKU-A"),
    ).toBeInTheDocument();
    expect(screen.getByText("Lịch sử in nhãn")).toBeInTheDocument();
    expect(screen.getByTestId("packing-label-detail")).not.toHaveTextContent(
      "Công ty Tân Phát",
    );
    const detail = within(screen.getByTestId("packing-label-detail"));
    expect(detail.getAllByText("PL-PX-0001")).toHaveLength(1);
    expect(detail.getAllByText("PX-0001")).toHaveLength(1);
    expect(
      detail.queryByText("Chi tiết lượt in đang xem"),
    ).not.toBeInTheDocument();
    expect(detail.getAllByText("Nhãn đầu bị nhòe khi dán")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Xem trước nhãn" }));
    expect(
      await screen.findByRole("dialog", { name: /^Xem trước nhãn/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("100 mm")).toBeInTheDocument();
    expect(screen.getByText("150 mm")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("packing-label-preview")).getAllByText(
        "PL-PX-0001",
      ),
    ).toHaveLength(1);
    expect(
      within(screen.getByTestId("packing-label-preview")).queryByText(
        "Lịch sử in nhãn",
      ),
    ).not.toBeInTheDocument();
  });

  it("mở phiếu xuất nguồn từ ID của bản lưu nhãn", async () => {
    const user = userEvent.setup();
    renderReport();
    await screen.findAllByRole("button", { name: /Xem chi tiết nhãn/ });
    await user.click(
      screen.getAllByRole("button", { name: /Xem chi tiết nhãn/ })[0],
    );
    await screen.findByTestId("packing-label-detail");
    await user.click(
      await screen.findByRole("button", { name: "Mở phiếu xuất" }),
    );
    expect(await screen.findByTestId("outbound-source-id")).toHaveTextContent(
      "outbound-1",
    );
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
      (await within(dialog).findAllByText("Máy in hết giấy nhãn"))[0],
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

  it("cho chọn xuất báo cáo sau khi dữ liệu và quyền REPORT_EXPORT đã sẵn sàng", async () => {
    const user = userEvent.setup();
    renderReport();
    expect(screen.getByRole("button", { name: /Xuất báo cáo/ })).toBeDisabled();
    await screen.findAllByRole("button", { name: /Xem chi tiết nhãn/ });
    const trigger = screen.getByRole("button", { name: /Xuất báo cáo/ });
    expect(trigger).toBeEnabled();
    await user.click(trigger);
    expect(
      await screen.findByRole("radio", { name: /Tất cả kết quả/ }),
    ).toBeChecked();
    expect(http.post).not.toHaveBeenCalled();
  });
  it("groups attempts into unique labels and preserves labels that have never been printed", async () => {
    vi.mocked(http.get).mockImplementation(async (url: unknown) =>
      String(url) === "/reports/label-log"
        ? ({
            rows: [
              ...LABEL_LOG_ROWS,
              {
                id: "ls-empty",
                label_code: "PL-READY",
                outbound_no: "PX-READY",
                status: "READY_TO_PRINT",
                sku_summary: "SKU-D x1",
              },
            ],
          } as never)
        : ((PAYLOAD[String(url)] ?? {}) as never),
    );
    const user = userEvent.setup();
    renderReport();
    await screen.findAllByText("PL-PX-0001");
    await user.click(screen.getByRole("tab", { name: /Nhãn/ }));
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getAllByText("PL-PX-0001")).toHaveLength(1);
    expect(within(table).getByText("PL-READY")).toBeInTheDocument();
  });
  it("filters by printer and clears the filter without losing rows", async () => {
    const user = userEvent.setup();
    renderReport();
    await screen.findAllByText("PL-PX-0001");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Máy in" }),
      PRINTER_B,
    );
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      3,
    );
    await user.click(screen.getAllByRole("button", { name: "Xóa lọc" })[0]);
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      5,
    );
  });
  it("blocks preview and print when immutable payload lacks mandatory fields", async () => {
    vi.mocked(http.get).mockImplementation(async (url: unknown) =>
      String(url) === "/label-snapshots/ls-1"
        ? ({
            ...(PAYLOAD[String(url)] as object),
            label_payload: { label_code: "PL-PX-0001", outbound_no: "PX-0001" },
          } as never)
        : ((PAYLOAD[String(url)] ?? {}) as never),
    );
    const user = userEvent.setup();
    renderReport();
    await user.click(
      (await screen.findAllByRole("button", { name: /Xem chi tiết nhãn/ }))[0],
    );
    const detail = await screen.findByTestId("packing-label-detail");
    expect(within(detail).getByText("Nơi nhận")).toBeInTheDocument();
    expect(
      await within(detail).findByRole("button", { name: "Xem trước nhãn" }),
    ).toBeDisabled();
    expect(
      within(detail).getByRole("button", { name: "In nhãn" }),
    ).toBeDisabled();
    await act(async () => {
      await ensureEnglishMessages();
      useLanguageStore.getState().setLanguage("en");
    });
    expect(within(detail).getByText("Recipient")).toBeInTheDocument();
    expect(within(detail).getByText("SKU / quantity")).toBeInTheDocument();
    expect(
      within(detail).getByRole("heading", { name: "Data validation errors" }),
    ).toBeInTheDocument();
    expect(
      within(detail).getByRole("button", { name: "Preview label" }),
    ).toBeDisabled();
  });
  it("preserves filters when loading fails and retries the same period", async () => {
    vi.mocked(http.get).mockRejectedValue(new Error("report unavailable"));
    renderReport();
    expect(
      await screen.findByText(
        "Chưa thể tải lịch sử in",
        {},
        { timeout: 10000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Xuất báo cáo" })).toBeDisabled();
    await act(async () => {
      await ensureEnglishMessages();
      useLanguageStore.getState().setLanguage("en");
    });
    expect(
      screen.getByRole("heading", { name: "Unable to load print history" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Filters are preserved. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });
  it("confirms aggregate export scope and includes every selected filter", async () => {
    const user = userEvent.setup();
    renderReport();
    await screen.findAllByText("PL-PX-0001");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Máy in" }),
      PRINTER_A,
    );
    await user.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
    const dialog = screen.getByRole("dialog", {
      name: /^Xuất báo cáo nhãn đóng gói/,
    });
    expect(
      await within(dialog).findByText(/Tổng hợp theo nhãn/),
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Zebra ZD421");
    expect(
      within(dialog).getByRole("button", { name: /Tải|Xuất/ }),
    ).toBeEnabled();
  });
});
