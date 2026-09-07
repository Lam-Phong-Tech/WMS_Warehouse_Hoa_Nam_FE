/**
 * Tab "So sánh đối tượng nhận hàng" — kiểm phần mà bộ tính không kiểm được:
 * tab có mở ra đúng chỗ không, các mục có dựng từ payload THẬT của backend
 * không, và ba trạng thái "không đủ dữ liệu" có nói ra thành lời không.
 *
 * Bộ tính (xếp hạng, so kỳ, nhận xét) đã có unit test riêng ở
 * `agency-comparison-model.test.ts`; ở đây chỉ chạm vào những gì cần cây DOM.
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
import RecipientAgencyReport from "./RecipientAgencyReport";

/**
 * Ngày cố định để kỳ mặc định của tab (2 tháng gần nhất) luôn phủ đúng các mốc
 * dựng ở dưới, dù CI chạy vào ngày nào.
 */
const TODAY = "2026-09-20";

type RowSpec = {
  party: "ag-1" | "ag-2";
  sku: "sku-a" | "sku-b";
  date: string;
  qty: number;
  doc: string;
};

const PARTY_META = {
  "ag-1": { code: "AG01", name: "Đại lý An Phát" },
  "ag-2": { code: "AG02", name: "Đại lý Bình Minh" },
} as const;

const SKU_META = {
  "sku-a": { code: "SKU-A", name: "Máy cắt" },
  "sku-b": { code: "SKU-B", name: "Máy khoan" },
} as const;

function row({ party, sku, date, qty, doc }: RowSpec) {
  return {
    document_id: doc,
    outbound_no: doc.toUpperCase(),
    document_date: date,
    recipient_id: party,
    agency_id: party,
    agency_code: PARTY_META[party].code,
    agency_name: PARTY_META[party].name,
    recipient_name: PARTY_META[party].name,
    recipient_type: "AGENCY",
    market: "Miền Nam",
    region: "TP.HCM",
    address: "Quận 1, TP. Hồ Chí Minh",
    contact_masked: "090*****67",
    sku_id: sku,
    product_code: SKU_META[sku].code,
    product_name: SKU_META[sku].name,
    issued_qty: qty,
    scanned_qty: qty,
  };
}

/**
 * An Phát chạy từ tháng 8, Bình Minh chỉ mở từ tháng 9 — đúng ca "kỳ so sánh
 * không tương đương" mà màn hình phải cảnh báo thay vì kết luận Bình Minh kém.
 */
const OUTBOUND_ROWS = [
  row({ party: "ag-1", sku: "sku-a", date: "2026-08-10", qty: 120, doc: "d1" }),
  row({ party: "ag-1", sku: "sku-b", date: "2026-08-12", qty: 60, doc: "d2" }),
  row({ party: "ag-1", sku: "sku-a", date: "2026-09-05", qty: 200, doc: "d3" }),
  row({ party: "ag-1", sku: "sku-b", date: "2026-09-08", qty: 40, doc: "d4" }),
  row({ party: "ag-2", sku: "sku-a", date: "2026-09-06", qty: 150, doc: "d5" }),
  row({ party: "ag-2", sku: "sku-b", date: "2026-09-09", qty: 90, doc: "d6" }),
];

const PAYLOAD: Record<string, unknown> = {
  "/reports/outbound-by-recipient": {
    rows: OUTBOUND_ROWS,
    pagination: {
      current_page: 1,
      last_page: 1,
      total: OUTBOUND_ROWS.length,
    },
  },
  "/reports/document-history": { rows: [] },
};

const PAGE_PAYLOAD: Record<string, unknown[]> = {
  "/reversal-documents": [],
  "/products": [
    {
      sku_id: "sku-a",
      sku_code: "SKU-A",
      sku_name: "Máy cắt",
      sku_type: "PRODUCT",
      category_id: "cat-1",
    },
    {
      sku_id: "sku-b",
      sku_code: "SKU-B",
      sku_name: "Máy khoan",
      sku_type: "PRODUCT",
      category_id: "cat-1",
    },
  ],
  "/agencies": [
    {
      agency_id: "ag-1",
      agency_code: "AG01",
      agency_name: "Đại lý An Phát",
      recipient_type: "AGENCY",
      market: "Miền Nam",
      region: "TP.HCM",
    },
    {
      agency_id: "ag-2",
      agency_code: "AG02",
      agency_name: "Đại lý Bình Minh",
      recipient_type: "AGENCY",
      // Bộ seeder ghi hai cột này dạng mã ASCII; màn phải đọc ra tiếng Việt.
      market: "MIEN_NAM",
      region: "CAN_THO",
    },
  ],
  "/product-categories": [
    { id: "cat-1", category_code: "MAY", category_name: "Máy công cụ" },
  ],
  "/users": [],
};

