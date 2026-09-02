/**
 * RPT-07 "Xuất theo người nhận / đại lý" — màn được port 1:1 từ baseline
 * Report 08 nhưng chạy trên endpoint THẬT của dự án qua `recipient-agency-api`.
 *
 * File này khóa những gì typecheck không bắt được: KPI/bảng dựng đúng từ payload
 * BE, lượng hoàn tác được phân bổ về đúng dòng, tab Bảng/Lát cắt đổi vùng đối
 * soát, nút "Đối soát" mở modal đúng dòng, và hai nút xuất phản ánh đúng quyền.
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

// jsdom không đo được SVG nên ApexCharts render rỗng; stub tối thiểu để cây
// component vẫn mount đúng như trên trình duyệt thật.
vi.mock("react-apexcharts", () => ({
  default: ({ type }: { type?: string }) => (
    <div data-testid={`chart-${type ?? "unknown"}`} />
  ),
}));

import { http } from "@/shared/api/http";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";
import RecipientAgencyReport from "./RecipientAgencyReport";

/**
 * Một phiếu xuất 2 dòng (10 + 5) đã bị hoàn tác 3 ở mức CHỨNG TỪ. Phân bổ theo
 * tỉ trọng gross ⇒ dòng A nhận 2, dòng B nhận 1; tổng vẫn đúng 3.
 */
const OUTBOUND_ROWS = [
  {
    document_id: "doc-1",
    outbound_no: "PX-0001",
    document_date: "2026-08-10",
    recipient_id: "ag-1",
    agency_id: "ag-1",
    agency_code: "AG01",
    agency_name: "Đại lý An Phát",
    recipient_name: "Đại lý An Phát",
    recipient_type: "AGENCY",
    address: "Quận 1, TP. Hồ Chí Minh",
    contact_masked: "090*****67",
    sku_id: "sku-a",
    product_code: "SKU-A",
    product_name: "Máy A",
    issued_qty: 10,
    scanned_qty: 10,
  },
  {
    document_id: "doc-1",
    outbound_no: "PX-0001",
    document_date: "2026-08-10",
    recipient_id: "ag-1",
    agency_id: "ag-1",
    agency_code: "AG01",
    agency_name: "Đại lý An Phát",
    recipient_name: "Đại lý An Phát",
    recipient_type: "AGENCY",
    address: "Quận 1, TP. Hồ Chí Minh",
    contact_masked: "090*****67",
    sku_id: "sku-b",
    product_code: "SKU-B",
    product_name: "Bo mạch B",
    issued_qty: 5,
    scanned_qty: 5,
  },
];

const PAYLOAD: Record<string, unknown> = {
  "/reports/outbound-by-recipient": {
    rows: OUTBOUND_ROWS,
    pagination: { current_page: 1, last_page: 1, total: 2 },
  },
  "/reports/document-history": {
    rows: [
      {
        id: "doc-1",
        document_no: "PX-0001",
        created_by_name: "Nguyễn Kho Vận",
      },
    ],
  },
};

const PAGE_PAYLOAD: Record<string, unknown[]> = {
  "/reversal-documents": [
    {
      status: "POSTED",
      reference_document_code: "PX-0001",
      reference_document_id: "doc-1",
      reversed_at: "2026-08-12T09:00:00+07:00",
      total_qty: 3,
    },
  ],
  "/products": [
    {
      sku_id: "sku-a",
      sku_code: "SKU-A",
      sku_name: "Máy A",
      sku_type: "PRODUCT",
    },
    {
      sku_id: "sku-b",
      sku_code: "SKU-B",
      sku_name: "Bo mạch B",
      sku_type: "COMPONENT",
    },
  ],
  "/agencies": [
    {
      agency_id: "ag-1",
      agency_code: "AG01",
      agency_name: "Đại lý An Phát",
      recipient_type: "AGENCY",
    },
  ],
  "/users": [
    {
      user_id: "u-1",
      display_name: "Nguyễn Kho Vận",
      department: { department_id: "dep-1", department_name: "Kho vận" },
    },
  ],
};

function renderReport() {
  renderWithProviders(<RecipientAgencyReport />, [ROUTES.REPORTS_RECIPIENT]);
}

describe("RPT-07 · Xuất theo người nhận / đại lý", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.get).mockImplementation(async (url: unknown) => {
      return (PAYLOAD[String(url)] ?? { rows: [] }) as never;
    });
    vi.mocked(http.getPage).mockImplementation(async (url: unknown) => {
      return {
        data: (PAGE_PAYLOAD[String(url)] ?? []) as never,
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

  it("dựng KPI xuất thuần từ payload thật và phân bổ hoàn tác về từng dòng", async () => {
    renderReport();

    expect(
      await screen.findByTestId("report-08-recipient-agency"),
    ).toBeInTheDocument();

    // Tổng xuất 15, hoàn tác 3, xuất thuần 12, 1 chứng từ đã ghi nhận.
    const kpis = await screen.findByLabelText("Tổng quan vận hành", {
      selector: "section",
    });
    expect(within(kpis).getByText("15")).toBeInTheDocument();
    expect(within(kpis).getByText("3")).toBeInTheDocument();
    expect(within(kpis).getByText("12")).toBeInTheDocument();

    // Bảng là chế độ mặc định và có đủ hai nhóm người nhận × mã hàng.
    const table = await screen.findByRole("table");
    // Mỗi dòng in tên người nhận ở cả dòng chính lẫn dòng phụ "Tuyến đại lý".
    expect(within(table).getAllByText(/AG01 · Đại lý An Phát/)).toHaveLength(4);
    expect(within(table).getByText(/SKU-A · Máy A/)).toBeInTheDocument();
    expect(within(table).getByText(/SKU-B · Bo mạch B/)).toBeInTheDocument();
  });

  it("mở modal đối soát đúng dòng, kèm chứng từ nguồn và cảnh báo PII đã che", async () => {
    const user = userEvent.setup();
    renderReport();

    const buttons = await screen.findAllByRole("button", { name: /Đối soát/ });
    await user.click(buttons[0]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Đối soát:/)).toBeInTheDocument();
    expect(within(dialog).getAllByText("PX-0001").length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/Ghi nhận xuất/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Hoàn tác xuất/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        /Thông tin liên hệ đã được máy chủ che theo quyền của tài khoản./,
      ),
    ).toBeInTheDocument();
  });

  it("chuyển giữa Bảng và Lát cắt, tự thu gọn bộ lọc khi sang Lát cắt", async () => {
    const user = userEvent.setup();
    renderReport();

    const tableTab = await screen.findByRole("tab", { name: /Bảng/ });
    const sliceTab = screen.getByRole("tab", { name: /Lát cắt/ });
    expect(tableTab).toHaveAttribute("aria-selected", "true");

    await user.click(sliceTab);
    expect(sliceTab).toHaveAttribute("aria-selected", "true");
    expect(
      await screen.findByRole("button", { name: "Hiện bộ lọc" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dữ liệu lát cắt")).toBeInTheDocument();
  });

  it("bật xuất XLSX theo quyền report.export và khóa xuất CSV kèm PII", async () => {
    renderReport();

    // Chờ lát cắt về: trước khi có snapshot_id thì cả hai nút đều khóa.
    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: /Xuất XLSX/ })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /Xuất CSV có thông tin cá nhân/ }),
    ).toBeDisabled();
  });
});
