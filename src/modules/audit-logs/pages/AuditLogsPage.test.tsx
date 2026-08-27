import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/modules/audit-logs/services/audit-logs.service", () => ({
  auditLogService: { getAuditLogs: vi.fn() },
}));
vi.mock("@/modules/audit-logs/components/AuditLogDetailDrawer", () => ({
  AuditLogDetailDrawer: ({ open }: { open: boolean }) =>
    open ? <div data-testid="detail-drawer" /> : null,
}));

import { auditLogService } from "@/modules/audit-logs/services/audit-logs.service";
import { AuditLogsPage } from "./AuditLogsPage";

const LOG_ID = "01a042bb-b4b4-7120-80b9-fd91c0ec083f";

const LOGS = [
  {
    id: "log-1",
    actor_id: "user-1",
    actor: {
      user_id: "user-1",
      username: "admin",
      display_name: "Administrator",
      email: "admin@gmail.com",
      phone: null,
      department_id: null,
      status: "ACTIVE",
      created_at: "2026-08-27T10:00:00Z",
      updated_at: "2026-08-27T10:00:00Z",
      deleted_at: null,
    },
    action: "TOKEN_REFRESH",
    object_type: "app_user",
    object_id: LOG_ID,
    module: "SYSTEM" as const,
    reason: null,
    description: `TOKEN_REFRESH app_user #${LOG_ID}`,
    request_id: null,
    result: "SUCCESS" as const,
    error_code: null,
    ip_address: "172.19.0.1",
    before_data: null,
    after_data: null,
    created_at: "2026-08-27T18:05:00Z",
  },
  {
    id: "log-2",
    actor_id: null,
    actor: null,
    action: "CREATE",
    object_type: "document_attachment",
    object_id: "f1e03466-aec2-4a9e-bbe4-9295f917b5df",
    module: "INBOUND" as const,
    reason: null,
    description: "CREATE document_attachment",
    request_id: null,
    result: "SUCCESS" as const,
    error_code: null,
    ip_address: null,
    before_data: null,
    after_data: null,
    created_at: "2026-08-27T18:03:00Z",
  },
];

describe("AuditLogsPage (Nhật ký hệ thống)", () => {
  beforeEach(() => {
    vi.mocked(auditLogService.getAuditLogs).mockReset();
    vi.mocked(auditLogService.getAuditLogs).mockResolvedValue({
      data: LOGS,
      meta: { current_page: 1, per_page: 10, total: 2, last_page: 1 },
    } as never);
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("bố cục đồng bộ các trang khác: toolbar lọc, tổng số bản ghi, STT và checkbox chọn nhiều", async () => {
    renderWithProviders(<AuditLogsPage />);

    expect(await screen.findByText("app_user")).toBeInTheDocument();

    // Toolbar cùng chuẩn WarrantyPage/InventoryPage.
    expect(screen.getByLabelText("Tìm nhật ký hệ thống")).toBeInTheDocument();
    expect(screen.getByLabelText("Lọc phân hệ")).toBeInTheDocument();
    expect(screen.getByLabelText("Lọc hành động")).toBeInTheDocument();
    expect(screen.getByLabelText("Số dòng mỗi trang")).toBeInTheDocument();
    expect(screen.getByText("Tổng 2 bản ghi")).toBeInTheDocument();

    // STT chạy theo trang.
    expect(screen.getByText("STT")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    // Chọn nhiều: 1 checkbox header + 1 checkbox mỗi dòng.
    expect(
      screen.getByLabelText("Chọn tất cả nhật ký trong trang"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(LOGS.length + 1);
  });

  it("UUID đối tượng hiển thị rút gọn, không in nguyên 36 ký tự làm vỡ cột", async () => {
    renderWithProviders(<AuditLogsPage />);
    await screen.findByText("app_user");

    expect(screen.getByText(`#01a042bb…083f`)).toBeInTheDocument();
    // Chuỗi UUID đầy đủ chỉ còn ở tooltip (title), không nằm trong ô Đối tượng.
    expect(screen.queryByText(`#${LOG_ID}`)).not.toBeInTheDocument();
    expect(screen.getByTitle(LOG_ID)).toBeInTheDocument();
  });

  it("chọn tất cả bật khối thao tác hàng loạt và bỏ chọn tắt đi", async () => {
    renderWithProviders(<AuditLogsPage />);
    await screen.findByText("app_user");

    fireEvent.click(screen.getByLabelText("Chọn tất cả nhật ký trong trang"));
    expect(await screen.findByText("Đã chọn 2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Xuất Excel \(2\)/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bỏ chọn" }));
    await waitFor(() => {
      expect(screen.queryByText("Đã chọn 2")).not.toBeInTheDocument();
    });
  });

  it("tick chọn dòng không mở Dialog chi tiết, bấm nút Xem mới mở", async () => {
    renderWithProviders(<AuditLogsPage />);
    await screen.findByText("app_user");

    const rowCheckboxes = screen
      .getAllByRole("checkbox")
      .filter(
        (node) =>
          node.getAttribute("aria-label") !== "Chọn tất cả nhật ký trong trang",
      );
    fireEvent.click(rowCheckboxes[0]);
    expect(screen.queryByTestId("detail-drawer")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Xem chi tiết nhật ký" })[0],
    );
    expect(await screen.findByTestId("detail-drawer")).toBeInTheDocument();
  });
});
