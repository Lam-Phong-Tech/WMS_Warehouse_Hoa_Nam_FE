/**
 * RPT-06 "Báo cáo Bảo hành & linh kiện" — màn port 1:1 baseline UI/UX 8.7 chạy
 * trên endpoint THẬT của dự án.
 *
 * File này khóa những gì typecheck không bắt được: mọi ô lọc đều ĐỘNG (đổi bộ
 * lọc thì KPI, biểu đồ, bảng và thẻ lát cắt đổi theo), hai tab Bảng/Lát cắt đổi
 * vùng đối soát thật, và nút "Đối soát" mở đúng hồ sơ kèm lỗi + linh kiện.
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
import WarrantyComponentsReport from "./WarrantyComponentsReport";

const TODAY = dayjs();
const RECEIVED = TODAY.startOf("month").format("YYYY-MM-DD");
const OVERDUE_DUE = TODAY.subtract(3, "day").format("YYYY-MM-DD");
const DUE_SOON_DUE = TODAY.add(1, "day").format("YYYY-MM-DD");
const ON_TRACK_DUE = TODAY.add(20, "day").format("YYYY-MM-DD");

/**
 * Ba hồ sơ phủ đủ ba nhánh rủi ro hạn của baseline: quá hạn (đang sửa chữa),
 * sắp đến hạn (đang kiểm tra) và không áp dụng (đã hoàn tất).
 */
const WARRANTY_ROWS = [
  {
    warranty_case_id: "wc-1",
    case_no: "BH-2026-0001",
    model: "HN-GEN-22",
    sku_id: "sku-gen",
    sku_name: "Máy phát điện Hoa Nam 2.2kW",
    status: "REPAIRING",
    received_at: RECEIVED,
    estimated_completion_date: OVERDUE_DUE,
    defect: "Điện áp đầu ra không ổn định",
    defects: [
      {
        defect_id: "d-1",
        defect_code: "E-AVR",
        defect_name: "Điện áp đầu ra không ổn định",
      },
      {
        defect_id: "d-2",
        defect_code: "E-NOISE",
        defect_name: "Động cơ phát tiếng ồn bất thường",
      },
    ],
    components_issued: "SKU-AVR × 1",
    customer_name: "Phạm Thị Mai",
    customer_phone: "0931234887",
    customer_address: "12 Lê Lợi, TP.HCM",
  },
  {
    warranty_case_id: "wc-2",
    case_no: "BH-2026-0002",
    model: "HN-500",
    sku_id: "sku-pump",
    sku_name: "Máy bơm Hoa Nam 500W",
    status: "CHECKING",
    received_at: RECEIVED,
    estimated_completion_date: DUE_SOON_DUE,
    defect: "Động cơ không khởi động",
    defects: [
      {
        defect_id: "d-3",
        defect_code: "E-MOTOR",
        defect_name: "Động cơ không khởi động",
      },
    ],
    components_issued: "",
    customer_name: "Trần Hoàng",
    customer_phone: "0901234321",
    customer_address: "3 Trần Phú, Đà Nẵng",
  },
  {
    warranty_case_id: "wc-3",
    case_no: "BH-2026-0003",
    model: "HN-DRILL-18",
    sku_id: "sku-drill",
    sku_name: "Máy khoan Hoa Nam 18V",
    status: "COMPLETED",
    received_at: RECEIVED,
    estimated_completion_date: ON_TRACK_DUE,
    completed_at: TODAY.format("YYYY-MM-DD"),
    defect: "",
    defects: [],
    components_issued: "SKU-BOARD × 2",
    customer_name: "Bùi Gia",
    customer_phone: "0977221000",
    customer_address: "8 Hai Bà Trưng, Hà Nội",
  },
];

const PAYLOAD: Record<string, unknown> = {
  "/reports/warranty-defects": {
    rows: WARRANTY_ROWS,
    pagination: { current_page: 1, per_page: 100, total: 3, last_page: 1 },
  },
};

