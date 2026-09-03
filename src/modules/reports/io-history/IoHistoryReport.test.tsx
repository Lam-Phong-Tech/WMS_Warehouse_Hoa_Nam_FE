/**
 * RPT-IO-01 "Lịch sử nhập – xuất kho" — bản port 1:1 mockup 8.3 chạy trên
 * endpoint thật `/reports/document-history` + `/reversal-documents` +
 * `/reports/inventory-ledger`.
 *
 * File này khóa những gì typecheck không bắt được:
 *  · ba nguồn được ghép thành đúng ba loại chứng từ của mockup;
 *  · DẤU của "Qty posted" lấy từ sổ movement, và dòng không xác định được dấu
 *    thì hiện "Chưa có" chứ không bị cộng vào KPI;
 *  · bốn thẻ KPI, bộ lọc loại chứng từ, ô tìm nhanh và nút "Đặt lại" thật sự
 *    đổi tập dòng;
 *  · hai tab Bảng / Lát cắt và hộp thoại đối soát mở đúng chứng từ đã bấm.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import dayjs from "dayjs";
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

function renderReport() {
  renderWithProviders(<IoHistoryReport />, [ROUTES.REPORTS_PENDING_EVIDENCE]);
}

/** Các dòng dữ liệu của bảng (bỏ hàng tiêu đề). */
async function bodyRows() {
  const table = await screen.findByRole("table");
  return within(table).getAllByRole("row").slice(1);
}

