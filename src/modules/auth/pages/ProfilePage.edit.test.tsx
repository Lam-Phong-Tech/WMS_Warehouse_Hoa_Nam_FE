import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";
import { authService } from "@/modules/auth/services/auth.service";
import { auditLogService } from "@/modules/audit-logs/services/audit-logs.service";
import type { MeResponse } from "@/modules/auth/types/me.types";
import { useAuthStore } from "@/shared/store/auth.store";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { renderWithProviders } from "@/test/test-utils";

const me: MeResponse = {
  id: "user-1",
  user_id: "user-1",
  name: "Quản trị viên",
  display_name: "Quản trị viên",
  email: "admin@example.test",
  code: "admin",
  phone: "0982622326",
  version: 3,
  status: "ACTIVE",
  roles: [],
  permissions: [],
  warehouse_scope_ids: [],
  company: null,
  branch: null,
  department: null,
  position: null,
  role: null,
  active_context: null,
  available_contexts: [],
};

describe("ProfilePage self-service editing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useLanguageStore.setState({ language: "vi" });
    useAuthStore.setState({
      token: "<profile-test-token>",
      user: me,
      profile: me,
      isAuthenticated: true,
      isProfileLoaded: true,
      permissionCodes: [],
      isSuperAdmin: false,
      currentContext: null,
    });
    vi.spyOn(authService, "mfaStatus").mockResolvedValue({
      enabled: false,
      pending: false,
      required_for_role: false,
      enforced: false,
      must_enroll_now: false,
      recovery_codes_remaining: 0,
    });
    vi.spyOn(auditLogService, "getMyPermissionHistory").mockResolvedValue({
      data: [],
      meta: {},
    });
  });

  it("validates the phone, saves both fields, and refreshes the displayed profile", async () => {
    const update = vi.spyOn(authService, "updateMe").mockResolvedValue({
      ...me,
      name: "Tên mới",
      display_name: "Tên mới",
      phone: "0912345678",
      version: 4,
    });
    renderWithProviders(<ProfilePage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Chỉnh sửa thông tin" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: /Họ và tên/ }), {
      target: { value: "Tên mới" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Số điện thoại/ }), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(
      screen.getByText(/Số điện thoại phải gồm 10 chữ số/),
    ).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: /Số điện thoại/ }), {
      target: { value: "0912345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        {
          display_name: "Tên mới",
          phone: "0912345678",
        },
        3,
      ),
    );
    expect(
      await screen.findByText("Thông tin cá nhân đã được cập nhật."),
    ).toBeInTheDocument();
    expect(useAuthStore.getState().profile?.display_name).toBe("Tên mới");
    expect(useAuthStore.getState().profile?.phone).toBe("0912345678");
  });
});