const PAGE_PAYLOAD: Record<string, unknown[]> = {
  "/warranty-cases": [
    { warranty_case_code: "BH-2026-0001", created_by: "u-1" },
    { warranty_case_code: "BH-2026-0002", created_by: "u-2" },
    { warranty_case_code: "BH-2026-0003", created_by: "u-1" },
  ],
  "/warranty-component-issues": [
    {
      warranty_case_id: "wc-1",
      component_issue_no: "PXLBH-2026-0021",
      status: "POSTED",
      posted_at: "2026-08-25T09:00:00+07:00",
    },
  ],
  "/products": [
    {
      sku_id: "sku-avr",
      sku_code: "SKU-AVR",
      sku_name: "Bộ điều áp AVR 2.2kW",
      sku_type: "COMPONENT",
    },
    {
      sku_id: "sku-board",
      sku_code: "SKU-BOARD",
      sku_name: "Bo mạch sạc 18V",
      sku_type: "COMPONENT",
    },
  ],
  "/users": [
    {
      user_id: "u-1",
      display_name: "Võ Kim Oanh",
      department: {
        department_id: "dep-1",
        department_name: "Trung tâm dịch vụ",
      },
    },
    {
      user_id: "u-2",
      display_name: "Lê Quốc Bảo",
      department: {
        department_id: "dep-1",
        department_name: "Trung tâm dịch vụ",
      },
    },
  ],
};

function renderReport() {
  renderWithProviders(<WarrantyComponentsReport />, [ROUTES.REPORTS_WARRANTY]);
}

/** Bảng đối soát là bảng duy nhất của trang khi đang ở chế độ "Bảng". */
async function caseTable() {
  return screen.findByRole("table");
}

/**
 * Chờ tới khi lát cắt đã có dữ liệu. Mã hồ sơ xuất hiện ở CẢ hai vùng đối soát
 * (bảng và thẻ lát cắt — vùng không hiển thị vẫn nằm trong DOM) nên phải chờ
 * theo TẬP phần tử, không phải một phần tử duy nhất.
 */
async function waitForData() {
  await screen.findAllByText("BH-2026-0001");
}