describe("RPT-IO-01 · Lịch sử nhập – xuất kho", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.get).mockImplementation(
      async (url: unknown) =>
        (String(url) === "/reports/inventory-ledger"
          ? LEDGER
          : { rows: [] }) as never,
    );
    vi.mocked(http.getPage).mockImplementation(async (url: unknown) => {
      const key = String(url);
      if (key === "/reports/document-history") {
        return {
          data: DOCUMENTS as never,
          meta: { timestamp: `${TODAY}T12:24:00+07:00` },
        };
      }
      if (key === "/reversal-documents") {
        return {
          data: REVERSALS as never,
          meta: { current_page: 1, last_page: 1, total: REVERSALS.length },
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
    renderReport();
    await screen.findByText("IN-2026-00031");

    const rows = await bodyRows();
    expect(rows).toHaveLength(4);
    // Sắp theo posted_at giảm dần: 12:40 → 11:15 → 10:20 → 09:02.
    expect(within(rows[0]).getByText("REV-2026-00008")).toBeInTheDocument();
    expect(within(rows[1]).getByText("REV-2026-00007")).toBeInTheDocument();
    expect(within(rows[2]).getByText("OUT-2026-00018")).toBeInTheDocument();
    expect(within(rows[3]).getByText("IN-2026-00031")).toBeInTheDocument();

    // Phòng ban lấy từ danh bạ người dùng, không suy từ loại chứng từ.
    expect(within(rows[3]).getByText("Kho nhập")).toBeInTheDocument();
  });

  it("không in UUID thô: actor hoàn tác ra tên, movement ra mã MV-…", async () => {
    renderReport();
    await screen.findByText("IN-2026-00031");
    const rows = await bodyRows();

    // Phiếu hoàn tác chỉ có posted_by = UUID ⇒ tra danh bạ ra "Lê Chi" + phòng ban.
    expect(within(rows[1]).getByText("Lê Chi")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Kho xuất")).toBeInTheDocument();
    // Cột Movement là MÃ nghiệp vụ, không phải id rút gọn.
    expect(within(rows[3]).getAllByText("MV-20260903-0001")).toHaveLength(2);
    // Không một ô nào trên trang chứa chuỗi dạng UUID.
    expect(document.body.textContent).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/iu,
    );
  });

  it("lấy dấu Qty posted từ sổ movement; không có dấu thì để trống", async () => {
    renderReport();
    await screen.findByText("IN-2026-00031");
    const rows = await bodyRows();

    expect(within(rows[3]).getByText("+120")).toBeInTheDocument();
    expect(within(rows[2]).getByText("−18")).toBeInTheDocument();
    expect(within(rows[1]).getByText("+2")).toBeInTheDocument();
    // REV-…08 chưa có movement và không truy được chứng từ gốc ⇒ "Chưa có"
    // ở ĐÚNG ô "Qty posted" (cột thứ 6; các ô khác của dòng cũng đang rỗng).
    expect(within(rows[0]).getAllByRole("cell")[5]).toHaveTextContent(
      "Chưa có",
    );
  });

  it("bốn thẻ KPI chỉ cộng những dòng có dấu xác định", async () => {
    renderReport();
    await screen.findByText("IN-2026-00031");

    expect(screen.getByText("120 đơn vị tăng")).toBeInTheDocument();
    expect(screen.getByText("18 đơn vị giảm")).toBeInTheDocument();
    // Hai phiếu hoàn tác nhưng chỉ một phiếu có dấu ⇒ 2 đơn vị.
    expect(screen.getByText("2 đơn vị đã xác định dấu")).toBeInTheDocument();
    // Ảnh hưởng ròng = 120 − 18 + 2 = 104 (bỏ qua phiếu chưa xác định dấu).
    expect(screen.getByText("+104")).toBeInTheDocument();
  });

  it("lọc loại chứng từ rồi Đặt lại đưa bảng về đủ bốn dòng", async () => {
    const user = userEvent.setup();
    renderReport();
    await screen.findByText("IN-2026-00031");

    await user.click(screen.getByRole("combobox", { name: /Loại chứng từ/ }));
    await user.click(screen.getByRole("option", { name: "Nhập kho" }));

    expect(await bodyRows()).toHaveLength(1);
    expect(screen.getByText("IN-2026-00031")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Đặt lại/ }));
    await screen.findByText("REV-2026-00008");
    expect(await bodyRows()).toHaveLength(4);
  });

  it("ô Tìm nhanh lọc theo mã phiếu / người thực hiện / nơi nhận", async () => {
    const user = userEvent.setup();
    renderReport();
    await screen.findByText("IN-2026-00031");

    await user.type(
      screen.getByLabelText("Tìm lịch sử nhập xuất"),
      "Đại lý Quận 7",
    );

    const rows = await bodyRows();
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("OUT-2026-00018")).toBeInTheDocument();
  });

  it("tab Lát cắt gom phiếu gốc với hoàn tác cùng chứng từ tham chiếu", async () => {
    const user = userEvent.setup();
    renderReport();
    await screen.findByText("IN-2026-00031");

    await user.click(screen.getByRole("tab", { name: /Dạng hộp/ }));

    // Chỉ hai phiếu nguồn (nhập + xuất); phiếu hoàn tác không tự thành lát cắt.
    const slices = await screen.findAllByRole("button", { name: "Đối soát" });
    expect(slices).toHaveLength(2);
    // OUT-…18 có một hoàn tác 2 đơn vị ⇒ 2 mốc nghiệp vụ, thuần −16.
    expect(screen.getByText("2 mốc nghiệp vụ")).toBeInTheDocument();
    expect(screen.getByText("−16")).toBeInTheDocument();

    // Sang lát cắt thì bộ lọc thu lại, để lộ dải "Bộ lọc đang áp dụng".
    expect(screen.getByText("Bộ lọc đang áp dụng")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Hiện bộ lọc/ }));
    expect(screen.queryByText("Bộ lọc đang áp dụng")).not.toBeInTheDocument();
  });

  it("bấm Xem mở hộp thoại đối soát đúng chứng từ, Escape đóng lại", async () => {
    const user = userEvent.setup();
    renderReport();
    await screen.findByText("IN-2026-00031");

    const rows = await bodyRows();
    await user.click(within(rows[2]).getByRole("button", { name: "Xem" }));

    const dialog = await screen.findByRole("dialog", {
      name: "OUT-2026-00018",
    });
    // Đối soát: tổng 18, hoàn tác 2, ảnh hưởng ròng −16.
    expect(within(dialog).getByText("18")).toBeInTheDocument();
    expect(within(dialog).getByText("−16")).toBeInTheDocument();
    expect(
      within(dialog).getByText("HN-MK-001-V1 · Máy Hoa Nam"),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
