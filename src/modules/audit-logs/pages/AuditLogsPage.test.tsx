import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import dayjs from "dayjs";
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

    expect(await screen.findByText("Tài khoản người dùng")).toBeInTheDocument();

    // Toolbar cùng chuẩn WarrantyPage/InventoryPage.
    expect(screen.getByLabelText("Tìm nhật ký hệ thống")).toBeInTheDocument();
    expect(screen.getByLabelText("Lọc phân hệ")).toBeInTheDocument();
    expect(screen.getByLabelText("Lọc hành động")).toBeInTheDocument();
    expect(screen.getByLabelText("Số dòng mỗi trang")).toBeInTheDocument();
    expect(screen.getByText("Tổng 2 bản ghi")).toBeInTheDocument();

    // STT chạy theo trang. Scope trong bảng vì UiPagination (MUI, Part 4 thay
    // antd Pagination vốn bị stub trong test setup) cũng render nút trang "1"
    // thật — query toàn màn sẽ trúng 2 node.
    const table = screen.getByRole("table");
    expect(screen.getByText("STT")).toBeInTheDocument();
    expect(within(table).getByText("1")).toBeInTheDocument();
    expect(within(table).getByText("2")).toBeInTheDocument();

    // Chọn nhiều: 1 checkbox header + 1 checkbox mỗi dòng.
    expect(
      screen.getByLabelText("Chọn tất cả nhật ký trong trang"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(LOGS.length + 1);
  });

  it("UUID đối tượng hiển thị rút gọn, không in nguyên 36 ký tự làm vỡ cột", async () => {
    renderWithProviders(<AuditLogsPage />);
    await screen.findByText("Tài khoản người dùng");

    expect(screen.getByText(`#01a042bb…083f`)).toBeInTheDocument();
    // Chuỗi UUID đầy đủ chỉ còn ở tooltip (title), không nằm trong ô Đối tượng.
    expect(screen.queryByText(`#${LOG_ID}`)).not.toBeInTheDocument();
    expect(screen.getByTitle(LOG_ID)).toBeInTheDocument();
  });

  it("đối tượng có mã nghiệp vụ (BE tra ngược) hiện MÃ thay cho định danh rút gọn", async () => {
    const objectId = "48a72bc5-5577-4681-b5f9-f4258e37b747";
    vi.mocked(auditLogService.getAuditLogs).mockResolvedValue({
      data: [
        {
          ...LOGS[0],
          id: "log-3",
          action: "POST",
          object_type: "stock_document",
          object_id: objectId,
          object_code: "PN-COV-00012",
          module: "INBOUND" as const,
          description: `POST stock_document #${objectId}`,
        },
      ],
      meta: { current_page: 1, per_page: 10, total: 1, last_page: 1 },
    } as never);

    renderWithProviders(<AuditLogsPage />);

    expect(await screen.findByText("PN-COV-00012")).toBeInTheDocument();
    expect(screen.queryByText(/#48a72bc5/)).not.toBeInTheDocument();
    expect(screen.queryByTitle(objectId)).not.toBeInTheDocument();
  });

  it("cột Đối tượng và Mô tả là tiếng Việt, không in enum/tên bảng thô của BE", async () => {
    renderWithProviders(<AuditLogsPage />);
    await screen.findByText("Tài khoản người dùng");

    // `object_type` (tên bảng) chỉ còn ở tooltip, không phải chữ hiển thị.
    expect(screen.queryByText("app_user")).not.toBeInTheDocument();
    expect(screen.getByTitle("app_user")).toBeInTheDocument();

    // `description` của BE là chuỗi ghép máy "{ACTION} {object_type} #{uuid}".
    expect(
      screen.queryByText(`TOKEN_REFRESH app_user #${LOG_ID}`),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Làm mới phiên — Tài khoản người dùng 01a042…ec083f"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Tạo mới — Tệp đính kèm chứng từ f1e034…17b5df"),
    ).toBeInTheDocument();
  });

  it("lọc thời gian dùng lịch 'Từ ngày / Đến ngày', không phải ô datetime của trình duyệt", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<AuditLogsPage />);
    await screen.findByText("Tài khoản người dùng");

    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(screen.getByLabelText("Lọc theo khoảng ngày")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Từ ngày" })).toHaveTextContent(
      /^Từ ngày$/,
    );
    expect(screen.getByRole("button", { name: "Đến ngày" })).toHaveTextContent(
      /^Đến ngày$/,
    );

    // Chọn hôm kia → hôm nay rồi Áp dụng: khoảng gửi lên BE là TRỌN NGÀY.
    const today = dayjs().startOf("day");
    const from = today.subtract(2, "day");
    await user.click(screen.getByRole("button", { name: "Từ ngày" }));
    await user.click(
      screen.getByRole("button", { name: from.format("DD/MM/YYYY") }),
    );
    await user.click(
      screen.getByRole("button", { name: today.format("DD/MM/YYYY") }),
    );
    await user.click(screen.getByRole("button", { name: "Áp dụng" }));

    await waitFor(() => {
      expect(auditLogService.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          date_from: `${from.format("YYYY-MM-DD")} 00:00:00`,
          date_to: `${today.format("YYYY-MM-DD")} 23:59:59`,
        }),
      );
    });
  });

  it("chọn tất cả bật khối thao tác hàng loạt và bỏ chọn tắt đi", async () => {
    renderWithProviders(<AuditLogsPage />);
    await screen.findByText("Tài khoản người dùng");

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
    await screen.findByText("Tài khoản người dùng");

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
