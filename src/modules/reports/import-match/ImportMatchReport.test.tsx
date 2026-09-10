/**
 * RPT-04 "Nhập liệu, đối chiếu & lỗi" — màn port 1:1 từ baseline 8.5
 * (Import & Match) nhưng chạy trên endpoint THẬT của dự án.
 *
 * File này khóa những gì typecheck không bắt được: hai ngữ cảnh đọc đúng hai
 * nguồn dữ liệu, KPI/bảng dựng từ payload BE, KPI lọc được, Top mã lỗi mở đúng
 * batch, và tab Bảng/Lát cắt tự thu gọn bộ lọc.
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
import ImportMatchReport from "./ImportMatchReport";

/** Kỳ mặc định là "tháng này" nên dữ liệu mẫu phải rơi vào hôm nay. */
const TODAY = dayjs().format("YYYY-MM-DD");
const AT = `${TODAY}T08:30:00+07:00`;

const SKU_IMPORT_REPORTS = [
  {
    import_report_id: "impb-1",
    file_name: "master-sku-2026-09.xlsx",
    file_sha256: "sha256:af48c84a9bf01569",
    template_version: "v3",
    mode: "DRY_RUN",
    status: "VALID",
    total_rows: 120,
    valid_rows: 108,
    error_rows: 12,
    created_at: AT,
    actor_id: "user-kho",
    error_file_available: true,
    row_errors: [
      {
        row: 17,
        code: "SKU_DUPLICATE",
        message: "Mã SKU đã tồn tại trong tập dữ liệu đích.",
        field: "sku_code",
        value: "HN-SKU-017",
      },
      {
        row: 42,
        code: "MODEL_REQUIRED",
        message: "Thiếu mã model bắt buộc.",
        field: "model_code",
        value: "HN-SKU-042",
      },
    ],
  },
];

const IMPORT_MATCH = {
  batches: [
    {
      id: "out-match-001",
      import_no: "REQ-IMP-2026-09-001",
      status: "VALIDATED",
      total_rows: 3,
      valid_rows: 2,
      error_rows: 1,
      uploaded_at: AT,
      uploaded_by_name: "Nguyễn Minh Kho",
    },
  ],
  rows: [
    {
      id: "line-1",
      import_no: "REQ-IMP-2026-09-001",
      row_no: 1,
      source_request_no: "YCX-000231",
      sku_code: "HN-MAY-001",
      required_qty: 10,
      matched_qty: 10,
      scanned_qty: 8,
      posted_qty: 0,
      validation_status: "VALID",
      error_code: null,
      error_message: null,
    },
    {
      id: "line-2",
      import_no: "REQ-IMP-2026-09-001",
      row_no: 2,
      source_request_no: "YCX-000231",
      sku_code: "HN-MAY-002",
      required_qty: 5,
      matched_qty: 3,
      scanned_qty: 3,
      posted_qty: 0,
      validation_status: "VALID",
      error_code: null,
      error_message: null,
    },
    {
      id: "line-3",
      import_no: "REQ-IMP-2026-09-001",
      row_no: 3,
      source_request_no: "YCX-000232",
      sku_code: "HN-MAY-003",
      required_qty: 2,
      matched_qty: 0,
      scanned_qty: 0,
      posted_qty: 0,
      validation_status: "ERROR",
      error_code: "SKU_MAPPING_MISSING",
      error_message: "Chưa tìm được SKU mapping cho dòng yêu cầu.",
    },
  ],
};

const PAGE_PAYLOAD: Record<string, unknown[]> = {
  "/skus/import-reports": SKU_IMPORT_REPORTS,
  "/users": [
    {
      user_id: "user-kho",
      display_name: "Nguyễn Minh Kho",
      department: { department_id: "warehouse", department_name: "Kho vận" },
    },
  ],
  "/products": [
    {
      sku_id: "sku-001",
      sku_code: "HN-MAY-001",
      sku_name: "Máy Hoa Nam 001",
      sku_type: "PRODUCT",
    },
  ],
};

function renderReport() {
  renderWithProviders(<ImportMatchReport />, [ROUTES.REPORTS_IMPORT_QUALITY]);
}