// Danh mục SKU của màn báo cáo giờ đi qua GET /skus/lookup (một request, không
// phân trang — xem fetchAllSkus); cùng dòng dữ liệu với "/products" ở trên.
PAYLOAD["/skus/lookup"] = PAGE_PAYLOAD["/products"];

async function openComparisonTab() {
  const user = userEvent.setup();
  renderWithProviders(<RecipientAgencyReport />, [ROUTES.REPORTS_RECIPIENT]);
  await user.click(
    await screen.findByRole("tab", { name: /So sánh đơn vị nhận hàng/ }),
  );
  return user;
}

describe("RPT-07 · tab So sánh đối tượng nhận hàng", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(dayjs(TODAY).toDate());
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
    vi.useRealTimers();
    cleanupTestState();
  });

  it("chưa mở tab thì KHÔNG dựng màn so sánh (không kéo cửa sổ dữ liệu rộng)", async () => {
    renderWithProviders(<RecipientAgencyReport />, [ROUTES.REPORTS_RECIPIENT]);

    expect(
      await screen.findByTestId("report-08-recipient-agency"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("report-08-comparison"),
    ).not.toBeInTheDocument();
  });

  it("mở tab thì dựng KPI, nhận xét và các mục so sánh từ payload thật", async () => {
    await openComparisonTab();

    expect(
      await screen.findByTestId("report-08-comparison"),
    ).toBeInTheDocument();

    // Tổng xuất thuần của hai đại lý trong kỳ mặc định (2 tháng gần nhất):
    // 120 + 60 + 200 + 40 + 150 + 90 = 660.
    const kpis = await screen.findByLabelText(
      "Chỉ số tổng quan của nhóm đang so sánh",
      { selector: "section" },
    );
    expect(within(kpis).getByText("660")).toBeInTheDocument();
    // An Phát 420 > Bình Minh 240 ⇒ dẫn đầu.
    expect(within(kpis).getByText("Đại lý An Phát")).toBeInTheDocument();

    // Mục so sánh chính là grouped bar (cùng hai bar chart Top nhanh/chậm),
    // không phải pie/donut.
    expect((await screen.findAllByTestId("chart-bar")).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByTestId("chart-line")).toBeInTheDocument();
    expect(screen.queryByTestId("chart-donut")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chart-pie")).not.toBeInTheDocument();
  });

  /**
   * Người dùng báo lỗi 2026-09-07: dòng chú của đại lý và hai ô lọc Thị
   * trường / Khu vực in nguyên mã "MIEN_NAM" / "CAN_THO" giữa màn tiếng Việt.
   * Hai cột này là VARCHAR tự do nên fixture cố ý trộn: AG01 lưu chữ
   * người dùng gõ, AG02 lưu mã của bộ seeder.
   */
  it("đọc mã thị trường / khu vực ra tiếng Việt, chữ người dùng gõ giữ nguyên", async () => {
    const user = await openComparisonTab();
    await screen.findByTestId("report-08-comparison");

    // Dòng chú dưới tên đại lý ở bảng xếp hạng.
    expect(await screen.findByText("Miền Nam · Cần Thơ")).toBeInTheDocument();
    expect(screen.getByText("Miền Nam · TP.HCM")).toBeInTheDocument();
    expect(screen.queryByText(/CAN_THO|MIEN_NAM/)).not.toBeInTheDocument();

    // Và danh sách lựa chọn của chính ô lọc — chỗ người dùng chụp màn báo lỗi.
    await user.click(screen.getByRole("button", { name: "Khu vực" }));
    expect(
      await screen.findByRole("option", { name: /Cần Thơ/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /CAN_THO/ }),
    ).not.toBeInTheDocument();
  });

  it("cảnh báo kỳ không tương đương khi một đại lý mới có dữ liệu giữa kỳ", async () => {
    await openComparisonTab();
    await screen.findByTestId("report-08-comparison");

    // Dải cảnh báo đầu màn.
    expect(
      await screen.findByText(
        /Có đối tượng chưa phát sinh từ đầu kỳ nên kỳ so sánh không tương đương/i,
      ),
    ).toBeInTheDocument();

    // Và nhận xét phải nêu mốc của TỪNG bên: An Phát mở sổ từ 08, Bình Minh từ
    // 09 — in chung một mốc cho cả hai là sai với ít nhất một bên.
    const insight = await screen.findByText(
      /Kỳ so sánh không tương đương: .*Đại lý An Phát \(08\/2026\)/,
    );
    expect(insight).toHaveTextContent("Đại lý Bình Minh (09/2026)");
    expect(insight).toHaveTextContent("bắt đầu từ 07/2026");
  });

  it("đổi qua Heatmap và Bảng vẫn giữ nguyên tập SKU đang xem", async () => {
    const user = await openComparisonTab();
    await screen.findByTestId("report-08-comparison");

    await user.click(screen.getByRole("tab", { name: /Heatmap/ }));
    const heatmap = await screen.findByRole("table", {
      name: /Ma trận số lượng theo SKU/,
    });
    expect(within(heatmap).getByText("SKU-A")).toBeInTheDocument();
    expect(within(heatmap).getByText("SKU-B")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /^Bảng$/ }));
    const matrixSection = await screen.findByLabelText(
      "So sánh mặt hàng giữa các đối tượng",
      { selector: "section" },
    );
    const table = within(matrixSection).getByRole("table");
    expect(within(table).getAllByText(/SKU-A/).length).toBeGreaterThan(0);
  });

  it("bấm một ô heatmap mở chứng từ nguồn của đúng đại lý × SKU đó", async () => {
    const user = await openComparisonTab();
    await screen.findByTestId("report-08-comparison");

    await user.click(screen.getByRole("tab", { name: /Heatmap/ }));
    const heatmap = await screen.findByRole("table", {
      name: /Ma trận số lượng theo SKU/,
    });
    // Ô "Bình Minh × SKU-A" = 150. Nhãn trợ năng của ô mang đủ đại lý + SKU +
    // số lượng, nên chọn được đúng ô mà không phải dò theo vị trí cột.
    await user.click(
      within(heatmap).getByRole("button", {
        name: /Đại lý Bình Minh · SKU-A: 150/,
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Đại lý Bình Minh · SKU-A/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("D5")).toBeInTheDocument();
    // Chỉ chứng từ của ô đang bấm, không kéo theo phiếu của đại lý khác.
    expect(within(dialog).queryByText("D3")).not.toBeInTheDocument();
  });

  it("chọn đối tượng trong bộ lọc hiện chip và bỏ chọn được", async () => {
    const user = await openComparisonTab();
    await screen.findByTestId("report-08-comparison");

    await user.click(
      screen.getByRole("button", { name: "Đại lý / Đối tác so sánh" }),
    );
    await user.click(
      await screen.findByRole("option", { name: /AG02 · Đại lý Bình Minh/ }),
    );
    await user.keyboard("{Escape}");

    const chips = await screen.findByRole("list", {
      name: /Đang chọn trong Đại lý \/ Đối tác so sánh/,
    });
    expect(
      within(chips).getByText(/AG02 · Đại lý Bình Minh/),
    ).toBeInTheDocument();

    // Còn đúng một đối tượng ⇒ phải nói thẳng là chưa so sánh được.
    expect(
      await screen.findByText(/Cần ít nhất 2 đối tượng có phát sinh/),
    ).toBeInTheDocument();
  });

  it("không có dòng nào trong kỳ thì hiện trạng thái rỗng, không dựng số giả", async () => {
    vi.mocked(http.get).mockImplementation(async (url: unknown) => {
      if (String(url) === "/reports/outbound-by-recipient") {
        return {
          rows: [],
          pagination: { current_page: 1, last_page: 1, total: 0 },
        } as never;
      }
      return { rows: [] } as never;
    });

    await openComparisonTab();
    await screen.findByTestId("report-08-comparison");

    expect(
      await screen.findByText(/Cần ít nhất 2 đối tượng có phát sinh/),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Không có dữ liệu theo bộ lọc hiện tại/).length,
    ).toBeGreaterThan(0);
  });

  it("nói ra khi sổ bị cắt ở trần trang thay vì hiện số thiếu như số đủ", async () => {
    vi.mocked(http.get).mockImplementation(async (url: unknown) => {
      if (String(url) === "/reports/outbound-by-recipient") {
        return {
          rows: OUTBOUND_ROWS,
          // Máy chủ báo 9.000 dòng nhưng chỉ tải về 6 ⇒ mọi con số đều thiếu.
          pagination: { current_page: 1, last_page: 90, total: 9000 },
        } as never;
      }
      return (PAYLOAD[String(url)] ?? { rows: [] }) as never;
    });

    await openComparisonTab();
    await screen.findByTestId("report-08-comparison");

    expect(
      await screen.findByText(/mọi con số bên dưới còn thiếu/),
    ).toBeInTheDocument();
  });
});
