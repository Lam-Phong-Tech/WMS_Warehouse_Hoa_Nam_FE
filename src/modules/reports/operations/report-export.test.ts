import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * WWHN-347 · UAT TC_FUNC_08 — "Lịch sử nhập – xuất kho": bấm Xuất XLSX/PDF tạo
 * job rồi job nằm mãi ở PENDING, không tải được file, không có thông báo lỗi.
 *
 * Nguyên nhân gốc nằm ở BE (tiến trình dựng file chết vì hết bộ nhớ, xem
 * Wwhn347ReportExportMemoryTest). Phần thuộc về FE là hai request của luồng này
 * KHÔNG được dùng `apiTimeoutMs` chung 10 giây:
 *
 *  - GET /reports/export/{id} có thể tự chạy export ngay trong request đó khi
 *    worker hàng đợi không nhặt job (đường cứu hộ WWHN-343) — đo được ~20 giây
 *    cho một bản PDF ~750 dòng;
 *  - GET .../download tải nguyên khối file XLSX/PDF.
 *
 * Với trần 10 giây, trình duyệt huỷ request giữa chừng và người dùng nhận "xuất
 * thất bại" cho một file máy chủ vừa dựng xong. Bộ test này khoá lại: mỗi request
 * phải mang timeout riêng, và không được nhỏ hơn hạn chót của cả vòng poll.
 */
describe("WWHN-347 · timeout riêng cho luồng export báo cáo", () => {
  const getMock = vi.fn();
  const downloadMock = vi.fn();
  const postMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    getMock.mockReset();
    downloadMock.mockReset();
    postMock.mockReset();

    vi.doMock("@/shared/api/http", () => ({
      http: { get: getMock, post: postMock, downloadFile: downloadMock },
    }));
    vi.doMock("@/shared/api/wms-action-permission", () => ({
      assertWmsActionPermission: () => undefined,
    }));
    // jsdom không cài hai hàm này; chỉ vá đúng chúng, KHÔNG thay cả `URL` (làm
    // thế là mất luôn constructor mà axios/jsdom đang dùng).
    URL.createObjectURL = () => "blob:stub";
    URL.revokeObjectURL = () => undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock("@/shared/api/http");
    vi.doUnmock("@/shared/api/wms-action-permission");
  });

  async function runOnce() {
    postMock.mockResolvedValue({ export_job_id: "job-347" });
    getMock.mockResolvedValue({
      export_job_id: "job-347",
      status: "READY",
      row_count: 4243,
      download_url: "/api/v1/reports/export/job-347/download",
      error_message: null,
    });
    downloadMock.mockResolvedValue({
      blob: new Blob(["x"]),
      fileName: "lich-su-phieu.xlsx",
    });

    const { runReportExport } = await import("./report-export");
    return runReportExport("xlsx", {
      reportCode: "document-history",
      fileStem: "lich-su-phieu",
      filters: { from_date: "2026-08-01", to_date: "2026-09-09" },
    });
  }

  it("gửi timeout riêng cho request poll trạng thái job", async () => {
    await runOnce();

    expect(getMock).toHaveBeenCalledWith(
      "/reports/export/job-347",
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
    // Không request đơn lẻ nào được bỏ cuộc sớm hơn hạn chót vòng poll (60s),
    // nếu không thông báo cho người dùng do trình duyệt quyết định thay vì do
    // trạng thái job. 10.000 = apiTimeoutMs chung, đúng giá trị đã gây lỗi.
    const config = getMock.mock.calls[0]?.[1] as { timeout: number };
    expect(config.timeout).toBeGreaterThanOrEqual(60000);
  });

  it("gửi timeout riêng cho request tải file", async () => {
    await runOnce();

    expect(downloadMock).toHaveBeenCalledWith(
      "/reports/export/job-347/download",
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
    const config = downloadMock.mock.calls[0]?.[1] as { timeout: number };
    expect(config.timeout).toBeGreaterThanOrEqual(60000);
  });

  it("job FAILED hiển thị đúng câu BE gửi, không nuốt thành lỗi chung", async () => {
    postMock.mockResolvedValue({ export_job_id: "job-347" });
    getMock.mockResolvedValue({
      export_job_id: "job-347",
      status: "FAILED",
      row_count: null,
      download_url: null,
      error_message:
        "Bản PDF chỉ dựng được tối đa 800 dòng (kết quả hiện tại 4.243 dòng). Hãy thu hẹp bộ lọc, hoặc chọn Xuất XLSX nếu cần trọn dữ liệu.",
    });

    const { runReportExport } = await import("./report-export");

    await expect(
      runReportExport("pdf", {
        reportCode: "document-history",
        fileStem: "lich-su-phieu",
        filters: {},
      }),
    ).rejects.toThrow(/tối đa 800 dòng/);
  });
});
