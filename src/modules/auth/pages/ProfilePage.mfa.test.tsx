import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProfilePage } from "@/modules/auth/pages/ProfilePage";
import { authService } from "@/modules/auth/services/auth.service";
import { auditLogService } from "@/modules/audit-logs/services/audit-logs.service";
import type { MfaStatus } from "@/modules/auth/types/mfa.types";

vi.mock("@/modules/auth/services/auth.service", () => ({
  authService: { mfaStatus: vi.fn() },
}));
vi.mock("@/modules/audit-logs/services/audit-logs.service", () => ({
  auditLogService: { getMyPermissionHistory: vi.fn() },
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const status: MfaStatus = {
  enabled: false,
  pending: false,
  required_for_role: false,
  enforced: false,
  must_enroll_now: false,
  recovery_codes_remaining: 0,
};

describe("ProfilePage MFA status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auditLogService.getMyPermissionHistory).mockResolvedValue({
      data: [],
      meta: {} as Awaited<
        ReturnType<typeof auditLogService.getMyPermissionHistory>
      >["meta"],
    });
  });

  it("shows the registered state after MFA is enabled", async () => {
    vi.mocked(authService.mfaStatus).mockResolvedValue({
      ...status,
      enabled: true,
    });
    renderPage();

    expect(
      await screen.findByText(
        "Tài khoản của bạn đã đăng ký xác thực hai bước.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Đang bật")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem chi tiết" })).toHaveAttribute(
      "href",
      "/profile/mfa",
    );
    expect(screen.queryByRole("link", { name: "Bắt đầu đăng ký" })).toBeNull();
  });

  it("shows the setup action only when MFA is disabled", async () => {
    vi.mocked(authService.mfaStatus).mockResolvedValue(status);
    renderPage();

    expect(
      await screen.findByRole("link", { name: "Bắt đầu đăng ký" }),
    ).toHaveAttribute("href", "/profile/mfa");
    expect(
      screen.queryByText("Tài khoản của bạn đã đăng ký xác thực hai bước."),
    ).toBeNull();
  });
});
