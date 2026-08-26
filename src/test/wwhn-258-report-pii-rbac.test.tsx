/**
 * WWHN-258 · FE258-P1-04 + FE258-P1-03 — hành vi ĐỘC LẬP của màn báo cáo theo
 * `warranty.pii.view` và `warranty.pii.export`.
 *
 * Vì sao phải render thật: hai test Flow 06 sẵn có (`flow06-*.test.ts`) chỉ
 * `readFileSync` rồi `toContain` chuỗi source. Chúng chứng minh được "trong file
 * có ký tự này", không chứng minh được "người thiếu quyền nhìn thấy gì". Register
 * WWHN-258 đòi đúng thứ thứ hai, nên bộ test này mount trang với hai bộ quyền
 * khác nhau và so sánh DOM + payload gửi lên BE.
 *
 * Hợp đồng BE được phản chiếu ở đây (AlignedWarrantyReportController::export +
 * OperationalReportController::createExport):
 *   - reason kèm thiếu `warranty.pii.export` → 403 PERMISSION_DENIED
 *   - reason < 5 ký tự → 422 PII_EXPORT_REASON_INVALID
 *   - không gửi reason → file vẫn xuất, nhưng đã mask
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
vi.mock("@/modules/master-data/services/warehouse.service", () => ({
  fetchWarehouses: vi.fn(async () => []),
}));
vi.mock("@/modules/outbound/services/mvpOutboundService", () => ({
  fetchPrinterConfigs: vi.fn(async () => []),
}));
vi.mock("@/modules/master-data/hooks/use-mvp-master", () => ({
  useMvpAgencies: vi.fn(() => ({ data: { data: [] }, isLoading: false })),
  useMvpDefects: vi.fn(() => ({ data: { data: [] }, isLoading: false })),
}));

import { http } from "@/shared/api/http";
import { useAuthStore } from "@/shared/store/auth.store";
import AlignedReportsPage from "@/modules/reports/pages/AlignedReportsPage";

const RAW_CUSTOMER = {
  case_no: "BH-0001",
  identification_status: "IDENTIFIED",
  model: "KT-2000",
  defect: "Không lên nguồn",
  components_issued: "1",
  status: "RECEIVED",
  received_at: "2026-08-10",
  updated_at: "2026-08-11",
  // BE mask theo quyền của actor; fixture cố tình để PII THÔ để chứng minh FE
  // không phụ thuộc vào việc BE có mask hay không (fail-closed tầng render).
  customer_name: "Nguyễn Văn A",
  customer_phone: "0901234567",
  customer_address: "12 Lê Lợi, TP.HCM",
};

function warrantyPayload(total = 1) {
  return {
    rows: [RAW_CUSTOMER],
    pagination: { current_page: 1, per_page: 15, total },
    by_defect: [],
  };
}

/**
 * `ActionButton` hỏi quyền bằng mã UI `REPORT_EXPORT`; runtime thật quy nó về
 * `report.export` qua `canonicalizeWmsPermission`. Mock `hasPermission` trong
 * `src/test/setup.ts` lại so khớp chuỗi thô nên phải cấp cả hai dạng — đây là
 * đặc tính của harness dùng chung, không phải hành vi của trang báo cáo.
 */
const EXPORT_CODES = ["report.export", "REPORT_EXPORT"];

function grant(permissionCodes: string[]) {
  useAuthStore.setState({ isSuperAdmin: false, permissionCodes });
}

async function openWarrantyTab() {
  renderWithProviders(<AlignedReportsPage />, ["/reports"]);
  fireEvent.click(await screen.findByRole("tab", { name: /Bảo hành/ }));
  return screen.findByText("BH-0001");
}

