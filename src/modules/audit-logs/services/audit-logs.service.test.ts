import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("@/shared/api/http", () => ({
  http: {
    getPage: vi.fn(),
  },
}));

// BE thật cho GET /audit-logs chỉ nhận `page`/`limit`/`q`/`user_id`/`action`/
// `module` (xác nhận qua Swagger thật + gọi trực tiếp endpoint,
// `?page=1&limit=15`) — trước đây FE gửi `per_page`/`search` sai tên, khiến
// BE bỏ qua và luôn trả về page size mặc định bất kể user chọn gì.
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
    expect(http.getPage).toHaveBeenCalledWith("/audit-logs?page=1&limit=15");
  });

  it("gửi `limit` (không phải `per_page`) cho tham số kích thước trang", async () => {
    await auditLogService.getAuditLogs({ page: 2, limit: 50 });
    expect(http.getPage).toHaveBeenCalledWith("/audit-logs?page=2&limit=50");
  });

  it("gửi `q` (không phải `search`) cho tìm kiếm theo mô tả", async () => {
    await auditLogService.getAuditLogs({ q: "tạo phòng ban" });
    expect(http.getPage).toHaveBeenCalledWith(
      `/audit-logs?${new URLSearchParams({ q: "tạo phòng ban" }).toString()}`,
    );
  });

  it("gửi user_id/action/module đúng tên param", async () => {
    await auditLogService.getAuditLogs({
      user_id: 1,
      action: "DELETE",
      module: "Departments",
    });
    const calledUrl = vi.mocked(http.getPage).mock.calls[0][0];
    expect(calledUrl).toContain("user_id=1");
    expect(calledUrl).toContain("action=DELETE");
    expect(calledUrl).toContain("module=Departments");
  });

  it("không truyền filter nào → gọi endpoint không query string", async () => {
    await auditLogService.getAuditLogs();
    expect(http.getPage).toHaveBeenCalledWith("/audit-logs");
  });
});