describe("RPT-04 · Nhập liệu, đối chiếu & lỗi", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.get).mockImplementation(
      async (url: unknown) =>
        // Danh mục SKU đi qua GET /skus/lookup (xem fetchAllSkus); mọi URL khác là
        // chính báo cáo Import & Match.
        (String(url) === "/skus/lookup"
          ? PAGE_PAYLOAD["/products"]
          : IMPORT_MATCH) as unknown as never,
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

  it("ngữ cảnh Import dựng KPI và nhật ký từ /skus/import-reports", async () => {
    renderReport();

    expect(
      await screen.findByTestId("rpt-tab-import-quality"),
    ).toBeInTheDocument();

    // 120 tổng dòng, 108 hợp lệ, 12 lỗi trong đó 1 dòng mang mã trùng lặp
    // ⇒ 11 lỗi + 1 trùng.
    const kpi = await screen.findByRole("region", {
      name: "Chất lượng dữ liệu đã nhập",
    });
    expect(within(kpi).getByText("120")).toBeInTheDocument();
    expect(within(kpi).getByText("108")).toBeInTheDocument();
    expect(within(kpi).getByText("11")).toBeInTheDocument();
    expect(within(kpi).getByText("1")).toBeInTheDocument();

    const table = await screen.findByRole("table");
    expect(
      within(table).getByText("master-sku-2026-09.xlsx"),
    ).toBeInTheDocument();
    expect(within(table).getByText("Nguyễn Minh Kho")).toBeInTheDocument();
    expect(within(table).getByText("90%")).toBeInTheDocument();
  });

  it("KPI 'Dòng không hợp lệ' lọc nhật ký và mở lại chế độ Bảng", async () => {
    const user = userEvent.setup();
    renderReport();

    await screen.findByRole("table");
    const failedCard = screen.getByRole("button", {
      name: /Dòng không hợp lệ/,
    });
    await user.click(failedCard);

    // Batch vẫn còn 11 dòng lỗi nên không bị lọc mất; bộ lọc "Kết quả" đổi giá trị.
    expect(
      await screen.findByRole("combobox", { name: "Lọc theo kết quả xử lý" }),
    ).toHaveTextContent("Lỗi");
    expect(screen.getByRole("tab", { name: "Dạng ngang" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      within(await screen.findByRole("table")).getByText(
        "master-sku-2026-09.xlsx",
      ),
    ).toBeInTheDocument();
  });

  it("đổi ngữ cảnh sang đối soát thì đọc /reports/import-match và đổi nhãn cột", async () => {
    const user = userEvent.setup();
    renderReport();

    await screen.findByRole("table");
    await user.click(
      screen.getByRole("tab", { name: "Đối soát yêu cầu xuất" }),
    );

    const table = await screen.findByRole("table");
    expect(
      within(table).getByText("Mã đối soát / phiếu xuất"),
    ).toBeInTheDocument();
    expect(within(table).getByText("REQ-IMP-2026-09-001")).toBeInTheDocument();
    // SL yêu cầu 10+5+2 = 17, đã đối chiếu 10+3+0 = 13, còn lại 4.
    const kpi = await screen.findByRole("region", {
      name: "Tiến độ đối soát",
    });
    expect(within(kpi).getByText("17")).toBeInTheDocument();
    expect(within(kpi).getByText("13")).toBeInTheDocument();
    expect(within(kpi).getByText("4")).toBeInTheDocument();
  });

  it("bấm mã lỗi ở 'Top mã lỗi' mở hộp thoại chi tiết batch liên quan", async () => {
    const user = userEvent.setup();
    renderReport();

    await screen.findByRole("table");
    // UAT TC_UI_19: nút trong "Top mã lỗi" giờ hiển thị NHÃN tiếng Việt
    // (mã máy chỉ còn trong tooltip/title).
    await user.click(
      screen.getByRole("button", { name: /Thiếu mã model bắt buộc/ }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Chi tiết lô dữ liệu · master-sku-2026-09.xlsx/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Thiếu mã model bắt buộc."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("sha256:af48c84a9bf01569"),
    ).toBeInTheDocument();
  });

  it("chuyển sang Lát cắt thì tự thu gọn bộ lọc và vẫn hiện đúng batch", async () => {
    const user = userEvent.setup();
    renderReport();

    await screen.findByRole("table");
    await user.click(screen.getByRole("tab", { name: "Dạng hộp" }));

    expect(
      await screen.findByRole("button", { name: "Hiện bộ lọc" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Báo cáo 01 · master-sku-2026-09.xlsx/),
    ).toBeInTheDocument();
  });
});
