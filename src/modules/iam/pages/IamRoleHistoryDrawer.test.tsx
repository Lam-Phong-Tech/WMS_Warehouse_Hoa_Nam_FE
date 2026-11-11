import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import dayjs from "dayjs";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("@/modules/audit-logs/services/audit-logs.service", () => ({
  auditLogService: { getAuditLogs: vi.fn() },
}));

import { auditLogService } from "@/modules/audit-logs/services/audit-logs.service";
import type { IamRole } from "../types/iam.types";
import { IamRoleHistoryDrawer } from "./IamRoleHistoryDrawer";

const role: IamRole = {
  role_id: "role-1",
  role_code: "ADMIN",
  role_name: "Quản trị hệ thống",
  scope_type: "SYSTEM",
  status: "ACTIVE",
};

describe("IamRoleHistoryDrawer — bộ lọc ngày", () => {
  it("dùng bộ chọn ngày dùng chung và xóa được bộ lọc ngày", async () => {
    vi.mocked(auditLogService.getAuditLogs).mockResolvedValue({
      data: [],
      meta: { total: 0 },
    } as never);

    renderWithProviders(
      <IamRoleHistoryDrawer
        role={role}
        permissions={[]}
        allowed
        onClose={() => {}}
      />,
    );

    const fromField = await screen.findByRole("button", { name: "Từ ngày" });
    expect(fromField).toHaveAttribute(
      "data-date-field",
      "iam-role-history-from",
    );
    expect(document.querySelector('input[type="date"]')).toBeNull();

    const target = dayjs().subtract(5, "day");
    fireEvent.click(fromField);
    const panel = await screen.findByRole("dialog", { name: "Từ ngày" });
    const monthsBack = dayjs()
      .startOf("month")
      .diff(target.startOf("month"), "month");
    for (let index = 0; index < monthsBack; index += 1) {
      fireEvent.click(
        within(panel).getByRole("button", { name: "Tháng trước" }),
      );
    }
    fireEvent.click(
      within(panel).getByRole("button", {
        name: target.format("DD/MM/YYYY"),
      }),
    );

    await waitFor(() =>
      expect(auditLogService.getAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({
          date_from: target.format("YYYY-MM-DD"),
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Bỏ chọn: Từ ngày" }));
    await waitFor(() =>
      expect(auditLogService.getAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ date_from: undefined }),
      ),
    );
  });
});
