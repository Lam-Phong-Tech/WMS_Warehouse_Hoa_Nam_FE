import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginRoute } from "@/app/router/LoginRoute";
import {
  profileFixture,
  preferenceFixture,
} from "@/modules/auth/pages/profile.fixture";
import { AccountLandingPage } from "@/modules/auth/pages/AccountLandingPage";
import { profileService } from "@/modules/auth/services/profile.service";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";

vi.mock("@/modules/auth/services/profile.service", () => ({
  profileService: { getPreferences: vi.fn() },
}));

/** Regression: the login -> authenticated transition used to hard-redirect to
 * the dashboard, so Logout → Login ignored the saved default homepage while a
 * direct `/` visit honored it. */
describe("AccountLandingPage after login", () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.setState({
      isBootstrapped: true,
      isAuthenticated: true,
      profile: profileFixture,
      permissionCodes: ["inbound.view"],
      isSuperAdmin: false,
      isProfileLoaded: true,
    });
    vi.mocked(profileService.getPreferences).mockResolvedValue({
      ...preferenceFixture,
      default_homepage: "inbound",
    });
  });

  it("resolves the saved default homepage when the login route redirects", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[ROUTES.LOGIN]}>
          <Routes>
            <Route element={<LoginRoute />}>
              <Route path={ROUTES.LOGIN} element={<div>Login form</div>} />
            </Route>
            <Route path={ROUTES.HOME} element={<AccountLandingPage />} />
            <Route path={ROUTES.INBOUND} element={<div>Inbound page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Inbound page")).toBeInTheDocument();
  });
});
