/**
 * GỢI Ý BỘ LỌC KỲ — nối dây thật trên một màn báo cáo (RPT-IO-01).
 *
 * `report-range-advice.test.ts` đã khoá phần LUẬT; file này khoá phần khó thấy
 * hơn: màn có dò đúng lúc không, dò bằng cửa sổ nào, và bấm "Áp dụng" có thật
 * sự đổi kỳ đang xem không. Ba thứ đó chỉ sai khi đã chạy, không sai lúc
 * typecheck.
 *
 * Mẹo đọc test: kỳ ĐANG XEM đi qua `http.getPage` (màn cần `meta.timestamp`),
 * còn phép DÒ đi qua `http.get` — nên hai đường tách nhau tự nhiên trong mock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
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
import { COVERAGE_WINDOW_DAYS } from "../operations/report-coverage";

/**
 * "Hôm nay" cố định = 06/09/2026, đúng ca người dùng mô tả: kho có dữ liệu
 * 06→08/2026, sang đầu tháng 9 mở báo cáo thì kỳ mặc định ("Tháng này") trống.
 */
const NOW = new Date("2026-09-06T08:00:00+07:00");

const COVERAGE_FROM = dayjs(NOW)
  .startOf("day")
  .subtract(COVERAGE_WINDOW_DAYS - 1, "day")
  .format("YYYY-MM-DD");

function document(id: string, postedAt: string) {
  return {
    id,
    document_no: `IN-${id}`,
    doc_type: "INBOUND",
    status: "POSTED",
    counterpart: "Nhà cung cấp Hoa Nam",
    document_date: postedAt.slice(0, 10),
    posted_at: postedAt,
    created_by_name: "Nguyễn An",
    lines: [
      { product_code: "HN-MK-001-V1", product_name: "Máy", posted_qty: 10 },
    ],
  };
}

/** Cửa sổ dò 12 tháng: chỉ có chứng từ trong 01/06 → 31/08/2026. */
const COVERAGE_DOCUMENTS = {
  rows: [
    document("d1", "2026-06-01 08:00:00"),
    document("d2", "2026-07-15 08:00:00"),
    document("d3", "2026-08-31 17:00:00"),
  ],
};

const EMPTY_PAGE = {
  data: [] as never,
  meta: { current_page: 1, last_page: 1, total: 0 },
};

/** `from_date` của mỗi lần DÒ chứng từ — để soi màn dò cửa sổ nào. */
function probedWindows(): string[] {
  return vi
    .mocked(http.get)
    .mock.calls.filter(([url]) => String(url) === "/reports/document-history")
    .map(([, config]) => {
      const params = (
        config as { params?: Record<string, unknown> } | undefined
      )?.params;
      return String(params?.from_date ?? "");
    });
}

/** `from_date` của mỗi lần đọc KỲ ĐANG XEM. */
function viewedWindows(): string[] {
  return vi
    .mocked(http.getPage)
    .mock.calls.filter(([url]) => String(url) === "/reports/document-history")
    .map(([, config]) => {
      const params = (
        config as { params?: Record<string, unknown> } | undefined
      )?.params;
      return String(params?.from_date ?? "");
    });
}

/** Kỳ đang xem trả về `rows`; mặc định rỗng (tháng 9 chưa có gì). */
let documentsInPeriod: Record<string, unknown>[] = [];

function renderReport() {
  renderWithProviders(<IoHistoryReport />, [ROUTES.REPORTS_PENDING_EVIDENCE]);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  documentsInPeriod = [];
  vi.mocked(http.get).mockReset();
  vi.mocked(http.getPage).mockReset();
  vi.mocked(http.get).mockImplementation(
    async (url: unknown, config?: unknown) => {
      if (String(url) !== "/reports/document-history") {
        return { rows: [] } as never;
      }
      const params = (
        config as { params?: Record<string, unknown> } | undefined
      )?.params;
      return (
        String(params?.from_date ?? "") === COVERAGE_FROM
          ? COVERAGE_DOCUMENTS
          : { rows: [] }
      ) as never;
    },
  );
  vi.mocked(http.getPage).mockImplementation(async (url: unknown) => {
    if (String(url) === "/reports/document-history") {
      return {
        data: { rows: documentsInPeriod } as never,
        meta: { timestamp: "2026-09-06T08:00:00+07:00" },
      };
    }
    return EMPTY_PAGE as never;
  });
  useAuthStore.setState({
    isSuperAdmin: false,
    permissionCodes: ["report.view"],
  });
});

afterEach(() => {
  vi.useRealTimers();
  cleanupTestState();
});

describe("RPT-IO-01 · gợi ý bộ lọc kỳ", () => {
  it("kỳ trống thì dò 12 tháng và chỉ ra khoảng có dữ liệu", async () => {
    renderReport();

    const banner = await screen.findByTestId("report-range-advice");
    expect(banner).toHaveAttribute("data-advice-kind", "empty-with-coverage");
    expect(banner).toHaveTextContent("01-06-2026 → 31-08-2026");

    // Phép dò phải là một cửa sổ RIÊNG, không phải kỳ đang xem — nếu dùng lại
    // kỳ đang xem thì mãi mãi không biết dữ liệu nằm ở đâu.
    expect(probedWindows()).toContain(COVERAGE_FROM);
    expect(viewedWindows()).toContain("2026-09-01");
  });

  it("bấm 'Áp dụng' chuyển kỳ đang xem sang khoảng được đề xuất", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderReport();

    await user.click(await screen.findByTestId("report-range-advice-apply"));

    // Hai nút ngày phải hiện kỳ mới, không chỉ đổi chữ trong banner gợi ý.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Từ ngày" })).toHaveTextContent(
        "01/06/2026",
      );
      expect(
        screen.getByRole("button", { name: "Đến ngày" }),
      ).toHaveTextContent("31/08/2026");
    });
    // Kỳ mới được gọi thật, không chỉ đổi chữ trên màn.
    expect(viewedWindows()).toContain("2026-06-01");
  });

  it("kỳ có dữ liệu thì KHÔNG dò và KHÔNG hiện gợi ý", async () => {
    documentsInPeriod = [document("d9", "2026-09-02 09:00:00")];

    renderReport();
    await screen.findByRole("table");

    expect(screen.queryByTestId("report-range-advice")).toBeNull();
    expect(probedWindows()).toEqual([]);
  });
});
