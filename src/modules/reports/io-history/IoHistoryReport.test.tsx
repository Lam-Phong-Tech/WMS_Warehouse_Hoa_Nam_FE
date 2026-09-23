/**
 * RPT-08 "Lịch sử nhập – xuất kho" — giao diện SystemHNWeb chạy trên
 * endpoint thật `/reports/document-history` + `/reversal-documents` +
 * `/reports/inventory-ledger`.
 *
 * File này khóa những gì typecheck không bắt được:
 *  · ba nguồn được ghép thành đúng ba loại chứng từ của mockup;
 *  · DẤU của "Qty posted" lấy từ sổ movement, và dòng không xác định được dấu
 *    thì hiện "Chưa có" chứ không bị cộng vào KPI;
 *  · tổng quan, bộ lọc loại chứng từ, ô tìm nhanh và nút "Đặt lại" thật sự
 *    đổi tập dòng;
 *  · hai tab Bảng / Lát cắt và hộp thoại đối soát mở đúng chứng từ đã bấm.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import dayjs from "dayjs";
import { ThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
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

vi.mock("@/modules/reports/operations/report-export", () => ({
  runReportExport: vi.fn(),
}));

import { runReportExport } from "@/modules/reports/operations/report-export";
import { http } from "@/shared/api/http";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";
import IoHistoryReport from "./IoHistoryReport";

/**
 * Mọi mốc thời gian nằm trong kỳ mặc định ("Tháng này" = đầu tháng → hôm nay),
 * nếu không bộ lọc ngày sẽ loại hết dòng và bài test đo nhầm thứ khác.
 */
const TODAY = dayjs().format("YYYY-MM-DD");

const DOCUMENTS = {
  rows: [
    {
      id: "doc-in-1",
      document_no: "IN-2026-00031",
      doc_type: "INBOUND",
      status: "POSTED",
      counterpart: "Nhà cung cấp Hoa Nam",
      document_date: TODAY,
      posted_at: `${TODAY} 09:02:00`,
      created_by_name: "Nguyễn An",
      lines: [
        {
          product_code: "HN-MK-001-V1",
          product_name: "Máy Hoa Nam",
          posted_qty: 120,
        },
      ],
    },
    {
      id: "doc-out-1",
      document_no: "OUT-2026-00018",
      doc_type: "OUTBOUND",
      status: "POSTED",
      counterpart: "Đại lý Quận 7",
      document_date: TODAY,
      posted_at: `${TODAY} 10:20:00`,
      created_by_name: "Lê Chi",
      lines: [
        {
          product_code: "HN-MK-001-V1",
          product_name: "Máy Hoa Nam",
          posted_qty: 18,
        },
      ],
    },
  ],
};

const REVERSALS = [
  {
    id: "rev-1",
    reversal_code: "REV-2026-00007",
    status: "POSTED",
    reference_document_code: "OUT-2026-00018",
    reference_document_type: "OUTBOUND",
    reversed_at: `${TODAY} 11:15:00`,
    created_at: `${TODAY} 11:01:00`,
    total_qty: 2,
    warehouse_name: "Kho Hà Nội",
    // BE trả posted_by là UUID (chỉ join created_by_name) — màn phải tra ra tên.
    posted_by: "u-2",
    created_by: "u-2",
  },
  {
    // Phiếu hoàn tác KHÔNG truy được loại chứng từ gốc và chưa có movement ⇒
    // dấu không xác định. Phải hiện "Chưa có" và không được cộng vào KPI.
    id: "rev-2",
    reversal_code: "REV-2026-00008",
    status: "POSTED",
    reference_document_code: "",
    reference_document_type: "",
    reversed_at: `${TODAY} 12:40:00`,
    created_at: `${TODAY} 12:30:00`,
    total_qty: 9,
    warehouse_name: "Kho Hà Nội",
    posted_by: "u-2",
    created_by: "u-2",
  },
];