describe("WWHN-258 · báo cáo bảo hành — gate PII theo quyền", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.post).mockReset();
    vi.mocked(http.downloadFile).mockReset();

    vi.mocked(http.get).mockResolvedValue(warrantyPayload());
    vi.mocked(http.getPage).mockResolvedValue({ data: [], meta: {} });
    vi.mocked(http.post).mockResolvedValue({
      download_url: "/api/v1/reports/warranty-defects/export-excel",
      row_count: 1,
    });
    vi.mocked(http.downloadFile).mockResolvedValue({
      blob: new Blob(["x"]),
      fileName: "bao-cao-bao-hanh-20260819-120000.xlsx",
    });
    // jsdom không có hai API này; handleBlobDownload gọi thẳng.
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("thiếu warranty.pii.export: không có ô lý do và thông điệp nói rõ vì sao", async () => {
    grant(["report.view", ...EXPORT_CODES]);
    await openWarrantyTab();

    expect(screen.queryByTestId("report-pii-reason")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /không có quyền xuất PII nên tệp xuất luôn che thông tin/,
      ),
    ).toBeInTheDocument();
  });

  it("có warranty.pii.export: ô lý do xuất hiện và hướng dẫn ngưỡng 5 ký tự", async () => {
    grant(["report.view", ...EXPORT_CODES, "warranty.pii.export"]);
    await openWarrantyTab();

    expect(screen.getByTestId("report-pii-reason")).toBeInTheDocument();
    expect(
      screen.getByText(/chỉ chứa PII thô khi bạn nhập lý do \(≥ 5 ký tự\)/),
    ).toBeInTheDocument();
  });

  it("thiếu warranty.pii.view: cột khách hàng bị mask dù BE trả PII thô", async () => {
    grant(["report.view", ...EXPORT_CODES]);
    await openWarrantyTab();

    expect(screen.queryByText("Nguyễn Văn A")).not.toBeInTheDocument();
    expect(screen.queryByText("0901234567")).not.toBeInTheDocument();
    expect(screen.getByText("*******567")).toBeInTheDocument();
  });

  it("có warranty.pii.view: cột khách hàng hiển thị đầy đủ", async () => {
    grant(["report.view", ...EXPORT_CODES, "warranty.pii.view"]);
    await openWarrantyTab();

    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByText("0901234567")).toBeInTheDocument();
  });

  it("không có quyền xuất PII thì payload export không bao giờ mang reason", async () => {
    grant(["report.view", ...EXPORT_CODES]);
    await openWarrantyTab();

    fireEvent.click(screen.getByRole("button", { name: /Xuất XLSX/ }));

    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
    const body = vi.mocked(http.post).mock.calls[0][1] as {
      filters: Record<string, unknown>;
      report_code: string;
    };
    expect(body.report_code).toBe("warranty-defects");
    expect(body.filters).not.toHaveProperty("reason");
  });

  it("lý do dưới 5 ký tự: chặn tại client, không gọi BE để ăn 422", async () => {
    grant(["report.view", ...EXPORT_CODES, "warranty.pii.export"]);
    await openWarrantyTab();

    fireEvent.change(screen.getByTestId("report-pii-reason"), {
      target: { value: "abc" },
    });

    expect(
      await screen.findByText(/Lý do xuất PII phải có ít nhất 5 ký tự/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Xuất XLSX/ }));
    expect(http.post).not.toHaveBeenCalled();
  });

  it("lý do hợp lệ: reason đi kèm filters của POST /reports/export", async () => {
    grant(["report.view", ...EXPORT_CODES, "warranty.pii.export"]);
    await openWarrantyTab();

    fireEvent.change(screen.getByTestId("report-pii-reason"), {
      target: { value: "Doi soat bao hanh quy 3" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Xuất XLSX/ }));

    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
    const [, body, config] = vi.mocked(http.post).mock.calls[0] as [
      string,
      { filters: Record<string, unknown> },
      { headers: Record<string, string> },
    ];
    expect(body.filters.reason).toBe("Doi soat bao hanh quy 3");
    // Annex C createReportExport: mỗi lần tạo job phải có Idempotency-Key.
    expect(config.headers["Idempotency-Key"]).toBeTruthy();
  });
});

describe("WWHN-258 · phản hồi dữ liệu lớn và 403 export", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.post).mockReset();
    vi.mocked(http.getPage).mockResolvedValue({ data: [], meta: {} });
    grant(["report.view", ...EXPORT_CODES]);
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("vượt trần 10.000 dòng: cảnh báo trước và khoá nút export", async () => {
    vi.mocked(http.get).mockResolvedValue(warrantyPayload(10001));
    await openWarrantyTab();

    const banner = screen.getByTestId("report-export-row-limit");
    expect(banner).toHaveAttribute("data-ui-state", "disabled");
    expect(
      within(banner).getByText(/vượt giới hạn 10\.000 dòng mỗi tệp/),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Xuất XLSX/ })).toBeDisabled();
  });

  it("BE trả 403: dựng surface permission-denied riêng, không lẫn vào lỗi mạng", async () => {
    vi.mocked(http.get).mockResolvedValue(warrantyPayload());
    vi.mocked(http.post).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 403,
        data: {
          success: false,
          error_code: "PERMISSION_DENIED",
          message: "Xuất PII bảo hành cần quyền warranty.pii.export.",
        },
      },
    });
    await openWarrantyTab();

    fireEvent.click(screen.getByRole("button", { name: /Xuất XLSX/ }));

    const denied = await screen.findByTestId("report-export-permission-denied");
    expect(denied).toHaveAttribute("data-ui-state", "permission-denied");
  });
});
