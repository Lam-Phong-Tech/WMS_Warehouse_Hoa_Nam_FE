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
import RecipientAgencyReport from "./RecipientAgencyReport";

const OUTBOUND_ROWS = [
  {
    document_id: "doc-1",
    outbound_no: "PX-0001",
    document_date: "2026-09-10",
    recipient_id: "receiver-1",
    agency_id: "ag-1",
    agency_code: "AG01",
    agency_name: "Đại lý An Phát",
    recipient_name: "Nguyễn Văn Minh",
    recipient_type: "AGENCY",
    sku_id: "sku-a",
    product_code: "SKU-A",
    product_name: "Máy A",
    issued_qty: 10,
    scanned_qty: 10,
  },
  {
    document_id: "doc-1",
    outbound_no: "PX-0001",
    document_date: "2026-09-10",
    recipient_id: "receiver-1",
    agency_id: "ag-1",
    agency_code: "AG01",
    agency_name: "Đại lý An Phát",
    recipient_name: "Nguyễn Văn Minh",
    recipient_type: "AGENCY",
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
  "/skus/lookup": [
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
};

const PAGE_PAYLOAD: Record<string, unknown[]> = {
  "/reversal-documents": [
    {
      status: "POSTED",
      reference_document_code: "PX-0001",
      reference_document_id: "doc-1",
      reversed_at: "2026-09-10T09:00:00+07:00",
      total_qty: 3,
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
      permissionCodes: ["report.view", "report.export"],
    });
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("dựng đúng cấu trúc baseline, cộng số lượng thuần và tiến độ chứng từ", async () => {
    renderReport();

    const root = await screen.findByTestId("report-08-recipient-agency");
    expect(root).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Báo cáo Xuất theo người nhận đại lý",
      }),
    ).toBeInTheDocument();

    expect(screen.getByRole("combobox", { name: "Đại lý" })).toHaveTextContent(
      "Tất cả đại lý",
    );

    const overview = screen.getByLabelText("Tổng quan vận hành");
    expect(within(screen.getByLabelText("Tổng phiếu xuất")).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Đại lý nhận")).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Đã hoàn tất")).getByText("0")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Chưa hoàn tất")).getByText("1")).toBeInTheDocument();
    expect(overview).toBeInTheDocument();

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Đại lý An Phát")).toBeInTheDocument();
    expect(within(table).getByText("Nguyễn Văn Minh")).toBeInTheDocument();
    expect(within(table).getByText("12")).toBeInTheDocument();
    expect(within(table).getByText("0/1")).toBeInTheDocument();
  });

  it("nút Xem mở chi tiết thật của đại lý, không còn action chết", async () => {
    const user = userEvent.setup();
    renderReport();

    const table = await screen.findByRole("table");
    await user.click(within(table).getByRole("button", { name: /Xem/ }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Chi tiết nhận hàng · Đại lý An Phát/),
    ).toBeInTheDocument();
    expect(dialog.querySelector(".rpt07-detail-dialog")).not.toBeNull();
    expect(
      within(dialog).getByText("Người nhận: Nguyễn Văn Minh"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("PX-0001")).toBeInTheDocument();
    expect(within(dialog).getByText("Chưa hoàn tất")).toBeInTheDocument();
  });

  it("tìm kiếm chỉ lọc bảng và có thể đặt lại ngay trong empty state", async () => {
    const user = userEvent.setup();
    renderReport();

    const searchBox = await screen.findByPlaceholderText(
      "Tên đại lý, người nhận, mã phiếu...",
    );
    await user.clear(searchBox);
    await user.type(searchBox, "khong-co-dai-ly");

    expect(
      await screen.findByText("Không tìm thấy kết quả phù hợp"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Đặt lại tìm kiếm/ }),
    );
    expect(screen.getByText("Đại lý An Phát")).toBeInTheDocument();
  });

  it("quyền report.export điều khiển đúng nút Xuất báo cáo", async () => {
    renderReport();
    await screen.findByText("Đại lý An Phát");
    expect(
      screen.getByRole("button", { name: "Xuất báo cáo" }),
    ).toBeEnabled();
  });
});