const LEDGER = {
  rows: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      movement_no: "MV-20260903-0001",
      occurred_at: `${TODAY} 09:02:00`,
      movement_type: "RECEIPT",
      product_code: "HN-MK-001-V1",
      qty_delta: 120,
      source_id: "doc-in-1",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      movement_no: "MV-20260903-0002",
      occurred_at: `${TODAY} 10:20:00`,
      movement_type: "ISSUE",
      product_code: "HN-MK-001-V1",
      qty_delta: -18,
      source_id: "doc-out-1",
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      movement_no: "MV-20260903-0003",
      occurred_at: `${TODAY} 11:15:00`,
      movement_type: "REVERSAL",
      product_code: "HN-MK-001-V1",
      qty_delta: 2,
      source_id: "rev-1",
      original_movement_id: "22222222-2222-4222-8222-222222222222",
    },
  ],
};

const USERS = [
  { id: "u-1", display_name: "Nguyễn An", department_name: "Kho nhập" },
  { id: "u-2", display_name: "Lê Chi", department_name: "Kho xuất" },
];

let documents = DOCUMENTS.rows;
let reversals = REVERSALS;
let ledger = LEDGER;
let reversalError: unknown = null;

function renderReport() {
  renderWithProviders(
    <ThemeProvider theme={muiTheme}>
      <IoHistoryReport />
    </ThemeProvider>,
    [ROUTES.REPORTS_PENDING_EVIDENCE],
  );
}

async function bodyRows() {
  const table = await screen.findByRole("table");
  return within(table).getAllByRole("row").slice(1);
}

async function openDetailControls(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Chế độ xem & bộ lọc chi tiết"));
}

