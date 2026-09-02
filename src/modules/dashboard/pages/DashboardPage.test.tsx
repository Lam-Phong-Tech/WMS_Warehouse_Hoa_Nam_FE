import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import dayjs from "dayjs";

vi.mock("@/shared/api/http", () => ({
  http: { get: vi.fn(), getPage: vi.fn(), post: vi.fn() },
}));

import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { OPERATIONS_REPORT_ENDPOINTS } from "@/modules/reports/operations/report-data";
import { reportQueryOptions } from "../overview/overview-data";
import { useAuthStore } from "@/shared/store/auth.store";
import DashboardPage from "./DashboardPage";

/**
 * Màn "Tổng quan vận hành" dựng theo demo UI/UX, đọc từ BỐN nguồn thật. Test ở
 * đây khoá đúng những điều dễ vỡ khi ai đó sửa layout: KPI phải đổi nhánh theo
 * bộ lọc loại hàng, tổng quá hạn phải là tổng THẬT (không phải độ dài mảng mẫu),
 * đẳng thức đối soát phải cộng từ sổ XNT, và không có quyền thì không rò số nào.
 */

const today = dayjs().format("YYYY-MM-DD");
const mockedGet = vi.mocked(http.get);

const overview = {
  period: { from_date: today, to_date: today },
  data_scope: "GLOBAL",
  scope_warehouse_ids: null,
  kpi: {
    on_hand: { product: 800, component: 434, total: 1234 },
    receipt_today: { product: 200, component: 100, total: 300 },
    issue_today: { product: 90, component: 30, total: 120 },
    receipt_month: { product: 1000, component: 500, total: 1500 },
    issue_month: { product: 600, component: 150, total: 750 },
  },
  warranty_received: { today: 3, week: 11, month: 42 },
  top_sku: { best: null, worst: null },
  flow_daily: [
    {
      date: today,
      receipt_product: 200,
      receipt_component: 100,
      issue_product: 90,
      issue_component: 30,
    },
  ],
  stock_trend: [{ date: today, closing_qty: 1234 }],
  stock_structure: {
    PRODUCT: {
      AVAILABLE: 800,
      NON_SELLABLE: 50,
      DEFECTIVE: 20,
      QUARANTINE: 10,
    },
    COMPONENT: {
      AVAILABLE: 434,
      NON_SELLABLE: 0,
      DEFECTIVE: 0,
      QUARANTINE: 0,
    },
  },
  warranty: {
    by_status: { CHECKING: 3, COMPLETED: 7 },
    overdue_count: 137,
    overdue_sample: [
      {
        warranty_case_code: "WC-001",
        customer_name: "Nguyễn Văn A",
        status: "CHECKING",
        estimated_completion_date: "2026-08-01",
        days_overdue: 28,
      },
    ],
  },
  issues: {
    inventory_mismatch: 5,
    import_error: 2,
    warranty_overdue: 137,
    print_failed: 1,
    sku_pending_info: 4,
  },
};

const xnt = {
  lines: [
    {
      product_code: "SKU-A",
      product_name: "Máy bơm A",
      opening: 1000,
      receipt_net: 300,
      issue_net: 90,
      component_issue_net: 30,
      reversal_unlinked_net: 0,
      closing: 1180,
    },
    {
      product_code: "SKU-B",
      product_name: "Máy bơm B",
      opening: 54,
      receipt_net: 0,
      issue_net: 0,
      component_issue_net: 0,
      reversal_unlinked_net: 0,
      closing: 54,
    },
  ],
};

const xntDaily = {
  days: [
    {
      date: today,
      inbound_qty: 300,
      outbound_qty: 120,
      reversal_net: 0,
      closing_qty: 1234,
    },
  ],
};

const quick = { below_min_stock_count: 14, above_max_stock_count: 4 };

