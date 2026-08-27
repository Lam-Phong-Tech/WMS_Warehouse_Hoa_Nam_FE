import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("@/shared/api/http", () => ({
  http: {
    getPage: vi.fn(),
  },
}));

// BE thật cho GET /audit-logs (đọc trực tiếp AuditLogController::index() +
// xác nhận qua Swagger sống astrodev.test8.io.vn) chỉ nhận `page`/`per_page`/
// `q`/`user_id`/`action`/`module` — bản test trước gửi `limit` (sai tên) nên
// BE luôn bỏ qua và trả về page size mặc định (10) bất kể user chọn gì.
describe("auditLogService.getAuditLogs", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let http: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let auditLogService: any;
  beforeAll(async () => {
    const httpMod = await import("@/shared/api/http");
    http = httpMod.http;
    const serviceMod =
      await import("@/modules/audit-logs/services/audit-logs.service");
    auditLogService = serviceMod.auditLogService;
  });

  beforeEach(() => {
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.getPage).mockResolvedValue({ data: [], meta: {} });
  });

  // Bug thật đã gặp (2026-07-07): dùng http.get() thay vì http.getPage() khiến
  // AuditLogsPage đọc `data?.data`/`data?.meta?.total` vào 1 mảng thô không
  // có field .data/.meta → luôn hiện "Chưa có audit log" dù BE có dữ liệu.
  it("dùng http.getPage() để giữ lại meta phân trang (không dùng http.get())", async () => {
    await auditLogService.getAuditLogs({ page: 1, limit: 15 });
    expect(http.getPage).toHaveBeenCalledWith("/audit-logs?page=1&per_page=15");
  });

  it("gửi `per_page` (không phải `limit`) cho tham số kích thước trang", async () => {
    await auditLogService.getAuditLogs({ page: 2, limit: 50 });
    expect(http.getPage).toHaveBeenCalledWith("/audit-logs?page=2&per_page=50");
  });

  it("gửi `q` (không phải `search`) cho tìm kiếm theo mô tả", async () => {
    await auditLogService.getAuditLogs({ q: "tạo phòng ban" });
    expect(http.getPage).toHaveBeenCalledWith(
      `/audit-logs?${new URLSearchParams({ q: "tạo phòng ban" }).toString()}`,
    );
  });

  it("gửi user_id/action/module đúng tên param — user_id là UUID string", async () => {
    await auditLogService.getAuditLogs({
      user_id: "5f6b9b3a-6b8e-4f2a-9c3e-2c0a0f6a1b2c",
      action: "DELETE",
      module: "WARRANTY",
    });
    const calledUrl = vi.mocked(http.getPage).mock.calls[0][0];
    expect(calledUrl).toContain("user_id=5f6b9b3a-6b8e-4f2a-9c3e-2c0a0f6a1b2c");
    expect(calledUrl).toContain("action=DELETE");
    expect(calledUrl).toContain("module=WARRANTY");
  });

  it("không truyền filter nào → gọi endpoint không query string", async () => {
    await auditLogService.getAuditLogs();
    expect(http.getPage).toHaveBeenCalledWith("/audit-logs");
  });
});