describe("RPT-06 · Báo cáo Bảo hành & linh kiện", () => {
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
      permissionCodes: [
        "report.view",
        "report.export",
        "REPORT_EXPORT",
        "warranty.pii.view",
      ],
    });
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("dựng KPI, biểu đồ và bảng đối soát từ payload báo cáo thật", async () => {
    renderReport();

    expect(
      await screen.findByTestId("report-07-warranty-components"),
    ).toBeInTheDocument();

    const overview = await screen.findByLabelText("Tổng quan vận hành", {
      selector: "section",
    });
    // 3 hồ sơ · 2 đang mở (REPAIRING + CHECKING) · 1 hoàn tất · 1 quá hạn · 1 sắp đến hạn.
    expect(within(overview).getByText("Tổng hồ sơ")).toBeInTheDocument();
    expect(within(overview).getAllByText("3").length).toBeGreaterThan(0);
    expect(within(overview).getAllByText("2").length).toBeGreaterThan(0);

    // Donut liệt đủ sáu trạng thái kèm số đếm thật.
    expect(screen.getByText(/Đang sửa chữa: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Đã hủy: 0/)).toBeInTheDocument();

    // Biểu đồ lỗi và linh kiện đọc từ chính lát cắt đang xem.
    expect(
      screen.getByText("Động cơ phát tiếng ồn bất thường"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("SKU-AVR · Bộ điều áp AVR 2.2kW"),
    ).toBeInTheDocument();

    const table = await caseTable();
    expect(within(table).getByText("BH-2026-0001")).toBeInTheDocument();
    expect(within(table).getByText("BH-2026-0003")).toBeInTheDocument();
    expect(within(table).getByText("Quá hạn")).toBeInTheDocument();
    expect(within(table).getByText("Sắp đến hạn")).toBeInTheDocument();
    expect(within(table).getAllByText("Không áp dụng")).toHaveLength(1);
    // Người phụ trách suy từ created_by qua danh bạ người dùng.
    expect(within(table).getAllByText("Võ Kim Oanh").length).toBeGreaterThan(0);
  });

  it("lọc theo trạng thái từ chú giải donut thu hẹp cả KPI lẫn bảng", async () => {
    const user = userEvent.setup();
    renderReport();
    await waitForData();

    await user.click(screen.getByText(/Đang sửa chữa: 1/));

    const table = await caseTable();
    expect(within(table).getByText("BH-2026-0001")).toBeInTheDocument();
    expect(within(table).queryByText("BH-2026-0002")).not.toBeInTheDocument();
    expect(screen.getByText("1 đang chọn")).toBeInTheDocument();
    expect(screen.getByText("1 hồ sơ")).toBeInTheDocument();

    // Chú giải donut vẫn giữ đủ sáu trạng thái để còn bỏ chọn được.
    expect(screen.getByText(/Đang kiểm tra: 1/)).toBeInTheDocument();
  });

  it("ô lọc SKU và nút linh kiện tác động thật lên lát cắt, Đặt lại trả về ban đầu", async () => {
    const user = userEvent.setup();
    renderReport();
    await waitForData();

    await user.type(screen.getByLabelText("SKU / mẫu sản phẩm"), "HN-500");
    expect(
      within(await caseTable()).queryByText("BH-2026-0001"),
    ).not.toBeInTheDocument();
    expect(
      within(await caseTable()).getByText("BH-2026-0002"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Đặt lại/ }));
    expect(
      within(await caseTable()).getByText("BH-2026-0001"),
    ).toBeInTheDocument();

    // "Chưa có" = hồ sơ chưa phát sinh linh kiện nào.
    await user.click(screen.getByRole("button", { name: /Chưa có/ }));
    const filtered = await caseTable();
    expect(within(filtered).getByText("BH-2026-0002")).toBeInTheDocument();
    expect(
      within(filtered).queryByText("BH-2026-0003"),
    ).not.toBeInTheDocument();
  });

  it("chuyển tab Lát cắt đổi vùng đối soát sang thẻ, không còn bảng", async () => {
    const user = userEvent.setup();
    renderReport();
    await waitForData();

    await user.click(screen.getByRole("tab", { name: /Lát cắt/ }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    const panel = screen.getByRole("tabpanel", { name: /Lát cắt/ });
    expect(within(panel).getByText("BH-2026-0001")).toBeInTheDocument();
    expect(within(panel).getAllByText("Linh kiện đã xuất")).toHaveLength(3);
  });

  it("nút Đối soát mở đúng hồ sơ kèm lỗi hiệu lực và linh kiện đã xuất", async () => {
    const user = userEvent.setup();
    renderReport();
    await waitForData();

    const buttons = await screen.findAllByRole("button", { name: /Đối soát/ });
    await user.click(buttons[0]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("BH-2026-0001")).toBeInTheDocument();
    expect(within(dialog).getByText("Đang sửa chữa")).toBeInTheDocument();
    expect(within(dialog).getByText("Quá hạn")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Động cơ phát tiếng ồn bất thường"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/PXLBH-2026-0021 · Bộ điều áp AVR 2.2kW × 1/),
    ).toBeInTheDocument();
    // Có warranty.pii.view ⇒ hiện PII thô, không che.
    expect(within(dialog).getByText("Phạm Thị Mai")).toBeInTheDocument();
    // Không có warranty.view ⇒ nói rõ vì sao thiếu lịch sử, không để trống.
    expect(
      within(dialog).getByText(/không có quyền xem lịch sử hồ sơ bảo hành/),
    ).toBeInTheDocument();
  });
});