function routeResponses(url: string) {
  if (url === API_ENDPOINTS.REPORTS_DASHBOARD_OVERVIEW)
    return Promise.resolve(overview);
  if (url === API_ENDPOINTS.REPORTS_XNT_ENHANCED) return Promise.resolve(xnt);
  if (url === OPERATIONS_REPORT_ENDPOINTS.XNT_DAILY)
    return Promise.resolve(xntDaily);
  if (url === API_ENDPOINTS.DASHBOARD_KPI) return Promise.resolve(quick);
  return Promise.reject(new Error(`unexpected url ${url}`));
}

// Cùng một con số còn xuất hiện ở khối đối soát, biểu đồ và bảng dữ liệu thay
// thế, nên các assertion về KPI đều thu hẹp phạm vi vào #kpi-grid.
function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useAuthStore.setState({
    permissionCodes: [],
    isSuperAdmin: false,
    isProfileLoaded: false,
  });
});

describe("DashboardPage — Tổng quan vận hành", () => {
  it("đổi bộ lọc Loại hàng thì KPI đọc đúng nhánh và ẩn thẻ không còn nghĩa", async () => {
    mockedGet.mockImplementation((url: string) => routeResponses(url));
    renderDashboard();

    // Mặc định "Toàn bộ" → dùng total của on_hand.
    expect(
      await screen.findByText("Xuất sản phẩm đã Post"),
    ).toBeInTheDocument();
    const grid = document.querySelector("#kpi-grid") as HTMLElement;
    expect(within(grid).getByText("1.234")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Linh kiện" }));

    // Linh kiện → nhánh component; thẻ xuất sản phẩm biến mất đúng như demo.
    expect(within(grid).getByText("434")).toBeInTheDocument();
    expect(within(grid).queryByText("1.234")).not.toBeInTheDocument();
    expect(screen.queryByText("Xuất sản phẩm đã Post")).not.toBeInTheDocument();
  });

  it("hiển thị tổng thật của ca quá hạn, không lấy độ dài mảng mẫu", async () => {
    mockedGet.mockImplementation((url: string) => routeResponses(url));
    renderDashboard();

    // overdue_sample chỉ có 1 phần tử nhưng tổng thật là 137.
    expect(await screen.findByText("137 quá hạn")).toBeInTheDocument();
    expect(await screen.findByText("28 ngày")).toBeInTheDocument();
  });

  it("đối soát tồn cộng từ sổ XNT và báo chênh lệch đo được", async () => {
    mockedGet.mockImplementation((url: string) => routeResponses(url));
    renderDashboard();

    const status = await screen.findByRole("status", {
      name: "Đã khớp · Chênh lệch 0",
    });
    expect(status).toBeInTheDocument();
    // 1000 + 54 = 1054 tồn đầu kỳ; 1180 + 54 = 1234 tồn cuối kỳ.
    const card = document.querySelector("#equation-card") as HTMLElement;
    expect(within(card).getByText("1.054")).toBeInTheDocument();
    expect(within(card).getByText("1.234")).toBeInTheDocument();
  });

  it("thẻ định mức đọc số dưới/vượt ngưỡng từ dashboard-quick", async () => {
    mockedGet.mockImplementation((url: string) => routeResponses(url));
    renderDashboard();

    expect(
      await screen.findByLabelText("Tồn dưới định mức: 14 SKU"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Tồn vượt định mức: 4 SKU"),
    ).toBeInTheDocument();
  });

  it("không gọi API báo cáo khi profile đã tải mà thiếu report.view", () => {
    useAuthStore.setState({
      isProfileLoaded: true,
      isSuperAdmin: false,
      permissionCodes: ["inventory.view"],
    });

    renderDashboard();

    expect(screen.getByText("Giới hạn quyền")).toBeInTheDocument();
    expect(mockedGet).not.toHaveBeenCalled();
    // Không có widget nào lộ số liệu.
    expect(screen.queryByText("1.234")).not.toBeInTheDocument();
  });

  it("lỗi nguồn đọc chính thì không thay số liệu bằng 0", async () => {
    mockedGet.mockImplementation((url: string) =>
      url === API_ENDPOINTS.REPORTS_DASHBOARD_OVERVIEW
        ? Promise.reject(new Error("boom"))
        : routeResponses(url),
    );

    renderDashboard();

    expect(await screen.findByText("Lỗi nguồn đọc")).toBeInTheDocument();
    expect(
      screen.getByText("Không thể tải Tổng tồn khả dụng"),
    ).toBeInTheDocument();
    // Lưới KPI không có con số nào — không thay dữ liệu lỗi bằng 0.
    const grid = document.querySelector("#kpi-grid") as HTMLElement;
    expect(within(grid).queryByText("1.234")).not.toBeInTheDocument();
    expect(within(grid).queryByText("0")).not.toBeInTheDocument();
  });

  it("đổi kỳ KPI thì gọi lại các nguồn với khoảng ngày mới", async () => {
    mockedGet.mockImplementation((url: string) => routeResponses(url));
    renderDashboard();

    await screen.findByText("Xuất sản phẩm đã Post");
    expect(mockedGet).toHaveBeenCalledWith(
      API_ENDPOINTS.REPORTS_XNT_ENHANCED,
      expect.objectContaining({
        params: { from_date: today, to_date: today },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "7 ngày gần nhất" }));

    const from = dayjs().subtract(6, "day").format("YYYY-MM-DD");
    expect(mockedGet).toHaveBeenCalledWith(
      API_ENDPOINTS.REPORTS_XNT_ENHANCED,
      expect.objectContaining({ params: { from_date: from, to_date: today } }),
    );
  });
});

/**
 * Cửa sổ biểu đồ phải TÁCH khỏi kỳ KPI.
 *
 * Bản trước nối hai thứ làm một, nên kỳ mặc định "Hôm nay" chỉ còn 1 điểm dữ
 * liệu: `<path>` sinh ra đúng một lệnh `M` — SVG không vẽ nét nào — và
 * `sparkPoints()` bỏ hẳn sparkline vì dưới 2 giá trị. Màn hình vẫn đầy số
 * nhưng mọi đường biểu đồ đều trống. Demo ghim biểu đồ ở 7 ngày (`app.js:706`
 * luôn ghi "Biểu đồ: 7 ngày gần nhất") chính vì vậy.
 */
describe("DashboardPage — cửa sổ biểu đồ 7 ngày", () => {
  const days = Array.from({ length: 7 }, (_, index) =>
    dayjs()
      .subtract(6 - index, "day")
      .format("YYYY-MM-DD"),
  );

  const weekOverview = {
    ...overview,
    flow_daily: days.map((date, index) => ({
      date,
      receipt_product: 100 + index * 10,
      receipt_component: 50 + index * 5,
      issue_product: 40 + index * 3,
      issue_component: 10 + index,
    })),
    stock_trend: days.map((date, index) => ({
      date,
      closing_qty: 1200 + index * 25,
    })),
  };

  const weekDaily = {
    days: days.map((date) => ({
      date,
      inbound_qty: 150,
      outbound_qty: 50,
      reversal_net: 5,
      closing_qty: 1234,
    })),
  };

  function routeWeek(url: string) {
    if (url === API_ENDPOINTS.REPORTS_DASHBOARD_OVERVIEW)
      return Promise.resolve(weekOverview);
    if (url === API_ENDPOINTS.REPORTS_XNT_ENHANCED) return Promise.resolve(xnt);
    if (url === OPERATIONS_REPORT_ENDPOINTS.XNT_DAILY)
      return Promise.resolve(weekDaily);
    if (url === API_ENDPOINTS.DASHBOARD_KPI) return Promise.resolve(quick);
    return Promise.reject(new Error(`unexpected url ${url}`));
  }

  it("vẽ đường luồng nhiều điểm dù kỳ KPI là Hôm nay", async () => {
    mockedGet.mockImplementation((url: string) => routeWeek(url));
    renderDashboard();

    await screen.findByText("Xuất sản phẩm đã Post");

    const flow = document.querySelector("#flow-card") as HTMLElement;
    expect(flow).not.toBeNull();
    // Lệnh "L" là bằng chứng có NÉT: path chỉ có "M" thì SVG không vẽ gì.
    const drawn = [...flow.querySelectorAll("path")].filter((node) =>
      (node.getAttribute("d") ?? "").includes("L"),
    );
    expect(drawn.length).toBeGreaterThan(0);

    // Bảng dữ liệu thay thế phải liệt kê đủ 7 ngày, không phải 1.
    const table = flow.querySelector("tbody") as HTMLElement;
    expect(table.querySelectorAll("tr")).toHaveLength(7);
  });

  it("giữ sparkline trên thẻ KPI ở kỳ Hôm nay", async () => {
    mockedGet.mockImplementation((url: string) => routeWeek(url));
    renderDashboard();

    await screen.findByText("Xuất sản phẩm đã Post");

    const sparks = [...document.querySelectorAll("#kpi-grid .kpi-spark")];
    expect(sparks.length).toBeGreaterThan(0);
    for (const spark of sparks) {
      const points = spark.querySelector("polyline")?.getAttribute("points");
      expect(points?.trim()).toBeTruthy();
    }
  });

  it("đọc chuỗi theo ngày ở cửa sổ 7 ngày, không theo kỳ KPI", async () => {
    mockedGet.mockImplementation((url: string) => routeWeek(url));
    renderDashboard();

    await screen.findByText("Xuất sản phẩm đã Post");

    // Kỳ KPI là Hôm nay…
    expect(mockedGet).toHaveBeenCalledWith(
      API_ENDPOINTS.REPORTS_XNT_ENHANCED,
      expect.objectContaining({ params: { from_date: today, to_date: today } }),
    );
    // …nhưng chuỗi theo ngày vẫn lấy trọn 7 ngày.
    expect(mockedGet).toHaveBeenCalledWith(
      OPERATIONS_REPORT_ENDPOINTS.XNT_DAILY,
      expect.objectContaining({
        params: { from_date: days[0], to_date: today },
      }),
    );
    // Và payload chính chỉ tốn 1 request cho cả hai cửa sổ.
    expect(mockedGet).toHaveBeenCalledWith(
      API_ENDPOINTS.REPORTS_DASHBOARD_OVERVIEW,
      expect.objectContaining({
        params: { from_date: days[0], to_date: today },
      }),
    );
  });

  it("nói rõ cửa sổ biểu đồ trên section-meta", async () => {
    mockedGet.mockImplementation((url: string) => routeWeek(url));
    renderDashboard();

    await screen.findByText("Xuất sản phẩm đã Post");

    const meta = document.querySelector(".section-meta") as HTMLElement;
    expect(meta.textContent).toContain(dayjs(days[0]).format("DD/MM/YYYY"));
  });

  /** CSS `[data-lazy]` để khối ở opacity .78; thiếu observer là kẹt luôn ở đó. */
  it("lộ khối dưới fold thay vì bỏ chúng mờ vĩnh viễn", async () => {
    mockedGet.mockImplementation((url: string) => routeWeek(url));
    renderDashboard();

    await screen.findByText("Xuất sản phẩm đã Post");

    const lazy = [...document.querySelectorAll("[data-lazy]")];
    expect(lazy.length).toBe(2);
    // jsdom không có IntersectionObserver ⇒ hook phải hiện ngay, không treo.
    for (const section of lazy) {
      expect(section.classList.contains("lazy-ready")).toBe(true);
    }
  });

  it("xướng lên vùng aria-live khi đổi kỳ KPI", async () => {
    mockedGet.mockImplementation((url: string) => routeWeek(url));
    const { container } = renderDashboard();

    await screen.findByText("Xuất sản phẩm đã Post");

    const live = container.querySelector(".sr-only") as HTMLElement;
    expect(live).not.toBeNull();
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "7 ngày gần nhất" }));
    expect(live.textContent).toBe("Đã chọn kỳ KPI 7 ngày gần nhất");

    fireEvent.click(screen.getByRole("button", { name: "Linh kiện" }));
    expect(live.textContent).toBe("Đã lọc loại hàng Linh kiện");
  });
});