describe("RPT-IO-01 · Lịch sử nhập – xuất kho", () => {
  beforeEach(() => {
    documents = DOCUMENTS.rows;
    reversals = REVERSALS;
    ledger = LEDGER;
    reversalError = null;
    vi.mocked(runReportExport).mockReset().mockResolvedValue(2);
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.get).mockImplementation(
      async (url: unknown) =>
        (String(url) === "/reports/inventory-ledger"
          ? ledger
          : { rows: [] }) as never,
    );
    vi.mocked(http.getPage).mockImplementation(async (url: unknown) => {
      const key = String(url);
      if (key === "/reports/document-history") {
        return {
          data: { rows: documents } as never,
          meta: { timestamp: `${TODAY}T12:24:00+07:00` },
        };
      }
      if (key === "/reversal-documents") {
        if (reversalError) throw reversalError;
        return {
          data: reversals as never,
          meta: { current_page: 1, last_page: 1, total: reversals.length },
        };
      }
      if (key === "/users") {
        return {
          data: USERS as never,
          meta: { current_page: 1, last_page: 1, total: USERS.length },
        };
      }
      return {
        data: [] as never,
        meta: { current_page: 1, last_page: 1, total: 0 },
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

  it("ghép ba nguồn thành đủ ba loại chứng từ, mới nhất trước", async () => {
    const user = userEvent.setup();
    renderReport();
    const rows = await bodyRows();
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("REV-2026-00008");
    expect(rows[1]).toHaveTextContent("REV-2026-00007");
    expect(rows[2]).toHaveTextContent("OUT-2026-00018");
    expect(rows[3]).toHaveTextContent("IN-2026-00031");
    // Department remains reachable in document details after compacting the table.
    await user.click(within(rows[3]).getByRole("button", { name: "Xem" }));
    const dialog = await screen.findByRole("dialog", { name: "IN-2026-00031" });
    expect(
      within(dialog).getByText("Nguyễn An · Kho nhập"),
    ).toBeInTheDocument();
  });

  it("không in UUID thô: actor hoàn tác ra tên, movement ra mã MV-…", async () => {
    const user = userEvent.setup();
    renderReport();
    const rows = await bodyRows();
    expect(within(rows[1]).getByText("Lê Chi")).toBeInTheDocument();
    await user.click(within(rows[1]).getByRole("button", { name: "Xem" }));
    const reversalDialog = await screen.findByRole("dialog", {
      name: "REV-2026-00007",
    });
    expect(
      within(reversalDialog).getByText("Lê Chi · Kho xuất"),
    ).toBeInTheDocument();
    expect(
      within(reversalDialog).getByText("MV-20260903-0003"),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/iu,
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(reversalDialog).not.toBeInTheDocument());
    await user.click(within(rows[3]).getByRole("button", { name: "Xem" }));
    const inboundDialog = await screen.findByRole("dialog", {
      name: "IN-2026-00031",
    });
    expect(
      within(inboundDialog).getByText("MV-20260903-0001"),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/iu,
    );
  });

  it("lấy dấu Qty posted từ sổ movement; không có dấu thì để trống", async () => {
    renderReport();
    const rows = await bodyRows();
    expect(within(rows[3]).getByText("+120")).toBeInTheDocument();
    expect(within(rows[2]).getByText("−18")).toBeInTheDocument();
    expect(within(rows[1]).getByText("+2")).toBeInTheDocument();
    expect(within(rows[0]).getAllByRole("cell")[4]).toHaveTextContent(
      "Chưa có",
    );
  });

  it("tổng quan chỉ cộng những dòng có dấu xác định", async () => {
    renderReport();
    await bodyRows();
    expect(screen.getByText("120 đơn vị tăng")).toBeInTheDocument();
    expect(screen.getByText("18 đơn vị giảm")).toBeInTheDocument();
    expect(screen.getByText("2 đơn vị đã xác định dấu")).toBeInTheDocument();
    expect(screen.getByText("+104")).toBeInTheDocument();
  });

  it("giữ tổng hoàn tác có dấu khi hai phiếu hoàn tác ngược chiều nhau", async () => {
    reversals = [
      ...REVERSALS,
      {
        ...REVERSALS[0],
        id: "rev-3",
        reversal_code: "REV-2026-00009",
        reference_document_code: "IN-2026-00031",
        reference_document_type: "INBOUND",
        total_qty: 5,
        reversed_at: `${TODAY} 13:00:00`,
      },
    ];
    ledger = {
      rows: [
        ...LEDGER.rows,
        {
          ...LEDGER.rows[2],
          source_id: "rev-3",
          movement_no: "MV-20260903-0004",
          qty_delta: -5,
        },
      ],
    };
    renderReport();
    await bodyRows();
    expect(screen.getByText("3 đơn vị đã xác định dấu")).toBeInTheDocument();
    expect(screen.getByText("+99")).toBeInTheDocument();
  });

  it("lọc loại chứng từ rồi Đặt lại đưa bảng về đủ bốn dòng", async () => {
    const user = userEvent.setup();
    renderReport();
    await bodyRows();
    await user.click(screen.getByRole("combobox", { name: /Loại chứng từ/ }));
    await user.click(await screen.findByRole("option", { name: "Nhập kho" }));
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
    expect(await bodyRows()).toHaveLength(1);
    expect((await bodyRows())[0]).toHaveTextContent("IN-2026-00031");
    await user.click(screen.getByRole("button", { name: /Đặt lại/ }));
    await waitFor(async () => expect(await bodyRows()).toHaveLength(4));
  });

  it("ô Tìm nhanh lọc theo mã phiếu / người thực hiện / nơi nhận", async () => {
    const user = userEvent.setup();
    renderReport();
    await bodyRows();
    await openDetailControls(user);
    await user.type(
      screen.getByLabelText("Tìm lịch sử nhập xuất"),
      "Đại lý Quận 7",
    );
    const rows = await bodyRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("OUT-2026-00018");
  });

  it("tab Lát cắt gom phiếu gốc với hoàn tác cùng chứng từ tham chiếu", async () => {
    const user = userEvent.setup();
    renderReport();
    await bodyRows();
    await openDetailControls(user);
    await user.click(screen.getByRole("tab", { name: /Dạng hộp/ }));
    expect(
      await screen.findAllByRole("button", { name: "Đối soát" }),
    ).toHaveLength(2);
    expect(screen.getByText("2 mốc nghiệp vụ")).toBeInTheDocument();
    expect(screen.getByText("−16")).toBeInTheDocument();
    expect(screen.getByText("Bộ lọc đang áp dụng")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Hiện bộ lọc/ }));
    expect(screen.queryByText("Bộ lọc đang áp dụng")).not.toBeInTheDocument();
  });

  it.each(["Escape", "nút đóng", "nền mờ"] as const)(
    "bấm Xem mở đúng đối soát; %s giữ nội dung khi đóng rồi trả focus và cuộn trang",
    async (closeMethod) => {
      const user = userEvent.setup();
      renderReport();
      const rows = await bodyRows();
      const opener = within(rows[2]).getByRole("button", { name: "Xem" });
      const originalOverflow = document.body.style.overflow;
      await user.click(opener);
      const dialog = await screen.findByRole("dialog", {
        name: "OUT-2026-00018",
      });
      expect(within(dialog).getByText("18")).toBeInTheDocument();
      expect(within(dialog).getByText("−16")).toBeInTheDocument();
      expect(
        within(dialog).getByText("HN-MK-001-V1 · Máy Hoa Nam"),
      ).toBeInTheDocument();
      expect(within(dialog).getByText("MV-20260903-0002")).toBeInTheDocument();
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(document.body.style.overflow).toBe("hidden");

      if (closeMethod === "Escape") {
        fireEvent.keyDown(dialog, { key: "Escape" });
      } else if (closeMethod === "nút đóng") {
        fireEvent.click(
          within(dialog).getByRole("button", { name: "Đóng chi tiết" }),
        );
      } else {
        // MUI's dialog container is the clickable area outside its paper.
        const backdropArea = dialog.parentElement!;
        fireEvent.mouseDown(backdropArea);
        fireEvent.click(backdropArea);
      }
      // The outgoing surface must retain its details throughout the transition.
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveTextContent("OUT-2026-00018");
      expect(dialog).toHaveTextContent("MV-20260903-0002");
      await waitFor(() => expect(dialog).not.toBeInTheDocument());
      expect(opener).toHaveFocus();
      expect(document.body.style.overflow).toBe(originalOverflow);
    },
  );
  it("phân trang 5 dòng nhưng giữ đủ snapshot và đưa về trang đầu khi lọc", async () => {
    documents = Array.from({ length: 8 }, (_, index) => ({
      ...DOCUMENTS.rows[0],
      id: `doc-many-${index + 1}`,
      document_no: `IN-MANY-${index + 1}`,
      posted_at: `${TODAY} 09:${String(index).padStart(2, "0")}:00`,
    }));
    reversals = [];
    const user = userEvent.setup();
    renderReport();
    expect(await bodyRows()).toHaveLength(5);
    expect(screen.getByText(/Hiển thị 1–5 \/ 8 giao dịch/)).toBeInTheDocument();
    const overview = screen.getByRole("region", { name: "Tổng quan vận hành" });
    expect(within(overview).getByText("+960")).toBeInTheDocument();
    const historyCalls = () =>
      vi
        .mocked(http.getPage)
        .mock.calls.filter(([url]) => url === "/reports/document-history");
    const callsBeforePage = historyCalls().length;
    await user.click(screen.getByRole("button", { name: "Trang tiếp" }));
    expect(await bodyRows()).toHaveLength(3);
    expect(screen.getByText(/Hiển thị 6–8 \/ 8 giao dịch/)).toBeInTheDocument();
    expect(historyCalls()).toHaveLength(callsBeforePage);
    expect(within(overview).getByText("+960")).toBeInTheDocument();
    await user.type(
      screen.getByPlaceholderText(
        "Mã phiếu, SKU, người thực hiện, nơi nhận...",
      ),
      "IN-MANY-8",
    );
    await waitFor(async () => expect(await bodyRows()).toHaveLength(1));
    expect((await bodyRows())[0]).toHaveTextContent("IN-MANY-8");
    expect(screen.getByRole("button", { name: "Trang 1" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const [, config] of historyCalls()) {
      expect(config?.params).not.toHaveProperty("page");
      expect(config?.params).not.toHaveProperty("per_page");
    }
  });

  it("xóa tìm kiếm không có kết quả khôi phục bảng mà không đổi tổng quan", async () => {
    const user = userEvent.setup();
    renderReport();
    await bodyRows();
    await user.type(
      screen.getByPlaceholderText(
        "Mã phiếu, SKU, người thực hiện, nơi nhận...",
      ),
      "SN-KHONG-TON-TAI",
    );
    const heading = await screen.findByRole("heading", {
      name: "Không tìm thấy kết quả",
    });
    expect(await bodyRows()).toHaveLength(0);
    expect(screen.getByText("+104")).toBeInTheDocument();
    await user.click(
      within(heading.parentElement!).getByRole("button", {
        name: "Xóa tìm kiếm",
      }),
    );
    expect(await bodyRows()).toHaveLength(4);
    expect(
      screen.getByPlaceholderText(
        "Mã phiếu, SKU, người thực hiện, nơi nhận...",
      ),
    ).toHaveValue("");
    expect(screen.getByText("+104")).toBeInTheDocument();
  });

  it.each([403, 404, 503])(
    "nguồn hoàn tác lỗi %i vẫn giữ các chứng từ đã tải thành công",
    async (status) => {
      reversalError = {
        isAxiosError: true,
        response: {
          status,
          data: { message: "Không tải được nguồn hoàn tác" },
        },
      };
      renderReport();
      const rows = await bodyRows();
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent("OUT-2026-00018");
      expect(rows[1]).toHaveTextContent("IN-2026-00031");
      expect(
        await screen.findByText("Dữ liệu có thể chưa mới nhất"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Bạn không có quyền truy cập"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Không tìm thấy trang"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Hệ thống đang gặp sự cố"),
      ).not.toBeInTheDocument();
    },
  );

  it("xuất XLSX giữ đúng khoảng ngày, loại và từ khóa báo cáo", async () => {
    const user = userEvent.setup();
    renderReport();
    await bodyRows();
    await user.click(screen.getByRole("combobox", { name: /Loại chứng từ/ }));
    await user.click(await screen.findByRole("option", { name: "Nhập kho" }));
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
    await openDetailControls(user);
    await user.type(
      screen.getByLabelText("Tìm lịch sử nhập xuất"),
      "IN-2026-00031",
    );
    await user.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
    await user.click(screen.getByRole("menuitem", { name: /Xuất XLSX/ }));
    await waitFor(() => expect(runReportExport).toHaveBeenCalledTimes(1));
    expect(runReportExport).toHaveBeenCalledWith(
      "xlsx",
      expect.objectContaining({
        reportCode: "document-history",
        filters: {
          from_date: dayjs().startOf("month").format("YYYY-MM-DD"),
          to_date: TODAY,
          doc_type: "inbound",
          status: "POSTED",
          keyword: "IN-2026-00031",
        },
      }),
    );
    expect(
      await screen.findByText("Đã xuất báo cáo thành công"),
    ).toBeInTheDocument();
  });

  it("lọc người thực hiện chỉ thu hẹp danh sách, giữ tổng quan và phạm vi xuất báo cáo", async () => {
    const user = userEvent.setup();
    renderReport();
    await bodyRows();
    await user.click(screen.getByRole("combobox", { name: "Người thực hiện" }));
    await user.click(await screen.findByRole("option", { name: "Nguyễn An" }));
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
    expect(await bodyRows()).toHaveLength(1);
    expect((await bodyRows())[0]).toHaveTextContent("IN-2026-00031");
    expect(screen.getByText("+104")).toBeInTheDocument();
    expect(
      screen.getByText(/Người thực hiện: chỉ lọc danh sách/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
    expect(
      screen.getByRole("menu", { name: "Xuất báo cáo" }),
    ).toHaveTextContent(
      "Tệp xuất dùng bộ lọc toàn báo cáo. Bộ lọc danh sách chỉ áp dụng cho bảng bên dưới.",
    );
    await user.click(screen.getByRole("menuitem", { name: /Xuất PDF/ }));
    await waitFor(() => expect(runReportExport).toHaveBeenCalledTimes(1));
    expect(runReportExport).toHaveBeenCalledWith(
      "pdf",
      expect.objectContaining({
        filters: {
          from_date: dayjs().startOf("month").format("YYYY-MM-DD"),
          to_date: TODAY,
          doc_type: "all",
          status: "POSTED",
        },
      }),
    );
  });

  it("READY luôn là xuất thành công, không suy diễn thiếu dữ liệu từ row_count", async () => {
    vi.mocked(runReportExport).mockResolvedValue(1);
    const user = userEvent.setup();
    renderReport();
    await bodyRows();
    await user.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
    await user.click(screen.getByRole("menuitem", { name: /Xuất XLSX/ }));
    expect(
      await screen.findByText("Đã xuất báo cáo thành công"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Báo cáo đã được xuất nhưng chưa đầy đủ"),
    ).not.toBeInTheDocument();
  });
});