/**
 * Nút "Làm mới": có sự kiện là chưa đủ, phải NHÌN THẤY nó đang chạy và không
 * cho bấm chồng.
 */
describe("DashboardPage — nút làm mới", () => {
  it("gọi lại cả bốn nguồn và xướng lên aria-live", async () => {
    mockedGet.mockImplementation((url: string) => routeResponses(url));
    const { container } = renderDashboard();

    await screen.findByText("Xuất sản phẩm đã Post");
    const before = mockedGet.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: /Làm mới/ }));

    // Bốn nguồn đọc, bốn lượt gọi mới.
    expect(mockedGet.mock.calls.length).toBe(before + 4);
    expect(
      (container.querySelector(".sr-only") as HTMLElement).textContent,
    ).toBe("Đã làm mới Dashboard");
  });

  /**
   * Bản trước khoá nút theo mỗi `overview.isFetching`, nên nút sáng lại trong
   * lúc ba nguồn kia còn đang bay — bấm tiếp là nhân đôi request.
   */
  it("khoá nút cho tới khi cả bốn nguồn xong, không riêng nguồn chính", async () => {
    let releaseQuick: (value: unknown) => void = () => {};
    const slowQuick = new Promise((resolve) => {
      releaseQuick = resolve;
    });
    let quickCalls = 0;
    mockedGet.mockImplementation((url: string) => {
      if (url === API_ENDPOINTS.DASHBOARD_KPI) {
        quickCalls += 1;
        return quickCalls === 1 ? Promise.resolve(quick) : slowQuick;
      }
      return routeResponses(url);
    });
    renderDashboard();

    await screen.findByText("Xuất sản phẩm đã Post");
    const button = screen.getByRole("button", {
      name: /Làm mới/,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.click(button);
    // `quick` còn treo ⇒ nút phải vẫn khoá dù nguồn chính đã về.
    await screen.findByText("Đang thử lại");
    expect(button.disabled).toBe(true);

    releaseQuick(quick);
  });

  /**
   * Bấm Làm mới trên trang khoẻ mạnh cũng phải có phản hồi nhìn thấy được —
   * bản trước chỉ hiện banner khi TRƯỚC ĐÓ đã có lỗi.
   */
  it("hiện banner Đang thử lại ngay khi bấm, không đợi phải có lỗi", async () => {
    let release: (value: unknown) => void = () => {};
    const slow = new Promise((resolve) => {
      release = resolve;
    });
    let overviewCalls = 0;
    mockedGet.mockImplementation((url: string) => {
      if (url === API_ENDPOINTS.REPORTS_DASHBOARD_OVERVIEW) {
        overviewCalls += 1;
        return overviewCalls === 1 ? Promise.resolve(overview) : slow;
      }
      return routeResponses(url);
    });
    renderDashboard();

    await screen.findByText("Xuất sản phẩm đã Post");
    expect(screen.queryByText("Đang thử lại")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Làm mới/ }));
    expect(await screen.findByText("Đang thử lại")).toBeInTheDocument();

    release(overview);
  });

  /**
   * Banner ngoại tuyến hứa "tạm dừng làm mới" — phải dừng THẬT.
   *
   * Kiểm hai nửa vì một test đơn không phủ được cả hai mà vẫn tất định: nửa
   * trên là cái công tắc, nửa dưới là việc trang bật đúng công tắc đó khi mất
   * mạng. Chỗ nối giữa hai nửa chỉ có một điểm gọi duy nhất và đã được
   * typecheck giữ.
   */
  it("tắt hẳn vòng 60 giây thay vì chỉ nói trong banner", () => {
    expect(reportQueryOptions(true, true).refetchInterval).toBe(60_000);
    expect(reportQueryOptions(true, false).refetchInterval).toBe(false);
  });

  it("nhận ra trạng thái ngoại tuyến lúc mở trang", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
    try {
      mockedGet.mockImplementation((url: string) => routeResponses(url));
      renderDashboard();
      expect(await screen.findByText("Ngoại tuyến")).toBeInTheDocument();
    } finally {
      // `onLine` nằm trên prototype nên khôi phục bằng cách xoá bản ghi đè.
      delete (window.navigator as { onLine?: boolean }).onLine;
    }
  });
});
